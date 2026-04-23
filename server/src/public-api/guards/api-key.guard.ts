import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

export const API_KEY_HEADER = 'x-api-key';

export interface PublicApiCaller {
  keyId: string;
  keyPrefix: string;
  canSendText: boolean;
  canSendVoice: boolean;
  owner: {
    id: string;
    name: string;
    phone: string | null;
    countryCode: string;
  };
}

declare module 'express-serve-static-core' {
  interface Request {
    apiCaller?: PublicApiCaller;
  }
}

function hashKey(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();

    const headerValue =
      req.headers?.[API_KEY_HEADER] || req.headers?.[API_KEY_HEADER.toUpperCase()];
    const raw = Array.isArray(headerValue) ? headerValue[0] : headerValue;

    if (!raw || typeof raw !== 'string') {
      throw new UnauthorizedException('API key is required');
    }

    const keyHash = hashKey(raw.trim());

    const key = await this.prisma.publicApiKey.findUnique({
      where: { keyHash },
      include: {
        owner: {
          select: { id: true, name: true, phone: true, countryCode: true },
        },
      },
    });

    if (!key) {
      throw new UnauthorizedException('Invalid API key');
    }

    if (key.revokedAt) {
      throw new ForbiddenException('API key has been revoked');
    }

    // Fire-and-forget — we don't want to block the request on this update.
    this.prisma.publicApiKey
      .update({ where: { id: key.id }, data: { lastUsedAt: new Date() } })
      .catch(() => undefined);

    req.apiCaller = {
      keyId: key.id,
      keyPrefix: key.keyPrefix,
      canSendText: key.canSendText,
      canSendVoice: key.canSendVoice,
      owner: key.owner,
    };

    return true;
  }
}
