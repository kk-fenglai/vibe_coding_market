// Seed: BuilderHub bootstrap data.
//
// Safety:
//   - The admin user is always upserted (needed for first deploy on any env).
//   - Demo accounts are only created in NON-production environments
//     unless you explicitly set ALLOW_PROD_SEED=true.
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

const IS_PROD = process.env.NODE_ENV === 'production';
const ALLOW_PROD_SEED = process.env.ALLOW_PROD_SEED === 'true';

async function main() {
  console.log(`🌱 Seeding database (NODE_ENV=${process.env.NODE_ENV || 'development'})...`);

  // ---- Super Admin — always ensure exists ----
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com';
  const adminInitialPwd = process.env.ADMIN_INITIAL_PASSWORD || 'ChangeMe$Admin@2026!Prod';
  if (IS_PROD && !process.env.ADMIN_INITIAL_PASSWORD) {
    console.warn('⚠️  ADMIN_INITIAL_PASSWORD not set — using default. Change it immediately after first login.');
  }
  const adminPwdHash = await bcrypt.hash(adminInitialPwd, 12);
  await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { role: 'SUPER_ADMIN', status: 'ACTIVE', emailVerified: true },
    create: {
      email: ADMIN_EMAIL,
      passwordHash: adminPwdHash,
      name: 'Super Admin',
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
  });
  console.log(`✅ Super admin ready: ${ADMIN_EMAIL}`);
  console.log('⚠️  Change this password IMMEDIATELY after first login!');

  // ---- Demo users — dev/staging only ----
  if (IS_PROD && !ALLOW_PROD_SEED) {
    console.log('⏭️  Skipping demo users (NODE_ENV=production).');
    return;
  }

  const demoPwd = await bcrypt.hash('demo1234', 12);
  // Client demo account (posts projects).
  await prisma.user.upsert({
    where: { email: 'client@builderhub.dev' },
    update: { emailVerified: true },
    create: {
      email: 'client@builderhub.dev',
      passwordHash: demoPwd,
      name: 'Demo Client',
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
  });
  // Builder demo account (applies to projects).
  await prisma.user.upsert({
    where: { email: 'builder@builderhub.dev' },
    update: { emailVerified: true },
    create: {
      email: 'builder@builderhub.dev',
      passwordHash: demoPwd,
      name: 'Demo Builder',
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
  });
  console.log('✅ Demo users ready: client@builderhub.dev / builder@builderhub.dev (password: demo1234)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
