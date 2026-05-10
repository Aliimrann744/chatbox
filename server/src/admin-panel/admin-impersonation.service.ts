import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { PublicApiKeysService } from '../public-api/public-api-keys.service';
import { CreateApiKeyDto } from '../public-api/dto/create-api-key.dto';
import { phoneLookupCandidates } from '../public-api/utils/phone.util';

interface UserJwtPayload {
  sub: string;
  phone: string;
  iat?: number;
  exp?: number;
}

/**
 * Lets the superadmin act on behalf of an existing, verified user without
 * routing through the OTP flow. The minted access token is byte-identical
 * to one issued by the real /api/auth/verify-otp handler — same payload
 * shape, same signing secret, same expiry — so it works seamlessly with
 * every endpoint the user themselves could hit (notably the existing
 * /api/public-api-keys CRUD).
 *
 * Security boundary preserved:
 *   - We refuse impersonation for !isVerified users (JwtStrategy would
 *     reject the token anyway; we surface a clear error early).
 *   - Tokens carry the standard expiry; if anything is misused, it dies
 *     in 15 minutes by default.
 *   - Key creation/revocation are delegated to PublicApiKeysService, which
 *     already enforces ownerId checks — so the admin can never accidentally
 *     revoke a key belonging to a different user.
 */
@Injectable()
export class AdminImpersonationService {
  private readonly logger = new Logger(AdminImpersonationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly keysService: PublicApiKeysService,
  ) {}

  // ───────────── Step 1: identify user → issue access token ─────────────

  async issueTokenForUser(input: { name: string; phone: string }) {
    const name = (input.name ?? '').trim();
    const phone = (input.phone ?? '').trim();
    if (!name) throw new BadRequestException('Name is required');
    if (!phone) throw new BadRequestException('Phone is required');

    const candidates = phoneLookupCandidates(phone);
    if (candidates.length === 0) {
      throw new BadRequestException('Invalid phone number format');
    }

    const user = await this.prisma.user.findFirst({
      where: { phone: { in: candidates } },
      select: {
        id: true,
        name: true,
        phone: true,
        countryCode: true,
        email: true,
        avatar: true,
        isVerified: true,
        createdAt: true,
      },
    });

    if (!user) {
      // Exact wording the user asked for in the spec.
      throw new NotFoundException(
        'This user is not existing right now in our system',
      );
    }

    // Defense: name confirmation. We don't require an exact match (admin
    // might type "Ali" for "Ali Imran"), but the supplied name must be a
    // case-insensitive substring of the stored name OR vice-versa.
    if (!this.namesLooseMatch(name, user.name)) {
      throw new BadRequestException(
        `A user with that phone exists, but the name does not match (stored as "${user.name}").`,
      );
    }

    if (!user.isVerified) {
      // The /api/public-api-keys endpoint is gated by JwtStrategy which
      // refuses tokens for unverified users — issuing one here would just
      // produce a token that 401s immediately. Refuse early with a clear
      // message so the admin knows the real reason.
      throw new ForbiddenException(
        'User exists but has not completed verification — they must verify before keys can be issued.',
      );
    }

    const expiresIn =
      this.config.get<string>('JWT_EXPIRES_IN') || '15m';
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, phone: user.phone || user.email || '' },
      {
        secret: this.config.get<string>('JWT_SECRET'),
        expiresIn,
      },
    );

    this.logger.log(
      `[admin-impersonation] token issued for user=${user.id} (${user.name}) by superadmin`,
    );

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn, // human-readable string ("15m") — not seconds
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        countryCode: user.countryCode,
        email: user.email,
        avatar: user.avatar,
        createdAt: user.createdAt,
      },
    };
  }

  // ───────────── Step 2: create key (caller pastes token back) ─────────────

  async createKey(input: { accessToken: string; dto: CreateApiKeyDto }) {
    const user = await this.resolveUserFromToken(input.accessToken);
    const result = await this.keysService.createKey(user.id, input.dto);
    this.logger.log(
      `[admin-impersonation] key created for user=${user.id} prefix=${result.keyPrefix} by superadmin`,
    );
    return {
      ...result,
      // Echo back which user this was created under so the admin can sanity
      // check before handing the raw key to anyone.
      forUser: {
        id: user.id,
        name: user.name,
        phone: user.phone,
      },
    };
  }

  // ───────────── Step 3: list keys ─────────────

  async listKeys(input: { accessToken: string }) {
    const user = await this.resolveUserFromToken(input.accessToken);
    const items = await this.keysService.listKeys(user.id);
    return {
      forUser: { id: user.id, name: user.name, phone: user.phone },
      total: items.length,
      items,
    };
  }

  // ───────────── Step 4: revoke a single key ─────────────

  async revokeKey(input: { accessToken: string; keyId: string }) {
    const user = await this.resolveUserFromToken(input.accessToken);
    const keyId = (input.keyId ?? '').trim();
    if (!keyId) throw new BadRequestException('keyId is required');
    const result = await this.keysService.revokeKey(user.id, keyId);
    this.logger.log(
      `[admin-impersonation] key revoked id=${keyId} user=${user.id} by superadmin`,
    );
    return result;
  }

  // ───────────── helpers ─────────────

  private async resolveUserFromToken(token: string) {
    const trimmed = (token ?? '').trim();
    if (!trimmed) {
      throw new BadRequestException('Access token is required');
    }
    let payload: UserJwtPayload;
    try {
      payload = await this.jwt.verifyAsync<UserJwtPayload>(trimmed, {
        secret: this.config.get<string>('JWT_SECRET'),
      });
    } catch (err: any) {
      const reason =
        err?.name === 'TokenExpiredError'
          ? 'Access token has expired — issue a new one in step 1.'
          : 'Access token is invalid.';
      throw new UnauthorizedException(reason);
    }

    if (!payload?.sub) {
      throw new UnauthorizedException('Access token payload is missing user id');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        name: true,
        phone: true,
        isVerified: true,
      },
    });
    if (!user) {
      throw new NotFoundException('User no longer exists');
    }
    if (!user.isVerified) {
      throw new ForbiddenException('User is not verified');
    }
    return user;
  }

  private namesLooseMatch(a: string, b: string): boolean {
    const x = a.trim().toLowerCase();
    const y = (b ?? '').trim().toLowerCase();
    if (!x || !y) return false;
    return x === y || x.includes(y) || y.includes(x);
  }
}
