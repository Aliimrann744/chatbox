import { WebSocketGateway, WebSocketServer, SubscribeMessage, OnGatewayConnection, OnGatewayDisconnect, ConnectedSocket, MessageBody } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { CallService } from './call.service';
import { ChatService } from '../chat/chat.service';
import { ChatGateway } from '../chat/chat.gateway';
import { CallType, CallStatus } from '@prisma/client';
import { NotificationService } from '../notification/notification.service';

@WebSocketGateway({ cors: { origin: '*', }, namespace: '/call' })

export class CallGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private connectedUsers = new Map<string, string>();
  private activeCalls = new Map<string, { callerId: string; receiverId: string }>();
  // Grace-period timers keyed by `${callId}:${userId}`. When a participant's
  // socket drops during an ANSWERED call (e.g. screen lock, transient network),
  // we wait before ending the call so they have time to reconnect.
  private pendingDisconnects = new Map<string, ReturnType<typeof setTimeout>>();
  private static DISCONNECT_GRACE_MS = 30_000;

  constructor(private jwtService: JwtService, private configService: ConfigService, private callService: CallService, private chatService: ChatService, private chatGateway: ChatGateway, private notificationService: NotificationService) {}

  private clearPendingDisconnects(userId: string): string[] {
    const clearedCallIds: string[] = [];
    for (const [key, timer] of this.pendingDisconnects.entries()) {
      const [callId, uid] = key.split(':');
      if (uid === userId) {
        clearTimeout(timer);
        this.pendingDisconnects.delete(key);
        clearedCallIds.push(callId);
      }
    }
    return clearedCallIds;
  }

  private clearPendingDisconnectsForCall(callId: string) {
    for (const key of Array.from(this.pendingDisconnects.keys())) {
      if (key.startsWith(`${callId}:`)) {
        const timer = this.pendingDisconnects.get(key);
        if (timer) clearTimeout(timer);
        this.pendingDisconnects.delete(key);
      }
    }
  }

  // ==================== ICE SERVERS ====================

  private getIceServers() {
    const iceServers: any[] = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }];
    const turnUrl = this.configService.get<string>('TURN_SERVER_URL');

    if (turnUrl) {
      iceServers.push({
        urls: JSON.parse(turnUrl),
        username: this.configService.get<string>('TURN_USERNAME') || '',
        credential: this.configService.get<string>('TURN_CREDENTIAL') || '',
      });
    }

    return iceServers;
  }

  // ==================== CONNECTION HANDLING ====================

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth.token || client.handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token, { secret: this.configService.get<string>('JWT_SECRET') });
      const userId = payload.sub;
      this.connectedUsers.set(userId, client.id);
      client.data.userId = userId;
      client.join(`user_${userId}`);

      // If this user had pending disconnect timers (e.g. they just unlocked
      // their screen and reconnected), cancel them and tell the peer the
      // participant is back so any "Reconnecting..." UI can clear.
      const resumedCallIds = this.clearPendingDisconnects(userId);
      for (const callId of resumedCallIds) {
        const call = this.activeCalls.get(callId);
        if (!call) continue;
        const peerId = call.callerId === userId ? call.receiverId : call.callerId;
        const peerSocketId = this.connectedUsers.get(peerId);
        if (peerSocketId) {
          this.server.to(peerSocketId).emit('call_peer_reconnected', { callId, userId });
        }
        // Tell the rejoining client the call is still live.
        client.emit('call_resumed', { callId });
        console.log(`Call: User ${userId} reconnected — call ${callId} resumed`);
      }

      console.log(`Call: User ${userId} connected`);
      client.emit('connected', { userId });
    } catch (error) {
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    if (!userId) return;

    this.connectedUsers.delete(userId);

    for (const [callId, call] of this.activeCalls.entries()) {
      const isParticipant = call.callerId === userId || call.receiverId === userId;
      if (!isParticipant) continue;

      let status: string;
      try {
        const callRecord = await this.callService.getCall(callId);
        status = callRecord.status;
      } catch (err: any) {
        console.log(`Call: Error checking call ${callId} status, cleaning up:`, err?.message);
        this.activeCalls.delete(callId);
        continue;
      }

      // Pre-answer: preserve the original behaviour. If the CALLER drops
      // during RINGING they gave up; if the RECEIVER drops, let FCM push
      // carry the ring so they can still accept after the app wakes up.
      if (status !== 'ANSWERED') {
        if (call.callerId === userId) {
          console.log(`Call: Caller ${userId} disconnected during ${status}, ending call ${callId}`);
          await this.handleCallEnd(client, { callId });
        } else {
          console.log(`Call: Receiver ${userId} disconnected while call ${callId} is ${status}, keeping call alive`);
        }
        continue;
      }

      // ANSWERED: the call is in progress. Don't end it yet — the disconnect
      // may just be a screen lock or brief network blip. Give a grace window
      // for the socket to reconnect. Tell the peer so their UI can show
      // "Reconnecting...".
      const peerId = call.callerId === userId ? call.receiverId : call.callerId;
      const peerSocketId = this.connectedUsers.get(peerId);
      if (peerSocketId) {
        this.server.to(peerSocketId).emit('call_peer_disconnected', { callId, userId });
      }

      const key = `${callId}:${userId}`;
      // If a timer already exists for this participant (shouldn't, but defensive), clear it.
      const existing = this.pendingDisconnects.get(key);
      if (existing) clearTimeout(existing);

      const timer = setTimeout(async () => {
        this.pendingDisconnects.delete(key);
        // Only end the call if the user is still disconnected.
        if (this.connectedUsers.has(userId)) return;
        // And only if the call wasn't already ended by another path
        // (e.g. the peer's grace timer fired first, or explicit end).
        if (!this.activeCalls.has(callId)) return;
        console.log(`Call: Grace period expired — user ${userId} did not reconnect, ending call ${callId}`);
        try {
          const ended = await this.callService.endCall(callId);
          this.activeCalls.delete(callId);
          this.clearPendingDisconnectsForCall(callId);
          const peerSocket = this.connectedUsers.get(peerId);
          if (peerSocket) {
            this.server.to(peerSocket).emit('call_ended', { callId, duration: ended.duration });
          }
          await this.sendCallLogToChat(ended.callerId, ended.receiverId, ended.type, ended.status, ended.duration);
        } catch (err: any) {
          console.error(`Call: Failed to end call ${callId} after grace period:`, err?.message);
        }
      }, CallGateway.DISCONNECT_GRACE_MS);

      this.pendingDisconnects.set(key, timer);
      console.log(`Call: User ${userId} disconnected from active call ${callId} — grace period started`);
    }

    console.log(`Call: User ${userId} disconnected`);
  }

  // ==================== CALL INITIATION ====================

  @SubscribeMessage('call_initiate')
  async handleCallInitiate(@ConnectedSocket() client: Socket, @MessageBody() data: { receiverId: string; type: 'VOICE' | 'VIDEO' }) {
    const callerId = client.data.userId;

    try {
      const call = await this.callService.createCall( callerId, data.receiverId, data.type as CallType);
      this.activeCalls.set(call.id, { callerId, receiverId: data.receiverId });

      const receiverSocketId = this.connectedUsers.get(data.receiverId);
      const receiverOnline = !!receiverSocketId;

      // ALWAYS send FCM push for calls — even if user appears online.
      // The socket may be stale (app in background but not yet disconnected).
      // FCM is the only reliable way to wake a backgrounded/killed app.
      const caller = await this.notificationService.getUserWithDetails(callerId);
      console.log(`Call: Sending FCM call notification from "${caller?.name}" to user ${data.receiverId} (socketOnline=${receiverOnline})`);
      this.notificationService.sendCallNotification(
        data.receiverId,
        caller?.name || 'Unknown',
        caller?.avatar || null,
        call.id,
        callerId,
        data.type,
      ).then(() => {
        console.log(`Call: FCM call notification sent successfully`);
      }).catch((err) =>
        console.error('Call: FCM push notification FAILED:', err.message),
      );

      // Also send via socket if user appears online (instant delivery for foreground app)
      if (receiverSocketId) {
        console.log(`Call: Also sending incoming_call via socket to ${data.receiverId}`);
        this.server.to(receiverSocketId).emit('incoming_call', { callId: call.id, caller: call.caller, type: data.type });
      }

      return { success: true, callId: call.id, receiverOnline, call };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // ==================== CALL ACCEPTANCE/REJECTION ====================

  @SubscribeMessage('call_accept')
  async handleCallAccept(@ConnectedSocket() client: Socket, @MessageBody() data: { callId: string }) {
    try {
      // Check if call is still active (not already ended/missed/declined)
      const existingCall = await this.callService.getCall(data.callId);
      if (existingCall.status !== 'RINGING') {
        return { success: false, error: `Call is no longer available (status: ${existingCall.status})` };
      }

      const call = await this.callService.acceptCall(data.callId);
      const iceServers = this.getIceServers();

      // Notify caller that call was accepted (with ICE server config)
      const callerSocketId = this.connectedUsers.get(call.callerId);
      if (callerSocketId) {
        this.server.to(callerSocketId).emit('call_accepted', { callId: data.callId, iceServers });
      }

      // Return ICE server config to receiver (the accepting client)
      return { success: true, iceServers };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('call_decline')
  async handleCallDecline(@ConnectedSocket() client: Socket, @MessageBody() data: { callId: string }) {
    try {
      this.clearPendingDisconnectsForCall(data.callId);
      const call = await this.callService.declineCall(data.callId);
      this.activeCalls.delete(data.callId);

      // Notify caller
      const callerSocketId = this.connectedUsers.get(call.callerId);
      if (callerSocketId) {
        this.server.to(callerSocketId).emit('call_declined', { callId: data.callId });
      }

      // Send call log message to chat
      await this.sendCallLogToChat(call.callerId,call.receiverId,call.type,'DECLINED',null);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('call_busy')
  async handleCallBusy(@ConnectedSocket() client: Socket, @MessageBody() data: { callId: string }) {
    try {
      this.clearPendingDisconnectsForCall(data.callId);
      const call = await this.callService.endCall(data.callId, CallStatus.BUSY);
      this.activeCalls.delete(data.callId);
      const callerSocketId = this.connectedUsers.get(call.callerId);
      if (callerSocketId) {
        this.server.to(callerSocketId).emit('call_busy', { callId: data.callId });
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // ==================== WEBRTC SIGNALING ====================

  // ==================== CALL REJOIN ====================
  // Clients emit this after their socket reconnects during an active call
  // (e.g. after the user unlocked their screen past the grace window).
  // If the call is still active, tell them. If it ended while they were
  // offline, tell them that so their UI can reset.
  @SubscribeMessage('call_rejoin')
  async handleCallRejoin(@ConnectedSocket() client: Socket, @MessageBody() data: { callId: string }) {
    try {
      const userId = client.data.userId;
      const call = this.activeCalls.get(data.callId);
      if (!call) {
        client.emit('call_ended', { callId: data.callId, duration: null });
        return { success: false, ended: true };
      }
      const isParticipant = call.callerId === userId || call.receiverId === userId;
      if (!isParticipant) {
        client.emit('call_ended', { callId: data.callId, duration: null });
        return { success: false, ended: true };
      }
      // Still active — clear any grace-period timer and notify the peer.
      const key = `${data.callId}:${userId}`;
      const pending = this.pendingDisconnects.get(key);
      if (pending) {
        clearTimeout(pending);
        this.pendingDisconnects.delete(key);
      }
      const peerId = call.callerId === userId ? call.receiverId : call.callerId;
      const peerSocketId = this.connectedUsers.get(peerId);
      if (peerSocketId) {
        this.server.to(peerSocketId).emit('call_peer_reconnected', { callId: data.callId, userId });
      }
      client.emit('call_resumed', { callId: data.callId });
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('call_offer')
  async handleCallOffer(@ConnectedSocket() client: Socket, @MessageBody() data: { callId: string; offer: any }) {
    try {
      const call = await this.callService.getCall(data.callId);
      const receiverSocketId = this.connectedUsers.get(call.receiverId);
      if (receiverSocketId) {
        this.server.to(receiverSocketId).emit('call_offer', { callId: data.callId, offer: data.offer });
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('call_answer')
  async handleCallAnswer(@ConnectedSocket() client: Socket, @MessageBody() data: { callId: string; answer: any }) {
    try {
      const call = await this.callService.getCall(data.callId);
      const callerSocketId = this.connectedUsers.get(call.callerId);
      if (callerSocketId) {
        this.server.to(callerSocketId).emit('call_answer', { callId: data.callId, answer: data.answer });
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('call_ice_candidate')
  async handleIceCandidate(@ConnectedSocket() client: Socket, @MessageBody() data: { callId: string; candidate: any }) {
    try {
      const call = await this.callService.getCall(data.callId);
      const userId = client.data.userId;

      // Send to the other participant
      const targetId = userId === call.callerId ? call.receiverId : call.callerId;
      const targetSocketId = this.connectedUsers.get(targetId);

      if (targetSocketId) {
        this.server.to(targetSocketId).emit('call_ice_candidate', { callId: data.callId, candidate: data.candidate });
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // ==================== MEDIA STATUS (MUTE / VIDEO) ====================

  @SubscribeMessage('call_mute_status')
  async handleMuteStatus(@ConnectedSocket() client: Socket, @MessageBody() data: { callId: string; isMuted: boolean }) {
    try {
      const userId = client.data.userId;
      const call = this.activeCalls.get(data.callId);

      // Resolve the peer either from the in-memory active call map or by querying the DB
      let targetId: string | undefined;
      if (call) {
        targetId = userId === call.callerId ? call.receiverId : call.callerId;
      } else {
        const record = await this.callService.getCall(data.callId);
        targetId = userId === record.callerId ? record.receiverId : record.callerId;
      }

      if (!targetId) return { success: false, error: 'Peer not found' };

      const targetSocketId = this.connectedUsers.get(targetId);
      if (targetSocketId) {
        this.server.to(targetSocketId).emit('call_mute_status', {
          callId: data.callId,
          userId,
          isMuted: !!data.isMuted,
        });
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('call_video_status')
  async handleVideoStatus(@ConnectedSocket() client: Socket, @MessageBody() data: { callId: string; isVideoEnabled: boolean }) {
    try {
      const userId = client.data.userId;
      const call = this.activeCalls.get(data.callId);

      let targetId: string | undefined;
      if (call) {
        targetId = userId === call.callerId ? call.receiverId : call.callerId;
      } else {
        const record = await this.callService.getCall(data.callId);
        targetId = userId === record.callerId ? record.receiverId : record.callerId;
      }

      if (!targetId) return { success: false, error: 'Peer not found' };

      const targetSocketId = this.connectedUsers.get(targetId);
      if (targetSocketId) {
        this.server.to(targetSocketId).emit('call_video_status', {
          callId: data.callId,
          userId,
          isVideoEnabled: !!data.isVideoEnabled,
        });
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // ==================== CALL END ====================

  @SubscribeMessage('call_end')
  async handleCallEnd(@ConnectedSocket() client: Socket, @MessageBody() data: { callId: string }) {
    try {
      // Explicit end from a participant — cancel any grace-period timers so
      // the call doesn't get re-ended when a timer eventually fires.
      this.clearPendingDisconnectsForCall(data.callId);
      const call = await this.callService.endCall(data.callId);
      this.activeCalls.delete(data.callId);

      // Notify the other participant
      const userId = client.data.userId;
      const targetId = userId === call.callerId ? call.receiverId : call.callerId;
      const targetSocketId = this.connectedUsers.get(targetId);

      if (targetSocketId) {
        this.server.to(targetSocketId).emit('call_ended', { callId: data.callId, duration: call.duration });
      }

      // Send call log message to chat
      await this.sendCallLogToChat(call.callerId, call.receiverId, call.type, call.status, call.duration);
      return { success: true, duration: call.duration };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // ==================== CALL TIMEOUT ====================

  @SubscribeMessage('call_timeout')
  async handleCallTimeout(@ConnectedSocket() client: Socket, @MessageBody() data: { callId: string }) {
    try {
      this.clearPendingDisconnectsForCall(data.callId);
      const call = await this.callService.missCall(data.callId);
      this.activeCalls.delete(data.callId);

      // Notify receiver about missed call
      const receiverSocketId = this.connectedUsers.get(call.receiverId);
      if (receiverSocketId) {
        this.server.to(receiverSocketId).emit('call_missed', { callId: data.callId, caller: call.caller });
      } else {
        // Receiver offline — send missed call push
        const caller = await this.notificationService.getUserWithDetails(call.callerId);
        this.notificationService.sendMissedCallNotification(
          call.receiverId,
          caller?.name || 'Unknown',
          call.type,
        ).catch((err) =>
          console.error('Missed call push failed:', err.message),
        );
      }

      // Send call log message to chat
      await this.sendCallLogToChat(call.callerId, call.receiverId, call.type, 'MISSED', null);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // ==================== CALL LOG HELPER ====================

  private async sendCallLogToChat(callerId: string,receiverId: string, callType: 'VOICE' | 'VIDEO', callStatus: string, duration: number | null) {
    try {
      const message = await this.chatService.createCallLogMessage(callerId, receiverId, callType, callStatus, duration,);
      this.chatGateway.sendToUser(callerId, 'new_message', message);
      this.chatGateway.sendToUser(receiverId, 'new_message', message);
    } catch (error) {
      console.error('Failed to send call log to chat:', error);
    }
  }

  // ==================== UTILITY METHODS ====================

  getSocketId(userId: string): string | undefined {
    return this.connectedUsers.get(userId);
  }

  isUserOnline(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }
}
