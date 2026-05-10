import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { AdminAuthGuard } from './guards/admin-auth.guard';
import { AdminImpersonationService } from './admin-impersonation.service';

interface IssueTokenBody {
  name?: string;
  phone?: string;
}

interface CreateKeyBody {
  accessToken?: string;
  label?: string;
  canSendText?: boolean;
  canSendVoice?: boolean;
}

interface ListKeysBody {
  accessToken?: string;
}

interface RevokeKeyBody {
  accessToken?: string;
  keyId?: string;
}

/**
 * Admin-side endpoints that drive the "issue API key on behalf of a user"
 * workflow. Sits at /admin-panel/api/impersonate/* — same exclude-from-/api
 * tree as the rest of the panel and gated by AdminAuthGuard.
 */
@Controller('admin-panel/api/impersonate')
@Public() // bypass global JwtAuthGuard — admin uses its own session
@UseGuards(AdminAuthGuard)
export class AdminImpersonationController {
  constructor(private readonly service: AdminImpersonationService) {}

  @Post('issue-token')
  issueToken(@Body() body: IssueTokenBody) {
    return this.service.issueTokenForUser({
      name: body.name ?? '',
      phone: body.phone ?? '',
    });
  }

  @Post('create-key')
  createKey(@Body() body: CreateKeyBody) {
    return this.service.createKey({
      accessToken: body.accessToken ?? '',
      dto: {
        label: body.label,
        canSendText: body.canSendText,
        canSendVoice: body.canSendVoice,
      },
    });
  }

  @Post('list-keys')
  listKeys(@Body() body: ListKeysBody) {
    return this.service.listKeys({ accessToken: body.accessToken ?? '' });
  }

  @Post('revoke-key')
  revokeKey(@Body() body: RevokeKeyBody) {
    return this.service.revokeKey({
      accessToken: body.accessToken ?? '',
      keyId: body.keyId ?? '',
    });
  }
}
