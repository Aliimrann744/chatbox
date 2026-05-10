import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Request, Response } from 'express';
import { createHash, timingSafeEqual } from 'crypto';
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_TTL_SECONDS,
  DEFAULT_ADMIN_PASSWORD,
  DEFAULT_ADMIN_SESSION_SECRET,
  DEFAULT_ADMIN_USERNAME,
} from './admin-panel.constants';

export interface AdminPrincipal {
  username: string;
  iat: number;
  exp: number;
}

declare module 'express-serve-static-core' {
  interface Request {
    admin?: AdminPrincipal;
  }
}

@Injectable()
export class AdminAuthService {
  private readonly logger = new Logger(AdminAuthService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
  ) {}

  /**
   * Constant-time credential comparison. Reads creds from env on every call
   * so rotating ADMIN_USERNAME / ADMIN_PASSWORD does not require a restart.
   */
  verifyCredentials(username: string, password: string): boolean {
    const expectedUser =
      this.config.get<string>('ADMIN_USERNAME') ?? DEFAULT_ADMIN_USERNAME;
    const expectedPass =
      this.config.get<string>('ADMIN_PASSWORD') ?? DEFAULT_ADMIN_PASSWORD;
    return (
      this.safeEqual(username ?? '', expectedUser) &&
      this.safeEqual(password ?? '', expectedPass)
    );
  }

  /**
   * Sign an admin session JWT and write it to an HttpOnly cookie. Cookie
   * lifetime matches token lifetime so the browser drops it on expiry.
   */
  async issueSession(res: Response, username: string): Promise<void> {
    const secret = this.getSessionSecret();
    const token = await this.jwt.signAsync(
      { sub: username, role: 'admin' },
      { secret, expiresIn: ADMIN_SESSION_TTL_SECONDS },
    );

    const isProd = (process.env.NODE_ENV ?? '').toLowerCase() === 'production';
    res.cookie(ADMIN_SESSION_COOKIE, token, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/admin-panel',
      maxAge: ADMIN_SESSION_TTL_SECONDS * 1000,
    });
  }

  clearSession(res: Response): void {
    res.clearCookie(ADMIN_SESSION_COOKIE, { path: '/admin-panel' });
  }

  /**
   * Verify the admin_session cookie. Returns the decoded principal or null.
   * Express does not parse cookies by default — we read the raw header and
   * extract just the cookie we care about.
   */
  async readSession(req: Request): Promise<AdminPrincipal | null> {
    const token = this.extractCookie(req, ADMIN_SESSION_COOKIE);
    if (!token) return null;

    try {
      const payload = await this.jwt.verifyAsync<{
        sub: string;
        iat: number;
        exp: number;
      }>(token, { secret: this.getSessionSecret() });
      return { username: payload.sub, iat: payload.iat, exp: payload.exp };
    } catch {
      return null;
    }
  }

  private getSessionSecret(): string {
    const secret =
      this.config.get<string>('ADMIN_SESSION_SECRET') ??
      DEFAULT_ADMIN_SESSION_SECRET;
    if (secret === DEFAULT_ADMIN_SESSION_SECRET) {
      this.logger.warn(
        '[admin-panel] ADMIN_SESSION_SECRET is unset — using insecure default. Set it in env for production.',
      );
    }
    return secret;
  }

  private extractCookie(req: Request, name: string): string | null {
    const header = req.headers?.cookie;
    if (typeof header !== 'string' || header.length === 0) return null;
    const parts = header.split(';');
    for (const part of parts) {
      const eq = part.indexOf('=');
      if (eq < 0) continue;
      if (part.slice(0, eq).trim() === name) {
        return decodeURIComponent(part.slice(eq + 1).trim());
      }
    }
    return null;
  }

  private safeEqual(a: string, b: string): boolean {
    // timingSafeEqual requires equal-length buffers, so hash both first.
    const ha = createHash('sha256').update(a).digest();
    const hb = createHash('sha256').update(b).digest();
    return timingSafeEqual(ha, hb);
  }
}
