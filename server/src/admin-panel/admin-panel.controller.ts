import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { AdminAuthService } from './admin-auth.service';
import { AdminAuthGuard, AdminPublic } from './guards/admin-auth.guard';
import { AdminPanelService } from './admin-panel.service';
import {
  renderApiKeyDetail,
  renderApiKeysList,
  renderAuditPage,
  renderDashboard,
  renderIssueKeyPage,
  renderMessagesLog,
  renderRevokeKeyPage,
  renderUserDetail,
  renderUsersList,
} from './views/pages';
import { renderLogin } from './views/layout';

/**
 * HTML routes for /admin-panel/*. The whole tree is excluded from the global
 * /api prefix in main.ts and is gated by AdminAuthGuard. Login + logout are
 * the only handlers that bypass the guard (via @Public from the JwtAuthGuard
 * standpoint — and explicitly by the guard itself recognising them as
 * unauthenticated entry points).
 */
@Controller('admin-panel')
@Public() // bypass the global JwtAuthGuard — admin uses its own session
@UseGuards(AdminAuthGuard)
export class AdminPanelController {
  constructor(
    private readonly auth: AdminAuthService,
    private readonly service: AdminPanelService,
  ) {}

  // ─────────────── Login form / landing ───────────────

  @Get()
  @AdminPublic()
  async root(@Req() req: Request, @Res() res: Response, @Query('adminError') adminError?: string) {
    res.setHeader('Cache-Control', 'no-store');
    const principal = await this.auth.readSession(req);
    if (principal) {
      return res
        .status(302)
        .setHeader('Location', '/admin-panel/dashboard')
        .end();
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(renderLogin(typeof adminError === 'string' ? adminError : undefined));
  }

  // ─────────────── Login POST (rate-limited) ───────────────

  @Post('login')
  @AdminPublic()
  @Throttle({ default: { ttl: 600_000, limit: 10 } }) // 10 attempts / 10 min / IP
  async login(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: { username?: string; password?: string },
  ) {
    const username = (body?.username ?? '').toString();
    const password = (body?.password ?? '').toString();
    const ipAddress =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      null;
    const userAgent =
      typeof req.headers['user-agent'] === 'string'
        ? req.headers['user-agent']
        : null;

    const ok = this.auth.verifyCredentials(username, password);

    await this.service.recordLogin({
      username: username || '(empty)',
      success: ok,
      ipAddress,
      userAgent,
      reason: ok ? 'ok' : 'invalid_credentials',
    });

    if (!ok) {
      // Per the spec: bounce back to where they came from, or `/`.
      const referer =
        typeof req.headers.referer === 'string' && req.headers.referer.length
          ? req.headers.referer
          : '/';
      const target = referer.includes('?')
        ? referer + '&adminError=invalid_credentials'
        : referer + '?adminError=invalid_credentials';
      return res.status(302).setHeader('Location', target).end();
    }

    await this.auth.issueSession(res, username);
    return res
      .status(302)
      .setHeader('Location', '/admin-panel/dashboard')
      .end();
  }

  @Post('logout')
  @AdminPublic()
  logout(@Res() res: Response) {
    this.auth.clearSession(res);
    return res.status(302).setHeader('Location', '/').end();
  }

  // ─────────────── Pages (require session) ───────────────

  @Get('dashboard')
  dashboard(@Res() res: Response) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(renderDashboard());
  }

  @Get('api-keys')
  apiKeysPage(@Res() res: Response) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(renderApiKeysList());
  }

  @Get('api-keys/:id')
  apiKeyDetailPage(@Res() res: Response, @Req() req: Request) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    const id = (req.params as any).id ?? '';
    return res.send(renderApiKeyDetail(id));
  }

  @Get('users')
  usersPage(@Res() res: Response) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(renderUsersList());
  }

  @Get('users/:id')
  userDetailPage(@Res() res: Response, @Req() req: Request) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    const id = (req.params as any).id ?? '';
    return res.send(renderUserDetail(id));
  }

  @Get('messages')
  messagesPage(@Res() res: Response) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(renderMessagesLog());
  }

  @Get('audit')
  auditPage(@Res() res: Response) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(renderAuditPage());
  }

  @Get('issue-key')
  issueKeyPage(@Res() res: Response) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(renderIssueKeyPage());
  }

  @Get('revoke-key')
  revokeKeyPage(@Res() res: Response) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(renderRevokeKeyPage());
  }
}
