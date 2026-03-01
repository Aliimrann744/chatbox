import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { CallService } from './call.service';
import { AgoraService } from './agora.service';
import { CallType, CallStatus } from '@prisma/client';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/call',
})
export class CallGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  // Store connected users: Map<userId, socketId>
  private connectedUsers = new Map<string, string>();

  // Store active calls: Map<callId, { callerId, receiverId }>
  private activeCalls = new Map<string, { callerId: string; receiverId: string }>();

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private callService: CallService,
    private agoraService: AgoraService,
  ) {}

  // ==================== CONNECTION HANDLING ====================

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth.token ||
        client.handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      const userId = payload.sub;
      this.connectedUsers.set(userId, client.id);
      client.data.userId = userId;
      client.join(`user_${userId}`);

      console.log(`Call: User ${userId} connected`);
      client.emit('connected', { userId });
    } catch (error) {
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    if (userId) {
      this.connectedUsers.delete(userId);

      // End any active calls
      for (const [callId, call] of this.activeCalls.entries()) {
        if (call.callerId === userId || call.receiverId === userId) {
          await this.handleCallEnd(client, { callId });
        }
      }

      console.log(`Call: User ${userId} disconnected`);
    }
  }

  // ==================== CALL INITIATION ====================

  @SubscribeMessage('call_initiate')
  async handleCallInitiate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { receiverId: string; type: 'VOICE' | 'VIDEO' },
  ) {
    const callerId = client.data.userId;

    try {
      // Create call record
      const call = await this.callService.createCall(
        callerId,
        data.receiverId,
        data.type as CallType,
      );

      // Store active call
      this.activeCalls.set(call.id, {
        callerId,
        receiverId: data.receiverId,
      });

      // Check if receiver is online
      const receiverSocketId = this.connectedUsers.get(data.receiverId);
      const receiverOnline = !!receiverSocketId;

      if (receiverSocketId) {
        // Send incoming call notification to receiver
        this.server.to(receiverSocketId).emit('incoming_call', {
          callId: call.id,
          caller: call.caller,
          type: data.type,
        });
      } else {
        console.log(
          `Call: Receiver ${data.receiverId} is offline, cannot deliver incoming_call`,
        );
      }

      // Return call info to caller (including receiver online status)
      return {
        success: true,
        callId: call.id,
        receiverOnline,
        call,
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ==================== CALL ACCEPTANCE/REJECTION ====================

  @SubscribeMessage('call_accept')
  async handleCallAccept(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { callId: string },
  ) {
    try {
      const call = await this.callService.acceptCall(data.callId);

      // Generate Agora tokens for both participants
      const channelName = data.callId;
      const callerUid = this.agoraService.userIdToUid(call.callerId);
      const receiverUid = this.agoraService.userIdToUid(call.receiverId);
      const appId = this.agoraService.getAppId();

      const callerToken = this.agoraService.generateRtcToken(
        channelName,
        callerUid,
      );
      const receiverToken = this.agoraService.generateRtcToken(
        channelName,
        receiverUid,
      );

      // Notify caller that call was accepted (with Agora credentials)
      const callerSocketId = this.connectedUsers.get(call.callerId);
      if (callerSocketId) {
        this.server.to(callerSocketId).emit('call_accepted', {
          callId: data.callId,
          agora: {
            appId,
            token: callerToken,
            channelName,
            uid: callerUid,
          },
        });
      }

      // Return Agora credentials to receiver (the accepting client)
      return {
        success: true,
        agora: {
          appId,
          token: receiverToken,
          channelName,
          uid: receiverUid,
        },
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('call_decline')
  async handleCallDecline(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { callId: string },
  ) {
    try {
      const call = await this.callService.declineCall(data.callId);

      // Remove from active calls
      this.activeCalls.delete(data.callId);

      // Notify caller
      const callerSocketId = this.connectedUsers.get(call.callerId);
      if (callerSocketId) {
        this.server.to(callerSocketId).emit('call_declined', {
          callId: data.callId,
        });
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('call_busy')
  async handleCallBusy(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { callId: string },
  ) {
    try {
      const call = await this.callService.endCall(data.callId, CallStatus.BUSY);

      this.activeCalls.delete(data.callId);

      const callerSocketId = this.connectedUsers.get(call.callerId);
      if (callerSocketId) {
        this.server.to(callerSocketId).emit('call_busy', {
          callId: data.callId,
        });
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ==================== WEBRTC SIGNALING ====================

  @SubscribeMessage('call_offer')
  async handleCallOffer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { callId: string; offer: any },
  ) {
    try {
      const call = await this.callService.getCall(data.callId);
      const receiverSocketId = this.connectedUsers.get(call.receiverId);

      if (receiverSocketId) {
        this.server.to(receiverSocketId).emit('call_offer', {
          callId: data.callId,
          offer: data.offer,
        });
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('call_answer')
  async handleCallAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { callId: string; answer: any },
  ) {
    try {
      const call = await this.callService.getCall(data.callId);
      const callerSocketId = this.connectedUsers.get(call.callerId);

      if (callerSocketId) {
        this.server.to(callerSocketId).emit('call_answer', {
          callId: data.callId,
          answer: data.answer,
        });
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('call_ice_candidate')
  async handleIceCandidate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { callId: string; candidate: any },
  ) {
    try {
      const call = await this.callService.getCall(data.callId);
      const userId = client.data.userId;

      // Send to the other participant
      const targetId =
        userId === call.callerId ? call.receiverId : call.callerId;
      const targetSocketId = this.connectedUsers.get(targetId);

      if (targetSocketId) {
        this.server.to(targetSocketId).emit('call_ice_candidate', {
          callId: data.callId,
          candidate: data.candidate,
        });
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ==================== CALL END ====================

  @SubscribeMessage('call_end')
  async handleCallEnd(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { callId: string },
  ) {
    try {
      const call = await this.callService.endCall(data.callId);

      // Remove from active calls
      this.activeCalls.delete(data.callId);

      // Notify the other participant
      const userId = client.data.userId;
      const targetId =
        userId === call.callerId ? call.receiverId : call.callerId;
      const targetSocketId = this.connectedUsers.get(targetId);

      if (targetSocketId) {
        this.server.to(targetSocketId).emit('call_ended', {
          callId: data.callId,
          duration: call.duration,
        });
      }

      return { success: true, duration: call.duration };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ==================== CALL TIMEOUT ====================

  @SubscribeMessage('call_timeout')
  async handleCallTimeout(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { callId: string },
  ) {
    try {
      const call = await this.callService.missCall(data.callId);

      this.activeCalls.delete(data.callId);

      // Notify receiver about missed call
      const receiverSocketId = this.connectedUsers.get(call.receiverId);
      if (receiverSocketId) {
        this.server.to(receiverSocketId).emit('call_missed', {
          callId: data.callId,
          caller: call.caller,
        });
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
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
