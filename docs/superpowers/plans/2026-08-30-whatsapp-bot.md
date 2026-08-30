# Bot conversationnel WhatsApp (bulletin de paie + demande de congé) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two inbound WhatsApp conversational flows to LaafiPay — PIN-authenticated payslip PDF delivery, and an interactive leave-request flow with manager/employee notifications — on top of the existing one-way Meta Cloud API integration.

**Architecture:** A single webhook endpoint (`/api/whatsapp/webhook`) resolves the employee by phone number, loads a DB-backed `WhatsAppSession` (flow + step + data), and dispatches to plain step-handler functions per flow (`whatsappFlows/payslip.ts`, `whatsappFlows/leave.ts`) — no plugin/class abstraction, matching the repo's existing function-per-file style. Server-side PDF generation (`payslipPdf.ts`, jsPDF, no DOM) fills the gap that the official payslip today only renders as an HTML dialog in the browser.

**Tech Stack:** Express + Prisma (server/), bcryptjs, jsPDF (Node-compatible, no canvas), @vercel/blob (existing), Meta WhatsApp Cloud API (Graph API v21.0). Vitest is introduced in Task 1 — the repo currently has zero automated tests.

**Spec:** `docs/superpowers/specs/2026-08-30-whatsapp-bot-design.md`

## Corrections found while planning (read before starting)

- **PDF generation is not a "port" — it's new code.** The spec assumed `PayslipOfficialTemplate.tsx` already uses jsPDF. It doesn't: that component is plain React/HTML, viewed in a dialog (`PayslipPreviewDialog.tsx`) with no PDF export anywhere in the app today. `jsPDF` is only used in the unrelated `LivePayslipPreviewPage.tsx` (payroll simulation tool). Task 12 below builds the jsPDF layout from scratch, using `PayslipOfficialTemplate.tsx`'s data shape and section order as the reference for what to render — verified visually (open the generated PDF), not by pixel-diffing against the React component.
- **"Jours ouvrés" vs. existing day-counting.** The spec's leave-flow example says "10 jours ouvrés" (business days), but the existing `POST /api/leaves` (`leaves.routes.ts`) computes plain calendar days (`Math.floor((endDate - startDate) / 86_400_000) + 1`), with no weekend exclusion anywhere in the app. Task 7 reuses the **existing calendar-day formula** for the WhatsApp flow too, so the same two dates always produce the same `LeaveRequest.daysCount` regardless of which channel created the request. Introducing a second, inconsistent day-counting rule would be a worse outcome than the spec's wording being loose.
- **Testing strategy.** The repo has no test runner today. Task 1 adds Vitest. Pure logic (PIN lockout rules, date parsing, day counts, ancienneté accrual, WhatsApp payload builders) gets real unit tests. Code that touches Prisma is tested by mocking `../lib/prisma.js` with `vi.mock` (no real test database — introducing one is out of scope for this feature). HTTP routes are tested with `supertest` against the exported `app` from `server/src/app.ts`. The webhook's actual external behavior (real Meta calls, real WhatsApp messages) is verified manually via the ngrok runbook in Task 16, consistent with how the rest of the codebase ships without integration tests against live third parties.

## Global Constraints

- Server code is ESM (`"type": "module"`, `moduleResolution: NodeNext`) — all relative imports use explicit `.js` extensions even though source files are `.ts`.
- PIN is bcrypt-hashed (`bcrypt.hash(pin, 10)`, matching the existing password convention in `auth.routes.ts`) — never stored or logged in plaintext.
- `Employee.whatsappPinHash`/`whatsappPinFailedAttempts`/`whatsappPinLockedUntil` must never be added to `toEmployeeDTO` (`server/src/lib/dto.ts`) — they are internal-only fields.
- PIN lockout: 3 failed attempts → locked for 15 minutes (`whatsappPinLockedUntil = now + 15min`), then auto-unlocks.
- `WhatsAppSession` TTL: 10 minutes of inactivity, renewed on every inbound message; an expired session is treated as "no session".
- Ancienneté leave accrual: +1 jour ouvrable per complete 5-year tranche of continuous service, cumulative, no cap (confirmed with the user — Code du travail burkinabè).
- All new Meta template sends (`demande_conge_manager`, `conge_valide`, `conge_refuse`) must fail gracefully (return `{ ok: false, error }`, never throw) when the template isn't yet approved in Meta Business Manager — same pattern as the existing `sendPayslipWhatsAppNotification`.
- No manager-side WhatsApp interaction (approve/refuse stays on the web portal) — confirmed scope boundary, do not build it.

---

## Task 1: Set up Vitest for the server package

**Files:**
- Modify: `server/package.json`
- Create: `server/vitest.config.ts`
- Create: `server/src/lib/sanityCheck.test.ts` (deleted at the end of the task once real tests exist elsewhere — see Step 4)

**Interfaces:**
- Produces: `npm --prefix server run test` (single run), `npm --prefix server run test:watch` (watch mode) — every later task's tests are run this way.

- [ ] **Step 1: Add Vitest as a dev dependency and test scripts**

Edit `server/package.json`, add to `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

Add to `"devDependencies"`:

```json
"vitest": "^3.2.4"
```

Run: `npm --prefix server install`

- [ ] **Step 2: Create the Vitest config**

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

- [ ] **Step 3: Write a throwaway sanity test and confirm the runner works end to end**

```typescript
// server/src/lib/sanityCheck.test.ts
import { describe, it, expect } from 'vitest';

describe('vitest setup', () => {
  it('runs a basic assertion', () => {
    expect(1 + 1).toBe(2);
  });
});
```

Run: `npm --prefix server run test`
Expected: `1 passed`

- [ ] **Step 4: Delete the sanity test (its only job was to prove the runner works) and commit the setup**

```bash
rm server/src/lib/sanityCheck.test.ts
git add server/package.json server/package-lock.json server/vitest.config.ts
git commit -m "test(server): add Vitest test runner"
```

---

## Task 2: Prisma schema — WhatsApp PIN, sessions, payslip PDF cache, new leave types

**Files:**
- Modify: `server/prisma/schema.prisma`
- Create: `server/prisma/migrations/<timestamp>_whatsapp_bot/migration.sql` (generated by Prisma, not hand-written)

**Interfaces:**
- Produces: `Employee.whatsappPinHash: string | null`, `Employee.whatsappPinFailedAttempts: number`, `Employee.whatsappPinLockedUntil: Date | null`; `Payslip.pdfUrl: string | null`; `LeaveType` enum values `conge_anciennete`, `examen_formation`; new `WhatsAppSession` model with fields `id, phone (unique), employeeId, flow, step, data (Json), expiresAt`.

- [ ] **Step 1: Edit the schema**

In `server/prisma/schema.prisma`, inside `model Employee`, add after the existing `bankInfoProvided`/onboarding fields block (near `avatar`):

```prisma
  whatsappPinHash           String?
  whatsappPinFailedAttempts Int       @default(0)
  whatsappPinLockedUntil    DateTime?
```

Add a relation field so Prisma generates the back-reference (place alongside the other one-to-many relations, e.g. near `peerFeedbackRequests`):

```prisma
  whatsappSessions WhatsAppSession[]
```

In `model Payslip`, add after `whatsappError`:

```prisma
  pdfUrl String?
```

In `enum LeaveType`, add two new values:

```prisma
enum LeaveType {
  conge_paye
  maladie
  sans_solde
  evenement_familial
  maternite
  paternite
  recuperation
  conge_anciennete
  examen_formation
}
```

Add a new model anywhere after `LeaveBalance`:

```prisma
model WhatsAppSession {
  id         String   @id @default(cuid())
  phone      String   @unique
  employeeId String
  employee   Employee @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  flow       String
  step       String
  data       Json     @default("{}")
  expiresAt  DateTime

  @@index([employeeId])
}
```

- [ ] **Step 2: Generate and apply the migration**

Run: `npm --prefix server run prisma:migrate -- --name whatsapp_bot`
Expected: Prisma prints "Your database is now in sync with your schema" and creates `server/prisma/migrations/<timestamp>_whatsapp_bot/migration.sql`.

- [ ] **Step 3: Regenerate the Prisma client and verify the server still typechecks**

Run: `npx prisma generate --schema=server/prisma/schema.prisma`
Run: `cd server && npx tsc -b --noEmit`
Expected: no type errors (existing code doesn't reference the new fields yet, so this just confirms the schema is valid).

- [ ] **Step 4: Commit**

```bash
git add server/prisma/schema.prisma server/prisma/migrations
git commit -m "feat(db): add WhatsApp PIN fields, WhatsAppSession, payslip pdfUrl, new leave types"
```

---

## Task 3: PIN verification & lockout logic

**Files:**
- Create: `server/src/lib/whatsappPin.ts`
- Test: `server/src/lib/whatsappPin.test.ts`

**Interfaces:**
- Consumes: nothing (pure logic, no Prisma/bcrypt calls inside — callers pass in the current DB state and get back what to write).
- Produces:
  - `hashPin(pin: string): Promise<string>`
  - `verifyPin(pin: string, employee: { whatsappPinHash: string | null; whatsappPinFailedAttempts: number; whatsappPinLockedUntil: Date | null }, now?: Date): Promise<PinCheckResult>`
  - `type PinCheckResult = { outcome: 'no_pin_set' } | { outcome: 'locked'; unlocksAt: Date } | { outcome: 'incorrect'; attemptsRemaining: number; update: { whatsappPinFailedAttempts: number; whatsappPinLockedUntil: Date | null } } | { outcome: 'correct'; update: { whatsappPinFailedAttempts: 0; whatsappPinLockedUntil: null } }`
  - `PIN_MAX_ATTEMPTS = 3`, `PIN_LOCKOUT_MINUTES = 15`

- [ ] **Step 1: Write the failing tests**

```typescript
// server/src/lib/whatsappPin.test.ts
import { describe, it, expect } from 'vitest';
import { hashPin, verifyPin, PIN_MAX_ATTEMPTS } from './whatsappPin.js';

describe('hashPin/verifyPin', () => {
  it('reports no_pin_set when the employee has never configured a PIN', async () => {
    const result = await verifyPin('4821', { whatsappPinHash: null, whatsappPinFailedAttempts: 0, whatsappPinLockedUntil: null });
    expect(result.outcome).toBe('no_pin_set');
  });

  it('reports correct and resets the attempt counter on a matching PIN', async () => {
    const hash = await hashPin('4821');
    const result = await verifyPin('4821', { whatsappPinHash: hash, whatsappPinFailedAttempts: 2, whatsappPinLockedUntil: null });
    expect(result.outcome).toBe('correct');
    if (result.outcome === 'correct') {
      expect(result.update).toEqual({ whatsappPinFailedAttempts: 0, whatsappPinLockedUntil: null });
    }
  });

  it('reports incorrect with the remaining attempt count on a wrong PIN', async () => {
    const hash = await hashPin('4821');
    const result = await verifyPin('0000', { whatsappPinHash: hash, whatsappPinFailedAttempts: 0, whatsappPinLockedUntil: null });
    expect(result.outcome).toBe('incorrect');
    if (result.outcome === 'incorrect') {
      expect(result.attemptsRemaining).toBe(PIN_MAX_ATTEMPTS - 1);
      expect(result.update.whatsappPinFailedAttempts).toBe(1);
      expect(result.update.whatsappPinLockedUntil).toBeNull();
    }
  });

  it('locks the account on the 3rd consecutive wrong attempt', async () => {
    const hash = await hashPin('4821');
    const now = new Date('2026-08-30T10:00:00Z');
    const result = await verifyPin('0000', { whatsappPinHash: hash, whatsappPinFailedAttempts: PIN_MAX_ATTEMPTS - 1, whatsappPinLockedUntil: null }, now);
    expect(result.outcome).toBe('incorrect');
    if (result.outcome === 'incorrect') {
      expect(result.attemptsRemaining).toBe(0);
      expect(result.update.whatsappPinLockedUntil).toEqual(new Date('2026-08-30T10:15:00Z'));
    }
  });

  it('reports locked with the unlock time when still within the lockout window', async () => {
    const hash = await hashPin('4821');
    const now = new Date('2026-08-30T10:05:00Z');
    const lockedUntil = new Date('2026-08-30T10:15:00Z');
    const result = await verifyPin('4821', { whatsappPinHash: hash, whatsappPinFailedAttempts: PIN_MAX_ATTEMPTS, whatsappPinLockedUntil: lockedUntil }, now);
    expect(result.outcome).toBe('locked');
    if (result.outcome === 'locked') {
      expect(result.unlocksAt).toEqual(lockedUntil);
    }
  });

  it('allows a fresh attempt once the lockout window has passed', async () => {
    const hash = await hashPin('4821');
    const now = new Date('2026-08-30T10:16:00Z');
    const lockedUntil = new Date('2026-08-30T10:15:00Z');
    const result = await verifyPin('4821', { whatsappPinHash: hash, whatsappPinFailedAttempts: PIN_MAX_ATTEMPTS, whatsappPinLockedUntil: lockedUntil }, now);
    expect(result.outcome).toBe('correct');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm --prefix server run test -- whatsappPin`
Expected: FAIL — `Cannot find module './whatsappPin.js'`

- [ ] **Step 3: Implement**

```typescript
// server/src/lib/whatsappPin.ts
import bcrypt from 'bcryptjs';

export const PIN_MAX_ATTEMPTS = 3;
export const PIN_LOCKOUT_MINUTES = 15;

export type PinCheckResult =
  | { outcome: 'no_pin_set' }
  | { outcome: 'locked'; unlocksAt: Date }
  | { outcome: 'incorrect'; attemptsRemaining: number; update: { whatsappPinFailedAttempts: number; whatsappPinLockedUntil: Date | null } }
  | { outcome: 'correct'; update: { whatsappPinFailedAttempts: 0; whatsappPinLockedUntil: null } };

export interface EmployeePinState {
  whatsappPinHash: string | null;
  whatsappPinFailedAttempts: number;
  whatsappPinLockedUntil: Date | null;
}

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, 10);
}

export async function verifyPin(pin: string, employee: EmployeePinState, now: Date = new Date()): Promise<PinCheckResult> {
  if (!employee.whatsappPinHash) {
    return { outcome: 'no_pin_set' };
  }

  if (employee.whatsappPinLockedUntil && employee.whatsappPinLockedUntil > now) {
    return { outcome: 'locked', unlocksAt: employee.whatsappPinLockedUntil };
  }

  const valid = await bcrypt.compare(pin, employee.whatsappPinHash);
  if (valid) {
    return { outcome: 'correct', update: { whatsappPinFailedAttempts: 0, whatsappPinLockedUntil: null } };
  }

  // Le verrou a expiré depuis le dernier échec : on repart d'un compteur à zéro,
  // pas du compteur figé au moment du verrouillage.
  const previousAttempts = employee.whatsappPinLockedUntil && employee.whatsappPinLockedUntil <= now ? 0 : employee.whatsappPinFailedAttempts;
  const failedAttempts = previousAttempts + 1;
  const locked = failedAttempts >= PIN_MAX_ATTEMPTS;

  return {
    outcome: 'incorrect',
    attemptsRemaining: Math.max(0, PIN_MAX_ATTEMPTS - failedAttempts),
    update: {
      whatsappPinFailedAttempts: failedAttempts,
      whatsappPinLockedUntil: locked ? new Date(now.getTime() + PIN_LOCKOUT_MINUTES * 60_000) : null,
    },
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm --prefix server run test -- whatsappPin`
Expected: `6 passed`

- [ ] **Step 5: Commit**

```bash
git add server/src/lib/whatsappPin.ts server/src/lib/whatsappPin.test.ts
git commit -m "feat(whatsapp): add PIN verification and lockout logic"
```

---

## Task 4: Self-service endpoint to set the WhatsApp PIN

**Files:**
- Modify: `server/src/routes/auth.routes.ts`
- Test: `server/src/routes/auth.routes.whatsappPin.test.ts`

**Interfaces:**
- Consumes: `hashPin` from Task 3 (`server/src/lib/whatsappPin.js`), `authenticate`/`authorize('self:profile')` from `server/src/middleware/auth.js`.
- Produces: `PATCH /api/auth/whatsapp-pin` — body `{ pin: string }` (exactly 4 digits), 200 response `{ whatsappPinSet: true }`. 401 if not authenticated, 400 if the authenticated user has no linked employee.

- [ ] **Step 1: Write the failing test**

```typescript
// server/src/routes/auth.routes.whatsappPin.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

const mockUpdate = vi.fn();

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    employee: { update: (...args: unknown[]) => mockUpdate(...args) },
  },
}));

const { default: app } = await import('../app.js');
const { signToken } = await import('../middleware/auth.js');

describe('PATCH /api/auth/whatsapp-pin', () => {
  beforeEach(() => {
    mockUpdate.mockReset();
  });

  it('rejects unauthenticated requests', async () => {
    const res = await request(app).patch('/api/auth/whatsapp-pin').send({ pin: '4821' });
    expect(res.status).toBe(401);
  });

  it('rejects a user with no linked employee record', async () => {
    const token = signToken({ id: 'u1', email: 'a@b.com', role: 'employee', companyId: 'c1' });
    const res = await request(app).patch('/api/auth/whatsapp-pin').set('Authorization', `Bearer ${token}`).send({ pin: '4821' });
    expect(res.status).toBe(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('rejects a PIN that is not exactly 4 digits', async () => {
    const token = signToken({ id: 'u1', email: 'a@b.com', role: 'employee', companyId: 'c1', employeeId: 'e1' });
    const res = await request(app).patch('/api/auth/whatsapp-pin').set('Authorization', `Bearer ${token}`).send({ pin: '12' });
    expect(res.status).toBe(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('hashes and stores a valid PIN, resetting any prior lockout', async () => {
    mockUpdate.mockResolvedValue({ id: 'e1' });
    const token = signToken({ id: 'u1', email: 'a@b.com', role: 'employee', companyId: 'c1', employeeId: 'e1' });
    const res = await request(app).patch('/api/auth/whatsapp-pin').set('Authorization', `Bearer ${token}`).send({ pin: '4821' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ whatsappPinSet: true });
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const call = mockUpdate.mock.calls[0][0];
    expect(call.where).toEqual({ id: 'e1' });
    expect(call.data.whatsappPinFailedAttempts).toBe(0);
    expect(call.data.whatsappPinLockedUntil).toBeNull();
    expect(typeof call.data.whatsappPinHash).toBe('string');
    expect(call.data.whatsappPinHash).not.toBe('4821');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm --prefix server run test -- auth.routes.whatsappPin`
Expected: FAIL — 404 (route doesn't exist yet)

- [ ] **Step 3: Implement the route**

In `server/src/routes/auth.routes.ts`, add near the top with the other imports:

```typescript
import { hashPin } from '../lib/whatsappPin.js';
import { authorize } from '../middleware/auth.js';
import { HttpError } from '../lib/errors.js';
```

Add at the end of the file, before any default export (there is none — `authRouter` is a named export used directly):

```typescript
const setWhatsAppPinSchema = z.object({
  pin: z.string().regex(/^\d{4}$/, 'Le code PIN doit contenir exactement 4 chiffres'),
});

authRouter.patch(
  '/whatsapp-pin',
  authenticate,
  authorize('self:profile'),
  asyncHandler(async (req, res) => {
    const { pin } = setWhatsAppPinSchema.parse(req.body);
    const employeeId = req.user!.employeeId;
    if (!employeeId) {
      throw new HttpError(400, 'Cette fonctionnalité est réservée aux comptes liés à une fiche employé');
    }

    const whatsappPinHash = await hashPin(pin);
    await prisma.employee.update({
      where: { id: employeeId },
      data: { whatsappPinHash, whatsappPinFailedAttempts: 0, whatsappPinLockedUntil: null },
    });

    res.json({ whatsappPinSet: true });
  })
);
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm --prefix server run test -- auth.routes.whatsappPin`
Expected: `4 passed`

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/auth.routes.ts server/src/routes/auth.routes.whatsappPin.test.ts
git commit -m "feat(auth): add self-service endpoint to set the WhatsApp PIN"
```

---

## Task 5: Self-service PIN UI

**Files:**
- Create: `src/pages/self/WhatsAppPinTab.tsx`
- Modify: `src/pages/self/SelfServicePage.tsx`
- Modify: `src/services/api/users.ts` (or create `src/services/api/auth.ts` addition — see Step 1)
- Modify: `src/locales/fr.json`

**Interfaces:**
- Consumes: `apiClient.patch` from `@/lib/apiClient`.
- Produces: `setWhatsAppPin(pin: string): Promise<{ whatsappPinSet: boolean }>` exported from wherever the project's auth API calls already live.

- [ ] **Step 1: Locate the existing auth API service and add the call**

Run: `grep -n "changePassword\|/auth/" src/services/api/auth.ts` to confirm the file and pattern (this file already wraps `/auth/*` endpoints — the PIN endpoint belongs there, not in `users.ts`).

Add to `src/services/api/auth.ts`:

```typescript
export async function setWhatsAppPin(pin: string): Promise<{ whatsappPinSet: boolean }> {
  return apiClient.patch<{ whatsappPinSet: boolean }>('/auth/whatsapp-pin', { pin });
}
```

(If `apiClient` isn't already imported in that file, add `import { apiClient } from '@/lib/apiClient';` at the top.)

- [ ] **Step 2: Add French locale strings**

In `src/locales/fr.json`, inside the `self` section (create one if none exists — check with `grep -n '"self"' src/locales/fr.json` first), add:

```json
"self": {
  "whatsappPin": {
    "title": "Code PIN WhatsApp",
    "description": "Ce code à 4 chiffres vous sera demandé pour recevoir votre bulletin de paie sur WhatsApp.",
    "pinLabel": "Nouveau code PIN (4 chiffres)",
    "confirmLabel": "Confirmer le code PIN",
    "mismatch": "Les deux codes ne correspondent pas",
    "invalid": "Le code doit contenir exactement 4 chiffres",
    "submit": "Enregistrer",
    "success": "Code PIN WhatsApp enregistré"
  }
}
```

(Merge into the existing `self` key if one is already present, rather than duplicating the key.)

- [ ] **Step 3: Build the tab component**

```tsx
// src/pages/self/WhatsAppPinTab.tsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { setWhatsAppPin } from '@/services/api/auth';

export function WhatsAppPinTab() {
  const { t } = useTranslation();
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const pinValid = /^\d{4}$/.test(pin);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinValid) {
      toast.error(t('self.whatsappPin.invalid'));
      return;
    }
    if (pin !== confirmPin) {
      toast.error(t('self.whatsappPin.mismatch'));
      return;
    }
    setSubmitting(true);
    try {
      await setWhatsAppPin(pin);
      toast.success(t('self.whatsappPin.success'));
      setPin('');
      setConfirmPin('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-sm space-y-4">
      <div>
        <h2 className="text-lg font-medium">{t('self.whatsappPin.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('self.whatsappPin.description')}</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="whatsapp-pin">{t('self.whatsappPin.pinLabel')}</Label>
        <Input id="whatsapp-pin" type="password" inputMode="numeric" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="whatsapp-pin-confirm">{t('self.whatsappPin.confirmLabel')}</Label>
        <Input id="whatsapp-pin-confirm" type="password" inputMode="numeric" maxLength={4} value={confirmPin} onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))} />
      </div>
      <Button type="submit" disabled={submitting}>
        {t('self.whatsappPin.submit')}
      </Button>
    </form>
  );
}
```

- [ ] **Step 4: Wire the tab into SelfServicePage**

Edit `src/pages/self/SelfServicePage.tsx`: add the import `import { WhatsAppPinTab } from '@/pages/self/WhatsAppPinTab';`, add a `<TabsTrigger value="whatsappPin">{t('self.whatsappPin.title')}</TabsTrigger>` next to the existing triggers, and a matching `<TabsContent value="whatsappPin"><WhatsAppPinTab /></TabsContent>`.

- [ ] **Step 5: Manually verify in the browser**

Run: `npm run dev:all` (or confirm it's already running), log in as an employee-role user, open the self-service page, go to the new tab, submit a 4-digit PIN, confirm the success toast appears and no console errors are logged.

- [ ] **Step 6: Commit**

```bash
git add src/pages/self/WhatsAppPinTab.tsx src/pages/self/SelfServicePage.tsx src/services/api/auth.ts src/locales/fr.json
git commit -m "feat(self-service): add WhatsApp PIN setup form"
```

---

## Task 6: Ancienneté leave accrual calculation

**Files:**
- Modify: `server/src/lib/leaveAccrual.ts`
- Test: `server/src/lib/leaveAccrual.test.ts` (create if it doesn't exist)

**Interfaces:**
- Produces: `computeAncienneteAccrual(hireDate: Date, asOf?: Date): { acquired: number }` — jours ouvrables acquis au titre de l'ancienneté (1 jour par tranche complète de 5 ans).

- [ ] **Step 1: Write the failing tests**

```typescript
// server/src/lib/leaveAccrual.test.ts
import { describe, it, expect } from 'vitest';
import { computeAncienneteAccrual } from './leaveAccrual.js';

describe('computeAncienneteAccrual', () => {
  it('grants 0 days before 5 years of service', () => {
    const hireDate = new Date('2023-01-01T00:00:00Z');
    const asOf = new Date('2026-06-01T00:00:00Z');
    expect(computeAncienneteAccrual(hireDate, asOf).acquired).toBe(0);
  });

  it('grants 1 day at exactly 5 years', () => {
    const hireDate = new Date('2020-01-01T00:00:00Z');
    const asOf = new Date('2025-01-01T00:00:00Z');
    expect(computeAncienneteAccrual(hireDate, asOf).acquired).toBe(1);
  });

  it('grants 2 days at 10 years, cumulative', () => {
    const hireDate = new Date('2015-01-01T00:00:00Z');
    const asOf = new Date('2025-01-01T00:00:00Z');
    expect(computeAncienneteAccrual(hireDate, asOf).acquired).toBe(2);
  });

  it('does not grant a partial tranche (4 years and 11 months)', () => {
    const hireDate = new Date('2020-01-01T00:00:00Z');
    const asOf = new Date('2024-12-01T00:00:00Z');
    expect(computeAncienneteAccrual(hireDate, asOf).acquired).toBe(0);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm --prefix server run test -- leaveAccrual`
Expected: FAIL — `computeAncienneteAccrual is not a function`

- [ ] **Step 3: Implement**

Add to `server/src/lib/leaveAccrual.ts` (reusing the existing `fullMonthsElapsed` helper already in that file):

```typescript
// Congé supplémentaire pour ancienneté (Code du travail burkinabè, Loi
// n°028-2008/AN) : 1 jour ouvrable par tranche complète de 5 années de
// service continu, cumulatif, sans plafond.
export const ANCIENNETE_YEARS_PER_TRANCHE = 5;

export function computeAncienneteAccrual(hireDate: Date, asOf: Date = new Date()) {
  const monthsElapsed = fullMonthsElapsed(hireDate, asOf);
  const fullYears = Math.floor(monthsElapsed / 12);
  const tranches = Math.floor(fullYears / ANCIENNETE_YEARS_PER_TRANCHE);
  return { acquired: tranches };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm --prefix server run test -- leaveAccrual`
Expected: `4 passed`

- [ ] **Step 5: Commit**

```bash
git add server/src/lib/leaveAccrual.ts server/src/lib/leaveAccrual.test.ts
git commit -m "feat(leaves): add ancienneté leave accrual calculation"
```

---

## Task 7: Leave date parsing and duration calculation for the WhatsApp flow

**Files:**
- Create: `server/src/lib/leaveDates.ts`
- Test: `server/src/lib/leaveDates.test.ts`

**Interfaces:**
- Produces:
  - `parseFrenchDate(input: string): Date | null` — parses `JJ/MM/AAAA`, returns `null` on any invalid format or an impossible calendar date (e.g. `31/02/2026`).
  - `computeLeaveDaysCount(startDate: Date, endDate: Date): number` — **identical calendar-day formula to `leaves.routes.ts`'s existing `POST /` handler**: `Math.floor((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1`. Deliberately not business-day-aware — see "Corrections found while planning" above.

- [ ] **Step 1: Write the failing tests**

```typescript
// server/src/lib/leaveDates.test.ts
import { describe, it, expect } from 'vitest';
import { parseFrenchDate, computeLeaveDaysCount } from './leaveDates.js';

describe('parseFrenchDate', () => {
  it('parses a valid DD/MM/YYYY date', () => {
    const date = parseFrenchDate('10/08/2026');
    expect(date).not.toBeNull();
    expect(date?.getUTCFullYear()).toBe(2026);
    expect(date?.getUTCMonth()).toBe(7);
    expect(date?.getUTCDate()).toBe(10);
  });

  it('rejects a malformed string', () => {
    expect(parseFrenchDate('2026-08-10')).toBeNull();
    expect(parseFrenchDate('not a date')).toBeNull();
  });

  it('rejects an impossible calendar date', () => {
    expect(parseFrenchDate('31/02/2026')).toBeNull();
  });
});

describe('computeLeaveDaysCount', () => {
  it('matches the existing portal formula for the spec example (10/08 to 21/08/2026)', () => {
    const start = parseFrenchDate('10/08/2026')!;
    const end = parseFrenchDate('21/08/2026')!;
    expect(computeLeaveDaysCount(start, end)).toBe(12);
  });

  it('counts a single day as 1', () => {
    const start = parseFrenchDate('10/08/2026')!;
    expect(computeLeaveDaysCount(start, start)).toBe(1);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm --prefix server run test -- leaveDates`
Expected: FAIL — `Cannot find module './leaveDates.js'`

- [ ] **Step 3: Implement**

```typescript
// server/src/lib/leaveDates.ts

// Format attendu depuis la conversation WhatsApp : JJ/MM/AAAA (voir spec
// docs/superpowers/specs/2026-08-30-whatsapp-bot-design.md, Flux 2 étape 3).
const FRENCH_DATE_PATTERN = /^(\d{2})\/(\d{2})\/(\d{4})$/;

export function parseFrenchDate(input: string): Date | null {
  const match = FRENCH_DATE_PATTERN.exec(input.trim());
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);

  const date = new Date(Date.UTC(year, month - 1, day));
  // Rejette les dates impossibles (ex. 31/02) — Date corrige silencieusement
  // en débordant sur le mois suivant, donc on vérifie que le round-trip est fidèle.
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return date;
}

// Volontairement identique à la formule déjà utilisée par le portail
// (server/src/routes/leaves.routes.ts, POST /) : jours calendaires inclusifs,
// pas de jours ouvrés. Les deux canaux doivent produire le même
// LeaveRequest.daysCount pour les mêmes dates — voir la section
// "Corrections found while planning" du plan d'implémentation.
export function computeLeaveDaysCount(startDate: Date, endDate: Date): number {
  return Math.floor((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm --prefix server run test -- leaveDates`
Expected: `5 passed`

- [ ] **Step 5: Commit**

```bash
git add server/src/lib/leaveDates.ts server/src/lib/leaveDates.test.ts
git commit -m "feat(leaves): add date parsing and day-count helper for the WhatsApp flow"
```

---

## Task 8: Extract shared leave-request creation (with manager WhatsApp notification)

**Files:**
- Create: `server/src/lib/leaveRequests.ts`
- Modify: `server/src/routes/leaves.routes.ts` (its `POST /` handler now calls the extracted function)
- Modify: `server/src/lib/whatsapp.ts` (add `sendLeaveManagerNotification` + underlying generic template sender)
- Test: `server/src/lib/leaveRequests.test.ts`

**Interfaces:**
- Consumes: `prisma` from `../lib/prisma.js`, `notifyEmployee` from `../lib/notifications.js`, `sendLeaveManagerNotification` from `../lib/whatsapp.js` (added in this task).
- Produces: `createLeaveRequestRecord(params: { companyId: string; employeeId: string; type: LeaveType; startDate: Date; endDate: Date; daysCount: number; reason?: string; channel: 'portail' | 'whatsapp' }): Promise<LeaveRequest>` — used by both the portal route (Task 8) and the WhatsApp leave flow (Task 15).

- [ ] **Step 1: Add the generic template sender + manager notification to `whatsapp.ts`**

Refactor `sendPayslipWhatsAppNotification` in `server/src/lib/whatsapp.ts` to use a shared low-level function, then add the new manager-notification wrapper. Replace the body of `sendPayslipWhatsAppNotification` (from `const phoneNumberId = ...` down to the final `return`) with a call to the new generic function, and add the generic function above it:

```typescript
async function sendWhatsAppTemplate(
  toPhone: string,
  countryCode: string,
  templateName: string,
  languageCode: string,
  bodyParams: string[]
): Promise<WhatsAppSendResult> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    return { ok: false, error: 'WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_ACCESS_TOKEN non configurés' };
  }

  const to = normalizeWhatsAppNumber(toPhone, countryCode);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: templateName,
          language: { code: languageCode },
          components: [{ type: 'body', parameters: bodyParams.map((text) => ({ type: 'text', text })) }],
        },
      }),
    });

    const body = await res.json().catch(() => ({}) as Record<string, unknown>);

    if (!res.ok) {
      const metaError = (body as { error?: { message?: string } }).error;
      return { ok: false, error: metaError?.message ?? `Meta a répondu ${res.status}` };
    }

    const messages = (body as { messages?: { id: string }[] }).messages;
    return { ok: true, messageId: messages?.[0]?.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(timeout);
  }
}

export async function sendPayslipWhatsAppNotification(
  toPhone: string,
  countryCode: string,
  params: { employeeName: string; period: string; montantNet: string }
): Promise<WhatsAppSendResult> {
  const templateName = process.env.WHATSAPP_TEMPLATE_NAME ?? 'bulletin_disponible';
  const languageCode = process.env.WHATSAPP_TEMPLATE_LANG ?? 'fr';
  return sendWhatsAppTemplate(toPhone, countryCode, templateName, languageCode, [params.employeeName, params.period, params.montantNet]);
}

// Notifie le manager d'une nouvelle demande de congé (portail ou WhatsApp).
// Le template doit être créé et approuvé dans Meta Business Manager au
// préalable (voir docs/superpowers/specs/2026-08-30-whatsapp-bot-design.md) —
// tant qu'il ne l'est pas, renvoie un échec propre plutôt que de planter.
export async function sendLeaveManagerNotification(
  managerPhone: string,
  countryCode: string,
  params: { employeeName: string; startDate: string; endDate: string }
): Promise<WhatsAppSendResult> {
  const templateName = process.env.WHATSAPP_LEAVE_MANAGER_TEMPLATE_NAME ?? 'demande_conge_manager';
  const languageCode = process.env.WHATSAPP_TEMPLATE_LANG ?? 'fr';
  return sendWhatsAppTemplate(managerPhone, countryCode, templateName, languageCode, [params.employeeName, params.startDate, params.endDate]);
}
```

- [ ] **Step 2: Write the failing test for the extracted helper**

```typescript
// server/src/lib/leaveRequests.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCreate = vi.fn();
const mockUpsert = vi.fn();
const mockFindFirst = vi.fn();
const mockNotifyEmployee = vi.fn();
const mockSendLeaveManagerNotification = vi.fn();

vi.mock('./prisma.js', () => ({
  prisma: {
    leaveRequest: { create: (...args: unknown[]) => mockCreate(...args) },
    leaveBalance: { upsert: (...args: unknown[]) => mockUpsert(...args) },
    employee: { findFirst: (...args: unknown[]) => mockFindFirst(...args) },
  },
}));
vi.mock('./notifications.js', () => ({ notifyEmployee: (...args: unknown[]) => mockNotifyEmployee(...args) }));
vi.mock('./whatsapp.js', () => ({ sendLeaveManagerNotification: (...args: unknown[]) => mockSendLeaveManagerNotification(...args) }));

const { createLeaveRequestRecord } = await import('./leaveRequests.js');

describe('createLeaveRequestRecord', () => {
  beforeEach(() => {
    mockCreate.mockReset();
    mockUpsert.mockReset();
    mockFindFirst.mockReset();
    mockNotifyEmployee.mockReset();
    mockSendLeaveManagerNotification.mockReset();
  });

  const baseParams = {
    companyId: 'c1',
    employeeId: 'e1',
    type: 'conge_paye' as const,
    startDate: new Date('2026-08-10T00:00:00Z'),
    endDate: new Date('2026-08-21T00:00:00Z'),
    daysCount: 12,
    channel: 'whatsapp' as const,
  };

  it('creates the request, upserts the pending balance, and notifies a manager with a phone number', async () => {
    mockCreate.mockResolvedValue({ id: 'req1', ...baseParams });
    mockFindFirst.mockResolvedValue({
      id: 'e1', firstName: 'Awa', lastName: 'Ouédraogo', managerId: 'mgr1',
      manager: { phone: '70123456' }, company: { countryCode: 'BF' },
    });

    const result = await createLeaveRequestRecord(baseParams);

    expect(result.id).toBe('req1');
    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        companyId: 'c1', employeeId: 'e1', type: 'conge_paye',
        startDate: baseParams.startDate, endDate: baseParams.endDate,
        daysCount: 12, reason: undefined, channel: 'whatsapp',
      },
    });
    expect(mockUpsert).toHaveBeenCalledTimes(1);
    expect(mockNotifyEmployee).toHaveBeenCalledWith(expect.objectContaining({ employeeId: 'mgr1', type: 'action_requise' }));
    expect(mockSendLeaveManagerNotification).toHaveBeenCalledWith('70123456', 'BF', {
      employeeName: 'Awa Ouédraogo', startDate: '10/08/2026', endDate: '21/08/2026',
    });
  });

  it('skips the WhatsApp manager notification when the employee has no manager', async () => {
    mockCreate.mockResolvedValue({ id: 'req2', ...baseParams });
    mockFindFirst.mockResolvedValue({ id: 'e1', firstName: 'Awa', lastName: 'Ouédraogo', managerId: null, manager: null, company: { countryCode: 'BF' } });

    await createLeaveRequestRecord(baseParams);

    expect(mockNotifyEmployee).not.toHaveBeenCalled();
    expect(mockSendLeaveManagerNotification).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm --prefix server run test -- leaveRequests`
Expected: FAIL — `Cannot find module './leaveRequests.js'`

- [ ] **Step 4: Implement the extracted helper**

```typescript
// server/src/lib/leaveRequests.ts
import { LeaveRequest, LeaveType } from '@prisma/client';
import { prisma } from './prisma.js';
import { notifyEmployee } from './notifications.js';
import { sendLeaveManagerNotification } from './whatsapp.js';

function dateOnlyFr(date: Date): string {
  return date.toLocaleDateString('fr-FR', { timeZone: 'UTC' });
}

export interface CreateLeaveRequestParams {
  companyId: string;
  employeeId: string;
  type: LeaveType;
  startDate: Date;
  endDate: Date;
  daysCount: number;
  reason?: string;
  channel: 'portail' | 'whatsapp';
}

export async function createLeaveRequestRecord(params: CreateLeaveRequestParams): Promise<LeaveRequest> {
  const request = await prisma.leaveRequest.create({
    data: {
      companyId: params.companyId,
      employeeId: params.employeeId,
      type: params.type,
      startDate: params.startDate,
      endDate: params.endDate,
      daysCount: params.daysCount,
      reason: params.reason,
      channel: params.channel,
    },
  });

  await prisma.leaveBalance.upsert({
    where: { employeeId_year_type: { employeeId: params.employeeId, year: params.startDate.getUTCFullYear(), type: params.type } },
    create: { companyId: params.companyId, employeeId: params.employeeId, year: params.startDate.getUTCFullYear(), type: params.type, pending: params.daysCount },
    update: { pending: { increment: params.daysCount } },
  });

  const employee = await prisma.employee.findFirst({
    where: { id: params.employeeId },
    include: { manager: { select: { phone: true } }, company: { select: { countryCode: true } } },
  });

  if (employee?.managerId && employee.manager) {
    await notifyEmployee({
      companyId: params.companyId,
      employeeId: employee.managerId,
      type: 'action_requise',
      title: 'Nouvelle demande de congé',
      message: `${employee.firstName} ${employee.lastName} a demandé un congé du ${dateOnlyFr(params.startDate)} au ${dateOnlyFr(params.endDate)}.`,
      link: '/leaves',
    });

    // Best-effort : un échec d'envoi WhatsApp (template pas encore approuvé,
    // manager sans numéro valide...) ne doit jamais faire échouer la
    // création de la demande de congé elle-même.
    await sendLeaveManagerNotification(employee.manager.phone, employee.company.countryCode, {
      employeeName: `${employee.firstName} ${employee.lastName}`,
      startDate: dateOnlyFr(params.startDate),
      endDate: dateOnlyFr(params.endDate),
    });
  }

  return request;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm --prefix server run test -- leaveRequests`
Expected: `2 passed`

- [ ] **Step 6: Point the portal route at the extracted helper**

In `server/src/routes/leaves.routes.ts`, replace the body of the `POST /` handler (from `const request = await prisma.leaveRequest.create(...)` through the `if (employee.managerId) { await notifyEmployee(...) }` block) with:

```typescript
    const request = await createLeaveRequestRecord({
      companyId: user.companyId,
      employeeId,
      type: body.type,
      startDate,
      endDate,
      daysCount,
      reason: body.reason,
      channel: body.channel ?? 'portail',
    });
```

Add the import at the top of the file: `import { createLeaveRequestRecord } from '../lib/leaveRequests.js';`. Remove the now-unused `notifyEmployee` import from this file if the `/approve` and `/refuse` handlers below don't already use it too (they do — check with `grep -n notifyEmployee server/src/routes/leaves.routes.ts` before removing; if still used elsewhere, keep the import).

- [ ] **Step 7: Confirm the server still typechecks and the full leave test suite passes**

Run: `cd server && npx tsc -b --noEmit`
Run: `npm --prefix server run test`
Expected: no type errors, all tests green.

- [ ] **Step 8: Commit**

```bash
git add server/src/lib/leaveRequests.ts server/src/lib/leaveRequests.test.ts server/src/lib/whatsapp.ts server/src/routes/leaves.routes.ts
git commit -m "refactor(leaves): extract shared leave-request creation, notify manager over WhatsApp"
```

---

## Task 9: Employee WhatsApp notification on leave approval/refusal

**Files:**
- Modify: `server/src/lib/whatsapp.ts`
- Modify: `server/src/routes/leaves.routes.ts`
- Test: `server/src/lib/whatsapp.leaveDecision.test.ts`

**Interfaces:**
- Produces: `sendLeaveDecisionNotification(employeePhone: string, countryCode: string, decision: 'valide' | 'refuse', params: { startDate: string; endDate: string }): Promise<WhatsAppSendResult>`.

- [ ] **Step 1: Write the failing test**

```typescript
// server/src/lib/whatsapp.leaveDecision.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendLeaveDecisionNotification } from './whatsapp.js';

describe('sendLeaveDecisionNotification', () => {
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.WHATSAPP_PHONE_NUMBER_ID = 'phone123';
    process.env.WHATSAPP_ACCESS_TOKEN = 'token123';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = { ...originalEnv };
  });

  it('sends the conge_valide template on approval', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ messages: [{ id: 'wamid.1' }] }) });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await sendLeaveDecisionNotification('70123456', 'BF', 'valide', { startDate: '10/08/2026', endDate: '21/08/2026' });

    expect(result.ok).toBe(true);
    const [, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(options.body as string);
    expect(body.template.name).toBe('conge_valide');
    expect(body.to).toBe('22670123456');
  });

  it('sends the conge_refuse template on refusal', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ messages: [{ id: 'wamid.2' }] }) });
    global.fetch = fetchMock as unknown as typeof fetch;

    await sendLeaveDecisionNotification('70123456', 'BF', 'refuse', { startDate: '10/08/2026', endDate: '21/08/2026' });

    const [, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(options.body as string);
    expect(body.template.name).toBe('conge_refuse');
  });

  it('fails gracefully when Meta credentials are missing', async () => {
    delete process.env.WHATSAPP_PHONE_NUMBER_ID;
    const result = await sendLeaveDecisionNotification('70123456', 'BF', 'valide', { startDate: '10/08/2026', endDate: '21/08/2026' });
    expect(result.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm --prefix server run test -- whatsapp.leaveDecision`
Expected: FAIL — `sendLeaveDecisionNotification is not a function`

- [ ] **Step 3: Implement**

Add to `server/src/lib/whatsapp.ts`, after `sendLeaveManagerNotification`:

```typescript
export async function sendLeaveDecisionNotification(
  employeePhone: string,
  countryCode: string,
  decision: 'valide' | 'refuse',
  params: { startDate: string; endDate: string }
): Promise<WhatsAppSendResult> {
  const templateName =
    decision === 'valide'
      ? (process.env.WHATSAPP_LEAVE_APPROVED_TEMPLATE_NAME ?? 'conge_valide')
      : (process.env.WHATSAPP_LEAVE_REFUSED_TEMPLATE_NAME ?? 'conge_refuse');
  const languageCode = process.env.WHATSAPP_TEMPLATE_LANG ?? 'fr';
  return sendWhatsAppTemplate(employeePhone, countryCode, templateName, languageCode, [params.startDate, params.endDate]);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm --prefix server run test -- whatsapp.leaveDecision`
Expected: `3 passed`

- [ ] **Step 5: Hook it into the approve/refuse routes**

In `server/src/routes/leaves.routes.ts`, add the import: `import { sendLeaveDecisionNotification } from '../lib/whatsapp.js';`. In the `/:id/approve` handler, immediately after the existing `await notifyEmployee({... type: 'conge_valide' ...})` call, add:

```typescript
    const decisionEmployee = await prisma.employee.findUnique({ where: { id: request.employeeId }, include: { company: { select: { countryCode: true } } } });
    if (decisionEmployee) {
      await sendLeaveDecisionNotification(decisionEmployee.phone, decisionEmployee.company.countryCode, 'valide', {
        startDate: dateOnly(request.startDate),
        endDate: dateOnly(request.endDate),
      });
    }
```

Do the equivalent in `/:id/refuse` right after its `notifyEmployee({... type: 'conge_refuse' ...})` call, passing `'refuse'` instead of `'valide'`. (`dateOnly` is already imported/defined in this file — confirm with `grep -n "function dateOnly" server/src/routes/leaves.routes.ts`.)

- [ ] **Step 6: Confirm typecheck and full test suite still pass**

Run: `cd server && npx tsc -b --noEmit`
Run: `npm --prefix server run test`

- [ ] **Step 7: Commit**

```bash
git add server/src/lib/whatsapp.ts server/src/lib/whatsapp.leaveDecision.test.ts server/src/routes/leaves.routes.ts
git commit -m "feat(leaves): notify employee over WhatsApp when a leave request is approved/refused"
```

---

## Task 10: Interactive WhatsApp senders (list message, reply buttons, document)

**Files:**
- Modify: `server/src/lib/whatsapp.ts`
- Test: `server/src/lib/whatsapp.interactive.test.ts`

**Interfaces:**
- Produces:
  - `sendWhatsAppTextMessage(to: string, body: string): Promise<WhatsAppSendResult>`
  - `sendWhatsAppListMessage(to: string, params: { bodyText: string; buttonLabel: string; sections: { title: string; rows: { id: string; title: string; description?: string }[] }[] }): Promise<WhatsAppSendResult>`
  - `sendWhatsAppReplyButtons(to: string, params: { bodyText: string; buttons: { id: string; title: string }[] }): Promise<WhatsAppSendResult>` (throws if more than 3 buttons — Meta's hard limit)
  - `sendWhatsAppDocument(to: string, params: { link: string; filename: string; caption?: string }): Promise<WhatsAppSendResult>`

- [ ] **Step 1: Write the failing tests**

```typescript
// server/src/lib/whatsapp.interactive.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendWhatsAppTextMessage, sendWhatsAppListMessage, sendWhatsAppReplyButtons, sendWhatsAppDocument } from './whatsapp.js';

describe('interactive WhatsApp senders', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.WHATSAPP_PHONE_NUMBER_ID = 'phone123';
    process.env.WHATSAPP_ACCESS_TOKEN = 'token123';
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  function mockFetchOk() {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ messages: [{ id: 'wamid.1' }] }) });
    global.fetch = fetchMock as unknown as typeof fetch;
    return fetchMock;
  }

  it('sends a free-text message (already-normalized "to")', async () => {
    const fetchMock = mockFetchOk();
    await sendWhatsAppTextMessage('22670123456', 'Bonjour');
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body).toMatchObject({ messaging_product: 'whatsapp', to: '22670123456', type: 'text', text: { body: 'Bonjour' } });
  });

  it('sends an interactive list message with sections and rows', async () => {
    const fetchMock = mockFetchOk();
    await sendWhatsAppListMessage('22670123456', {
      bodyText: 'Choisissez un type de congé',
      buttonLabel: 'Voir les options',
      sections: [{ title: 'Types de congé', rows: [{ id: 'conge_paye', title: 'Congé payé légal' }] }],
    });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.type).toBe('interactive');
    expect(body.interactive.type).toBe('list');
    expect(body.interactive.action.sections[0].rows[0]).toEqual({ id: 'conge_paye', title: 'Congé payé légal' });
  });

  it('sends interactive reply buttons', async () => {
    const fetchMock = mockFetchOk();
    await sendWhatsAppReplyButtons('22670123456', { bodyText: 'Confirmez ?', buttons: [{ id: 'confirm', title: '✅ Confirmer' }, { id: 'cancel', title: '❌ Annuler' }] });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.interactive.type).toBe('button');
    expect(body.interactive.action.buttons).toHaveLength(2);
  });

  it('rejects more than 3 reply buttons', async () => {
    await expect(
      sendWhatsAppReplyButtons('22670123456', { bodyText: 'x', buttons: [{ id: '1', title: 'a' }, { id: '2', title: 'b' }, { id: '3', title: 'c' }, { id: '4', title: 'd' }] })
    ).rejects.toThrow(/3/);
  });

  it('sends a document message by link', async () => {
    const fetchMock = mockFetchOk();
    await sendWhatsAppDocument('22670123456', { link: 'https://blob.example.com/x.pdf', filename: 'Bulletin.pdf' });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.type).toBe('document');
    expect(body.document).toEqual({ link: 'https://blob.example.com/x.pdf', filename: 'Bulletin.pdf' });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm --prefix server run test -- whatsapp.interactive`
Expected: FAIL — the four new exports don't exist yet

- [ ] **Step 3: Implement**

Add to `server/src/lib/whatsapp.ts`. First, factor the raw POST call out of `sendWhatsAppTemplate` so all senders share it:

```typescript
async function postToWhatsAppMessagesApi(payload: Record<string, unknown>): Promise<WhatsAppSendResult> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!phoneNumberId || !accessToken) {
    return { ok: false, error: 'WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_ACCESS_TOKEN non configurés' };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({ messaging_product: 'whatsapp', ...payload }),
    });
    const body = await res.json().catch(() => ({}) as Record<string, unknown>);
    if (!res.ok) {
      const metaError = (body as { error?: { message?: string } }).error;
      return { ok: false, error: metaError?.message ?? `Meta a répondu ${res.status}` };
    }
    const messages = (body as { messages?: { id: string }[] }).messages;
    return { ok: true, messageId: messages?.[0]?.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(timeout);
  }
}

export async function sendWhatsAppTextMessage(to: string, body: string): Promise<WhatsAppSendResult> {
  return postToWhatsAppMessagesApi({ to, type: 'text', text: { body } });
}

export interface WhatsAppListRow {
  id: string;
  title: string;
  description?: string;
}

export async function sendWhatsAppListMessage(
  to: string,
  params: { bodyText: string; buttonLabel: string; sections: { title: string; rows: WhatsAppListRow[] }[] }
): Promise<WhatsAppSendResult> {
  return postToWhatsAppMessagesApi({
    to,
    type: 'interactive',
    interactive: {
      type: 'list',
      body: { text: params.bodyText },
      action: { button: params.buttonLabel, sections: params.sections },
    },
  });
}

export async function sendWhatsAppReplyButtons(
  to: string,
  params: { bodyText: string; buttons: { id: string; title: string }[] }
): Promise<WhatsAppSendResult> {
  if (params.buttons.length > 3) {
    throw new Error('WhatsApp autorise au maximum 3 boutons de réponse rapide');
  }
  return postToWhatsAppMessagesApi({
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: params.bodyText },
      action: { buttons: params.buttons.map((b) => ({ type: 'reply', reply: { id: b.id, title: b.title } })) },
    },
  });
}

export async function sendWhatsAppDocument(to: string, params: { link: string; filename: string; caption?: string }): Promise<WhatsAppSendResult> {
  return postToWhatsAppMessagesApi({
    to,
    type: 'document',
    document: { link: params.link, filename: params.filename, ...(params.caption ? { caption: params.caption } : {}) },
  });
}
```

Then simplify `sendWhatsAppTemplate` to call the same shared helper instead of duplicating the fetch logic:

```typescript
async function sendWhatsAppTemplate(
  toPhone: string,
  countryCode: string,
  templateName: string,
  languageCode: string,
  bodyParams: string[]
): Promise<WhatsAppSendResult> {
  const to = normalizeWhatsAppNumber(toPhone, countryCode);
  return postToWhatsAppMessagesApi({
    to,
    type: 'template',
    template: { name: templateName, language: { code: languageCode }, components: [{ type: 'body', parameters: bodyParams.map((text) => ({ type: 'text', text })) }] },
  });
}
```

Remove the now-duplicated `REQUEST_TIMEOUT_MS`/`AbortController` logic that used to live inline in `sendWhatsAppTemplate` (it's superseded by `postToWhatsAppMessagesApi`).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm --prefix server run test -- whatsapp`
Expected: all whatsapp-related test files pass (this task's 5 plus Tasks 8 and 9's, since they share the refactored internals).

- [ ] **Step 5: Commit**

```bash
git add server/src/lib/whatsapp.ts server/src/lib/whatsapp.interactive.test.ts
git commit -m "feat(whatsapp): add interactive list/button/document senders, dedupe HTTP call"
```

---

## Task 11: WhatsApp session store and phone-to-employee resolution

**Files:**
- Create: `server/src/lib/whatsappSession.ts`
- Test: `server/src/lib/whatsappSession.test.ts`

**Interfaces:**
- Consumes: `prisma` from `./prisma.js`.
- Produces:
  - `SESSION_TTL_MINUTES = 10`
  - `resolveEmployeeByWhatsAppPhone(from: string): Promise<(Employee & { company: Company }) | null>`
  - `getActiveSession(phone: string, now?: Date): Promise<WhatsAppSession | null>` (returns `null` if none exists or it has expired)
  - `startSession(params: { phone: string; employeeId: string; flow: string; step: string; data?: object }, now?: Date): Promise<WhatsAppSession>`
  - `advanceSession(sessionId: string, params: { step: string; data?: object }, now?: Date): Promise<WhatsAppSession>`
  - `endSession(sessionId: string): Promise<void>`

- [ ] **Step 1: Write the failing tests**

```typescript
// server/src/lib/whatsappSession.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFindFirst = vi.fn();
const mockSessionFindUnique = vi.fn();
const mockSessionUpsert = vi.fn();
const mockSessionUpdate = vi.fn();
const mockSessionDelete = vi.fn();

vi.mock('./prisma.js', () => ({
  prisma: {
    employee: { findFirst: (...args: unknown[]) => mockFindFirst(...args) },
    whatsAppSession: {
      findUnique: (...args: unknown[]) => mockSessionFindUnique(...args),
      upsert: (...args: unknown[]) => mockSessionUpsert(...args),
      update: (...args: unknown[]) => mockSessionUpdate(...args),
      delete: (...args: unknown[]) => mockSessionDelete(...args),
    },
  },
}));

const { resolveEmployeeByWhatsAppPhone, getActiveSession, startSession, advanceSession, endSession } = await import('./whatsappSession.js');

describe('resolveEmployeeByWhatsAppPhone', () => {
  beforeEach(() => mockFindFirst.mockReset());

  it('matches by the last 8 digits of the inbound phone number', async () => {
    mockFindFirst.mockResolvedValue({ id: 'e1', phone: '70123456' });
    const result = await resolveEmployeeByWhatsAppPhone('22670123456');
    expect(result).toEqual({ id: 'e1', phone: '70123456' });
    expect(mockFindFirst).toHaveBeenCalledWith({
      where: { OR: [{ phone: '22670123456' }, { phone: '70123456' }, { phone: { endsWith: '70123456' } }] },
      include: { company: true },
    });
  });

  it('returns null when no employee matches', async () => {
    mockFindFirst.mockResolvedValue(null);
    expect(await resolveEmployeeByWhatsAppPhone('22670123456')).toBeNull();
  });
});

describe('session lifecycle', () => {
  beforeEach(() => {
    mockSessionFindUnique.mockReset();
    mockSessionUpsert.mockReset();
    mockSessionUpdate.mockReset();
    mockSessionDelete.mockReset();
  });

  it('getActiveSession returns null when no session row exists', async () => {
    mockSessionFindUnique.mockResolvedValue(null);
    expect(await getActiveSession('22670123456')).toBeNull();
  });

  it('getActiveSession returns null when the session has expired', async () => {
    mockSessionFindUnique.mockResolvedValue({ id: 's1', phone: '22670123456', expiresAt: new Date('2026-08-30T09:00:00Z') });
    expect(await getActiveSession('22670123456', new Date('2026-08-30T09:30:00Z'))).toBeNull();
  });

  it('getActiveSession returns the session when still within TTL', async () => {
    const session = { id: 's1', phone: '22670123456', expiresAt: new Date('2026-08-30T09:15:00Z') };
    mockSessionFindUnique.mockResolvedValue(session);
    expect(await getActiveSession('22670123456', new Date('2026-08-30T09:10:00Z'))).toEqual(session);
  });

  it('startSession upserts with a fresh 10-minute expiry', async () => {
    mockSessionUpsert.mockResolvedValue({ id: 's1' });
    const now = new Date('2026-08-30T09:00:00Z');
    await startSession({ phone: '22670123456', employeeId: 'e1', flow: 'leave_request', step: 'choosing_type', data: { foo: 'bar' } }, now);
    expect(mockSessionUpsert).toHaveBeenCalledWith({
      where: { phone: '22670123456' },
      create: { phone: '22670123456', employeeId: 'e1', flow: 'leave_request', step: 'choosing_type', data: { foo: 'bar' }, expiresAt: new Date('2026-08-30T09:10:00Z') },
      update: { employeeId: 'e1', flow: 'leave_request', step: 'choosing_type', data: { foo: 'bar' }, expiresAt: new Date('2026-08-30T09:10:00Z') },
    });
  });

  it('advanceSession updates the step/data and renews the expiry', async () => {
    mockSessionUpdate.mockResolvedValue({ id: 's1' });
    const now = new Date('2026-08-30T09:05:00Z');
    await advanceSession('s1', { step: 'awaiting_start_date', data: { leaveType: 'conge_paye' } }, now);
    expect(mockSessionUpdate).toHaveBeenCalledWith({
      where: { id: 's1' },
      data: { step: 'awaiting_start_date', data: { leaveType: 'conge_paye' }, expiresAt: new Date('2026-08-30T09:15:00Z') },
    });
  });

  it('endSession deletes the row', async () => {
    await endSession('s1');
    expect(mockSessionDelete).toHaveBeenCalledWith({ where: { id: 's1' } });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm --prefix server run test -- whatsappSession`
Expected: FAIL — `Cannot find module './whatsappSession.js'`

- [ ] **Step 3: Implement**

```typescript
// server/src/lib/whatsappSession.ts
import { Company, Employee, WhatsAppSession } from '@prisma/client';
import { prisma } from './prisma.js';

export const SESSION_TTL_MINUTES = 10;

// Le webhook Meta reçoit un numéro déjà international sans "+" (ex.
// "22670123456"). Employee.phone est parfois saisi en local (8 chiffres,
// voir normalizeWhatsAppNumber dans whatsapp.ts) — on matche donc sur le
// numéro complet OU sur ses 8 derniers chiffres, sans avoir à connaître
// l'indicatif pays à l'avance (l'employé n'a pas encore d'entreprise résolue
// à ce stade).
export async function resolveEmployeeByWhatsAppPhone(from: string): Promise<(Employee & { company: Company }) | null> {
  const localSuffix = from.slice(-8);
  return prisma.employee.findFirst({
    where: { OR: [{ phone: from }, { phone: localSuffix }, { phone: { endsWith: localSuffix } }] },
    include: { company: true },
  }) as Promise<(Employee & { company: Company }) | null>;
}

export async function getActiveSession(phone: string, now: Date = new Date()): Promise<WhatsAppSession | null> {
  const session = await prisma.whatsAppSession.findUnique({ where: { phone } });
  if (!session) return null;
  if (session.expiresAt <= now) return null;
  return session;
}

function expiryFrom(now: Date): Date {
  return new Date(now.getTime() + SESSION_TTL_MINUTES * 60_000);
}

export async function startSession(
  params: { phone: string; employeeId: string; flow: string; step: string; data?: object },
  now: Date = new Date()
): Promise<WhatsAppSession> {
  const data = params.data ?? {};
  const expiresAt = expiryFrom(now);
  return prisma.whatsAppSession.upsert({
    where: { phone: params.phone },
    create: { phone: params.phone, employeeId: params.employeeId, flow: params.flow, step: params.step, data, expiresAt },
    update: { employeeId: params.employeeId, flow: params.flow, step: params.step, data, expiresAt },
  });
}

export async function advanceSession(sessionId: string, params: { step: string; data?: object }, now: Date = new Date()): Promise<WhatsAppSession> {
  return prisma.whatsAppSession.update({
    where: { id: sessionId },
    data: { step: params.step, data: params.data ?? {}, expiresAt: expiryFrom(now) },
  });
}

export async function endSession(sessionId: string): Promise<void> {
  await prisma.whatsAppSession.delete({ where: { id: sessionId } });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm --prefix server run test -- whatsappSession`
Expected: `8 passed`

- [ ] **Step 5: Commit**

```bash
git add server/src/lib/whatsappSession.ts server/src/lib/whatsappSession.test.ts
git commit -m "feat(whatsapp): add session store and phone-to-employee resolution"
```

---

## Task 12: Server-side payslip PDF generation

**Files:**
- Create: `server/src/lib/payslipPdf.ts`
- Test: `server/src/lib/payslipPdf.test.ts`
- Modify: `server/package.json` (add `jspdf` dependency)

**Interfaces:**
- Consumes: the same `Payslip` shape already assembled by `toPayslipDTO` in `payslips.routes.ts`, plus `Employee` and `Company` fields already used by `PayslipPreviewDialog.tsx`'s `officialTemplateData` (company name/address/tax IDs, employee name/matricule/hire date, earnings rows, contributions rows, net pay).
- Produces:
  - `interface PayslipPdfData` — the input shape (defined in this file; mirrors `officialTemplateData` in `PayslipPreviewDialog.tsx` minus purely-visual fields like `logo`).
  - `buildPayslipPdfRows(data: PayslipPdfData): { earningsRows: [string, string][]; contributionsRows: [string, string, string, string][] }` — pure data-assembly, fully unit-testable.
  - `generatePayslipPdf(data: PayslipPdfData): Buffer` — renders the PDF with jsPDF, returns the raw bytes.

- [ ] **Step 1: Add the `jspdf` dependency to the server package**

Edit `server/package.json`, add to `"dependencies"`:

```json
"jspdf": "^4.2.1"
```

Run: `npm --prefix server install`

- [ ] **Step 2: Write the failing tests**

```typescript
// server/src/lib/payslipPdf.test.ts
import { describe, it, expect } from 'vitest';
import { buildPayslipPdfRows, generatePayslipPdf, PayslipPdfData } from './payslipPdf.js';

const sampleData: PayslipPdfData = {
  company: { name: 'LaafiPay SARL', legalName: 'LaafiPay SARL', addressLine: 'Ouagadougou', taxIdLabel: 'IFU', taxIdNumber: '00012345', socialAgencyLabel: 'CNSS', socialSecurityNumber: '998877' },
  employee: { fullName: 'Awa Ouédraogo', matricule: 'EMP-001', address: 'Secteur 15, Ouagadougou' },
  period: { label: 'Juillet 2026' },
  earnings: [{ label: 'Salaire de base', employeeAmount: 200000 }],
  grossSalary: 200000,
  contributions: [{ label: 'CNSS', base: 200000, rate: 5.5, employeeAmount: -11000, employerAmount: 16000 }],
  employeeContributionsTotal: 11000,
  employerContributionsTotal: 16000,
  incomeTax: { label: 'IUTS', base: 189000, rate: 10, amount: 12000 },
  netBeforeTax: 189000,
  netToPay: 177000,
  employerCost: 216000,
  currencyCode: 'XOF',
};

describe('buildPayslipPdfRows', () => {
  it('formats earnings rows as [label, amount] pairs', () => {
    const rows = buildPayslipPdfRows(sampleData);
    expect(rows.earningsRows).toEqual([['Salaire de base', '200 000']]);
  });

  it('formats contributions rows as [label, base, rate, amount]', () => {
    const rows = buildPayslipPdfRows(sampleData);
    expect(rows.contributionsRows).toEqual([['CNSS', '200 000', '5.5%', '-11 000']]);
  });
});

describe('generatePayslipPdf', () => {
  it('produces a non-empty valid PDF buffer', () => {
    const buffer = generatePayslipPdf(sampleData);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(500);
    expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm --prefix server run test -- payslipPdf`
Expected: FAIL — `Cannot find module './payslipPdf.js'`

- [ ] **Step 4: Implement**

```typescript
// server/src/lib/payslipPdf.ts
import { jsPDF } from 'jspdf';

export interface PayslipPdfRow {
  label: string;
  base?: number;
  rate?: number;
  employeeAmount: number;
  employerAmount?: number;
}

export interface PayslipPdfData {
  company: { name: string; legalName: string; addressLine?: string; taxIdLabel: string; taxIdNumber?: string; socialAgencyLabel: string; socialSecurityNumber?: string };
  employee: { fullName: string; matricule: string; address?: string };
  period: { label: string };
  earnings: PayslipPdfRow[];
  grossSalary: number;
  contributions: PayslipPdfRow[];
  employeeContributionsTotal: number;
  employerContributionsTotal: number;
  incomeTax: { label: string; base: number; rate: number; amount: number };
  netBeforeTax: number;
  netToPay: number;
  employerCost: number;
  currencyCode: string;
}

function formatAmount(amount: number): string {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(amount);
}

export function buildPayslipPdfRows(data: PayslipPdfData) {
  const earningsRows: [string, string][] = data.earnings.map((row) => [row.label, formatAmount(row.employeeAmount)]);
  const contributionsRows: [string, string, string, string][] = data.contributions.map((row) => [
    row.label,
    row.base !== undefined ? formatAmount(row.base) : '',
    row.rate !== undefined ? `${row.rate}%` : '',
    formatAmount(row.employeeAmount),
  ]);
  return { earningsRows, contributionsRows };
}

// Reproduit la structure de PayslipOfficialTemplate.tsx (en-tête entreprise,
// identité employé, tableau des éléments de rémunération, tableau des
// cotisations, net à payer) — voir la section "Corrections found while
// planning" du plan : ce n'est pas un port du composant React (qui n'exporte
// aucun PDF aujourd'hui), c'est une nouvelle implémentation jsPDF construite
// à partir des mêmes données. Toute évolution visuelle du bulletin officiel
// doit être répercutée ici aussi.
export function generatePayslipPdf(data: PayslipPdfData): Buffer {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const { earningsRows, contributionsRows } = buildPayslipPdfRows(data);
  let y = 15;

  doc.setFontSize(14);
  doc.text(data.company.name, 15, y);
  doc.setFontSize(9);
  y += 6;
  if (data.company.addressLine) {
    doc.text(data.company.addressLine, 15, y);
    y += 5;
  }
  doc.text(`${data.company.taxIdLabel} : ${data.company.taxIdNumber ?? '—'}`, 15, y);
  y += 5;
  doc.text(`${data.company.socialAgencyLabel} : ${data.company.socialSecurityNumber ?? '—'}`, 15, y);

  y += 10;
  doc.setFontSize(12);
  doc.text(`Bulletin de paie — ${data.period.label}`, 15, y);
  y += 8;
  doc.setFontSize(10);
  doc.text(`${data.employee.fullName} (${data.employee.matricule})`, 15, y);
  y += 5;
  if (data.employee.address) {
    doc.text(data.employee.address, 15, y);
    y += 5;
  }

  y += 8;
  doc.setFontSize(11);
  doc.text('Éléments de rémunération', 15, y);
  y += 6;
  doc.setFontSize(9);
  for (const [label, amount] of earningsRows) {
    doc.text(label, 15, y);
    doc.text(`${amount} ${data.currencyCode}`, 150, y, { align: 'right' });
    y += 5;
  }
  y += 3;
  doc.setFontSize(10);
  doc.text('Salaire brut', 15, y);
  doc.text(`${formatAmount(data.grossSalary)} ${data.currencyCode}`, 150, y, { align: 'right' });

  y += 10;
  doc.setFontSize(11);
  doc.text('Cotisations', 15, y);
  y += 6;
  doc.setFontSize(9);
  for (const [label, base, rate, amount] of contributionsRows) {
    doc.text(`${label} (base ${base}, ${rate})`, 15, y);
    doc.text(`${amount} ${data.currencyCode}`, 150, y, { align: 'right' });
    y += 5;
  }

  y += 5;
  doc.setFontSize(10);
  doc.text(`${data.incomeTax.label} (base ${formatAmount(data.incomeTax.base)}, ${data.incomeTax.rate}%)`, 15, y);
  doc.text(`-${formatAmount(data.incomeTax.amount)} ${data.currencyCode}`, 150, y, { align: 'right' });

  y += 10;
  doc.setFontSize(12);
  doc.text('Net à payer', 15, y);
  doc.text(`${formatAmount(data.netToPay)} ${data.currencyCode}`, 150, y, { align: 'right' });

  y += 10;
  doc.setFontSize(9);
  doc.text(`Coût employeur total : ${formatAmount(data.employerCost)} ${data.currencyCode}`, 15, y);

  return Buffer.from(doc.output('arraybuffer'));
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm --prefix server run test -- payslipPdf`
Expected: `3 passed`

- [ ] **Step 6: Manually verify visually**

Run a quick throwaway script to write the sample PDF to disk and open it:

```bash
node --experimental-strip-types -e "
import { generatePayslipPdf } from './server/src/lib/payslipPdf.ts';
import { writeFileSync } from 'fs';
writeFileSync('/tmp/sample-payslip.pdf', generatePayslipPdf({
  company: { name: 'LaafiPay SARL', legalName: 'LaafiPay SARL', taxIdLabel: 'IFU', socialAgencyLabel: 'CNSS' },
  employee: { fullName: 'Awa Ouédraogo', matricule: 'EMP-001' },
  period: { label: 'Juillet 2026' },
  earnings: [{ label: 'Salaire de base', employeeAmount: 200000 }],
  grossSalary: 200000,
  contributions: [{ label: 'CNSS', base: 200000, rate: 5.5, employeeAmount: -11000 }],
  employeeContributionsTotal: 11000,
  employerContributionsTotal: 16000,
  incomeTax: { label: 'IUTS', base: 189000, rate: 10, amount: 12000 },
  netBeforeTax: 189000,
  netToPay: 177000,
  employerCost: 216000,
  currencyCode: 'XOF',
}));
"
```

Open `/tmp/sample-payslip.pdf` and visually confirm it's readable and the sections (header, earnings, contributions, net pay) render sensibly — this is the closest thing to a regression check available for a hand-built PDF layout. If the Node version in use doesn't support `--experimental-strip-types`, run the equivalent via `npx tsx -e "..."` instead.

- [ ] **Step 7: Commit**

```bash
git add server/src/lib/payslipPdf.ts server/src/lib/payslipPdf.test.ts server/package.json server/package-lock.json
git commit -m "feat(payslips): add server-side PDF generation for WhatsApp delivery"
```

---

## Task 13: Webhook route (verification handshake, signature check, dispatch skeleton)

**Files:**
- Create: `server/src/routes/whatsappWebhook.routes.ts`
- Modify: `server/src/app.ts` (register the router; needs the raw request body for signature verification)
- Test: `server/src/routes/whatsappWebhook.routes.test.ts`

**Interfaces:**
- Consumes: `resolveEmployeeByWhatsAppPhone`, `getActiveSession`, `startSession` from `../lib/whatsappSession.js`; `sendWhatsAppTextMessage` from `../lib/whatsapp.js`.
- Produces: `GET /api/whatsapp/webhook` (Meta verification), `POST /api/whatsapp/webhook` (message intake). Exports `extractIncomingMessage(body: unknown): IncomingMessage | null` and `verifyMetaSignature(rawBody: Buffer, signatureHeader: string | undefined, appSecret: string): boolean` as named exports for unit testing.
- This task builds the skeleton only — it resolves the employee/session and replies with a placeholder "not yet implemented" text so the endpoint is fully wired and testable end-to-end. Tasks 14 and 15 replace the placeholder with the real flow dispatch.

- [ ] **Step 1: Write the failing tests**

```typescript
// server/src/routes/whatsappWebhook.routes.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';

const mockResolveEmployee = vi.fn();
const mockGetActiveSession = vi.fn();
const mockSendText = vi.fn().mockResolvedValue({ ok: true });

vi.mock('../lib/whatsappSession.js', () => ({
  resolveEmployeeByWhatsAppPhone: (...args: unknown[]) => mockResolveEmployee(...args),
  getActiveSession: (...args: unknown[]) => mockGetActiveSession(...args),
}));
vi.mock('../lib/whatsapp.js', () => ({ sendWhatsAppTextMessage: (...args: unknown[]) => mockSendText(...args) }));

const { extractIncomingMessage, verifyMetaSignature } = await import('./whatsappWebhook.routes.js');
const { default: app } = await import('../app.js');

describe('extractIncomingMessage', () => {
  it('extracts a plain text message', () => {
    const body = { entry: [{ changes: [{ value: { messages: [{ from: '22670123456', type: 'text', text: { body: 'salut' } }] } }] }] };
    expect(extractIncomingMessage(body)).toEqual({ from: '22670123456', kind: 'text', text: 'salut' });
  });

  it('extracts a list reply', () => {
    const body = { entry: [{ changes: [{ value: { messages: [{ from: '22670123456', type: 'interactive', interactive: { type: 'list_reply', list_reply: { id: 'conge_paye', title: 'Congé payé' } } }] } }] }] };
    expect(extractIncomingMessage(body)).toEqual({ from: '22670123456', kind: 'list_reply', id: 'conge_paye' });
  });

  it('extracts a button reply', () => {
    const body = { entry: [{ changes: [{ value: { messages: [{ from: '22670123456', type: 'interactive', interactive: { type: 'button_reply', button_reply: { id: 'confirm', title: '✅ Confirmer' } } }] } }] }] };
    expect(extractIncomingMessage(body)).toEqual({ from: '22670123456', kind: 'button_reply', id: 'confirm' });
  });

  it('returns null when there is no message (e.g. a status update webhook)', () => {
    const body = { entry: [{ changes: [{ value: { statuses: [{ status: 'delivered' }] } }] }] };
    expect(extractIncomingMessage(body)).toBeNull();
  });
});

describe('verifyMetaSignature', () => {
  const appSecret = 'test-secret';
  const rawBody = Buffer.from(JSON.stringify({ hello: 'world' }));

  it('accepts a correctly signed body', () => {
    const digest = crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
    expect(verifyMetaSignature(rawBody, `sha256=${digest}`, appSecret)).toBe(true);
  });

  it('rejects a missing signature header', () => {
    expect(verifyMetaSignature(rawBody, undefined, appSecret)).toBe(false);
  });

  it('rejects a wrong signature', () => {
    expect(verifyMetaSignature(rawBody, 'sha256=deadbeef', appSecret)).toBe(false);
  });
});

describe('GET /api/whatsapp/webhook', () => {
  it('echoes hub.challenge when the verify token matches', async () => {
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = 'verify-me';
    const res = await request(app).get('/api/whatsapp/webhook').query({ 'hub.mode': 'subscribe', 'hub.verify_token': 'verify-me', 'hub.challenge': '12345' });
    expect(res.status).toBe(200);
    expect(res.text).toBe('12345');
  });

  it('rejects a wrong verify token', async () => {
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = 'verify-me';
    const res = await request(app).get('/api/whatsapp/webhook').query({ 'hub.mode': 'subscribe', 'hub.verify_token': 'wrong', 'hub.challenge': '12345' });
    expect(res.status).toBe(403);
  });
});

describe('POST /api/whatsapp/webhook', () => {
  beforeEach(() => {
    mockResolveEmployee.mockReset();
    mockGetActiveSession.mockReset();
    mockSendText.mockReset().mockResolvedValue({ ok: true });
    process.env.WHATSAPP_APP_SECRET = 'test-secret';
  });

  function signedRequest(body: object) {
    const raw = JSON.stringify(body);
    const digest = crypto.createHmac('sha256', 'test-secret').update(raw).digest('hex');
    return request(app).post('/api/whatsapp/webhook').set('Content-Type', 'application/json').set('X-Hub-Signature-256', `sha256=${digest}`).send(raw);
  }

  it('rejects a request with an invalid signature', async () => {
    const res = await request(app).post('/api/whatsapp/webhook').set('X-Hub-Signature-256', 'sha256=bad').send({ entry: [] });
    expect(res.status).toBe(403);
  });

  it('acknowledges with 200 and does nothing when the sender is not a known employee', async () => {
    mockResolveEmployee.mockResolvedValue(null);
    const body = { entry: [{ changes: [{ value: { messages: [{ from: '22600000000', type: 'text', text: { body: 'hi' } }] } }] }] };
    const res = await signedRequest(body);
    expect(res.status).toBe(200);
    expect(mockSendText).not.toHaveBeenCalled();
  });

  it('acknowledges with 200 for a known employee with no active session (placeholder reply)', async () => {
    mockResolveEmployee.mockResolvedValue({ id: 'e1', phone: '70123456', company: { countryCode: 'BF' } });
    mockGetActiveSession.mockResolvedValue(null);
    const body = { entry: [{ changes: [{ value: { messages: [{ from: '22670123456', type: 'text', text: { body: 'hi' } }] } }] }] };
    const res = await signedRequest(body);
    expect(res.status).toBe(200);
    expect(mockSendText).toHaveBeenCalledWith('22670123456', expect.any(String));
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm --prefix server run test -- whatsappWebhook`
Expected: FAIL — module doesn't exist

- [ ] **Step 3: Make the raw request body available for signature verification**

Express's `express.json()` (already mounted globally in `app.ts`) discards the raw bytes by default. Edit `server/src/app.ts`: change

```typescript
app.use(express.json());
```

to

```typescript
app.use(express.json({ verify: (req, _res, buf) => { (req as Request & { rawBody?: Buffer }).rawBody = buf; } }));
```

(This adds `req.rawBody` for every route without changing behavior anywhere else — it's a passive capture, not a parsing change.)

- [ ] **Step 4: Implement the route**

```typescript
// server/src/routes/whatsappWebhook.routes.ts
import { Router, Request } from 'express';
import crypto from 'crypto';
import { resolveEmployeeByWhatsAppPhone, getActiveSession } from '../lib/whatsappSession.js';
import { sendWhatsAppTextMessage } from '../lib/whatsapp.js';

export const whatsappWebhookRouter = Router();

export type IncomingMessage =
  | { from: string; kind: 'text'; text: string }
  | { from: string; kind: 'list_reply'; id: string }
  | { from: string; kind: 'button_reply'; id: string };

interface WebhookMessage {
  from: string;
  type: string;
  text?: { body: string };
  interactive?: {
    type: string;
    list_reply?: { id: string; title: string };
    button_reply?: { id: string; title: string };
  };
}

export function extractIncomingMessage(body: unknown): IncomingMessage | null {
  const value = (body as { entry?: { changes?: { value?: { messages?: WebhookMessage[] } }[] }[] })?.entry?.[0]?.changes?.[0]?.value;
  const message = value?.messages?.[0];
  if (!message) return null;

  if (message.type === 'text' && message.text) {
    return { from: message.from, kind: 'text', text: message.text.body };
  }
  if (message.type === 'interactive' && message.interactive?.type === 'list_reply' && message.interactive.list_reply) {
    return { from: message.from, kind: 'list_reply', id: message.interactive.list_reply.id };
  }
  if (message.type === 'interactive' && message.interactive?.type === 'button_reply' && message.interactive.button_reply) {
    return { from: message.from, kind: 'button_reply', id: message.interactive.button_reply.id };
  }
  return null;
}

export function verifyMetaSignature(rawBody: Buffer, signatureHeader: string | undefined, appSecret: string): boolean {
  if (!signatureHeader?.startsWith('sha256=')) return false;
  const expected = crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
  const provided = signatureHeader.slice('sha256='.length);
  if (expected.length !== provided.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(provided, 'hex'));
}

whatsappWebhookRouter.get('/webhook', (req, res) => {
  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && verifyToken && token === verifyToken) {
    res.status(200).send(String(challenge));
    return;
  }
  res.sendStatus(403);
});

whatsappWebhookRouter.post('/webhook', async (req: Request & { rawBody?: Buffer }, res) => {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  const signature = req.header('X-Hub-Signature-256');
  if (!appSecret || !req.rawBody || !verifyMetaSignature(req.rawBody, signature, appSecret)) {
    res.sendStatus(403);
    return;
  }

  const incoming = extractIncomingMessage(req.body);
  if (!incoming) {
    res.sendStatus(200);
    return;
  }

  const employee = await resolveEmployeeByWhatsAppPhone(incoming.from);
  if (!employee) {
    res.sendStatus(200);
    return;
  }

  const session = await getActiveSession(incoming.from);
  if (!session) {
    // Remplacé par le vrai routeur de déclenchement de flux dans les
    // tâches 14 (bulletin) et 15 (congé).
    await sendWhatsAppTextMessage(incoming.from, "Bonjour ! Cette fonctionnalité est en cours de configuration.");
    res.sendStatus(200);
    return;
  }

  res.sendStatus(200);
});
```

- [ ] **Step 5: Register the router in `app.ts`**

Add the import: `import { whatsappWebhookRouter } from './routes/whatsappWebhook.routes.js';`. Add the mount line near the other `app.use('/api/...')` lines: `app.use('/api/whatsapp', whatsappWebhookRouter);`. Note: this router is intentionally **not** behind `authenticate` — Meta calls it directly, authentication is the HMAC signature check instead.

- [ ] **Step 6: Add `supertest` as a dev dependency (needed by this and prior route tests)**

Edit `server/package.json`, add to `"devDependencies"`: `"supertest": "^7.0.0"`, `"@types/supertest": "^6.0.2"`. Run: `npm --prefix server install`.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npm --prefix server run test -- whatsappWebhook`
Expected: all pass. Also re-run the full suite (`npm --prefix server run test`) to confirm Task 4/8's supertest-based tests (which assumed `supertest` would be added) now pass too.

- [ ] **Step 8: Add the new env vars to `.env.example` and `server/.env`**

Add to `server/.env.example` (and `server/.env` with real values once available):

```
WHATSAPP_APP_SECRET="<app secret from Meta Business Manager>"
WHATSAPP_WEBHOOK_VERIFY_TOKEN="<a random string you choose, entered identically in Meta's webhook config>"
WHATSAPP_LEAVE_MANAGER_TEMPLATE_NAME="demande_conge_manager"
WHATSAPP_LEAVE_APPROVED_TEMPLATE_NAME="conge_valide"
WHATSAPP_LEAVE_REFUSED_TEMPLATE_NAME="conge_refuse"
```

- [ ] **Step 9: Commit**

```bash
git add server/src/routes/whatsappWebhook.routes.ts server/src/routes/whatsappWebhook.routes.test.ts server/src/app.ts server/package.json server/package-lock.json server/.env.example
git commit -m "feat(whatsapp): add inbound webhook route with signature verification"
```

---

## Task 14: Flow 1 — payslip PIN authentication and delivery

**Files:**
- Create: `server/src/lib/whatsappFlows/payslip.ts`
- Modify: `server/src/routes/whatsappWebhook.routes.ts` (dispatch to this flow; also handle the template button click that starts it)
- Test: `server/src/lib/whatsappFlows/payslip.test.ts`

**Interfaces:**
- Consumes: `verifyPin` (Task 3), `startSession`/`advanceSession`/`endSession` (Task 11), `sendWhatsAppTextMessage`/`sendWhatsAppDocument` (Tasks 6/10), `generatePayslipPdf` (Task 12), `prisma`, `put` from `@vercel/blob`.
- Produces:
  - `PAYSLIP_FLOW = 'payslip_delivery'` (string constant used as `WhatsAppSession.flow`)
  - `handlePayslipFlowMessage(session: WhatsAppSession, employee: Employee & { company: Company }, incoming: IncomingMessage): Promise<void>` — sends whatever WhatsApp reply is appropriate and updates/ends the session itself (no return value the caller needs to act on).
  - `startPayslipFlow(employee: Employee & { company: Company }, payslipId: string): Promise<void>` — called when the employee taps "Obtenir mon bulletin" on the template notification.

- [ ] **Step 1: Write the failing tests**

```typescript
// server/src/lib/whatsappFlows/payslip.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockAdvanceSession = vi.fn();
const mockEndSession = vi.fn();
const mockSendText = vi.fn().mockResolvedValue({ ok: true });
const mockSendDocument = vi.fn().mockResolvedValue({ ok: true });
const mockFindEmployee = vi.fn();
const mockFindPayslip = vi.fn();
const mockUpdatePayslip = vi.fn();
const mockBlobPut = vi.fn().mockResolvedValue({ url: 'https://blob.example.com/p.pdf' });

vi.mock('../whatsappSession.js', () => ({ advanceSession: (...a: unknown[]) => mockAdvanceSession(...a), endSession: (...a: unknown[]) => mockEndSession(...a) }));
vi.mock('../whatsapp.js', () => ({ sendWhatsAppTextMessage: (...a: unknown[]) => mockSendText(...a), sendWhatsAppDocument: (...a: unknown[]) => mockSendDocument(...a) }));
vi.mock('../payslipPdf.js', () => ({ generatePayslipPdf: () => Buffer.from('%PDF-fake') }));
vi.mock('@vercel/blob', () => ({ put: (...a: unknown[]) => mockBlobPut(...a) }));
vi.mock('../prisma.js', () => ({
  prisma: {
    employee: { update: (...a: unknown[]) => mockFindEmployee(...a) },
    payslip: { findFirst: (...a: unknown[]) => mockFindPayslip(...a), update: (...a: unknown[]) => mockUpdatePayslip(...a) },
  },
}));

const { handlePayslipFlowMessage } = await import('./payslip.js');

const employee = {
  id: 'e1', phone: '70123456', firstName: 'Awa', lastName: 'Ouédraogo',
  whatsappPinHash: '$2a$10$fakehashfakehashfakehashfakehashfakehash', whatsappPinFailedAttempts: 0, whatsappPinLockedUntil: null,
  company: { countryCode: 'BF' },
};
const session = { id: 's1', phone: '22670123456', flow: 'payslip_delivery', step: 'awaiting_pin', data: { payslipId: 'p1' } };

describe('handlePayslipFlowMessage — awaiting_pin step', () => {
  beforeEach(() => {
    mockAdvanceSession.mockReset();
    mockEndSession.mockReset();
    mockSendText.mockReset().mockResolvedValue({ ok: true });
    mockSendDocument.mockReset().mockResolvedValue({ ok: true });
    mockFindPayslip.mockReset();
    mockUpdatePayslip.mockReset();
  });

  it('rejects a non-4-digit reply without consuming an attempt', async () => {
    await handlePayslipFlowMessage(session as never, employee as never, { from: '22670123456', kind: 'text', text: 'abcd' });
    expect(mockSendText).toHaveBeenCalledWith('22670123456', expect.stringContaining('4 chiffres'));
    expect(mockAdvanceSession).not.toHaveBeenCalled();
    expect(mockEndSession).not.toHaveBeenCalled();
  });

  it('sends the cached PDF and ends the session on a correct PIN', async () => {
    mockFindPayslip.mockResolvedValue({ id: 'p1', pdfUrl: 'https://blob.example.com/cached.pdf', period: '2026-07' });
    await handlePayslipFlowMessage(session as never, employee as never, { from: '22670123456', kind: 'text', text: '4821' });
    // Le vrai hash de test ne correspondra pas à "4821" — ce test vérifie
    // uniquement le chemin "succès", donc on utilise verifyPin réel avec un
    // hash généré pour "4821" dans le test suivant à la place.
  });
});
```

Replace the second test above (a real bcrypt hash is needed for the "correct PIN" path — inline a fixture instead of guessing a hash):

```typescript
// server/src/lib/whatsappFlows/payslip.test.ts (continued — replace the placeholder test above)
import { hashPin } from '../whatsappPin.js';

it('sends the cached PDF and ends the session on a correct PIN', async () => {
  const pinHash = await hashPin('4821');
  mockFindPayslip.mockResolvedValue({ id: 'p1', pdfUrl: 'https://blob.example.com/cached.pdf', period: '2026-07' });
  await handlePayslipFlowMessage(session as never, { ...employee, whatsappPinHash: pinHash } as never, { from: '22670123456', kind: 'text', text: '4821' });
  expect(mockSendDocument).toHaveBeenCalledWith('22670123456', { link: 'https://blob.example.com/cached.pdf', filename: expect.stringContaining('.pdf') });
  expect(mockEndSession).toHaveBeenCalledWith('s1');
});

it('generates and caches the PDF when none exists yet', async () => {
  const pinHash = await hashPin('4821');
  mockFindPayslip.mockResolvedValue({ id: 'p1', pdfUrl: null, period: '2026-07' });
  mockUpdatePayslip.mockResolvedValue({});
  await handlePayslipFlowMessage(session as never, { ...employee, whatsappPinHash: pinHash } as never, { from: '22670123456', kind: 'text', text: '4821' });
  expect(mockBlobPut).toHaveBeenCalledTimes(1);
  expect(mockUpdatePayslip).toHaveBeenCalledWith({ where: { id: 'p1' }, data: { pdfUrl: 'https://blob.example.com/p.pdf' } });
  expect(mockSendDocument).toHaveBeenCalledWith('22670123456', { link: 'https://blob.example.com/p.pdf', filename: expect.stringContaining('.pdf') });
});

it('rejects an incorrect PIN and keeps the session open with attempts remaining', async () => {
  const pinHash = await hashPin('4821');
  await handlePayslipFlowMessage(session as never, { ...employee, whatsappPinHash: pinHash } as never, { from: '22670123456', kind: 'text', text: '0000' });
  expect(mockSendText).toHaveBeenCalledWith('22670123456', expect.stringContaining('incorrect'));
  expect(mockAdvanceSession).toHaveBeenCalledWith('s1', { step: 'awaiting_pin', data: { payslipId: 'p1' } });
  expect(mockEndSession).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm --prefix server run test -- whatsappFlows/payslip`
Expected: FAIL — module doesn't exist

- [ ] **Step 3: Implement**

```typescript
// server/src/lib/whatsappFlows/payslip.ts
import { put } from '@vercel/blob';
import { Company, Employee, WhatsAppSession } from '@prisma/client';
import { prisma } from '../prisma.js';
import { verifyPin } from '../whatsappPin.js';
import { advanceSession, endSession } from '../whatsappSession.js';
import { sendWhatsAppTextMessage, sendWhatsAppDocument } from '../whatsapp.js';
import { generatePayslipPdf, PayslipPdfData } from '../payslipPdf.js';
import type { IncomingMessage } from '../../routes/whatsappWebhook.routes.js';

export const PAYSLIP_FLOW = 'payslip_delivery';

interface PayslipFlowData {
  payslipId: string;
}

// Construit les données du PDF à partir du même Payslip que celui déjà
// affiché dans PayslipPreviewDialog.tsx côté portail. Simplifié
// volontairement par rapport à ce dialogue (une seule ligne CNSS, pas de
// détail avances/retenues) pour rester au niveau d'information déjà présent
// sur le Payslip stocké — voir Task 12 pour le format cible.
function buildPdfDataFromPayslip(
  payslip: { period: string; baseSalary: number; salaireBrut: number; cnssEmployee: number; cnssEmployer: number; iuts: number; salaireNet: number; coutEmployeur: number },
  employee: Employee,
  company: Company
): PayslipPdfData {
  return {
    company: { name: company.name, legalName: company.legalName, taxIdLabel: 'IFU', socialAgencyLabel: 'CNSS' },
    employee: { fullName: `${employee.firstName} ${employee.lastName}`, matricule: employee.matricule },
    period: { label: payslip.period },
    earnings: [{ label: 'Salaire de base', employeeAmount: payslip.baseSalary }],
    grossSalary: payslip.salaireBrut,
    contributions: [{ label: 'CNSS', employeeAmount: -payslip.cnssEmployee, employerAmount: payslip.cnssEmployer }],
    employeeContributionsTotal: payslip.cnssEmployee,
    employerContributionsTotal: payslip.cnssEmployer,
    incomeTax: { label: 'IUTS', base: payslip.salaireBrut - payslip.cnssEmployee, rate: 0, amount: payslip.iuts },
    netBeforeTax: payslip.salaireBrut - payslip.cnssEmployee,
    netToPay: payslip.salaireNet,
    employerCost: payslip.coutEmployeur,
    currencyCode: company.currencyCode,
  };
}

async function deliverPayslip(phone: string, payslipId: string, employee: Employee, company: Company): Promise<void> {
  const payslip = await prisma.payslip.findFirst({ where: { id: payslipId } });
  if (!payslip) {
    await sendWhatsAppTextMessage(phone, "Votre bulletin n'est plus disponible. Contactez votre service RH.");
    return;
  }

  let pdfUrl = payslip.pdfUrl;
  if (!pdfUrl) {
    const pdfData = buildPdfDataFromPayslip(payslip, employee, company);
    const pdfBuffer = generatePayslipPdf(pdfData);
    const blob = await put(`payslips/${payslip.id}.pdf`, pdfBuffer, {
      access: 'private',
      contentType: 'application/pdf',
      token: process.env.DOCUMENTS_BLOB_READ_WRITE_TOKEN,
    });
    pdfUrl = blob.url;
    await prisma.payslip.update({ where: { id: payslip.id }, data: { pdfUrl } });
  }

  await sendWhatsAppDocument(phone, { link: pdfUrl, filename: `Bulletin_Paie_${payslip.period}.pdf` });
}

export async function handlePayslipFlowMessage(session: WhatsAppSession, employee: Employee & { company: Company }, incoming: IncomingMessage): Promise<void> {
  if (session.step !== 'awaiting_pin' || incoming.kind !== 'text') {
    await sendWhatsAppTextMessage(incoming.from, 'Veuillez entrer votre code PIN à 4 chiffres.');
    return;
  }

  if (!/^\d{4}$/.test(incoming.text)) {
    await sendWhatsAppTextMessage(incoming.from, 'Le code PIN doit contenir exactement 4 chiffres. Veuillez réessayer.');
    return;
  }

  const result = await verifyPin(incoming.text, employee);

  if (result.outcome === 'no_pin_set') {
    await sendWhatsAppTextMessage(incoming.from, "Vous n'avez pas encore configuré de code PIN WhatsApp. Rendez-vous sur le portail LaafiPay, dans votre espace self-service, pour en définir un.");
    await endSession(session.id);
    return;
  }

  if (result.outcome === 'locked') {
    await sendWhatsAppTextMessage(incoming.from, `Trop de tentatives incorrectes. Réessayez après ${result.unlocksAt.toLocaleTimeString('fr-FR')}.`);
    await endSession(session.id);
    return;
  }

  await prisma.employee.update({ where: { id: employee.id }, data: result.update });

  if (result.outcome === 'incorrect') {
    await sendWhatsAppTextMessage(incoming.from, `Code PIN incorrect. Tentatives restantes : ${result.attemptsRemaining}.`);
    await advanceSession(session.id, { step: session.step, data: session.data as PayslipFlowData });
    return;
  }

  const { payslipId } = session.data as PayslipFlowData;
  await deliverPayslip(incoming.from, payslipId, employee, employee.company);
  await endSession(session.id);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm --prefix server run test -- whatsappFlows/payslip`
Expected: `5 passed`

- [ ] **Step 5: Wire the flow into the webhook — both the "start" trigger and step dispatch**

In `server/src/routes/whatsappWebhook.routes.ts`:

Add imports: `import { PAYSLIP_FLOW, handlePayslipFlowMessage } from '../lib/whatsappFlows/payslip.js';`, `import { startSession } from '../lib/whatsappSession.js';`, `import { prisma } from '../lib/prisma.js';`.

Replace the placeholder `if (!session) { ... }` block in the `POST /webhook` handler with:

```typescript
  if (!session) {
    // Déclencheur : l'employé a cliqué sur "Obtenir mon bulletin" (bouton du
    // template bulletin_disponible). Le clic arrive comme un message de type
    // "button" (bouton de template, pas interactive) — voir la doc Meta sur
    // les quick-reply buttons de template.
    const latestPayslip = await prisma.payslip.findFirst({ where: { employeeId: employee.id, whatsappStatus: 'envoye' }, orderBy: { generatedAt: 'desc' } });
    if (!latestPayslip) {
      await sendWhatsAppTextMessage(incoming.from, "Aucun bulletin n'est disponible pour le moment.");
      res.sendStatus(200);
      return;
    }
    const newSession = await startSession({ phone: incoming.from, employeeId: employee.id, flow: PAYSLIP_FLOW, step: 'awaiting_pin', data: { payslipId: latestPayslip.id } });
    await handlePayslipFlowMessage(newSession, employee, { from: incoming.from, kind: 'text', text: '' });
    res.sendStatus(200);
    return;
  }

  if (session.flow === PAYSLIP_FLOW) {
    await handlePayslipFlowMessage(session, employee, incoming);
    res.sendStatus(200);
    return;
  }
```

Note the deliberate reuse of `handlePayslipFlowMessage` for the very first "awaiting_pin" prompt too (an empty/invalid `text` falls through to the "entrez votre code PIN" reminder message) — avoids a second near-duplicate function just to send the opening prompt. Remove the now-superseded generic placeholder reply that used to follow this block.

- [ ] **Step 6: Update the webhook route test for the new trigger behavior**

The existing test `'acknowledges with 200 for a known employee with no active session (placeholder reply)'` in `whatsappWebhook.routes.test.ts` asserted on the now-removed placeholder text — delete that test (the trigger behavior it partially covered is tested properly below).

`vi.mock` calls are hoisted to module scope, so a scenario needing `prisma.payslip.findFirst` mocked cannot be added inline via `vi.doMock` in the same file — the `app` module (and its transitive import of `whatsappWebhook.routes.js`, which imports `prisma.js`) is already evaluated by the time a test body runs. Create a new file instead, following the exact pattern already used in `leaveRequests.test.ts` (Task 8):

```typescript
// server/src/routes/whatsappWebhook.payslipTrigger.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';

const mockResolveEmployee = vi.fn();
const mockGetActiveSession = vi.fn();
const mockSendText = vi.fn().mockResolvedValue({ ok: true });
const mockFindFirstPayslip = vi.fn();

vi.mock('../lib/whatsappSession.js', () => ({
  resolveEmployeeByWhatsAppPhone: (...args: unknown[]) => mockResolveEmployee(...args),
  getActiveSession: (...args: unknown[]) => mockGetActiveSession(...args),
  startSession: vi.fn().mockResolvedValue({ id: 's1', phone: '22670123456', flow: 'payslip_delivery', step: 'awaiting_pin', data: {} }),
}));
vi.mock('../lib/whatsapp.js', () => ({ sendWhatsAppTextMessage: (...args: unknown[]) => mockSendText(...args) }));
vi.mock('../lib/whatsappFlows/payslip.js', () => ({ PAYSLIP_FLOW: 'payslip_delivery', handlePayslipFlowMessage: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../lib/prisma.js', () => ({ prisma: { payslip: { findFirst: (...args: unknown[]) => mockFindFirstPayslip(...args) } } }));

const { default: app } = await import('../app.js');

describe('POST /api/whatsapp/webhook — payslip trigger', () => {
  beforeEach(() => {
    mockResolveEmployee.mockReset();
    mockGetActiveSession.mockReset();
    mockFindFirstPayslip.mockReset();
    process.env.WHATSAPP_APP_SECRET = 'test-secret';
  });

  function signedRequest(body: object) {
    const raw = JSON.stringify(body);
    const digest = crypto.createHmac('sha256', 'test-secret').update(raw).digest('hex');
    return request(app).post('/api/whatsapp/webhook').set('Content-Type', 'application/json').set('X-Hub-Signature-256', `sha256=${digest}`).send(raw);
  }

  it('starts the payslip flow when a known employee has no session and a sent payslip exists', async () => {
    mockResolveEmployee.mockResolvedValue({ id: 'e1', phone: '70123456', company: { countryCode: 'BF' } });
    mockGetActiveSession.mockResolvedValue(null);
    mockFindFirstPayslip.mockResolvedValue({ id: 'p1' });
    const body = { entry: [{ changes: [{ value: { messages: [{ from: '22670123456', type: 'text', text: { body: 'hi' } }] } }] }] };
    const res = await signedRequest(body);
    expect(res.status).toBe(200);
  });

  it('tells the employee no payslip is available when none has been sent yet', async () => {
    mockResolveEmployee.mockResolvedValue({ id: 'e1', phone: '70123456', company: { countryCode: 'BF' } });
    mockGetActiveSession.mockResolvedValue(null);
    mockFindFirstPayslip.mockResolvedValue(null);
    const body = { entry: [{ changes: [{ value: { messages: [{ from: '22670123456', type: 'text', text: { body: 'hi' } }] } }] }] };
    const res = await signedRequest(body);
    expect(res.status).toBe(200);
    expect(mockSendText).toHaveBeenCalledWith('22670123456', expect.stringContaining('Aucun bulletin'));
  });
});
```

At this point in the plan, `whatsappWebhook.routes.ts` doesn't reference `whatsappFlows/leave.js` yet (that import is added in Task 15, Step 5) — so this test file only needs to mock what the route currently imports. Task 15 adds its own leave-flow route tests directly in `whatsappWebhook.routes.test.ts` (Step 5 there shows the exact code); it doesn't need to touch this file.

- [ ] **Step 7: Run the full server test suite and typecheck**

Run: `npm --prefix server run test`
Run: `cd server && npx tsc -b --noEmit`
Expected: all green, no type errors.

- [ ] **Step 8: Commit**

```bash
git add server/src/lib/whatsappFlows/payslip.ts server/src/lib/whatsappFlows/payslip.test.ts server/src/routes/whatsappWebhook.routes.ts server/src/routes/whatsappWebhook.routes.test.ts
git commit -m "feat(whatsapp): implement Flux 1 — PIN-authenticated payslip delivery"
```

---

## Task 15: Flow 2 — leave request menu, dates, confirmation

**Files:**
- Create: `server/src/lib/whatsappFlows/leave.ts`
- Modify: `server/src/routes/whatsappWebhook.routes.ts` (dispatch to this flow; add the "Demander un congé" trigger keyword)
- Test: `server/src/lib/whatsappFlows/leave.test.ts`

**Interfaces:**
- Consumes: `parseFrenchDate`/`computeLeaveDaysCount` (Task 7), `createLeaveRequestRecord` (Task 8), `startSession`/`advanceSession`/`endSession` (Task 11), `sendWhatsAppTextMessage`/`sendWhatsAppListMessage`/`sendWhatsAppReplyButtons` (Task 10), `prisma`.
- Produces:
  - `LEAVE_FLOW = 'leave_request'`
  - `LEAVE_TYPE_MENU: { id: LeaveType; title: string }[]` — the 6 menu rows in the exact order from the spec.
  - `startLeaveFlow(employee: Employee, phone: string): Promise<void>`
  - `handleLeaveFlowMessage(session: WhatsAppSession, employee: Employee & { company: Company }, incoming: IncomingMessage): Promise<void>`

- [ ] **Step 1: Write the failing tests**

```typescript
// server/src/lib/whatsappFlows/leave.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockAdvanceSession = vi.fn();
const mockEndSession = vi.fn();
const mockSendText = vi.fn().mockResolvedValue({ ok: true });
const mockSendList = vi.fn().mockResolvedValue({ ok: true });
const mockSendButtons = vi.fn().mockResolvedValue({ ok: true });
const mockCreateLeaveRequest = vi.fn();
const mockFindBalances = vi.fn();

vi.mock('../whatsappSession.js', () => ({ startSession: vi.fn().mockResolvedValue({ id: 's1' }), advanceSession: (...a: unknown[]) => mockAdvanceSession(...a), endSession: (...a: unknown[]) => mockEndSession(...a) }));
vi.mock('../whatsapp.js', () => ({ sendWhatsAppTextMessage: (...a: unknown[]) => mockSendText(...a), sendWhatsAppListMessage: (...a: unknown[]) => mockSendList(...a), sendWhatsAppReplyButtons: (...a: unknown[]) => mockSendButtons(...a) }));
vi.mock('../leaveRequests.js', () => ({ createLeaveRequestRecord: (...a: unknown[]) => mockCreateLeaveRequest(...a) }));
vi.mock('../prisma.js', () => ({ prisma: { leaveBalance: { findMany: (...a: unknown[]) => mockFindBalances(...a) } } }));

const { startLeaveFlow, handleLeaveFlowMessage } = await import('./leave.js');

const employee = { id: 'e1', companyId: 'c1', firstName: 'Awa', lastName: 'Ouédraogo', company: { countryCode: 'BF' } };

describe('startLeaveFlow', () => {
  beforeEach(() => {
    mockSendText.mockReset().mockResolvedValue({ ok: true });
    mockSendList.mockReset().mockResolvedValue({ ok: true });
    mockFindBalances.mockReset();
  });

  it('shows current balances followed by the leave-type list', async () => {
    mockFindBalances.mockResolvedValue([
      { type: 'conge_paye', remaining: 18 },
      { type: 'conge_anciennete', remaining: 2 },
    ]);
    await startLeaveFlow(employee as never, '22670123456');
    expect(mockSendText).toHaveBeenCalledWith('22670123456', expect.stringContaining('18 jours'));
    expect(mockSendList).toHaveBeenCalledTimes(1);
    const [, params] = mockSendList.mock.calls[0];
    expect(params.sections[0].rows).toHaveLength(6);
    expect(params.sections[0].rows[0]).toEqual({ id: 'conge_paye', title: 'Congé payé légal' });
  });
});

describe('handleLeaveFlowMessage — choosing_type step', () => {
  const session = { id: 's1', phone: '22670123456', flow: 'leave_request', step: 'choosing_type', data: {} };

  beforeEach(() => {
    mockAdvanceSession.mockReset();
    mockSendText.mockReset().mockResolvedValue({ ok: true });
  });

  it('advances to awaiting_start_date on a valid list reply', async () => {
    await handleLeaveFlowMessage(session as never, employee as never, { from: '22670123456', kind: 'list_reply', id: 'conge_paye' });
    expect(mockAdvanceSession).toHaveBeenCalledWith('s1', { step: 'awaiting_start_date', data: { leaveType: 'conge_paye' } });
    expect(mockSendText).toHaveBeenCalledWith('22670123456', expect.stringContaining('JJ/MM/AAAA'));
  });
});

describe('handleLeaveFlowMessage — awaiting_start_date step', () => {
  const session = { id: 's1', phone: '22670123456', flow: 'leave_request', step: 'awaiting_start_date', data: { leaveType: 'conge_paye' } };

  beforeEach(() => {
    mockAdvanceSession.mockReset();
    mockSendText.mockReset().mockResolvedValue({ ok: true });
  });

  it('rejects an invalid date format', async () => {
    await handleLeaveFlowMessage(session as never, employee as never, { from: '22670123456', kind: 'text', text: 'pas une date' });
    expect(mockSendText).toHaveBeenCalledWith('22670123456', expect.stringContaining('JJ/MM/AAAA'));
    expect(mockAdvanceSession).not.toHaveBeenCalled();
  });

  it('advances to awaiting_end_date on a valid date', async () => {
    await handleLeaveFlowMessage(session as never, employee as never, { from: '22670123456', kind: 'text', text: '10/08/2026' });
    expect(mockAdvanceSession).toHaveBeenCalledWith('s1', { step: 'awaiting_end_date', data: { leaveType: 'conge_paye', startDate: '10/08/2026' } });
  });
});

describe('handleLeaveFlowMessage — awaiting_end_date step', () => {
  const session = { id: 's1', phone: '22670123456', flow: 'leave_request', step: 'awaiting_end_date', data: { leaveType: 'conge_paye', startDate: '10/08/2026' } };

  beforeEach(() => {
    mockAdvanceSession.mockReset();
    mockSendText.mockReset().mockResolvedValue({ ok: true });
    mockSendButtons.mockReset().mockResolvedValue({ ok: true });
    mockFindBalances.mockReset().mockResolvedValue([{ type: 'conge_paye', remaining: 18 }]);
  });

  it('rejects an end date before the start date', async () => {
    await handleLeaveFlowMessage(session as never, employee as never, { from: '22670123456', kind: 'text', text: '05/08/2026' });
    expect(mockSendText).toHaveBeenCalledWith('22670123456', expect.stringContaining('après'));
    expect(mockAdvanceSession).not.toHaveBeenCalled();
  });

  it('shows the recap with confirm/cancel buttons on a valid range', async () => {
    await handleLeaveFlowMessage(session as never, employee as never, { from: '22670123456', kind: 'text', text: '21/08/2026' });
    expect(mockAdvanceSession).toHaveBeenCalledWith('s1', { step: 'awaiting_confirmation', data: { leaveType: 'conge_paye', startDate: '10/08/2026', endDate: '21/08/2026', daysCount: 12 } });
    expect(mockSendButtons).toHaveBeenCalledWith('22670123456', expect.objectContaining({ buttons: [{ id: 'confirm', title: '✅ Confirmer' }, { id: 'cancel', title: '❌ Annuler' }] }));
  });
});

describe('handleLeaveFlowMessage — awaiting_confirmation step', () => {
  const session = { id: 's1', phone: '22670123456', flow: 'leave_request', step: 'awaiting_confirmation', data: { leaveType: 'conge_paye', startDate: '10/08/2026', endDate: '21/08/2026', daysCount: 12 } };

  beforeEach(() => {
    mockEndSession.mockReset();
    mockSendText.mockReset().mockResolvedValue({ ok: true });
    mockCreateLeaveRequest.mockReset().mockResolvedValue({ id: 'req1' });
  });

  it('cancels on the cancel button without creating a request', async () => {
    await handleLeaveFlowMessage(session as never, employee as never, { from: '22670123456', kind: 'button_reply', id: 'cancel' });
    expect(mockCreateLeaveRequest).not.toHaveBeenCalled();
    expect(mockSendText).toHaveBeenCalledWith('22670123456', expect.stringContaining('annulée'));
    expect(mockEndSession).toHaveBeenCalledWith('s1');
  });

  it('creates the leave request on confirm', async () => {
    await handleLeaveFlowMessage(session as never, employee as never, { from: '22670123456', kind: 'button_reply', id: 'confirm' });
    expect(mockCreateLeaveRequest).toHaveBeenCalledWith({
      companyId: 'c1', employeeId: 'e1', type: 'conge_paye',
      startDate: new Date(Date.UTC(2026, 7, 10)), endDate: new Date(Date.UTC(2026, 7, 21)),
      daysCount: 12, channel: 'whatsapp',
    });
    expect(mockSendText).toHaveBeenCalledWith('22670123456', expect.stringContaining('envoyée'));
    expect(mockEndSession).toHaveBeenCalledWith('s1');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm --prefix server run test -- whatsappFlows/leave`
Expected: FAIL — module doesn't exist

- [ ] **Step 3: Implement**

```typescript
// server/src/lib/whatsappFlows/leave.ts
import { Company, Employee, LeaveType, WhatsAppSession } from '@prisma/client';
import { prisma } from '../prisma.js';
import { parseFrenchDate, computeLeaveDaysCount } from '../leaveDates.js';
import { createLeaveRequestRecord } from '../leaveRequests.js';
import { startSession, advanceSession, endSession } from '../whatsappSession.js';
import { sendWhatsAppTextMessage, sendWhatsAppListMessage, sendWhatsAppReplyButtons } from '../whatsapp.js';
import type { IncomingMessage } from '../../routes/whatsappWebhook.routes.js';

export const LEAVE_FLOW = 'leave_request';

// Ordre et libellés repris tels quels du script de conversation (spec,
// Flux 2 étape 1).
export const LEAVE_TYPE_MENU: { id: LeaveType; title: string }[] = [
  { id: 'conge_paye', title: 'Congé payé légal' },
  { id: 'evenement_familial', title: 'Permission exceptionnelle' },
  { id: 'maternite', title: 'Congé de maternité / paternité' },
  { id: 'maladie', title: 'Congé maladie' },
  { id: 'examen_formation', title: 'Congé pour examen / formation' },
  { id: 'sans_solde', title: 'Congé sans solde' },
];

interface LeaveFlowData {
  leaveType?: LeaveType;
  startDate?: string;
  endDate?: string;
  daysCount?: number;
}

function dateOnlyFr(date: Date): string {
  return date.toLocaleDateString('fr-FR', { timeZone: 'UTC' });
}

export async function startLeaveFlow(employee: Employee, phone: string): Promise<void> {
  const year = new Date().getUTCFullYear();
  const balances = await prisma.leaveBalance.findMany({ where: { employeeId: employee.id, year } });
  const congePaye = balances.find((b) => b.type === 'conge_paye');
  const conge_anciennete = balances.find((b) => b.type === 'conge_anciennete');

  await sendWhatsAppTextMessage(
    phone,
    `Vos soldes actuels :\n• Congés payés principaux : ${congePaye?.remaining ?? 0} jours\n• Congés d'ancienneté : ${conge_anciennete?.remaining ?? 0} jours`
  );

  await sendWhatsAppListMessage(phone, {
    bodyText: 'Quel type de congé souhaitez-vous demander ?',
    buttonLabel: 'Choisir',
    sections: [{ title: 'Types de congé', rows: LEAVE_TYPE_MENU }],
  });

  await startSession({ phone, employeeId: employee.id, flow: LEAVE_FLOW, step: 'choosing_type' });
}

export async function handleLeaveFlowMessage(session: WhatsAppSession, employee: Employee & { company: Company }, incoming: IncomingMessage): Promise<void> {
  const data = session.data as LeaveFlowData;

  if (session.step === 'choosing_type') {
    if (incoming.kind !== 'list_reply') {
      await sendWhatsAppTextMessage(incoming.from, 'Veuillez choisir un type de congé dans la liste proposée.');
      return;
    }
    await advanceSession(session.id, { step: 'awaiting_start_date', data: { leaveType: incoming.id as LeaveType } });
    await sendWhatsAppTextMessage(incoming.from, 'Indiquez la date de début (format : JJ/MM/AAAA).\nExemple : 10/08/2026');
    return;
  }

  if (session.step === 'awaiting_start_date') {
    if (incoming.kind !== 'text' || !parseFrenchDate(incoming.text)) {
      await sendWhatsAppTextMessage(incoming.from, 'Format de date invalide. Merci de répondre au format JJ/MM/AAAA (ex. 10/08/2026).');
      return;
    }
    await advanceSession(session.id, { step: 'awaiting_end_date', data: { ...data, startDate: incoming.text } });
    await sendWhatsAppTextMessage(incoming.from, 'Indiquez la date de fin (inclus).');
    return;
  }

  if (session.step === 'awaiting_end_date') {
    if (incoming.kind !== 'text' || !parseFrenchDate(incoming.text)) {
      await sendWhatsAppTextMessage(incoming.from, 'Format de date invalide. Merci de répondre au format JJ/MM/AAAA (ex. 21/08/2026).');
      return;
    }
    const startDate = parseFrenchDate(data.startDate!)!;
    const endDate = parseFrenchDate(incoming.text)!;
    if (endDate < startDate) {
      await sendWhatsAppTextMessage(incoming.from, 'La date de fin doit être après la date de début. Merci de la ressaisir.');
      return;
    }

    const daysCount = computeLeaveDaysCount(startDate, endDate);
    const year = startDate.getUTCFullYear();
    const balance = await prisma.leaveBalance.findMany({ where: { employeeId: employee.id, year, type: data.leaveType } });
    const remaining = (balance[0]?.remaining ?? 0) - daysCount;

    await advanceSession(session.id, { step: 'awaiting_confirmation', data: { ...data, endDate: incoming.text, daysCount } });

    const menuEntry = LEAVE_TYPE_MENU.find((m) => m.id === data.leaveType);
    await sendWhatsAppTextMessage(
      incoming.from,
      `📝 Récapitulatif de votre demande :\n• Type : ${menuEntry?.title}\n• Du : ${data.startDate} au ${incoming.text}\n• Durée : ${daysCount} jours\n• Solde restant après validation : ${remaining} jours\n\nValidez-vous cette demande ?`
    );
    await sendWhatsAppReplyButtons(incoming.from, { bodyText: 'Confirmez-vous cette demande ?', buttons: [{ id: 'confirm', title: '✅ Confirmer' }, { id: 'cancel', title: '❌ Annuler' }] });
    return;
  }

  if (session.step === 'awaiting_confirmation') {
    if (incoming.kind !== 'button_reply') {
      await sendWhatsAppTextMessage(incoming.from, 'Merci de répondre avec les boutons "Confirmer" ou "Annuler".');
      return;
    }

    if (incoming.id === 'cancel') {
      await sendWhatsAppTextMessage(incoming.from, 'Demande annulée.');
      await endSession(session.id);
      return;
    }

    if (incoming.id === 'confirm') {
      const startDate = parseFrenchDate(data.startDate!)!;
      const endDate = parseFrenchDate(data.endDate!)!;
      await createLeaveRequestRecord({
        companyId: employee.companyId,
        employeeId: employee.id,
        type: data.leaveType!,
        startDate,
        endDate,
        daysCount: data.daysCount!,
        channel: 'whatsapp',
      });
      await sendWhatsAppTextMessage(incoming.from, '🚀 Demande envoyée avec succès ! Votre manager a été notifié. Vous recevrez un message sur WhatsApp dès qu\'elle sera validée.');
      await endSession(session.id);
      return;
    }
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm --prefix server run test -- whatsappFlows/leave`
Expected: `9 passed`

- [ ] **Step 5: Wire the trigger and dispatch into the webhook**

In `server/src/routes/whatsappWebhook.routes.ts`, add the import: `import { LEAVE_FLOW, startLeaveFlow, handleLeaveFlowMessage } from '../lib/whatsappFlows/leave.js';`.

Replace the whole `if (!session) { ... }` block that Task 14 Step 5 put in place with this merged version (adds the leave trigger check before the payslip trigger; the payslip-trigger body is unchanged from Task 14):

```typescript
  if (!session) {
    const isLeaveTrigger = (incoming.kind === 'text' && /demander un cong/i.test(incoming.text)) || (incoming.kind === 'button_reply' && incoming.id === 'demander_conge');
    if (isLeaveTrigger) {
      await startLeaveFlow(employee, incoming.from);
      res.sendStatus(200);
      return;
    }

    const latestPayslip = await prisma.payslip.findFirst({ where: { employeeId: employee.id, whatsappStatus: 'envoye' }, orderBy: { generatedAt: 'desc' } });
    if (!latestPayslip) {
      await sendWhatsAppTextMessage(incoming.from, "Aucun bulletin n'est disponible pour le moment.");
      res.sendStatus(200);
      return;
    }
    const newSession = await startSession({ phone: incoming.from, employeeId: employee.id, flow: PAYSLIP_FLOW, step: 'awaiting_pin', data: { payslipId: latestPayslip.id } });
    await handlePayslipFlowMessage(newSession, employee, { from: incoming.from, kind: 'text', text: '' });
    res.sendStatus(200);
    return;
  }

  if (session.flow === PAYSLIP_FLOW) {
    await handlePayslipFlowMessage(session, employee, incoming);
    res.sendStatus(200);
    return;
  }

  if (session.flow === LEAVE_FLOW) {
    await handleLeaveFlowMessage(session, employee, incoming);
    res.sendStatus(200);
    return;
  }
```

This replaces both the `if (!session) {...}` block and the `if (session.flow === PAYSLIP_FLOW) {...}` block from Task 14 Step 5 — the whole dispatch section now lives in one place with both flows registered.

- [ ] **Step 6: Add dispatch tests for the leave trigger and add `whatsappFlows/leave.js` to the existing webhook mocks**

`server/src/routes/whatsappWebhook.routes.test.ts` (from Task 13) mocks `../lib/whatsapp.js` and `../lib/whatsappSession.js` but not `../lib/whatsappFlows/payslip.js` or `../lib/whatsappFlows/leave.js` — since Task 13's tests only exercised the pre-dispatch skeleton. Now that the route imports both flow modules, add these mocks near the top of `whatsappWebhook.routes.test.ts` (alongside the existing `vi.mock` calls) so the existing tests keep passing against real flow logic being exercised end-to-end rather than mocked — for this route-level test file, mock them out so it stays focused on dispatch, not flow behavior (flow behavior already has its own dedicated test files, Tasks 14 and 15):

```typescript
const mockHandlePayslipFlowMessage = vi.fn().mockResolvedValue(undefined);
const mockStartLeaveFlow = vi.fn().mockResolvedValue(undefined);
const mockHandleLeaveFlowMessage = vi.fn().mockResolvedValue(undefined);

vi.mock('../lib/whatsappFlows/payslip.js', () => ({ PAYSLIP_FLOW: 'payslip_delivery', handlePayslipFlowMessage: (...a: unknown[]) => mockHandlePayslipFlowMessage(...a) }));
vi.mock('../lib/whatsappFlows/leave.js', () => ({ LEAVE_FLOW: 'leave_request', startLeaveFlow: (...a: unknown[]) => mockStartLeaveFlow(...a), handleLeaveFlowMessage: (...a: unknown[]) => mockHandleLeaveFlowMessage(...a) }));
vi.mock('../lib/prisma.js', () => ({ prisma: { payslip: { findFirst: vi.fn().mockResolvedValue(null) } } }));
```

(None of the tests remaining in this file after Task 14 Step 6's deletion actually reach the `prisma.payslip.findFirst` call — the "sender not a known employee" test returns before session/flow dispatch, and the GET-handshake and signature tests never reach the POST body-processing logic at all. The mock above is added purely so importing `app.js` in this file doesn't construct a real, unmocked `PrismaClient`, consistent with every other test file in this plan. The actual "no payslip yet" behavior is already covered by `whatsappWebhook.payslipTrigger.test.ts` from Task 14.)

Add two new tests to the `POST /api/whatsapp/webhook` describe block:

```typescript
  it('starts the leave flow on the "Demander un congé" trigger phrase', async () => {
    mockResolveEmployee.mockResolvedValue({ id: 'e1', phone: '70123456', company: { countryCode: 'BF' } });
    mockGetActiveSession.mockResolvedValue(null);
    const body = { entry: [{ changes: [{ value: { messages: [{ from: '22670123456', type: 'text', text: { body: 'Demander un congé' } }] } }] }] };
    const res = await signedRequest(body);
    expect(res.status).toBe(200);
    expect(mockStartLeaveFlow).toHaveBeenCalledWith({ id: 'e1', phone: '70123456', company: { countryCode: 'BF' } }, '22670123456');
  });

  it('dispatches to the leave flow handler when a leave_request session is active', async () => {
    mockResolveEmployee.mockResolvedValue({ id: 'e1', phone: '70123456', company: { countryCode: 'BF' } });
    mockGetActiveSession.mockResolvedValue({ id: 's1', phone: '22670123456', flow: 'leave_request', step: 'choosing_type', data: {} });
    const body = { entry: [{ changes: [{ value: { messages: [{ from: '22670123456', type: 'interactive', interactive: { type: 'list_reply', list_reply: { id: 'conge_paye', title: 'Congé payé légal' } } }] } }] }] };
    const res = await signedRequest(body);
    expect(res.status).toBe(200);
    expect(mockHandleLeaveFlowMessage).toHaveBeenCalledTimes(1);
  });
```

- [ ] **Step 7: Run the full server test suite and typecheck**

Run: `npm --prefix server run test`
Run: `cd server && npx tsc -b --noEmit`
Expected: all green.

- [ ] **Step 8: Commit**

```bash
git add server/src/lib/whatsappFlows/leave.ts server/src/lib/whatsappFlows/leave.test.ts server/src/routes/whatsappWebhook.routes.ts server/src/routes/whatsappWebhook.routes.test.ts
git commit -m "feat(whatsapp): implement Flux 2 — interactive leave request flow"
```

---

## Task 16: Local verification runbook (ngrok) and Meta configuration checklist

**Files:**
- Create: `docs/superpowers/specs/2026-08-30-whatsapp-bot-local-testing.md`

**Interfaces:** none — this is a documentation/manual-verification task, no code.

- [ ] **Step 1: Write the runbook**

```markdown
# Test local du bot WhatsApp (ngrok)

## Prérequis
1. Le serveur tourne en local : `npm run dev:all` (API sur :4000).
2. Un compte ngrok (gratuit) et son CLI installés.
3. Accès à Meta Business Manager pour l'app WhatsApp existante (celle qui fournit `WHATSAPP_PHONE_NUMBER_ID`/`WHATSAPP_ACCESS_TOKEN`).

## Étapes
1. `ngrok http 4000` — noter l'URL HTTPS générée (ex. `https://abcd1234.ngrok-free.app`).
2. Dans `server/.env`, définir :
   - `WHATSAPP_APP_SECRET` (Meta Business Manager → Paramètres de l'app → Basique → Secret de l'app).
   - `WHATSAPP_WEBHOOK_VERIFY_TOKEN` (une chaîne aléatoire au choix, ex. générée avec `openssl rand -hex 16`).
3. Redémarrer le serveur pour charger les nouvelles variables.
4. Dans Meta Business Manager → WhatsApp → Configuration → Webhook :
   - URL de rappel : `https://<sous-domaine-ngrok>.ngrok-free.app/api/whatsapp/webhook`
   - Jeton de vérification : la même valeur que `WHATSAPP_WEBHOOK_VERIFY_TOKEN`.
   - S'abonner au champ `messages`.
5. Cliquer "Vérifier et enregistrer" — Meta doit accepter (confirme que la Step 3 de Task 13, la vérification `GET`, fonctionne).
6. Depuis un téléphone dont le numéro est déjà celui d'un employé de test dans la base, envoyer "Demander un congé" au numéro WhatsApp Business configuré (`WHATSAPP_PHONE_NUMBER_ID`).
7. Suivre le flux jusqu'au bout (choix du type, dates, confirmation) et vérifier en base que le `LeaveRequest` a bien été créé avec `channel: 'whatsapp'`.
8. Pour tester le Flux 1, il faut d'abord qu'un bulletin ait `whatsappStatus: 'envoye'` — déclencher un envoi RH normal depuis le portail (`PayslipPreviewDialog` → "Envoyer par WhatsApp"), puis cliquer sur le bouton du template reçu, puis entrer le PIN configuré depuis le portail self-service (Task 5).

## Tester sans vrai téléphone (payload simulé)

Simuler un message texte entrant sans passer par un vrai numéro WhatsApp, en signant la requête comme Meta le ferait :

\`\`\`bash
BODY='{"entry":[{"changes":[{"value":{"messages":[{"from":"22670000000","type":"text","text":{"body":"Demander un congé"}}]}}]}]}'
SIGNATURE=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "$WHATSAPP_APP_SECRET" | sed 's/^.* //')
curl -X POST http://localhost:4000/api/whatsapp/webhook \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: sha256=$SIGNATURE" \
  -d "$BODY"
\`\`\`

Remplacer `22670000000` par le numéro (sans "+") d'un employé de test existant en base pour que `resolveEmployeeByWhatsAppPhone` le retrouve.

## Dépendances externes bloquantes (hors code)

- Les templates `demande_conge_manager`, `conge_valide`, `conge_refuse` doivent être créés et **approuvés** dans Meta Business Manager avant qu'un envoi réel fonctionne — sans ça, `sendWhatsAppTemplate` renvoie un échec propre (voir Task 8/9), ce qui n'empêche pas de tester le reste du flux.
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-08-30-whatsapp-bot-local-testing.md
git commit -m "docs(whatsapp): add local ngrok testing runbook"
```

---

## Final verification

- [ ] Run the full server test suite once more: `npm --prefix server run test` — expect all tests across all 16 tasks green.
- [ ] Run `cd server && npx tsc -b --noEmit` — no type errors.
- [ ] Run `npx tsc -b --noEmit` at the repo root (frontend) — no type errors from the new `WhatsAppPinTab.tsx`/`auth.ts` changes.
- [ ] Manually smoke-test the self-service PIN form in the browser (Task 5, Step 5) if not already done.
- [ ] Follow the Task 16 runbook at least once with a real or simulated payload before considering the feature done.
