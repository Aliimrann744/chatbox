import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

@Injectable()
export class PublicApiKeysService {
  constructor(private readonly prisma: PrismaService) {}

  async createKey(userId: string, dto: CreateApiKeyDto) {
    // 32 raw bytes → ~43 char base64url. Prefix namespaces the key for humans.
    const secret = randomBytes(32).toString('base64url');
    const rawKey = `pk_live_${secret}`;
    const keyHash = createHash('sha256').update(rawKey).digest('hex');
    const keyPrefix = rawKey.slice(0, 12); // e.g. "pk_live_aBcD"

    const record = await this.prisma.publicApiKey.create({
      data: {
        ownerId: userId,
        label: dto.label?.trim() || 'API key',
        keyHash,
        keyPrefix,
        canSendText: dto.canSendText ?? true,
        canSendVoice: dto.canSendVoice ?? true,
      },
      select: {
        id: true,
        label: true,
        keyPrefix: true,
        canSendText: true,
        canSendVoice: true,
        createdAt: true,
      },
    });

    return {
      ...record,
      // Returned exactly once. The caller MUST store it now — we hold only
      // the hash from here on.
      key: rawKey,
    };
  }

  async listKeys(userId: string) {
    return this.prisma.publicApiKey.findMany({
      where: { ownerId: userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        label: true,
        keyPrefix: true,
        canSendText: true,
        canSendVoice: true,
        lastUsedAt: true,
        revokedAt: true,
        createdAt: true,
      },
    });
  }

  async revokeKey(userId: string, keyId: string) {
    const key = await this.prisma.publicApiKey.findUnique({ where: { id: keyId } });
    if (!key) throw new NotFoundException('API key not found');
    if (key.ownerId !== userId) {
      throw new ForbiddenException('You do not own this API key');
    }
    if (key.revokedAt) return { success: true, alreadyRevoked: true };

    await this.prisma.publicApiKey.update({
      where: { id: keyId },
      data: { revokedAt: new Date() },
    });
    return { success: true };
  }
}
