import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';
import {
  PublicApiMessageStatus,
  PublicApiMessageType,
} from '@prisma/client';

/**
 * Audit interceptor for /api/public/v1/messages/*. Runs *after* ApiKeyGuard
 * so req.apiCaller is populated, and writes one PublicApiMessageLog row per
 * attempt — success OR failure. The log write is fire-and-forget: a DB
 * hiccup here must not break message delivery, and we never mutate the
 * outgoing response body.
 *
 * What we capture:
 *   - apiKeyId / ownerId from the authenticated caller (denormalized)
 *   - recipientPhone (raw input) and recipientUserId (resolved, if any)
 *   - type (TEXT | VOICE) inferred from the route
 *   - status, errorReason, requestDurationMs, ip, ua, externalId
 *   - contentPreview (TEXT only, capped to 280 chars to avoid PII bloat)
 */
@Injectable()
export class PublicApiMessageLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(PublicApiMessageLogInterceptor.name);

  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest<Request>();
    const start = Date.now();
    const type: PublicApiMessageType = req.path?.endsWith('/voice')
      ? PublicApiMessageType.VOICE
      : PublicApiMessageType.TEXT;

    return next.handle().pipe(
      tap((response) => {
        // The handler resolved successfully — record SUCCESS.
        this.writeLog({
          req,
          type,
          status: PublicApiMessageStatus.SUCCESS,
          durationMs: Date.now() - start,
          recipientUserId: response?.data?.recipient?.id ?? null,
        });
      }),
      catchError((err) => {
        // Record FAILED before re-throwing — caller still sees the original
        // exception with its status code and shape unchanged.
        this.writeLog({
          req,
          type,
          status: PublicApiMessageStatus.FAILED,
          durationMs: Date.now() - start,
          errorReason: this.formatError(err),
        });
        return throwError(() => err);
      }),
    );
  }

  private writeLog(args: {
    req: Request;
    type: PublicApiMessageType;
    status: PublicApiMessageStatus;
    durationMs: number;
    recipientUserId?: string | null;
    errorReason?: string;
  }) {
    const { req, type, status, durationMs, recipientUserId, errorReason } =
      args;
    const caller = req.apiCaller;

    // No caller means ApiKeyGuard rejected before us — nothing to log here.
    if (!caller) return;

    const body = (req.body ?? {}) as Record<string, any>;
    const recipientPhone =
      typeof body.phone === 'string' ? body.phone.slice(0, 60) : '';
    const externalId =
      typeof body.externalId === 'string'
        ? body.externalId.slice(0, 191)
        : null;
    const contentPreview =
      type === PublicApiMessageType.TEXT && typeof body.content === 'string'
        ? body.content.slice(0, 280)
        : null;

    // Multer attaches the uploaded voice file at req.file.
    const file = (req as any).file as
      | { size?: number; mimetype?: string }
      | undefined;

    const ipAddress =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      null;
    const userAgent =
      typeof req.headers['user-agent'] === 'string'
        ? req.headers['user-agent'].slice(0, 500)
        : null;

    this.prisma.publicApiMessageLog
      .create({
        data: {
          apiKeyId: caller.keyId,
          ownerId: caller.owner.id,
          recipientUserId: recipientUserId ?? null,
          recipientPhone,
          type,
          status,
          errorReason: errorReason ? errorReason.slice(0, 1000) : null,
          externalId,
          contentPreview,
          fileSize: file?.size ?? null,
          mediaDurationMs:
            typeof body.duration === 'number'
              ? Math.max(0, Math.round(body.duration * 1000))
              : null,
          requestDurationMs: durationMs,
          ipAddress: ipAddress ? ipAddress.slice(0, 64) : null,
          userAgent,
        },
      })
      .catch((err) => {
        this.logger.warn(
          `[public-api] message log write failed: ${err?.message ?? err}`,
        );
      });
  }

  private formatError(err: any): string {
    if (!err) return 'unknown_error';
    if (typeof err.getStatus === 'function') {
      const status = err.getStatus();
      const msg =
        typeof err.message === 'string' ? err.message : 'http_exception';
      return `${status}:${msg}`;
    }
    if (err.message) return String(err.message);
    return String(err);
  }
}
