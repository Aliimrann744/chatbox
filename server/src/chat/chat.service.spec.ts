import { ChatService } from './chat.service';

describe('ChatService presence privacy', () => {
  const prisma = {
    blockedUser: { findFirst: jest.fn() },
    user: { findUnique: jest.fn() },
    contact: { findUnique: jest.fn() },
    chatMember: { findUnique: jest.fn() },
  };
  const service = new ChatService(prisma as any);

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.blockedUser.findFirst.mockResolvedValue(null);
  });

  it('returns immediate online and last-seen state when visible to everyone', async () => {
    const lastSeen = new Date('2026-07-05T10:00:00.000Z');
    prisma.user.findUnique.mockResolvedValue({
      id: 'target',
      isOnline: true,
      lastSeen,
      lastSeenPrivacy: 'EVERYONE',
    });

    await expect(service.getPresenceForViewer('viewer', 'target')).resolves.toEqual({
      userId: 'target',
      isOnline: true,
      lastSeen,
    });
  });

  it('hides presence when contacts-only privacy does not include the viewer', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'target',
      isOnline: true,
      lastSeen: new Date(),
      lastSeenPrivacy: 'CONTACTS',
    });
    prisma.contact.findUnique.mockResolvedValue(null);

    await expect(service.getPresenceForViewer('viewer', 'target')).resolves.toEqual({
      userId: 'target',
      isOnline: false,
      lastSeen: null,
    });
  });

  it('does not expose presence across a block', async () => {
    prisma.blockedUser.findFirst.mockResolvedValue({ id: 'block' });
    await expect(service.getPresenceForViewer('viewer', 'target')).resolves.toBeNull();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('rejects malformed message cursors before querying messages', async () => {
    prisma.chatMember.findUnique.mockResolvedValue({ userId: 'viewer', leftAt: null });
    await expect(service.getChatMessages('chat', 'viewer', 1, 50, 'not-a-cursor')).rejects.toThrow(
      'Invalid message cursor',
    );
  });
});
