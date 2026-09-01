# Avances sur salaire (backend réel) & fiche compte employé — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fully-mocked salary advance module with a real Prisma-backed workflow (self-service request → RH/compta approval → mobile money payout → automatic pre-filled deduction on payroll cycles, carried over across cycles until the balance is repaid), and add an employee account view aggregating salary, payslip history and advances.

**Architecture:** New `SalaryAdvance`/`AdvanceDeduction` Prisma models, a new `server/src/routes/advances.routes.ts` following the existing `treasury.routes.ts` pattern (scoped read like `leaves.routes.ts`'s `requireLeavesReadScope`), and a hook into the existing payroll cycle generation/validation flow in `payroll.routes.ts` so advances surface automatically as an editable `avances` line. Frontend: swap the mock service for real API calls behind the existing `useAdvances` hook interface, add a self-service request tab and an RH/compta employee account tab.

**Tech Stack:** Express + Prisma + Zod (server), React + TanStack Query + react-i18next (frontend), Vitest + Supertest for server tests (frontend has no test suite — verified with `tsc -b` + manual smoke test instead).

**Spec:** `docs/superpowers/specs/2026-09-01-salary-advances-design.md`

## Global Constraints

- Plafond par défaut : 30 % du salaire net (`PayrollConfig.maxAdvancePercent`, configurable par entreprise).
- Une seule avance active à la fois par employé (statuts `en_attente`, `approuve`, `verse_mobile_money`, `en_remboursement`).
- Le solde restant se reporte automatiquement sur les cycles de paie suivants jusqu'à remboursement complet.
- Toute demande self-service passe par `channel: 'portail'` — le canal WhatsApp reste hors scope de ce plan (juste préparé dans l'enum).
- Le tableau de bord RH-compta et les alertes/échéances sont hors scope (voir spec).
- Server-only : pas de fichier `.test.ts` n'existe encore sur `main` (Vitest n'y a jamais été installé, seulement sur la branche `whatsapp-bot` non fusionnée) — Task 1 l'ajoute indépendamment.

---

### Task 1: Ajouter Vitest au serveur

**Files:**
- Modify: `server/package.json`
- Create: `server/vitest.config.ts`

**Interfaces:**
- Produces: script npm `test` (`vitest run`) et `test:watch` (`vitest`) dans `server/`, exécutables depuis la racine avec `npm --prefix server run test` (ou `cd server && npm run test`).

- [ ] **Step 1: Ajouter les dépendances de test**

Dans `server/package.json`, ajouter aux `devDependencies` (ordre alphabétique, comme le reste du fichier) :

```json
"@types/supertest": "^6.0.3",
"supertest": "^7.2.2",
"vitest": "^3.2.4"
```

Et ajouter aux `scripts`, juste après `"start"` :

```json
"test": "vitest run",
"test:watch": "vitest",
```

- [ ] **Step 2: Créer la config Vitest**

```typescript
// server/vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 3: Installer et vérifier**

Run (depuis la racine du repo — monorepo npm workspaces, voir commentaire du commit `8298902` sur la branche `whatsapp-bot` : ne jamais utiliser `--prefix`) :

```bash
npm install
npm --prefix server run test
```

Expected: `vitest` s'exécute et affiche "No test files found" (aucun `.test.ts` n'existe encore) sans erreur de configuration.

- [ ] **Step 4: Commit**

```bash
git add server/package.json server/vitest.config.ts package-lock.json
git commit -m "test(server): add Vitest test runner"
```

---

### Task 2: Modèle de données Prisma

**Files:**
- Modify: `server/prisma/schema.prisma`

**Interfaces:**
- Produces: modèles `SalaryAdvance`, `AdvanceDeduction` ; enums `AdvanceChannel` (`whatsapp` | `portail`), `AdvanceStatus` (`en_attente` | `rejete` | `approuve` | `verse_mobile_money` | `en_remboursement` | `rembourse`) ; champ `PayrollConfig.maxAdvancePercent: Float` (défaut `30`) ; relations `Employee.salaryAdvances`, `Company.salaryAdvances`.

- [ ] **Step 1: Ajouter les enums**

Dans `server/prisma/schema.prisma`, juste après `enum PaymentOrderType { ... }` (ligne 196) et avant `enum TreasuryAccountKind`, insérer :

```prisma
enum AdvanceChannel {
  whatsapp
  portail
}

enum AdvanceStatus {
  en_attente
  rejete
  approuve
  verse_mobile_money
  en_remboursement
  rembourse
}
```

- [ ] **Step 2: Ajouter les modèles**

Juste après `model PaymentTransaction { ... }` (avant le commentaire `// ── Trésorerie & Rapprochement (LaafiCompta) ──`), insérer :

```prisma
// ── Avances sur salaire ──────────────────────────────────────────
// remainingBalance décroît à chaque cycle de paie validé (voir
// applyAdvanceDeductionsForCycle, server/src/lib/salaryAdvances.ts) : si le
// solde n'est pas épuisé en un cycle, l'avance reste "en_remboursement" et
// réapparaît pré-remplie au cycle suivant (voir syncEntries,
// payroll.routes.ts) jusqu'à remboursement complet.
model SalaryAdvance {
  id                  String              @id @default(cuid())
  companyId           String
  company             Company             @relation(fields: [companyId], references: [id], onDelete: Cascade)
  employeeId          String
  employee            Employee            @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  amount              Float
  remainingBalance    Float
  channel             AdvanceChannel
  status              AdvanceStatus       @default(en_attente)
  requestedAt         DateTime            @default(now())
  approvedAt          DateTime?
  approvedBy          String?
  rejectedAt          DateTime?
  rejectedBy          String?
  rejectionReason     String?
  mobileMoneyOperator MobileMoneyOperator?
  reference           String?
  paidAt              DateTime?
  createdAt           DateTime            @default(now())
  deductions          AdvanceDeduction[]

  @@index([employeeId])
  @@index([companyId, status])
}

model AdvanceDeduction {
  id             String        @id @default(cuid())
  advanceId      String
  advance        SalaryAdvance @relation(fields: [advanceId], references: [id], onDelete: Cascade)
  // Référence libre vers PayrollEntry.id — même convention que
  // TreasuryTransaction.matchedPaymentTransactionId (pas de relation Prisma
  // formelle, l'entrée de paie n'a pas besoin de connaître ses déductions).
  payrollEntryId String
  amount         Float
  createdAt      DateTime      @default(now())

  @@index([advanceId])
}
```

- [ ] **Step 3: Ajouter le champ de plafond et les relations inverses**

Dans `model PayrollConfig`, ajouter le champ après `customRubrics Json` :

```prisma
  maxAdvancePercent Float    @default(30)
```

Dans `model Employee`, ajouter à la liste des relations (après `paymentTransactions PaymentTransaction[]`) :

```prisma
  salaryAdvances      SalaryAdvance[]
```

Dans `model Company`, ajouter à la liste des relations (après `paymentOrders PaymentOrder[]`) :

```prisma
  salaryAdvances       SalaryAdvance[]
```

- [ ] **Step 4: Générer la migration**

Run: `cd server && npx prisma migrate dev --name add_salary_advances`
Expected: migration créée et appliquée sans erreur, `prisma generate` s'exécute automatiquement à la fin.

- [ ] **Step 5: Commit**

```bash
git add server/prisma/schema.prisma server/prisma/migrations
git commit -m "feat(schema): add SalaryAdvance and AdvanceDeduction models"
```

---

### Task 3: Permissions `advances:read`, `advances:approve`, `self:advances`

**Files:**
- Modify: `server/src/lib/permissions.ts`
- Modify: `src/lib/permissions.ts`
- Modify: `src/types/index.ts:12-54`

**Interfaces:**
- Consumes: aucune (indépendant de Task 1/2, peut être fait en parallèle mais suit l'ordre du plan par simplicité).
- Produces: valeurs de type `Permission` : `'advances:read' | 'advances:approve' | 'self:advances'`, utilisées par Task 5 (`authorize(...)` côté serveur) et Task 11-13 (`PermissionGate` côté client).

- [ ] **Step 1: Étendre le type `Permission` (frontend)**

Dans `src/types/index.ts`, remplacer :

```typescript
  // LaafiCompta — réservé admin/comptable, voir ROLE_PERMISSIONS
  | 'compta:access'
  // Self-service
  | 'self:payslips'
  | 'self:leaves'
  | 'self:profile'
  | 'self:reviews';
```

par :

```typescript
  // LaafiCompta — réservé admin/comptable, voir ROLE_PERMISSIONS
  | 'compta:access'
  // Avances sur salaire
  | 'advances:read'
  | 'advances:approve'
  // Self-service
  | 'self:payslips'
  | 'self:leaves'
  | 'self:profile'
  | 'self:reviews'
  | 'self:advances';
```

- [ ] **Step 2: Étendre le type `Permission` (serveur)**

Dans `server/src/lib/permissions.ts`, appliquer le même changement (le fichier est un miroir explicite, voir son commentaire d'en-tête) :

```typescript
  | 'compta:access'
  | 'advances:read'
  | 'advances:approve'
  | 'self:payslips'
  | 'self:leaves'
  | 'self:profile'
  | 'self:reviews'
  | 'self:advances';
```

- [ ] **Step 3: Attribuer les permissions par rôle (les deux fichiers `ROLE_PERMISSIONS`)**

Dans `server/src/lib/permissions.ts` ET `src/lib/permissions.ts`, pour `admin`, `hr_manager`, `accountant` : ajouter `'advances:read', 'advances:approve'` à côté de `'compta:access'` (ou juste après `payments:validate`/`payments:initiate`). Pour **tous** les rôles (`admin`, `hr_manager`, `manager`, `accountant`, `employee`) : ajouter `'self:advances'` à côté de `'self:leaves'`.

Résultat attendu pour `admin` (server, même changement côté frontend) :

```typescript
  admin: [
    'employees:read', 'employees:write', 'employees:delete',
    'payroll:read', 'payroll:write', 'payroll:approve', 'payroll:settings',
    'payments:read', 'payments:initiate', 'payments:validate',
    'payslips:read', 'payslips:generate', 'payslips:send',
    'leaves:read', 'leaves:write', 'leaves:approve', 'leaves:read_team',
    'reviews:read', 'reviews:write', 'reviews:manage_team',
    'reports:read', 'reports:export',
    'users:read', 'users:write', 'settings:read', 'settings:write', 'audit:read',
    'compta:access',
    'advances:read', 'advances:approve',
    'self:payslips', 'self:leaves', 'self:profile', 'self:reviews', 'self:advances',
  ],
```

Pour `hr_manager` et `accountant` : même ajout de `'advances:read', 'advances:approve'` et `'self:advances'`.
Pour `manager` et `employee` : ajouter uniquement `'self:advances'` (pas `advances:read`/`advances:approve` — un manager ne gère pas les avances de son équipe, seulement les congés, cohérent avec la spec).

- [ ] **Step 4: Vérifier la compilation**

Run: `cd server && npm run build`
Expected: aucune erreur TypeScript.

Run: `npx tsc -b tsconfig.app.json`
Expected: aucune erreur TypeScript côté frontend.

- [ ] **Step 5: Commit**

```bash
git add server/src/lib/permissions.ts src/lib/permissions.ts src/types/index.ts
git commit -m "feat(auth): add advances:read, advances:approve, self:advances permissions"
```

---

### Task 4: Règles métier des avances (`server/src/lib/salaryAdvances.ts`)

**Files:**
- Create: `server/src/lib/salaryAdvances.ts`
- Test: `server/src/lib/salaryAdvances.test.ts`

**Interfaces:**
- Consumes: `LegalSettingsInput`, `VariableElement`, `computePayrollEntry` (`server/src/lib/payrollEngine.ts`, déjà existants) ; modèles Prisma `SalaryAdvance`, `AdvanceDeduction`, `PayrollEntry` (Task 2).
- Produces:
  - `ACTIVE_ADVANCE_STATUSES: AdvanceStatus[]`
  - `OUTSTANDING_ADVANCE_STATUSES: AdvanceStatus[]`
  - `computeMaxAdvanceAmount(baseSalary: number, legalSettings: LegalSettingsInput, maxAdvancePercent: number): number`
  - `fetchOutstandingAdvancesByEmployee(companyId: string): Promise<Map<string, VariableElement[]>>`
  - `applyAdvanceDeductionsForCycle(entries: PayrollEntry[]): Promise<void>`

  Consommés par Task 5 (`computeMaxAdvanceAmount`, `ACTIVE_ADVANCE_STATUSES`) et Task 6 (`fetchOutstandingAdvancesByEmployee`, `applyAdvanceDeductionsForCycle`).

- [ ] **Step 1: Écrire le test de `computeMaxAdvanceAmount`**

```typescript
// server/src/lib/salaryAdvances.test.ts
import { describe, it, expect } from 'vitest';
import { computeMaxAdvanceAmount } from './salaryAdvances.js';

const legalSettings = {
  cnssEmployeeRate: 5.5,
  cnssEmployerRate: 16,
  iutsBrackets: [{ min: 0, max: null, rate: 0, deduction: 0 }],
};

describe('computeMaxAdvanceAmount', () => {
  it('calcule le plafond comme un pourcentage du salaire net estimé', () => {
    // baseSalary 200000, cnss 5.5% = 11000, salaireNet = 200000 - 11000 = 189000
    // plafond 30% = 56700
    const result = computeMaxAdvanceAmount(200_000, legalSettings, 30);
    expect(result).toBe(56_700);
  });

  it('arrondit vers le bas', () => {
    const result = computeMaxAdvanceAmount(100_000, legalSettings, 33);
    // salaireNet = 100000 - 5500 = 94500, 33% = 31185
    expect(result).toBe(31_185);
    expect(Number.isInteger(result)).toBe(true);
  });
});
```

- [ ] **Step 2: Lancer le test et vérifier qu'il échoue**

Run: `cd server && npx vitest run src/lib/salaryAdvances.test.ts`
Expected: FAIL — `Cannot find module './salaryAdvances.js'`

- [ ] **Step 3: Implémenter `computeMaxAdvanceAmount` et les constantes de statut**

```typescript
// server/src/lib/salaryAdvances.ts
import { AdvanceStatus, PayrollEntry } from '@prisma/client';
import { prisma } from './prisma.js';
import { computePayrollEntry, LegalSettingsInput, VariableElement } from './payrollEngine.js';

export const ACTIVE_ADVANCE_STATUSES: AdvanceStatus[] = [
  'en_attente',
  'approuve',
  'verse_mobile_money',
  'en_remboursement',
];

// Sous-ensemble d'ACTIVE_ADVANCE_STATUSES : avances déjà versées à
// l'employé et donc éligibles à un pré-remplissage sur un futur cycle de
// paie ("en_attente"/"approuve" n'ont pas encore d'argent à rembourser).
export const OUTSTANDING_ADVANCE_STATUSES: AdvanceStatus[] = ['verse_mobile_money', 'en_remboursement'];

// Simplification volontaire : plafond calculé sur le salaire net de base
// (baseSalary - CNSS - IUTS), sans primes/indemnités/heures sup du cycle en
// cours — ces éléments varient d'un cycle à l'autre et ne sont pas connus
// au moment d'une demande d'avance. Cohérent avec computeDefaultEntryForEmployee
// qui fait la même approximation pour les lignes générées automatiquement.
export function computeMaxAdvanceAmount(
  baseSalary: number,
  legalSettings: LegalSettingsInput,
  maxAdvancePercent: number
): number {
  const { salaireNet } = computePayrollEntry({ baseSalary }, legalSettings);
  return Math.floor((salaireNet * maxAdvancePercent) / 100);
}

// Une entrée par employé ayant au moins une avance versée non soldée —
// consommé par syncEntries (payroll.routes.ts) pour pré-remplir la ligne
// "avances" d'un nouveau PayrollEntry.
export async function fetchOutstandingAdvancesByEmployee(companyId: string): Promise<Map<string, VariableElement[]>> {
  const advances = await prisma.salaryAdvance.findMany({
    where: { companyId, status: { in: OUTSTANDING_ADVANCE_STATUSES }, remainingBalance: { gt: 0 } },
  });

  const map = new Map<string, VariableElement[]>();
  for (const advance of advances) {
    const list = map.get(advance.employeeId) ?? [];
    list.push({
      id: advance.id,
      label: 'Avance sur salaire',
      amount: advance.remainingBalance,
      type: 'avance',
    });
    map.set(advance.employeeId, list);
  }
  return map;
}

// Appelé à la validation d'un cycle de paie (payroll.routes.ts). Pour
// chaque ligne "avances" d'un PayrollEntry dont l'id correspond à une
// SalaryAdvance existante, crée l'AdvanceDeduction et décrémente le solde.
// Idempotent (vérifie qu'une déduction n'existe pas déjà pour ce couple
// avance/entrée) pour tolérer un second appel de validation.
export async function applyAdvanceDeductionsForCycle(entries: PayrollEntry[]): Promise<void> {
  for (const entry of entries) {
    const avances = entry.avances as unknown as VariableElement[];
    for (const item of avances) {
      if (item.type !== 'avance') continue;

      const advance = await prisma.salaryAdvance.findUnique({ where: { id: item.id } });
      // Avance supprimée entre la génération du cycle et sa validation
      // (cas improbable) — le montant reste dans le calcul du salaire net
      // (déjà soustrait par payrollEngine) mais aucune trace de
      // remboursement n'est créée, voir spec "Erreurs & cas limites".
      if (!advance) continue;

      const alreadyDeducted = await prisma.advanceDeduction.findFirst({
        where: { advanceId: advance.id, payrollEntryId: entry.id },
      });
      if (alreadyDeducted) continue;

      const amount = Math.min(item.amount, advance.remainingBalance);
      if (amount <= 0) continue;

      const remainingBalance = advance.remainingBalance - amount;
      await prisma.$transaction([
        prisma.advanceDeduction.create({ data: { advanceId: advance.id, payrollEntryId: entry.id, amount } }),
        prisma.salaryAdvance.update({
          where: { id: advance.id },
          data: { remainingBalance, status: remainingBalance <= 0 ? 'rembourse' : 'en_remboursement' },
        }),
      ]);
    }
  }
}
```

- [ ] **Step 4: Lancer le test et vérifier qu'il passe**

Run: `cd server && npx vitest run src/lib/salaryAdvances.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Écrire et vérifier les tests de `applyAdvanceDeductionsForCycle`**

Ajouter à `server/src/lib/salaryAdvances.test.ts` :

```typescript
import { beforeEach, describe, it, expect, vi } from 'vitest';

const mockFindUnique = vi.fn();
const mockDeductionFindFirst = vi.fn();
const mockDeductionCreate = vi.fn();
const mockAdvanceUpdate = vi.fn();
const mockTransaction = vi.fn((ops: unknown[]) => Promise.all(ops as Promise<unknown>[]));

vi.mock('./prisma.js', () => ({
  prisma: {
    salaryAdvance: { findUnique: (...args: unknown[]) => mockFindUnique(...args), update: (...args: unknown[]) => mockAdvanceUpdate(...args) },
    advanceDeduction: { findFirst: (...args: unknown[]) => mockDeductionFindFirst(...args), create: (...args: unknown[]) => mockDeductionCreate(...args) },
    $transaction: (ops: unknown[]) => mockTransaction(ops),
  },
}));

const { applyAdvanceDeductionsForCycle } = await import('./salaryAdvances.js');

function fakeEntry(id: string, avances: unknown[]) {
  return { id, avances } as unknown as import('@prisma/client').PayrollEntry;
}

describe('applyAdvanceDeductionsForCycle', () => {
  beforeEach(() => {
    mockFindUnique.mockReset();
    mockDeductionFindFirst.mockReset();
    mockDeductionCreate.mockReset();
    mockAdvanceUpdate.mockReset();
    mockTransaction.mockClear();
  });

  it("ignore les lignes qui ne sont pas de type 'avance'", async () => {
    const entry = fakeEntry('e1', [{ id: 'p1', label: 'Prime', amount: 5000, type: 'prime' }]);
    await applyAdvanceDeductionsForCycle([entry]);
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it('déduit et solde une avance quand le montant couvre tout le restant', async () => {
    mockFindUnique.mockResolvedValue({ id: 'adv1', remainingBalance: 20_000 });
    mockDeductionFindFirst.mockResolvedValue(null);
    const entry = fakeEntry('e1', [{ id: 'adv1', label: 'Avance sur salaire', amount: 20_000, type: 'avance' }]);

    await applyAdvanceDeductionsForCycle([entry]);

    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(mockDeductionCreate).toHaveBeenCalledWith({ data: { advanceId: 'adv1', payrollEntryId: 'e1', amount: 20_000 } });
    expect(mockAdvanceUpdate).toHaveBeenCalledWith({ where: { id: 'adv1' }, data: { remainingBalance: 0, status: 'rembourse' } });
  });

  it('laisse le statut en_remboursement quand le solde n\'est pas épuisé', async () => {
    mockFindUnique.mockResolvedValue({ id: 'adv1', remainingBalance: 20_000 });
    mockDeductionFindFirst.mockResolvedValue(null);
    const entry = fakeEntry('e1', [{ id: 'adv1', label: 'Avance sur salaire', amount: 12_000, type: 'avance' }]);

    await applyAdvanceDeductionsForCycle([entry]);

    expect(mockAdvanceUpdate).toHaveBeenCalledWith({ where: { id: 'adv1' }, data: { remainingBalance: 8_000, status: 'en_remboursement' } });
  });

  it('est idempotent : ne redéduit pas si une AdvanceDeduction existe déjà pour ce couple', async () => {
    mockFindUnique.mockResolvedValue({ id: 'adv1', remainingBalance: 20_000 });
    mockDeductionFindFirst.mockResolvedValue({ id: 'already' });
    const entry = fakeEntry('e1', [{ id: 'adv1', label: 'Avance sur salaire', amount: 20_000, type: 'avance' }]);

    await applyAdvanceDeductionsForCycle([entry]);

    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('ignore une ligne "avance" dont l\'id ne correspond à aucune SalaryAdvance', async () => {
    mockFindUnique.mockResolvedValue(null);
    const entry = fakeEntry('e1', [{ id: 'deleted-adv', label: 'Avance sur salaire', amount: 20_000, type: 'avance' }]);

    await applyAdvanceDeductionsForCycle([entry]);

    expect(mockTransaction).not.toHaveBeenCalled();
  });
});
```

Run: `cd server && npx vitest run src/lib/salaryAdvances.test.ts`
Expected: PASS (7 tests au total)

- [ ] **Step 6: Commit**

```bash
git add server/src/lib/salaryAdvances.ts server/src/lib/salaryAdvances.test.ts
git commit -m "feat(server): add salary advance rules (cap calculation, cycle deduction)"
```

---

### Task 5: Routes serveur `server/src/routes/advances.routes.ts`

**Files:**
- Create: `server/src/routes/advances.routes.ts`
- Test: `server/src/routes/advances.routes.test.ts`
- Modify: `server/src/routes/payroll.routes.ts:148` (exporter `mostRecentLegalSettings`)
- Modify: `server/src/app.ts`

**Interfaces:**
- Consumes: `ACTIVE_ADVANCE_STATUSES`, `computeMaxAdvanceAmount` (Task 4) ; permissions `advances:read`, `advances:approve`, `self:advances` (Task 3) ; `IutsBracket` (`payrollEngine.ts`, existant) ; `mostRecentLegalSettings` (exporté depuis `payroll.routes.ts`).
- Produces: `advancesRouter` monté sur `/api/advances` — `GET /` (liste scopée), `GET /eligibility`, `POST /`, `POST /:id/approve`, `POST /:id/reject`, `POST /:id/pay`. DTO JSON : `{ id, employeeId, amount, remainingBalance, channel, status, requestedAt, approvedAt?, approvedBy?, rejectedAt?, rejectedBy?, rejectionReason?, mobileMoneyOperator?, reference?, paidAt? }`.

- [ ] **Step 1: Exporter `mostRecentLegalSettings`**

Dans `server/src/routes/payroll.routes.ts:148`, changer :

```typescript
async function mostRecentLegalSettings(companyId: string) {
```

en :

```typescript
export async function mostRecentLegalSettings(companyId: string) {
```

- [ ] **Step 2: Écrire les tests des cas d'erreur et du plafond**

```typescript
// server/src/routes/advances.routes.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

const mockFindMany = vi.fn();
const mockFindFirst = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockEmployeeFindFirstOrThrow = vi.fn();
const mockLegalSettingsFindFirst = vi.fn();
const mockPayrollConfigFindUnique = vi.fn();

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    salaryAdvance: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      create: (...args: unknown[]) => mockCreate(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
    employee: { findFirstOrThrow: (...args: unknown[]) => mockEmployeeFindFirstOrThrow(...args) },
    legalSettings: { findFirst: (...args: unknown[]) => mockLegalSettingsFindFirst(...args) },
    payrollConfig: { findUnique: (...args: unknown[]) => mockPayrollConfigFindUnique(...args) },
  },
}));

const { default: app } = await import('../app.js');
const { signToken } = await import('../middleware/auth.js');

const legalSettings = {
  id: 'ls1',
  cnssEmployeeRate: 5.5,
  cnssEmployerRate: 16,
  iutsBrackets: [{ min: 0, max: null, rate: 0, deduction: 0 }],
};

describe('POST /api/advances', () => {
  beforeEach(() => {
    mockFindMany.mockReset();
    mockFindFirst.mockReset();
    mockCreate.mockReset();
    mockUpdate.mockReset();
    mockEmployeeFindFirstOrThrow.mockReset();
    mockLegalSettingsFindFirst.mockReset();
    mockPayrollConfigFindUnique.mockReset();
  });

  const token = signToken({ id: 'u1', email: 'a@b.com', role: 'employee', companyId: 'c1', employeeId: 'e1' });

  it('rejette une demande sans employeeId lié', async () => {
    const noEmployeeToken = signToken({ id: 'u2', email: 'x@y.com', role: 'employee', companyId: 'c1' });
    const res = await request(app).post('/api/advances').set('Authorization', `Bearer ${noEmployeeToken}`).send({ amount: 10_000 });
    expect(res.status).toBe(403);
  });

  it('rejette si une avance active existe déjà', async () => {
    mockFindFirst.mockResolvedValueOnce({ id: 'existing' });
    const res = await request(app).post('/api/advances').set('Authorization', `Bearer ${token}`).send({ amount: 10_000 });
    expect(res.status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('rejette un montant qui dépasse le plafond', async () => {
    mockFindFirst.mockResolvedValueOnce(null);
    mockEmployeeFindFirstOrThrow.mockResolvedValueOnce({ id: 'e1', baseSalary: 100_000 });
    mockLegalSettingsFindFirst.mockResolvedValueOnce(legalSettings);
    mockPayrollConfigFindUnique.mockResolvedValueOnce({ maxAdvancePercent: 30 });
    // salaireNet = 100000 - 5500 = 94500, plafond 30% = 28350
    const res = await request(app).post('/api/advances').set('Authorization', `Bearer ${token}`).send({ amount: 50_000 });
    expect(res.status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('crée une avance en_attente quand la demande respecte le plafond', async () => {
    mockFindFirst.mockResolvedValueOnce(null);
    mockEmployeeFindFirstOrThrow.mockResolvedValueOnce({ id: 'e1', baseSalary: 100_000 });
    mockLegalSettingsFindFirst.mockResolvedValueOnce(legalSettings);
    mockPayrollConfigFindUnique.mockResolvedValueOnce({ maxAdvancePercent: 30 });
    mockCreate.mockResolvedValueOnce({
      id: 'adv1', employeeId: 'e1', amount: 20_000, remainingBalance: 20_000,
      channel: 'portail', status: 'en_attente', requestedAt: new Date(),
    });

    const res = await request(app).post('/api/advances').set('Authorization', `Bearer ${token}`).send({ amount: 20_000 });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('en_attente');
    expect(mockCreate).toHaveBeenCalledWith({
      data: { companyId: 'c1', employeeId: 'e1', amount: 20_000, remainingBalance: 20_000, channel: 'portail', status: 'en_attente' },
    });
  });
});

describe('POST /api/advances/:id/approve', () => {
  beforeEach(() => {
    mockFindFirst.mockReset();
    mockUpdate.mockReset();
  });

  const hrToken = signToken({ id: 'u3', email: 'hr@b.com', role: 'hr_manager', companyId: 'c1', employeeId: 'e2' });

  it("refuse d'approuver une avance qui n'est pas en_attente", async () => {
    mockFindFirst.mockResolvedValueOnce({ id: 'adv1', status: 'approuve' });
    const res = await request(app).post('/api/advances/adv1/approve').set('Authorization', `Bearer ${hrToken}`).send({ approvedBy: 'hr@b.com' });
    expect(res.status).toBe(409);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('approuve une avance en_attente', async () => {
    mockFindFirst.mockResolvedValueOnce({ id: 'adv1', status: 'en_attente' });
    mockUpdate.mockResolvedValueOnce({
      id: 'adv1', status: 'approuve', requestedAt: new Date(), approvedAt: new Date(), approvedBy: 'hr@b.com',
    });
    const res = await request(app).post('/api/advances/adv1/approve').set('Authorization', `Bearer ${hrToken}`).send({ approvedBy: 'hr@b.com' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('approuve');
  });

  it('refuse un employé simple (sans advances:approve)', async () => {
    const employeeToken = signToken({ id: 'u1', email: 'a@b.com', role: 'employee', companyId: 'c1', employeeId: 'e1' });
    const res = await request(app).post('/api/advances/adv1/approve').set('Authorization', `Bearer ${employeeToken}`).send({ approvedBy: 'a@b.com' });
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 3: Lancer les tests et vérifier qu'ils échouent**

Run: `cd server && npx vitest run src/routes/advances.routes.test.ts`
Expected: FAIL — `advancesRouter` n'est pas encore monté dans `app.ts`, donc toutes les requêtes vers `/api/advances/*` renvoient 404 au lieu des statuts attendus (403/400/201/409/200).

- [ ] **Step 4: Implémenter le routeur**

```typescript
// server/src/routes/advances.routes.ts
import { Router } from 'express';
import { Request } from 'express';
import { z } from 'zod';
import { SalaryAdvance } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { ForbiddenError, HttpError, NotFoundError } from '../lib/errors.js';
import { hasPermission } from '../lib/permissions.js';
import { ACTIVE_ADVANCE_STATUSES, computeMaxAdvanceAmount } from '../lib/salaryAdvances.js';
import { IutsBracket } from '../lib/payrollEngine.js';
import { mostRecentLegalSettings } from './payroll.routes.js';

export const advancesRouter = Router();
advancesRouter.use(authenticate);

// ── DTO mapping ──────────────────────────────────────────────

function toAdvanceDTO(a: SalaryAdvance) {
  return {
    id: a.id,
    employeeId: a.employeeId,
    amount: a.amount,
    remainingBalance: a.remainingBalance,
    channel: a.channel,
    status: a.status,
    requestedAt: a.requestedAt.toISOString(),
    approvedAt: a.approvedAt?.toISOString(),
    approvedBy: a.approvedBy ?? undefined,
    rejectedAt: a.rejectedAt?.toISOString(),
    rejectedBy: a.rejectedBy ?? undefined,
    rejectionReason: a.rejectionReason ?? undefined,
    mobileMoneyOperator: a.mobileMoneyOperator ?? undefined,
    reference: a.reference ?? undefined,
    paidAt: a.paidAt?.toISOString(),
  };
}

// Même triage que requireLeavesReadScope (leaves.routes.ts) : RH/compta
// (advances:read) voient toute l'entreprise, un salarié self-service
// (self:advances) ne voit que ses propres avances.
function requireAdvancesReadScope(req: Request): { employeeId?: string } {
  const user = req.user!;
  if (hasPermission(user.role, 'advances:read')) return {};
  if (hasPermission(user.role, 'self:advances')) {
    if (!user.employeeId) throw new ForbiddenError();
    return { employeeId: user.employeeId };
  }
  throw new ForbiddenError();
}

async function computeEmployeeMaxAdvance(companyId: string, employeeId: string) {
  const employee = await prisma.employee.findFirstOrThrow({ where: { id: employeeId, companyId } });
  const [legalSettings, payrollConfig] = await Promise.all([
    mostRecentLegalSettings(companyId),
    prisma.payrollConfig.findUnique({ where: { companyId } }),
  ]);
  const iutsBrackets = legalSettings.iutsBrackets as unknown as IutsBracket[];
  const maxAdvancePercent = payrollConfig?.maxAdvancePercent ?? 30;
  const maxAdvanceAmount = computeMaxAdvanceAmount(
    employee.baseSalary,
    { cnssEmployeeRate: legalSettings.cnssEmployeeRate, cnssEmployerRate: legalSettings.cnssEmployerRate, iutsBrackets },
    maxAdvancePercent
  );
  return maxAdvanceAmount;
}

// ── Lecture ──────────────────────────────────────────────────

advancesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const scope = requireAdvancesReadScope(req);
    const companyId = req.user!.companyId;
    const queryEmployeeId = typeof req.query.employeeId === 'string' ? req.query.employeeId : undefined;
    const employeeId = scope.employeeId ?? queryEmployeeId;

    const advances = await prisma.salaryAdvance.findMany({
      where: { companyId, ...(employeeId ? { employeeId } : {}) },
      orderBy: { requestedAt: 'desc' },
    });
    res.json(advances.map(toAdvanceDTO));
  })
);

advancesRouter.get(
  '/eligibility',
  authorize('self:advances'),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    if (!user.employeeId) throw new ForbiddenError();

    const [maxAdvanceAmount, activeAdvance] = await Promise.all([
      computeEmployeeMaxAdvance(user.companyId, user.employeeId),
      prisma.salaryAdvance.findFirst({ where: { employeeId: user.employeeId, status: { in: ACTIVE_ADVANCE_STATUSES } } }),
    ]);

    res.json({ maxAdvanceAmount, hasActiveAdvance: !!activeAdvance });
  })
);

// ── Écriture ─────────────────────────────────────────────────

const createAdvanceSchema = z.object({ amount: z.number().positive() });

advancesRouter.post(
  '/',
  authorize('self:advances'),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    if (!user.employeeId) throw new ForbiddenError();
    const { amount } = createAdvanceSchema.parse(req.body);

    const existing = await prisma.salaryAdvance.findFirst({
      where: { employeeId: user.employeeId, status: { in: ACTIVE_ADVANCE_STATUSES } },
    });
    if (existing) throw new HttpError(400, 'Vous avez déjà une avance en cours');

    const maxAdvanceAmount = await computeEmployeeMaxAdvance(user.companyId, user.employeeId);
    if (amount > maxAdvanceAmount) {
      throw new HttpError(400, `Le montant demandé dépasse le plafond autorisé (${maxAdvanceAmount})`);
    }

    const created = await prisma.salaryAdvance.create({
      data: {
        companyId: user.companyId,
        employeeId: user.employeeId,
        amount,
        remainingBalance: amount,
        channel: 'portail',
        status: 'en_attente',
      },
    });
    res.status(201).json(toAdvanceDTO(created));
  })
);

const approveSchema = z.object({ approvedBy: z.string() });
const rejectSchema = z.object({ rejectedBy: z.string(), reason: z.string().optional() });

advancesRouter.post(
  '/:id/approve',
  authorize('advances:approve'),
  asyncHandler(async (req, res) => {
    const companyId = req.user!.companyId;
    const advance = await prisma.salaryAdvance.findFirst({ where: { id: req.params.id, companyId } });
    if (!advance) throw new NotFoundError(`Avance ${req.params.id} introuvable`);
    if (advance.status !== 'en_attente') {
      throw new HttpError(409, `Impossible d'approuver une avance au statut "${advance.status}"`);
    }

    const { approvedBy } = approveSchema.parse(req.body);
    const updated = await prisma.salaryAdvance.update({
      where: { id: advance.id },
      data: { status: 'approuve', approvedAt: new Date(), approvedBy },
    });
    res.json(toAdvanceDTO(updated));
  })
);

advancesRouter.post(
  '/:id/reject',
  authorize('advances:approve'),
  asyncHandler(async (req, res) => {
    const companyId = req.user!.companyId;
    const advance = await prisma.salaryAdvance.findFirst({ where: { id: req.params.id, companyId } });
    if (!advance) throw new NotFoundError(`Avance ${req.params.id} introuvable`);
    if (advance.status !== 'en_attente') {
      throw new HttpError(409, `Impossible de rejeter une avance au statut "${advance.status}"`);
    }

    const { rejectedBy, reason } = rejectSchema.parse(req.body);
    const updated = await prisma.salaryAdvance.update({
      where: { id: advance.id },
      data: { status: 'rejete', rejectedAt: new Date(), rejectedBy, rejectionReason: reason },
    });
    res.json(toAdvanceDTO(updated));
  })
);

advancesRouter.post(
  '/:id/pay',
  authorize('advances:approve'),
  asyncHandler(async (req, res) => {
    const companyId = req.user!.companyId;
    const advance = await prisma.salaryAdvance.findFirst({ where: { id: req.params.id, companyId } });
    if (!advance) throw new NotFoundError(`Avance ${req.params.id} introuvable`);
    if (advance.status !== 'approuve') {
      throw new HttpError(409, `Impossible de verser une avance au statut "${advance.status}"`);
    }

    const employee = await prisma.employee.findFirstOrThrow({ where: { id: advance.employeeId } });
    const reference = `OM-${Date.now().toString(36).toUpperCase()}`;
    const updated = await prisma.salaryAdvance.update({
      where: { id: advance.id },
      data: {
        status: 'verse_mobile_money',
        mobileMoneyOperator: employee.mobileMoneyOperator ?? 'orange',
        reference,
        paidAt: new Date(),
      },
    });
    res.json(toAdvanceDTO(updated));
  })
);
```

- [ ] **Step 5: Monter le routeur dans `app.ts`**

Dans `server/src/app.ts`, ajouter l'import à côté de `treasuryRouter` :

```typescript
import { advancesRouter } from './routes/advances.routes.js';
```

Et le montage à côté de `app.use('/api/treasury', treasuryRouter);` :

```typescript
app.use('/api/advances', advancesRouter);
```

- [ ] **Step 6: Lancer les tests et vérifier qu'ils passent**

Run: `cd server && npx vitest run src/routes/advances.routes.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 7: Vérifier la compilation serveur complète**

Run: `cd server && npm run build`
Expected: aucune erreur TypeScript.

- [ ] **Step 8: Commit**

```bash
git add server/src/routes/advances.routes.ts server/src/routes/advances.routes.test.ts server/src/routes/payroll.routes.ts server/src/app.ts
git commit -m "feat(server): add /api/advances routes (request, approve, reject, pay)"
```

---

### Task 6: Intégration au cycle de paie (pré-remplissage + décompte automatique)

**Files:**
- Modify: `server/src/lib/payrollEngine.ts`
- Modify: `server/src/routes/payroll.routes.ts`
- Test: `server/src/lib/payrollEngine.test.ts`
- Test: `server/src/routes/payroll.routes.advances.test.ts`

**Interfaces:**
- Consumes: `fetchOutstandingAdvancesByEmployee`, `applyAdvanceDeductionsForCycle` (Task 4).
- Produces: `computeDefaultEntryForEmployee` accepte un 4ᵉ paramètre optionnel `outstandingAdvances?: VariableElement[]` (nouvelle signature, seul appelant existant `syncEntries` mis à jour dans ce même task).

- [ ] **Step 1: Écrire le test du changement de signature**

```typescript
// server/src/lib/payrollEngine.test.ts
import { describe, it, expect } from 'vitest';
import { computeDefaultEntryForEmployee } from './payrollEngine.js';

const legalSettings = {
  cnssEmployeeRate: 5.5,
  cnssEmployerRate: 16,
  iutsBrackets: [{ min: 0, max: null, rate: 0, deduction: 0 }],
};

describe('computeDefaultEntryForEmployee avec avances en cours', () => {
  it('sans avance en cours, avances reste vide (comportement existant inchangé)', () => {
    const result = computeDefaultEntryForEmployee(200_000, legalSettings);
    expect(result.avances).toEqual([]);
  });

  it('pré-remplit la ligne avances avec les avances en cours passées en paramètre', () => {
    const outstandingAdvances = [{ id: 'adv1', label: 'Avance sur salaire', amount: 15_000, type: 'avance' as const }];
    const result = computeDefaultEntryForEmployee(200_000, legalSettings, undefined, outstandingAdvances);
    expect(result.avances).toEqual(outstandingAdvances);
    expect(result.salaireNet).toBe(200_000 - 11_000 - 15_000); // cnss 5.5% = 11000, iuts = 0
  });
});
```

- [ ] **Step 2: Lancer le test et vérifier qu'il échoue**

Run: `cd server && npx vitest run src/lib/payrollEngine.test.ts`
Expected: FAIL — le 2ᵉ test échoue (`result.avances` vaut `[]`, la fonction n'accepte pas encore ce paramètre).

- [ ] **Step 3: Mettre à jour `computeDefaultEntryForEmployee`**

Dans `server/src/lib/payrollEngine.ts`, remplacer la signature et le corps de la fonction :

```typescript
export function computeDefaultEntryForEmployee(
  baseSalary: number,
  legalSettings: LegalSettingsInput,
  configuredRubrics?: ConfiguredRubrics,
  outstandingAdvances: VariableElement[] = []
): PayrollEntryComputed {
  const indemnites: VariableElement[] = (configuredRubrics?.activeOptionalKeys ?? []).map((key) => ({
    id: `rubric-${key}`,
    label: OPTIONAL_RUBRIC_LABELS[key] ?? key,
    amount: key === 'transportAllowance' ? 15_000 : 0,
    type: 'indemnite',
  }));
  const primes: VariableElement[] = (configuredRubrics?.customRubrics ?? []).map((rubric, i) => ({
    id: `custom-${i}`,
    label: rubric.label,
    amount: 0,
    type: 'prime',
  }));

  return computePayrollEntry({ baseSalary, indemnites, primes, avances: outstandingAdvances }, legalSettings);
}
```

- [ ] **Step 4: Lancer le test et vérifier qu'il passe**

Run: `cd server && npx vitest run src/lib/payrollEngine.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Câbler le pré-remplissage dans `syncEntries`**

Dans `server/src/routes/payroll.routes.ts`, ajouter l'import :

```typescript
import { applyAdvanceDeductionsForCycle, fetchOutstandingAdvancesByEmployee } from '../lib/salaryAdvances.js';
```

Dans `syncEntries` (ligne ~91), ajouter la requête des avances en cours au `Promise.all` existant et la passer à `computeDefaultEntryForEmployee` :

```typescript
async function syncEntries(cycle: Pick<PayrollCycle, 'id' | 'companyId' | 'legalSettingsId'>) {
  const [legalSettings, activeEmployees, existingEntries, payrollConfig, outstandingAdvancesByEmployee] = await Promise.all([
    prisma.legalSettings.findUniqueOrThrow({ where: { id: cycle.legalSettingsId } }),
    prisma.employee.findMany({ where: { companyId: cycle.companyId, status: { not: 'offboarded' } } }),
    prisma.payrollEntry.findMany({ where: { cycleId: cycle.id }, select: { employeeId: true } }),
    prisma.payrollConfig.findUnique({ where: { companyId: cycle.companyId } }),
    fetchOutstandingAdvancesByEmployee(cycle.companyId),
  ]);

  const existingEmployeeIds = new Set(existingEntries.map((e) => e.employeeId));
  const missing = activeEmployees.filter((e) => !existingEmployeeIds.has(e.id));
  if (missing.length === 0) return;

  const iutsBrackets = legalSettings.iutsBrackets as unknown as IutsBracket[];
  const configuredRubrics: ConfiguredRubrics = {
    activeOptionalKeys: ((payrollConfig?.activeRubrics as unknown as string[]) ?? []).filter(
      (key) => !MANDATORY_RUBRIC_KEYS.has(key)
    ),
    customRubrics: (payrollConfig?.customRubrics as unknown as { label: string }[]) ?? [],
  };

  await prisma.payrollEntry.createMany({
    data: missing.map((emp) => {
      const computed = computeDefaultEntryForEmployee(
        emp.baseSalary,
        {
          cnssEmployeeRate: legalSettings.cnssEmployeeRate,
          cnssEmployerRate: legalSettings.cnssEmployerRate,
          iutsBrackets,
        },
        configuredRubrics,
        outstandingAdvancesByEmployee.get(emp.id) ?? []
      );
      return {
        cycleId: cycle.id,
        employeeId: emp.id,
        baseSalary: computed.baseSalary,
        overtimeHours: computed.overtimeHours,
        overtimeAmount: computed.overtimeAmount,
        primes: computed.primes as unknown as Prisma.InputJsonValue,
        indemnites: computed.indemnites as unknown as Prisma.InputJsonValue,
        avances: computed.avances as unknown as Prisma.InputJsonValue,
        retenues: computed.retenues as unknown as Prisma.InputJsonValue,
        absenceDays: computed.absenceDays,
        absenceAmount: computed.absenceAmount,
        salaireBrut: computed.salaireBrut,
        cnssEmployee: computed.cnssEmployee,
        cnssEmployer: computed.cnssEmployer,
        iuts: computed.iuts,
        salaireNet: computed.salaireNet,
        coutEmployeur: computed.coutEmployeur,
      };
    }),
  });
}
```

- [ ] **Step 6: Câbler le décompte automatique dans la validation de cycle**

Dans `server/src/routes/payroll.routes.ts`, dans le handler `POST /cycles/:id/validate` (ligne ~218), insérer l'appel juste après le `await prisma.payrollCycle.update(...)` et avant `await generatePayslipsForCycle(...)` :

```typescript
    await prisma.payrollEntry.updateMany({ where: { cycleId: cycle.id }, data: { status: 'valide' } });
    const updated = await prisma.payrollCycle.update({
      where: { id: cycle.id },
      data: { status: 'valide', validatedAt: new Date(), validatedBy },
      include: { entries: true },
    });

    // Décompte automatique des avances sur salaire en cours pour cet
    // employé — voir applyAdvanceDeductionsForCycle (lib/salaryAdvances.ts)
    // et la spec "Intégration au cycle de paie".
    await applyAdvanceDeductionsForCycle(updated.entries);

    await generatePayslipsForCycle(cycle.id, companyId, validatedBy);
```

- [ ] **Step 7: Écrire le test d'intégration route (prefill + déduction)**

```typescript
// server/src/routes/payroll.routes.advances.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

const mockLegalSettingsFindUnique = vi.fn();
const mockEmployeeFindMany = vi.fn();
const mockEntryFindMany = vi.fn();
const mockPayrollConfigFindUnique = vi.fn();
const mockAdvanceFindMany = vi.fn();
const mockEntryCreateMany = vi.fn();
const mockCycleFindFirst = vi.fn();
const mockCycleFindUniqueOrThrow = vi.fn();
const mockEntryUpdateMany = vi.fn();
const mockCycleUpdate = vi.fn();
const mockAdvanceFindUnique = vi.fn();
const mockDeductionFindFirst = vi.fn();
const mockDeductionCreate = vi.fn();
const mockAdvanceUpdate = vi.fn();
const mockTransaction = vi.fn((ops: unknown[]) => Promise.all(ops as Promise<unknown>[]));

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    legalSettings: { findUniqueOrThrow: (...a: unknown[]) => mockLegalSettingsFindUnique(...a) },
    employee: { findMany: (...a: unknown[]) => mockEmployeeFindMany(...a) },
    payrollEntry: {
      findMany: (...a: unknown[]) => mockEntryFindMany(...a),
      createMany: (...a: unknown[]) => mockEntryCreateMany(...a),
      updateMany: (...a: unknown[]) => mockEntryUpdateMany(...a),
    },
    payrollConfig: { findUnique: (...a: unknown[]) => mockPayrollConfigFindUnique(...a) },
    salaryAdvance: {
      findMany: (...a: unknown[]) => mockAdvanceFindMany(...a),
      findUnique: (...a: unknown[]) => mockAdvanceFindUnique(...a),
      update: (...a: unknown[]) => mockAdvanceUpdate(...a),
    },
    advanceDeduction: {
      findFirst: (...a: unknown[]) => mockDeductionFindFirst(...a),
      create: (...a: unknown[]) => mockDeductionCreate(...a),
    },
    payrollCycle: {
      findFirst: (...a: unknown[]) => mockCycleFindFirst(...a),
      findUniqueOrThrow: (...a: unknown[]) => mockCycleFindUniqueOrThrow(...a),
      update: (...a: unknown[]) => mockCycleUpdate(...a),
    },
    $transaction: (ops: unknown[]) => mockTransaction(ops),
  },
}));

vi.mock('./payslips.routes.js', () => ({ generatePayslipsForCycle: vi.fn() }));
vi.mock('../lib/comptaBridge.js', () => ({ dispatchComptaEvent: vi.fn() }));

const { default: app } = await import('../app.js');
const { signToken } = await import('../middleware/auth.js');

const legalSettings = {
  id: 'ls1', cnssEmployeeRate: 5.5, cnssEmployerRate: 16,
  iutsBrackets: [{ min: 0, max: null, rate: 0, deduction: 0 }],
};

describe('Intégration avances ↔ cycle de paie', () => {
  beforeEach(() => {
    [
      mockLegalSettingsFindUnique, mockEmployeeFindMany, mockEntryFindMany, mockPayrollConfigFindUnique,
      mockAdvanceFindMany, mockEntryCreateMany, mockCycleFindFirst, mockCycleFindUniqueOrThrow,
      mockEntryUpdateMany, mockCycleUpdate, mockAdvanceFindUnique, mockDeductionFindFirst,
      mockDeductionCreate, mockAdvanceUpdate,
    ].forEach((m) => m.mockReset());
    mockTransaction.mockClear();
  });

  const hrToken = signToken({ id: 'u1', email: 'hr@b.com', role: 'hr_manager', companyId: 'c1', employeeId: 'e2' });

  it('pré-remplit la ligne avances à la génération du cycle pour un employé avec solde restant', async () => {
    mockCycleFindFirst.mockResolvedValueOnce({ id: 'cyc1', companyId: 'c1', legalSettingsId: 'ls1' });
    mockLegalSettingsFindUnique.mockResolvedValueOnce(legalSettings);
    mockEmployeeFindMany.mockResolvedValueOnce([{ id: 'emp1', baseSalary: 200_000 }]);
    mockEntryFindMany.mockResolvedValueOnce([]);
    mockPayrollConfigFindUnique.mockResolvedValueOnce(null);
    mockAdvanceFindMany.mockResolvedValueOnce([{ id: 'adv1', employeeId: 'emp1', remainingBalance: 15_000 }]);
    // Re-fetch après syncEntries (GET /cycles/:id) — contenu sans importance
    // pour ce test (on n'asserte que sur l'appel à createMany ci-dessous),
    // juste assez complet pour que toPayrollCycleDTO ne plante pas.
    mockCycleFindUniqueOrThrow.mockResolvedValueOnce({
      id: 'cyc1', period: '2026-09', month: 9, year: 2026, status: 'brouillon',
      createdAt: new Date(), validatedAt: null, validatedBy: null, entries: [],
    });

    const res = await request(app).get('/api/payroll/cycles/cyc1').set('Authorization', `Bearer ${hrToken}`);

    expect(res.status).toBe(200);
    expect(mockEntryCreateMany).toHaveBeenCalledTimes(1);
    const data = mockEntryCreateMany.mock.calls[0][0].data;
    expect(data[0].avances).toEqual([{ id: 'adv1', label: 'Avance sur salaire', amount: 15_000, type: 'avance' }]);
  });

  it('applique le décompte automatique à la validation du cycle', async () => {
    mockCycleFindFirst.mockResolvedValueOnce({ id: 'cyc1', companyId: 'c1', legalSettingsId: 'ls1' });
    mockLegalSettingsFindUnique.mockResolvedValueOnce(legalSettings);
    mockEmployeeFindMany.mockResolvedValueOnce([]);
    mockEntryFindMany.mockResolvedValueOnce([{ employeeId: 'emp1' }]);
    mockPayrollConfigFindUnique.mockResolvedValueOnce(null);
    mockAdvanceFindMany.mockResolvedValueOnce([]);
    mockEntryUpdateMany.mockResolvedValueOnce({ count: 1 });
    // Objet complet requis par toPayrollCycleDTO/toPayrollEntryDTO (appelés
    // sur la valeur de retour de payrollCycle.update pour construire la
    // réponse JSON) — un objet partiel ferait planter res.json(...).
    const entryWithAdvance = {
      id: 'entry1', employeeId: 'emp1', cycleId: 'cyc1',
      baseSalary: 200_000, overtimeHours: 0, overtimeAmount: 0,
      primes: [], indemnites: [], avances: [{ id: 'adv1', label: 'Avance sur salaire', amount: 15_000, type: 'avance' }], retenues: [],
      absenceDays: 0, absenceAmount: 0,
      salaireBrut: 200_000, cnssEmployee: 11_000, cnssEmployer: 32_000, iuts: 0,
      salaireNet: 174_000, coutEmployeur: 232_000, status: 'valide',
    };
    mockCycleUpdate.mockResolvedValueOnce({
      id: 'cyc1', period: '2026-09', month: 9, year: 2026, status: 'valide',
      createdAt: new Date(), validatedAt: new Date(), validatedBy: 'hr@b.com',
      entries: [entryWithAdvance],
    });
    mockAdvanceFindUnique.mockResolvedValueOnce({ id: 'adv1', remainingBalance: 15_000 });
    mockDeductionFindFirst.mockResolvedValueOnce(null);

    const res = await request(app)
      .post('/api/payroll/cycles/cyc1/validate')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ validatedBy: 'hr@b.com' });

    expect(res.status).toBe(200);
    expect(mockDeductionCreate).toHaveBeenCalledWith({ data: { advanceId: 'adv1', payrollEntryId: 'entry1', amount: 15_000 } });
    expect(mockAdvanceUpdate).toHaveBeenCalledWith({ where: { id: 'adv1' }, data: { remainingBalance: 0, status: 'rembourse' } });
  });
});
```

- [ ] **Step 8: Lancer les tests et vérifier qu'ils passent**

Run: `cd server && npx vitest run src/routes/payroll.routes.advances.test.ts`
Expected: PASS (2 tests) — ajuster les mocks si l'ordre exact des appels `Promise.all` dans `syncEntries` diffère (les mocks sont résolus dans l'ordre de résolution des promesses, pas dans l'ordre d'appel — utiliser `mockResolvedValueOnce` par requête suffit car chaque fonction mockée est distincte).

- [ ] **Step 9: Lancer toute la suite serveur**

Run: `cd server && npm run test`
Expected: PASS, tous les tests précédents (Tasks 4, 5, 6) toujours au vert.

- [ ] **Step 10: Commit**

```bash
git add server/src/lib/payrollEngine.ts server/src/lib/payrollEngine.test.ts server/src/routes/payroll.routes.ts server/src/routes/payroll.routes.advances.test.ts
git commit -m "feat(payroll): auto-prefill and auto-deduct salary advances on cycle generation/validation"
```

---

### Task 7: Types frontend

**Files:**
- Modify: `src/types/index.ts:400-417`

**Interfaces:**
- Produces: `AdvanceChannel`, `AdvanceStatus`, `SalaryAdvance` (renomme `SalaryAdvanceRequest`), consommés par Tasks 8-13.

- [ ] **Step 1: Remplacer les types**

Dans `src/types/index.ts`, remplacer les lignes 400-417 (bloc `AdvanceStatus`/`SalaryAdvanceRequest`) :

```typescript
export type AdvanceChannel = 'whatsapp' | 'portail';
export type AdvanceStatus = 'en_attente' | 'rejete' | 'approuve' | 'verse_mobile_money' | 'en_remboursement' | 'rembourse';

export interface SalaryAdvance {
  id: string;
  employeeId: string;
  amount: number;
  remainingBalance: number;
  requestedAt: string;
  channel: AdvanceChannel;
  status: AdvanceStatus;
  approvedAt?: string;
  approvedBy?: string;
  rejectedAt?: string;
  rejectedBy?: string;
  rejectionReason?: string;
  mobileMoneyOperator?: MobileMoneyOperator;
  reference?: string;
  paidAt?: string;
}
```

- [ ] **Step 2: Vérifier la compilation**

Run: `npx tsc -b tsconfig.app.json`
Expected: erreurs dans `src/services/api/advances.ts` et `src/mocks/advances.ts` (types `SalaryAdvanceRequest` désormais introuvables — corrigés dans Task 8) ; aucune autre erreur ailleurs (seuls ces 2 fichiers référençaient le type, confirmé par recherche préalable).

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(types): replace mocked SalaryAdvanceRequest with real SalaryAdvance shape"
```

---

### Task 8: Service API frontend

**Files:**
- Modify: `src/services/api/advances.ts` (réécriture complète)
- Delete: `src/mocks/advances.ts`

**Interfaces:**
- Consumes: `apiClient`, `buildQueryString` (`@/lib/apiClient`) ; `SalaryAdvance`, `AdvanceChannel` (Task 7).
- Produces: `getAdvances(employeeId?: string): Promise<SalaryAdvance[]>`, `getAdvanceEligibility(): Promise<{ maxAdvanceAmount: number; hasActiveAdvance: boolean }>`, `createAdvanceRequest(amount: number): Promise<SalaryAdvance>`, `approveAdvanceRequest(id: string, approvedBy: string): Promise<SalaryAdvance>`, `rejectAdvanceRequest(id: string, rejectedBy: string, reason?: string): Promise<SalaryAdvance>`, `payAdvanceRequestViaMobileMoney(id: string): Promise<SalaryAdvance>`. Consommés par Task 9.

- [ ] **Step 1: Réécrire `src/services/api/advances.ts`**

```typescript
import { apiClient, buildQueryString } from '@/lib/apiClient';
import { SalaryAdvance } from '@/types';

export async function getAdvances(employeeId?: string): Promise<SalaryAdvance[]> {
  return apiClient.get<SalaryAdvance[]>(`/advances${buildQueryString({ employeeId })}`);
}

export interface AdvanceEligibility {
  maxAdvanceAmount: number;
  hasActiveAdvance: boolean;
}

export async function getAdvanceEligibility(): Promise<AdvanceEligibility> {
  return apiClient.get<AdvanceEligibility>('/advances/eligibility');
}

export async function createAdvanceRequest(amount: number): Promise<SalaryAdvance> {
  return apiClient.post<SalaryAdvance>('/advances', { amount });
}

export async function approveAdvanceRequest(id: string, approvedBy: string): Promise<SalaryAdvance> {
  return apiClient.post<SalaryAdvance>(`/advances/${id}/approve`, { approvedBy });
}

export async function rejectAdvanceRequest(id: string, rejectedBy: string, reason?: string): Promise<SalaryAdvance> {
  return apiClient.post<SalaryAdvance>(`/advances/${id}/reject`, { rejectedBy, reason });
}

export async function payAdvanceRequestViaMobileMoney(id: string): Promise<SalaryAdvance> {
  return apiClient.post<SalaryAdvance>(`/advances/${id}/pay`);
}
```

- [ ] **Step 2: Supprimer le mock**

```bash
git rm src/mocks/advances.ts
```

- [ ] **Step 3: Vérifier la compilation**

Run: `npx tsc -b tsconfig.app.json`
Expected: erreurs restantes uniquement dans `src/hooks/useAdvances.ts` (corrigé Task 9) et les composants qui l'utilisent (corrigés Tasks 11-13).

- [ ] **Step 4: Commit**

```bash
git add src/services/api/advances.ts
git commit -m "feat(advances): replace mocked service with real API calls"
```

---

### Task 9: Hook frontend `useAdvances`

**Files:**
- Modify: `src/hooks/useAdvances.ts` (réécriture complète)

**Interfaces:**
- Consumes: Task 8's service functions.
- Produces: `useAdvancesQuery(employeeId?: string)`, `useAdvanceEligibilityQuery()`, `useCreateAdvanceMutation()`, `useApproveAdvanceMutation()`, `useRejectAdvanceMutation()`, `usePayAdvanceMutation()`. Consommés par Tasks 11-13.

- [ ] **Step 1: Réécrire `src/hooks/useAdvances.ts`**

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  approveAdvanceRequest,
  createAdvanceRequest,
  getAdvanceEligibility,
  getAdvances,
  payAdvanceRequestViaMobileMoney,
  rejectAdvanceRequest,
} from '@/services/api/advances';

function useInvalidateAdvances() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['advances'] });
    queryClient.invalidateQueries({ queryKey: ['advance-eligibility'] });
  };
}

export function useAdvancesQuery(employeeId?: string) {
  return useQuery({
    queryKey: ['advances', employeeId],
    queryFn: () => getAdvances(employeeId),
  });
}

export function useAdvanceEligibilityQuery() {
  return useQuery({
    queryKey: ['advance-eligibility'],
    queryFn: getAdvanceEligibility,
  });
}

export function useCreateAdvanceMutation() {
  const invalidate = useInvalidateAdvances();
  return useMutation({
    mutationFn: (amount: number) => createAdvanceRequest(amount),
    onSuccess: invalidate,
  });
}

export function useApproveAdvanceMutation() {
  const invalidate = useInvalidateAdvances();
  return useMutation({
    mutationFn: ({ id, approvedBy }: { id: string; approvedBy: string }) => approveAdvanceRequest(id, approvedBy),
    onSuccess: invalidate,
  });
}

export function useRejectAdvanceMutation() {
  const invalidate = useInvalidateAdvances();
  return useMutation({
    mutationFn: ({ id, rejectedBy, reason }: { id: string; rejectedBy: string; reason?: string }) =>
      rejectAdvanceRequest(id, rejectedBy, reason),
    onSuccess: invalidate,
  });
}

export function usePayAdvanceMutation() {
  const invalidate = useInvalidateAdvances();
  return useMutation({
    mutationFn: (id: string) => payAdvanceRequestViaMobileMoney(id),
    onSuccess: invalidate,
  });
}
```

- [ ] **Step 2: Vérifier la compilation**

Run: `npx tsc -b tsconfig.app.json`
Expected: erreurs restantes uniquement dans `src/pages/payments/AdvancesTab.tsx` (`useAdvanceRequestsQuery`/`useMarkAdvanceDeductedMutation` n'existent plus — corrigé Task 11).

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useAdvances.ts
git commit -m "feat(advances): update useAdvances hook for real backend (add create/reject/eligibility)"
```

---

### Task 10: Constantes et libellés

**Files:**
- Modify: `src/lib/constants.ts:159-164`
- Modify: `src/locales/fr.json:400-414`

**Interfaces:**
- Produces: `ADVANCE_STATUS_VARIANT` couvrant les 6 nouveaux statuts ; clés i18n `payments.advances.*` mises à jour.

- [ ] **Step 1: Mettre à jour `ADVANCE_STATUS_VARIANT`**

Dans `src/lib/constants.ts`, remplacer les lignes 159-164 :

```typescript
export const ADVANCE_STATUS_VARIANT: Record<string, 'success' | 'warning' | 'secondary' | 'accent' | 'destructive'> = {
  en_attente: 'secondary',
  approuve: 'warning',
  rejete: 'destructive',
  verse_mobile_money: 'accent',
  en_remboursement: 'warning',
  rembourse: 'success',
};
```

- [ ] **Step 2: Mettre à jour les libellés `fr.json`**

Dans `src/locales/fr.json`, remplacer le bloc `advances` (lignes 400-414) :

```json
    "advances": {
      "title": "Avances sur salaire",
      "requestedAt": "Demandée le",
      "approve": "Approuver",
      "approved": "Demande approuvée",
      "reject": "Rejeter",
      "rejected": "Demande rejetée",
      "payViaMobileMoney": "Verser via Mobile Money",
      "paying": "Versement en cours...",
      "paid": "Avance versée avec succès",
      "remainingBalance": "Solde restant",
      "status_en_attente": "En attente",
      "status_approuve": "Approuvé",
      "status_rejete": "Rejeté",
      "status_verse_mobile_money": "Versé par Mobile Money",
      "status_en_remboursement": "En remboursement",
      "status_rembourse": "Remboursée",
      "requestTitle": "Demander une avance",
      "amount": "Montant",
      "maxAmount": "Plafond autorisé",
      "submit": "Envoyer la demande",
      "requestSubmitted": "Demande envoyée",
      "hasActiveAdvance": "Vous avez déjà une avance en cours de traitement ou de remboursement.",
      "history": "Historique de mes avances"
    }
```

(garder les clés `myPayslips`/etc. adjacentes intactes — remplacement du seul bloc `advances`.)

- [ ] **Step 3: Vérifier la compilation**

Run: `npx tsc -b tsconfig.app.json`
Expected: mêmes erreurs restantes qu'après Task 9 (dans `AdvancesTab.tsx`), rien de nouveau.

- [ ] **Step 4: Commit**

```bash
git add src/lib/constants.ts src/locales/fr.json
git commit -m "feat(advances): update status badges and labels for real workflow"
```

---

### Task 11: Mise à jour de `AdvancesTab.tsx` (vue RH/compta)

**Files:**
- Modify: `src/pages/payments/AdvancesTab.tsx`

**Interfaces:**
- Consumes: `useAdvancesQuery`, `useApproveAdvanceMutation`, `useRejectAdvanceMutation`, `usePayAdvanceMutation` (Task 9).

- [ ] **Step 1: Réécrire le composant**

```typescript
// src/pages/payments/AdvancesTab.tsx
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Smartphone } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PermissionGate } from '@/components/auth/PermissionGate';
import {
  useAdvancesQuery,
  useApproveAdvanceMutation,
  usePayAdvanceMutation,
  useRejectAdvanceMutation,
} from '@/hooks/useAdvances';
import { useEmployeesQuery } from '@/hooks/useEmployees';
import { useCurrentCompanyQuery } from '@/hooks/useCompanies';
import { useAuthStore } from '@/store/authStore';
import { ADVANCE_STATUS_VARIANT } from '@/lib/constants';
import { formatCurrency, formatDate } from '@/lib/utils';

export function AdvancesTab() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const { data: advances, isLoading } = useAdvancesQuery();
  const { data: employeesPage } = useEmployeesQuery({ perPage: 1000 });
  const { data: company } = useCurrentCompanyQuery();
  const currencyCode = company?.currencyCode;
  const approveMutation = useApproveAdvanceMutation();
  const rejectMutation = useRejectAdvanceMutation();
  const payMutation = usePayAdvanceMutation();

  const employeeName = (employeeId: string) => {
    const emp = employeesPage?.data.find((e) => e.id === employeeId);
    return emp ? `${emp.firstName} ${emp.lastName}` : employeeId;
  };

  const sorted = [...(advances ?? [])].sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));

  const handleApprove = async (id: string) => {
    if (!user) return;
    try {
      await approveMutation.mutateAsync({ id, approvedBy: user.email });
      toast.success(t('payments.advances.approved'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'approbation");
    }
  };

  const handleReject = async (id: string) => {
    if (!user) return;
    try {
      await rejectMutation.mutateAsync({ id, rejectedBy: user.email });
      toast.success(t('payments.advances.rejected'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors du rejet');
    }
  };

  const handlePay = async (id: string) => {
    try {
      await payMutation.mutateAsync(id);
      toast.success(t('payments.advances.paid'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors du paiement');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('payments.advances.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('employees.fullName')}</TableHead>
                <TableHead>{t('app.amount')}</TableHead>
                <TableHead>{t('payments.advances.requestedAt')}</TableHead>
                <TableHead>{t('app.status')}</TableHead>
                <PermissionGate permission="advances:approve">
                  <TableHead className="text-right">{t('app.actions')}</TableHead>
                </PermissionGate>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    {t('app.noResults')}
                  </TableCell>
                </TableRow>
              )}
              {sorted.map((advance) => (
                <TableRow key={advance.id}>
                  <TableCell className="font-medium">{employeeName(advance.employeeId)}</TableCell>
                  <TableCell>{formatCurrency(advance.amount, currencyCode)}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(advance.requestedAt, 'dd/MM/yyyy')}</TableCell>
                  <TableCell>
                    <Badge variant={ADVANCE_STATUS_VARIANT[advance.status]}>
                      {t(`payments.advances.status_${advance.status}`)}
                    </Badge>
                    {(advance.status === 'en_remboursement' || advance.status === 'verse_mobile_money') && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t('payments.advances.remainingBalance')} : {formatCurrency(advance.remainingBalance, currencyCode)}
                      </p>
                    )}
                    {advance.reference && (
                      <p className="mt-1 text-xs text-muted-foreground">{advance.reference}</p>
                    )}
                  </TableCell>
                  <PermissionGate permission="advances:approve">
                    <TableCell className="text-right space-x-2">
                      {advance.status === 'en_attente' && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => handleApprove(advance.id)} disabled={approveMutation.isPending}>
                            {t('payments.advances.approve')}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleReject(advance.id)} disabled={rejectMutation.isPending}>
                            {t('payments.advances.reject')}
                          </Button>
                        </>
                      )}
                      {advance.status === 'approuve' && (
                        <Button size="sm" onClick={() => handlePay(advance.id)} disabled={payMutation.isPending}>
                          <Smartphone className="mr-2 h-4 w-4" />
                          {payMutation.isPending ? t('payments.advances.paying') : t('payments.advances.payViaMobileMoney')}
                        </Button>
                      )}
                    </TableCell>
                  </PermissionGate>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Vérifier la compilation**

Run: `npx tsc -b tsconfig.app.json`
Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add src/pages/payments/AdvancesTab.tsx
git commit -m "feat(advances): update RH/compta advances list for real approve/reject/pay workflow"
```

---

### Task 12: Onglet self-service "Mes avances"

**Files:**
- Create: `src/pages/self/MyAdvancesTab.tsx`
- Modify: `src/pages/self/SelfServicePage.tsx`
- Modify: `src/locales/fr.json` (clés `nav.myAdvances`)

**Interfaces:**
- Consumes: `useAdvancesQuery`, `useAdvanceEligibilityQuery`, `useCreateAdvanceMutation` (Task 9).

- [ ] **Step 1: Ajouter la clé de navigation**

Dans `src/locales/fr.json`, à côté de `"myLeaves": "Mes congés",` (ligne 106), ajouter :

```json
    "myAdvances": "Mes avances",
```

- [ ] **Step 2: Créer `MyAdvancesTab.tsx`**

```typescript
// src/pages/self/MyAdvancesTab.tsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAdvanceEligibilityQuery, useAdvancesQuery, useCreateAdvanceMutation } from '@/hooks/useAdvances';
import { useAuthStore } from '@/store/authStore';
import { useCurrentCompanyQuery } from '@/hooks/useCompanies';
import { ADVANCE_STATUS_VARIANT } from '@/lib/constants';
import { formatCurrency, formatDate } from '@/lib/utils';

export function MyAdvancesTab() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const { data: advances, isLoading } = useAdvancesQuery(user?.employeeId);
  const { data: eligibility } = useAdvanceEligibilityQuery();
  const { data: company } = useCurrentCompanyQuery();
  const currencyCode = company?.currencyCode;
  const createMutation = useCreateAdvanceMutation();
  const [amount, setAmount] = useState('');

  const sorted = [...(advances ?? [])].sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));

  const handleSubmit = async () => {
    const parsed = Number(amount);
    if (!parsed || parsed <= 0) return;
    try {
      await createMutation.mutateAsync(parsed);
      toast.success(t('payments.advances.requestSubmitted'));
      setAmount('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la demande');
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('payments.advances.requestTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {eligibility?.hasActiveAdvance ? (
            <p className="text-sm text-muted-foreground">{t('payments.advances.hasActiveAdvance')}</p>
          ) : (
            <>
              {eligibility && (
                <p className="text-sm text-muted-foreground">
                  {t('payments.advances.maxAmount')} : {formatCurrency(eligibility.maxAdvanceAmount, currencyCode)}
                </p>
              )}
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground">{t('payments.advances.amount')}</label>
                  <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} min={1} />
                </div>
                <Button onClick={handleSubmit} disabled={createMutation.isPending || !amount}>
                  {t('payments.advances.submit')}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('payments.advances.history')}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : sorted.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">{t('app.noData')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('app.amount')}</TableHead>
                  <TableHead>{t('payments.advances.requestedAt')}</TableHead>
                  <TableHead>{t('app.status')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((advance) => (
                  <TableRow key={advance.id}>
                    <TableCell>{formatCurrency(advance.amount, currencyCode)}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(advance.requestedAt, 'dd/MM/yyyy')}</TableCell>
                    <TableCell>
                      <Badge variant={ADVANCE_STATUS_VARIANT[advance.status]}>
                        {t(`payments.advances.status_${advance.status}`)}
                      </Badge>
                      {(advance.status === 'en_remboursement' || advance.status === 'verse_mobile_money') && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t('payments.advances.remainingBalance')} : {formatCurrency(advance.remainingBalance, currencyCode)}
                        </p>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Ajouter l'onglet à `SelfServicePage.tsx`**

Dans `src/pages/self/SelfServicePage.tsx`, ajouter l'import :

```typescript
import { MyAdvancesTab } from '@/pages/self/MyAdvancesTab';
```

Ajouter le trigger juste après `myLeaves` :

```typescript
          <TabsTrigger value="advances">{t('nav.myAdvances')}</TabsTrigger>
```

Ajouter le contenu juste après le `TabsContent value="leaves"` :

```typescript
        <TabsContent value="advances">
          <MyAdvancesTab />
        </TabsContent>
```

- [ ] **Step 4: Vérifier la compilation**

Run: `npx tsc -b tsconfig.app.json`
Expected: aucune erreur.

- [ ] **Step 5: Commit**

```bash
git add src/pages/self/MyAdvancesTab.tsx src/pages/self/SelfServicePage.tsx src/locales/fr.json
git commit -m "feat(self-service): add salary advance request tab"
```

---

### Task 13: Fiche compte employé (onglet RH/compta)

**Files:**
- Create: `src/pages/employees/EmployeeAccountTab.tsx`
- Modify: `src/pages/employees/EmployeeDetailPage.tsx`
- Modify: `src/locales/fr.json` (clé `employees.tabs.account`)

**Interfaces:**
- Consumes: `useAdvancesQuery` (Task 9), `usePayslipsQuery` (existant, `@/hooks/usePayslips`).

- [ ] **Step 1: Ajouter la clé de traduction**

Dans `src/locales/fr.json`, dans le bloc `"tabs"` des employés (ligne 168-175), ajouter après `"career": "Carrière",` :

```json
      "account": "Compte",
```

- [ ] **Step 2: Créer `EmployeeAccountTab.tsx`**

```typescript
// src/pages/employees/EmployeeAccountTab.tsx
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAdvancesQuery } from '@/hooks/useAdvances';
import { usePayslipsQuery } from '@/hooks/usePayslips';
import { useCurrentCompanyQuery } from '@/hooks/useCompanies';
import { ADVANCE_STATUS_VARIANT, SEND_STATUS_VARIANT } from '@/lib/constants';
import { formatCurrency, formatDate, formatPeriod } from '@/lib/utils';
import { Employee } from '@/types';

export function EmployeeAccountTab({ employee }: { employee: Employee }) {
  const { t } = useTranslation();
  const { data: advances, isLoading: advancesLoading } = useAdvancesQuery(employee.id);
  const { data: payslips, isLoading: payslipsLoading } = usePayslipsQuery(employee.id);
  const { data: company } = useCurrentCompanyQuery();
  const currencyCode = company?.currencyCode;

  const outstandingBalance = (advances ?? [])
    .filter((a) => a.status === 'verse_mobile_money' || a.status === 'en_remboursement')
    .reduce((sum, a) => sum + a.remainingBalance, 0);

  const sortedAdvances = [...(advances ?? [])].sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
  const sortedPayslips = [...(payslips ?? [])].sort((a, b) => b.period.localeCompare(a.period));

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="grid grid-cols-2 gap-4 p-6 md:grid-cols-3">
          <div>
            <div className="text-xs text-muted-foreground">{t('employees.baseSalary')}</div>
            <div className="text-sm font-medium">{formatCurrency(employee.baseSalary, currencyCode)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">{t('payments.advances.remainingBalance')}</div>
            <div className="text-sm font-medium">{formatCurrency(outstandingBalance, currencyCode)}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('payments.advances.history')}</CardTitle>
        </CardHeader>
        <CardContent>
          {advancesLoading ? (
            <p className="text-sm text-muted-foreground">{t('app.loading')}</p>
          ) : sortedAdvances.length === 0 ? (
            <p className="py-4 text-center text-muted-foreground">{t('app.noData')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('app.amount')}</TableHead>
                  <TableHead>{t('payments.advances.requestedAt')}</TableHead>
                  <TableHead>{t('app.status')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedAdvances.map((advance) => (
                  <TableRow key={advance.id}>
                    <TableCell>{formatCurrency(advance.amount, currencyCode)}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(advance.requestedAt, 'dd/MM/yyyy')}</TableCell>
                    <TableCell>
                      <Badge variant={ADVANCE_STATUS_VARIANT[advance.status]}>
                        {t(`payments.advances.status_${advance.status}`)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('payslips.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          {payslipsLoading ? (
            <p className="text-sm text-muted-foreground">{t('app.loading')}</p>
          ) : sortedPayslips.length === 0 ? (
            <p className="py-4 text-center text-muted-foreground">{t('app.noData')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('payroll.period')}</TableHead>
                  <TableHead>{t('payslips.netToPay')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedPayslips.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium capitalize">{formatPeriod(p.period)}</TableCell>
                    <TableCell>{formatCurrency(p.salaireNet, currencyCode)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Ajouter l'onglet à `EmployeeDetailPage.tsx`**

Dans `src/pages/employees/EmployeeDetailPage.tsx`, ajouter l'import :

```typescript
import { EmployeeAccountTab } from '@/pages/employees/EmployeeAccountTab';
```

Ajouter le trigger dans la liste (après `career`, ligne ~200) :

```typescript
          <TabsTrigger value="account">{t('employees.tabs.account')}</TabsTrigger>
```

Ajouter le contenu après le `TabsContent value="career">...</TabsContent>` (avant la fermeture `</Tabs>`) :

```typescript
        <TabsContent value="account">
          <EmployeeAccountTab employee={emp} />
        </TabsContent>
```

- [ ] **Step 4: Vérifier la compilation**

Run: `npx tsc -b tsconfig.app.json`
Expected: aucune erreur. Si `SEND_STATUS_VARIANT` importé sans être utilisé dans `EmployeeAccountTab.tsx` (retiré de la version finale ci-dessus faute d'usage), supprimer l'import inutilisé pour éviter un avertissement du linter.

- [ ] **Step 5: Lancer le lint**

Run: `npx oxlint src/pages/employees/EmployeeAccountTab.tsx src/pages/employees/EmployeeDetailPage.tsx`
Expected: aucune erreur.

- [ ] **Step 6: Commit**

```bash
git add src/pages/employees/EmployeeAccountTab.tsx src/pages/employees/EmployeeDetailPage.tsx src/locales/fr.json
git commit -m "feat(employees): add account tab (salary, advances, payslip history)"
```

---

### Task 14: Vérification manuelle de bout en bout

**Files:** aucun (validation manuelle, pas de code)

- [ ] **Step 1: Lancer le backend et le frontend**

Run: `npm run dev:all` (vérifier au préalable qu'aucun processus n'occupe déjà les ports 3000/4000 — `netstat -ano | grep -E ":3000|:4000"` sur Windows/Git Bash).

- [ ] **Step 2: Configurer le plafond (optionnel)**

Dans "Configuration du bulletin" (paramètres entreprise), vérifier ou ajuster `maxAdvancePercent` si un endpoint/UI existe déjà pour éditer `PayrollConfig` — sinon laisser la valeur par défaut (30 %) pour ce test.

- [ ] **Step 3: Demande self-service**

Se connecter avec un compte `employee` (ou tout rôle ayant un `employeeId` lié). Aller dans "Mon espace" → "Mes avances". Vérifier que le plafond s'affiche, soumettre une demande sous le plafond. Vérifier qu'elle apparaît avec le statut "En attente".

- [ ] **Step 4: Approbation et versement**

Se connecter avec un compte `hr_manager` ou `admin`. Aller dans "Paiements" → "Avances sur salaire". Approuver la demande, puis la verser via Mobile Money. Vérifier les transitions de statut et la présence de la référence générée.

- [ ] **Step 5: Génération et validation d'un cycle de paie**

Créer (ou ouvrir) un cycle de paie pour la période courante. Vérifier que l'employé ayant reçu l'avance a une ligne "Avance sur salaire" pré-remplie dans ses éléments variables, avec le bon montant. Valider le cycle.

- [ ] **Step 6: Vérification du solde**

Retourner sur la fiche de l'employé (Employés → sélectionner l'employé → onglet "Compte"). Vérifier que l'avance apparaît en historique avec le bon statut ("Remboursée" si le salaire net couvrait tout le montant, "En remboursement" sinon) et que le solde restant affiché est correct. Vérifier aussi côté "Mes avances" (self-service) que l'employé voit la même mise à jour.

- [ ] **Step 7: Cas d'erreur**

Tenter une deuxième demande d'avance alors que la première n'est pas encore soldée → vérifier le message d'erreur. Tenter une demande dépassant le plafond → vérifier le message d'erreur.

- [ ] **Step 8: Rapport**

Consigner dans la conversation les éventuels problèmes rencontrés (pas de fichier à créer — juste un compte-rendu texte au chat, cohérent avec le reste du repo qui ne documente pas les smoke-tests dans des fichiers).

---
