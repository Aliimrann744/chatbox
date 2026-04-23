/* eslint-disable */
/**
 * One-shot seeder for the pre-configured public API key (value lives in
 * PUBLIC_API_TEST_KEY in .env). Inserts a row into `public_api_keys` with
 * the key's SHA-256 hash so the ApiKeyGuard will accept it.
 *
 * Usage:
 *   node scripts/seed-public-api-key.js                  # picks the first verified user as owner
 *   node scripts/seed-public-api-key.js <ownerUserId>    # owner explicitly chosen
 *
 * Re-runs are safe: if the key already exists (same hash) it prints the
 * existing row's id instead of erroring out.
 */
require('dotenv').config();
const { createHash } = require('crypto');
const { PrismaClient } = require('@prisma/client');

(async () => {
  const raw = (process.env.PUBLIC_API_TEST_KEY || '').trim();
  if (!raw) {
    console.error('PUBLIC_API_TEST_KEY is not set in .env');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    let ownerId = process.argv[2];

    if (!ownerId) {
      const candidate = await prisma.user.findFirst({
        where: { isVerified: true },
        orderBy: { createdAt: 'asc' },
        select: { id: true, name: true, phone: true, countryCode: true, email: true },
      });
      if (!candidate) {
        console.error('No verified user found. Pass an owner userId as the first argument.');
        process.exit(1);
      }
      ownerId = candidate.id;
      console.log(
        `Using first verified user as owner:\n  id=${candidate.id}\n  name=${candidate.name}\n  phone=${candidate.countryCode || ''}${candidate.phone || ''}\n  email=${candidate.email || '-'}`,
      );
    } else {
      const owner = await prisma.user.findUnique({ where: { id: ownerId }, select: { id: true } });
      if (!owner) {
        console.error(`User ${ownerId} not found.`);
        process.exit(1);
      }
    }

    const keyHash = createHash('sha256').update(raw).digest('hex');
    const keyPrefix = raw.slice(0, 12);

    const existing = await prisma.publicApiKey.findUnique({ where: { keyHash } });
    if (existing) {
      console.log(`\nKey already seeded (id=${existing.id}, revokedAt=${existing.revokedAt}).`);
      console.log(`Use it as:  x-api-key: ${raw}`);
      return;
    }

    const created = await prisma.publicApiKey.create({
      data: {
        ownerId,
        label: 'Postman test key',
        keyHash,
        keyPrefix,
        canSendText: true,
        canSendVoice: true,
      },
      select: { id: true, keyPrefix: true, createdAt: true },
    });

    console.log('\n✔ Seeded public API key:');
    console.log(`  id        = ${created.id}`);
    console.log(`  prefix    = ${created.keyPrefix}`);
    console.log(`  ownerId   = ${ownerId}`);
    console.log(`  createdAt = ${created.createdAt.toISOString()}`);
    console.log(`\nUse it as:  x-api-key: ${raw}`);
  } catch (err) {
    console.error('Seeder failed:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
