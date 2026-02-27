import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RtcTokenBuilder, RtcRole } from 'agora-token';

@Injectable()
export class AgoraService {
  private readonly appId: string;
  private readonly appCertificate: string;

  constructor(private configService: ConfigService) {
    this.appId = this.configService.get<string>('AGORA_APP_ID') || '';
    this.appCertificate =
      this.configService.get<string>('AGORA_APP_CERTIFICATE') || '';
  }

  generateRtcToken(
    channelName: string,
    uid: number,
    role: 'publisher' | 'subscriber' = 'publisher',
    expiry: number = 3600,
  ): string {
    const rtcRole =
      role === 'publisher' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expiry;

    return RtcTokenBuilder.buildTokenWithUid(
      this.appId,
      this.appCertificate,
      channelName,
      uid,
      rtcRole,
      privilegeExpiredTs,
      privilegeExpiredTs,
    );
  }

  /**
   * Convert a CUID string to a deterministic positive 32-bit integer
   * for use as an Agora UID.
   */
  userIdToUid(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0; // Convert to 32-bit integer
    }
    // Ensure positive value (Agora UIDs must be positive)
    return Math.abs(hash) || 1;
  }

  getAppId(): string {
    return this.appId;
  }
}
