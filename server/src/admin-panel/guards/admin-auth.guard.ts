import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request, Response } from 'express';
import { AdminAuthService } from '../admin-auth.service';

export const ADMIN_PUBLIC_KEY = 'adminPublic';
/**
 * Mark an admin handler as not requiring a session — login form, login POST,
 * logout. Everything else under /admin-panel/* requires a valid session.
 */
export const AdminPublic = () => SetMetadata(ADMIN_PUBLIC_KEY, true);

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AdminAuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      ADMIN_PUBLIC_KEY,
      [context.getHandler(), context.getClass()],
    );

    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const principal = await this.auth.readSession(req);

    if (principal) {
      req.admin = principal;
      return true;
    }

    if (isPublic) return true;

    // For HTML requests (Accept: text/html or no Accept header from a click),
    // redirect the browser to the login page. For JSON callers (the
    // dashboard's fetch() calls), return 401 so the page-level handler can
    // bounce the user.
    const acceptsHtml =
      typeof req.headers.accept === 'string' &&
      req.headers.accept.includes('text/html');

    if (acceptsHtml) {
      res
        .status(302)
        .setHeader('Location', '/admin-panel?adminError=session_expired')
        .end();
      return false;
    }

    throw new UnauthorizedException('Admin session required');
  }
}
