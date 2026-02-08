import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CallType, CallStatus } from '@prisma/client';

@Injectable()
export class CallService {
  constructor(private prisma: PrismaService) {}

  async createCall(
    callerId: string,
    receiverId: string,
    type: CallType,
  ) {
    // Check if receiver exists
    const receiver = await this.prisma.user.findUnique({
      where: { id: receiverId },
    });

    if (!receiver) {
      throw new NotFoundException('User not found');
    }

    // Check if blocked
    const isBlocked = await this.isBlocked(callerId, receiverId);
    if (isBlocked) {
      throw new ForbiddenException('Cannot call this user');
    }

    // Create call record
    const call = await this.prisma.call.create({
      data: {
        callerId,
        receiverId,
        type,
        status: CallStatus.RINGING,
      },
      include: {
        caller: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
        receiver: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
    });

    return call;
  }

  async acceptCall(callId: string) {
    const call = await this.prisma.call.update({
      where: { id: callId },
      data: {
        status: CallStatus.ANSWERED,
        answeredAt: new Date(),
      },
      include: {
        caller: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
        receiver: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
    });

    return call;
  }

  async endCall(callId: string, status?: CallStatus) {
    const call = await this.prisma.call.findUnique({
      where: { id: callId },
    });

    if (!call) {
      throw new NotFoundException('Call not found');
    }

    // Calculate duration if call was answered
    let duration: number | null = null;
    if (call.answeredAt) {
      duration = Math.floor(
        (new Date().getTime() - call.answeredAt.getTime()) / 1000,
      );
    }

    const finalStatus = status || (call.answeredAt ? CallStatus.ENDED : CallStatus.MISSED);

    const updatedCall = await this.prisma.call.update({
      where: { id: callId },
      data: {
        status: finalStatus,
        endedAt: new Date(),
        duration,
      },
      include: {
        caller: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
        receiver: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
    });

    return updatedCall;
  }

  async declineCall(callId: string) {
    return this.endCall(callId, CallStatus.DECLINED);
  }

  async missCall(callId: string) {
    return this.endCall(callId, CallStatus.MISSED);
  }

  async getCall(callId: string) {
    const call = await this.prisma.call.findUnique({
      where: { id: callId },
      include: {
        caller: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
        receiver: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
    });

    if (!call) {
      throw new NotFoundException('Call not found');
    }

    return call;
  }

  async getCallHistory(userId: string, page: number = 1, limit: number = 50) {
    const skip = (page - 1) * limit;

    const [calls, total] = await Promise.all([
      this.prisma.call.findMany({
        where: {
          OR: [{ callerId: userId }, { receiverId: userId }],
        },
        include: {
          caller: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
          receiver: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
        },
        orderBy: { startedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.call.count({
        where: {
          OR: [{ callerId: userId }, { receiverId: userId }],
        },
      }),
    ]);

    // Add direction info
    const callsWithDirection = calls.map((call) => ({
      ...call,
      direction: call.callerId === userId ? 'outgoing' : 'incoming',
      otherUser: call.callerId === userId ? call.receiver : call.caller,
    }));

    return {
      calls: callsWithDirection,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + calls.length < total,
      },
    };
  }

  async deleteCallHistory(userId: string, callId: string) {
    const call = await this.prisma.call.findUnique({
      where: { id: callId },
    });

    if (!call) {
      throw new NotFoundException('Call not found');
    }

    if (call.callerId !== userId && call.receiverId !== userId) {
      throw new ForbiddenException('You cannot delete this call record');
    }

    await this.prisma.call.delete({
      where: { id: callId },
    });

    return { success: true };
  }

  private async isBlocked(userId: string, targetId: string): Promise<boolean> {
    const blocked = await this.prisma.blockedUser.findFirst({
      where: {
        OR: [
          { blockerId: userId, blockedId: targetId },
          { blockerId: targetId, blockedId: userId },
        ],
      },
    });
    return !!blocked;
  }
}
