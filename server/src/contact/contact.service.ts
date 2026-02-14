import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PrivacySetting } from '@prisma/client';
import { DeviceContact } from './dto/sync-contacts.dto';

@Injectable()
export class ContactService {
  constructor(private prisma: PrismaService) {}

  // ==================== CONTACT SYNC ====================

  async syncContacts(
    userId: string,
    phoneNumbers?: string[],
    contacts?: DeviceContact[],
  ) {
    // Build phone-to-name map from new format
    const phoneToName = new Map<string, string>();
    if (contacts && contacts.length > 0) {
      contacts.forEach((c) => {
        const normalized = this.normalizePhoneNumber(c.phone);
        phoneToName.set(normalized, c.name);
      });
    }

    // Collect all phone numbers (from both old and new format)
    const allPhones: string[] = [];
    if (contacts && contacts.length > 0) {
      allPhones.push(...contacts.map((c) => this.normalizePhoneNumber(c.phone)));
    }
    if (phoneNumbers && phoneNumbers.length > 0) {
      allPhones.push(...phoneNumbers.map((p) => this.normalizePhoneNumber(p)));
    }

    if (allPhones.length === 0) {
      return this.getContacts(userId);
    }

    // Deduplicate
    const normalizedNumbers = [...new Set(allPhones)];

    // Find registered users with these phone numbers
    const registeredUsers = await this.prisma.user.findMany({
      where: {
        phone: { in: normalizedNumbers },
        isVerified: true,
        id: { not: userId },
      },
      select: {
        id: true,
        phone: true,
        name: true,
      },
    });

    // Auto-add contacts: filter blocked, then create/update
    await Promise.all(
      registeredUsers.map(async (user) => {
        const isBlocked = await this.isBlocked(userId, user.id);
        if (isBlocked) return;

        const deviceName = phoneToName.get(user.phone) || null;

        const existingContact = await this.prisma.contact.findUnique({
          where: {
            userId_contactId: {
              userId,
              contactId: user.id,
            },
          },
        });

        if (!existingContact) {
          // Create new contact with device name as nickname
          await this.prisma.contact.create({
            data: {
              userId,
              contactId: user.id,
              nickname: deviceName,
            },
          });
        } else if (deviceName && existingContact.nickname !== deviceName) {
          // Update nickname if device name changed
          await this.prisma.contact.update({
            where: { id: existingContact.id },
            data: { nickname: deviceName },
          });
        }
      }),
    );

    // Return the full contacts list (consistent shape)
    return this.getContacts(userId);
  }

  // ==================== CONTACT MANAGEMENT ====================

  async getContacts(userId: string) {
    const contacts = await this.prisma.contact.findMany({
      where: { userId },
      include: {
        contact: {
          select: {
            id: true,
            phone: true,
            name: true,
            avatar: true,
            about: true,
            isOnline: true,
            lastSeen: true,
          },
        },
      },
      orderBy: {
        contact: {
          name: 'asc',
        },
      },
    });

    return contacts.map((c) => ({
      id: c.id,
      contactId: c.contactId,
      nickname: c.nickname,
      ...c.contact,
    }));
  }

  async addContact(userId: string, contactId: string, nickname?: string) {
    // Check if contact user exists
    const contactUser = await this.prisma.user.findUnique({
      where: { id: contactId },
    });

    if (!contactUser) {
      throw new NotFoundException('User not found');
    }

    // Check if already a contact
    const existingContact = await this.prisma.contact.findUnique({
      where: {
        userId_contactId: {
          userId,
          contactId,
        },
      },
    });

    if (existingContact) {
      throw new ConflictException('Contact already exists');
    }

    // Check if blocked
    const isBlocked = await this.isBlocked(userId, contactId);
    if (isBlocked) {
      throw new ForbiddenException('Cannot add blocked user as contact');
    }

    // Create contact
    const contact = await this.prisma.contact.create({
      data: {
        userId,
        contactId,
        nickname,
      },
      include: {
        contact: {
          select: {
            id: true,
            phone: true,
            name: true,
            avatar: true,
            about: true,
            isOnline: true,
            lastSeen: true,
          },
        },
      },
    });

    return {
      id: contact.id,
      contactId: contact.contactId,
      nickname: contact.nickname,
      ...contact.contact,
    };
  }

  async updateContact(
    userId: string,
    contactId: string,
    nickname: string | null,
  ) {
    const contact = await this.prisma.contact.findUnique({
      where: {
        userId_contactId: {
          userId,
          contactId,
        },
      },
    });

    if (!contact) {
      throw new NotFoundException('Contact not found');
    }

    return this.prisma.contact.update({
      where: { id: contact.id },
      data: { nickname },
    });
  }

  async removeContact(userId: string, contactId: string) {
    const contact = await this.prisma.contact.findUnique({
      where: {
        userId_contactId: {
          userId,
          contactId,
        },
      },
    });

    if (!contact) {
      throw new NotFoundException('Contact not found');
    }

    await this.prisma.contact.delete({
      where: { id: contact.id },
    });

    return { success: true };
  }

  // ==================== BLOCKING ====================

  async blockUser(userId: string, blockedId: string) {
    // Check if already blocked
    const existingBlock = await this.prisma.blockedUser.findUnique({
      where: {
        blockerId_blockedId: {
          blockerId: userId,
          blockedId,
        },
      },
    });

    if (existingBlock) {
      throw new ConflictException('User is already blocked');
    }

    // Create block
    await this.prisma.blockedUser.create({
      data: {
        blockerId: userId,
        blockedId,
      },
    });

    // Remove from contacts if exists
    await this.prisma.contact.deleteMany({
      where: {
        OR: [
          { userId, contactId: blockedId },
          { userId: blockedId, contactId: userId },
        ],
      },
    });

    return { success: true };
  }

  async unblockUser(userId: string, blockedId: string) {
    const block = await this.prisma.blockedUser.findUnique({
      where: {
        blockerId_blockedId: {
          blockerId: userId,
          blockedId,
        },
      },
    });

    if (!block) {
      throw new NotFoundException('User is not blocked');
    }

    await this.prisma.blockedUser.delete({
      where: { id: block.id },
    });

    return { success: true };
  }

  async getBlockedUsers(userId: string) {
    const blockedUsers = await this.prisma.blockedUser.findMany({
      where: { blockerId: userId },
      include: {
        blocked: {
          select: {
            id: true,
            name: true,
            avatar: true,
            phone: true,
          },
        },
      },
    });

    return blockedUsers.map((b) => ({
      id: b.id,
      blockedAt: b.createdAt,
      user: b.blocked,
    }));
  }

  // ==================== SEARCH ====================

  async searchUsers(userId: string, query: string) {
    const users = await this.prisma.user.findMany({
      where: {
        id: { not: userId },
        isVerified: true,
        OR: [
          { name: { contains: query } },
          { phone: { contains: query } },
          { email: { contains: query } },
        ],
      },
      select: {
        id: true,
        name: true,
        avatar: true,
        phone: true,
        about: true,
        isOnline: true,
      },
      take: 20,
    });

    // Filter out blocked users
    const filteredUsers = await Promise.all(
      users.map(async (user) => {
        const isBlocked = await this.isBlocked(userId, user.id);
        if (isBlocked) return null;
        return user;
      }),
    );

    return filteredUsers.filter(Boolean);
  }

  // ==================== HELPER METHODS ====================

  async isBlocked(userId: string, targetId: string): Promise<boolean> {
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

  private normalizePhoneNumber(phone: string): string {
    // Remove spaces, dashes, parentheses
    return phone.replace(/[\s\-\(\)]/g, '');
  }

  private shouldShowField(
    privacy: PrivacySetting,
    isContact: any,
  ): boolean {
    switch (privacy) {
      case PrivacySetting.EVERYONE:
        return true;
      case PrivacySetting.CONTACTS:
        return !!isContact;
      case PrivacySetting.NOBODY:
        return false;
      default:
        return true;
    }
  }
}
