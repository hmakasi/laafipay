-- Empêche deux avances actives simultanées pour le même employé, même sous
-- concurrence (deux requêtes qui passent toutes les deux le check applicatif
-- findFirst avant que la première n'ait committé sa création). Index unique
-- partiel : hors du DSL Prisma (pas de clause WHERE), donc écrit ici à la main
-- — voir le commentaire sur SalaryAdvance dans schema.prisma.
CREATE UNIQUE INDEX "SalaryAdvance_employeeId_active_key" ON "SalaryAdvance" ("employeeId") WHERE "status" IN ('en_attente', 'approuve', 'verse_mobile_money', 'en_remboursement');
