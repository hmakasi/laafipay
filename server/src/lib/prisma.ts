import { PrismaClient } from '@prisma/client';

// En serverless (Vercel), le module peut être réévalué entre invocations "chaudes" ;
// on met en cache l'instance sur globalThis pour éviter de recréer des connexions inutilement.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
