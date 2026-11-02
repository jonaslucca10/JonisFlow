/**
 * Smoke test: Prisma + Postgres (engine WASM + driver adapter). Executar:
 *   node scripts/smoke-test.cjs
 */
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

(async () => {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL || 'postgresql://jonis@127.0.0.1:5432/jonisflow' });
  const prisma = new PrismaClient({ adapter });
  const email = `smoke-${Date.now()}@jonisflow.dev`;
  const u = await prisma.user.create({ data: { email, passwordHash: 'x', name: 'Smoke' } });
  const n = await prisma.user.count();
  // testar $transaction (usado no reset de senha) + wasm engine
  const r = await prisma.$transaction([
    prisma.session.create({ data: { userId: u.id, refreshTokenHash: 'h1', expiresAt: new Date(Date.now() + 86400000) } }),
  ]);
  console.log(`OK user: ${u.id} | total: ${n} | session: ${r.id}`);
  await prisma.$disconnect();
})().catch((e) => { console.error('SMOKE FAIL:', e.message.slice(0, 300)); process.exit(1); });
