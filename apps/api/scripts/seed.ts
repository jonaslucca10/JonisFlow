/**
 * Seed de dev: usuário demo + plano grátis (limite 3 buscas / 5 exportações).
 *   npx tsx scripts/seed.ts
 */
import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/prisma';

async function main() {
  const email = 'demo@jonisflow.dev';
  const passwordHash = await bcrypt.hash('demo1234', 10);
  const user = await prisma.user.upsert({
    where: { email },
    create: { email, name: 'Demo User', passwordHash },
    update: {},
  });
  console.log(`Usuário demo: ${user.email} / demo1234`);
}

main().finally(() => prisma.$disconnect());
