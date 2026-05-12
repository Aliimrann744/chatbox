require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const DELETED_LABEL = 'deleted account';

function pickFallbackName(user) {
  const phone = (user.phone || '').trim();
  const countryCode = (user.countryCode || '').trim();
  if (phone) {
    if (countryCode && !phone.startsWith('+')) return `${countryCode}${phone}`;
    return phone;
  }
  const email = (user.email || '').trim();
  if (email) {
    const local = email.split('@')[0];
    if (local) return local;
  }
  return '';
}

(async () => {
  const dryRun = process.argv.includes('--dry-run');
  const prisma = new PrismaClient();

  const summary = {
    scanned: 0,
    replacedDeletedLabel: 0,
    filledEmptyName: 0,
    leftBlank: 0,
  };

  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        phone: true,
        countryCode: true,
        email: true,
      },
    });

    summary.scanned = users.length;
    console.log(`Scanning ${users.length} user(s)...`);
    if (dryRun) console.log('(dry-run — no rows will be updated)\n');

    for (const user of users) {
      const current = (user.name || '').trim();
      const isDeletedLabel = current.toLowerCase() === DELETED_LABEL;
      const isEmpty = current === '';

      if (!isDeletedLabel && !isEmpty) continue;

      const fallback = pickFallbackName(user);
      const next = fallback;

      if (next === current) {
        // Nothing useful to put here — they have no phone, no email, and
        // their current name is already empty. Skip without claiming a fix.
        summary.leftBlank += 1;
        continue;
      }

      const reason = isDeletedLabel ? 'replaced "Deleted Account"' : 'filled empty name';
      const phoneLabel =
        (user.countryCode || '') + (user.phone || '') || '(no phone)';
      console.log(
        `  ${user.id}  [${reason}]  "${current}" -> "${next}"  (phone=${phoneLabel}, email=${user.email || '-'})`,
      );

      if (!dryRun) {
        await prisma.user.update({
          where: { id: user.id },
          data: { name: next },
        });
      }

      if (isDeletedLabel) summary.replacedDeletedLabel += 1;
      else summary.filledEmptyName += 1;
    }

    console.log('\nDone.');
    console.log(`  scanned                  : ${summary.scanned}`);
    console.log(`  replaced "Deleted Account": ${summary.replacedDeletedLabel}`);
    console.log(`  filled empty names        : ${summary.filledEmptyName}`);
    console.log(`  left blank (no fallback)  : ${summary.leftBlank}`);
    if (dryRun) console.log('\n(dry-run — re-run without --dry-run to apply)');
  } catch (err) {
    console.error('Script failed:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
