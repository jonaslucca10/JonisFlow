import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// Driver adapter (Prisma 6.16+): o WASM engine usa o adapter para se comunicar
// com o PostgreSQL. Em produção com engine binario nativo, o adapter tambem
// funciona e reduz duplicacao de conexoes.
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });

export const prisma = new PrismaClient({ adapter });
