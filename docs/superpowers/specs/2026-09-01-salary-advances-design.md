# Avances sur salaire (backend réel) & fiche compte employé

Date : 2026-09-01
Statut : approuvé, en attente du plan d'implémentation

## Contexte

Un comptable utilisateur de LaafiCompta a proposé une liste d'améliorations
en deux parties : (I) réconciliation bancaire et (II) suivi des comptes
employés (paie + avances). L'exploration du code a montré que (I) est déjà
largement implémenté (module Trésorerie & Rapprochement — `TreasuryAccount`,
`TreasuryTransaction`, import CSV, rapprochement auto contre les paiements de
paie) et fera l'objet d'un chantier séparé, plus ciblé.

Ce projet couvre (II) : le module "avances sur salaire" est aujourd'hui
**entièrement mocké côté frontend** (`src/services/api/advances.ts` —
aucune route serveur, aucune table Postgres, état perdu au redémarrage) et
la déduction sur la paie suivante est **manuelle** (bouton "marquer comme
déduit", aucun lien avec la génération du cycle de paie). Il n'existe par
ailleurs aucune vue agrégeant pour un employé donné : salaire, primes,
retenues, avances et solde en cours.

Le tableau de bord RH-compta (lien présence/congés → calcul de paie) et les
alertes/échéances demandés par le comptable sont **hors scope**, reportés à
un chantier ultérieur une fois cette base posée.

## Hors scope

- Réconciliation bancaire (chantier séparé).
- Tableau de bord RH-compta et alertes/échéances (chantier séparé).
- Connexion bancaire/API directe (déjà écarté ailleurs dans le code — aucune
  API réelle disponible pour ce contexte).
- Modification du calcul de paie lui-même (CNSS/IUTS) — seule l'insertion
  des lignes `avances` dans `PayrollEntry` change.

## Modèle de données (migration Prisma)

```prisma
model SalaryAdvance {
  id               String            @id @default(cuid())
  companyId        String
  company          Company           @relation(fields: [companyId], references: [id], onDelete: Cascade)
  employeeId       String
  employee         Employee          @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  amount           Float             // montant initial demandé/versé
  remainingBalance Float             // décroît à chaque déduction ; 0 = soldée
  channel          AdvanceChannel    // whatsapp | portail
  status           AdvanceStatus
  requestedAt      DateTime          @default(now())
  approvedAt       DateTime?
  approvedBy       String?
  rejectedAt       DateTime?
  rejectedBy       String?
  rejectionReason  String?
  mobileMoneyOperator MobileMoneyOperator?
  reference        String?
  paidAt           DateTime?
  createdAt        DateTime          @default(now())
  deductions       AdvanceDeduction[]

  @@index([employeeId])
  @@index([companyId, status])
}

model AdvanceDeduction {
  id             String        @id @default(cuid())
  advanceId      String
  advance        SalaryAdvance @relation(fields: [advanceId], references: [id], onDelete: Cascade)
  payrollEntryId String        // référence libre vers PayrollEntry.id, même
                                // convention que TreasuryTransaction.matchedPaymentTransactionId
  amount         Float
  createdAt      DateTime      @default(now())
}

enum AdvanceChannel {
  whatsapp
  portail
}

enum AdvanceStatus {
  en_attente          // créée par l'employé, en attente de décision RH/compta
  rejete
  approuve             // validée, en attente de versement
  verse_mobile_money   // versée à l'employé
  en_remboursement     // au moins une déduction effectuée, solde > 0
  rembourse            // remainingBalance == 0
}
```

- `PayrollConfig` reçoit un nouveau champ scalaire `maxAdvancePercent Float
  @default(30)` (% du salaire net mensuel, configurable par entreprise comme
  le reste de `PayrollConfig`).
- Le type frontend `VariableElement` (`src/types/index.ts`) a déjà un champ
  `id` — pour les éléments `type: 'avance'` générés automatiquement, cet
  `id` **est** `SalaryAdvance.id` : pas de nouveau champ nécessaire, juste
  une convention documentée dans `payrollEngine.ts`.
- Suppression de `src/mocks/advances.ts`, `src/services/api/advances.ts`
  (implémentation mock) et de l'ancien type `AdvanceStatus` /
  `SalaryAdvanceRequest` dans `src/types/index.ts`, remplacés par les
  équivalents générés par Prisma côté serveur et un type miroir côté client.

## Règles métier

- **Plafond** : une demande dont `amount > salaireNet actuel × maxAdvancePercent
  / 100` est refusée à la création (erreur 400 explicite, affichée dans le
  formulaire de demande).
- **Une avance active à la fois** : une nouvelle demande est refusée si
  l'employé a déjà une `SalaryAdvance` avec `status` dans `{en_attente,
  approuve, verse_mobile_money, en_remboursement}`.
- **Étalement automatique** : si `remainingBalance` après une déduction est
  encore > 0, l'avance reste `en_remboursement` et réapparaît pré-remplie au
  cycle de paie suivant. Elle passe à `rembourse` dès que
  `remainingBalance` atteint 0.

## Backend

Nouveau fichier `server/src/routes/advances.routes.ts` (remplace
`src/services/api/advances.ts` côté contrat, même rôle que
`treasury.routes.ts`) :

- `POST /api/advances` — self-service (employé authentifié demande pour
  lui-même). Vérifie plafond + unicité, crée `en_attente`.
- `GET /api/advances` — liste filtrable par `employeeId`/`status`, pour la
  vue RH/compta et la fiche compte employé.
- `POST /api/advances/:id/approve` — `en_attente` → `approuve`.
- `POST /api/advances/:id/reject` — `en_attente` → `rejete` (avec motif).
- `POST /api/advances/:id/pay` — réutilise la logique mobile money existante
  de `payAdvanceRequestViaMobileMoney` (déjà écrite, juste déplacée côté
  serveur) : `approuve` → `verse_mobile_money`, génère la référence.

Pas de endpoint "marquer comme déduit" : la déduction devient automatique
(voir ci-dessous).

### Intégration au cycle de paie

`computeDefaultEntryForEmployee` (appelée depuis `syncEntries` dans
`payroll.routes.ts`) va chercher, pour chaque employé, les
`SalaryAdvance` avec `remainingBalance > 0` et `status` dans
`{verse_mobile_money, en_remboursement}`, et pré-remplit `avances` avec un
`VariableElement` (`id = advance.id`, `amount = remainingBalance`). Comme
aujourd'hui, cette ligne reste éditable manuellement par le comptable avant
validation du cycle (JSON `PayrollEntry.avances`, déjà modifiable via
"Éléments variables").

À la validation d'un cycle (`POST /api/payroll/cycles/:id/validate`), pour
chaque `PayrollEntry`, on parcourt `entry.avances` : pour tout élément dont
`id` correspond à une `SalaryAdvance` existante, on crée un
`AdvanceDeduction` (`payrollEntryId`, `amount` = montant de la ligne) et on
décrémente `remainingBalance` de ce montant, en mettant à jour le `status`
(`rembourse` si le solde atteint 0, sinon `en_remboursement`). Ce traitement
s'ajoute à `generatePayslipsForCycle` déjà appelé à cette étape, dans la même
transaction si possible pour rester cohérent avec le reste de la validation
de cycle.

## Frontend

- **Self-service employé** — nouvel onglet `MyAdvancesTab` dans
  `src/pages/self/SelfServicePage.tsx`, même pattern que `MyPayslipsTab` /
  `MyLeavesTab` : formulaire de demande (montant, plafond affiché en temps
  réel) + liste des avances de l'employé avec statut et solde restant.
- **Fiche compte employé (RH/compta)** — nouvel onglet "Compte" sur
  `src/pages/employees/EmployeeDetailPage.tsx` : salaire actuel, historique
  des bulletins déjà générés (réutilise les données `Payslip` existantes),
  historique des avances avec statut/dates, solde en cours.
- `src/pages/payments/AdvancesTab.tsx` (vue RH/compta liste globale,
  existante) : `src/hooks/useAdvances.ts` garde la même interface
  (`useAdvanceRequestsQuery`, `useApproveAdvanceMutation`,
  `usePayAdvanceMutation`) — seule l'implémentation des fonctions de
  `services/api/advances.ts` change (mock → vrais appels réseau). Le bouton
  "marquer comme déduit" est retiré ; un badge de statut affiche
  `en_remboursement (solde restant : X)` / `rembourse` à la place.

## Erreurs & cas limites

- Demande dépassant le plafond → 400, message affiché dans le formulaire
  (pas de blocage silencieux).
- Deuxième demande alors qu'une avance est déjà active → 400, message
  explicite ("Vous avez déjà une avance en cours").
- Cycle de paie validé alors qu'une ligne `avances` a un `id` ne
  correspondant à aucune `SalaryAdvance` (avance supprimée entre-temps,
  cas improbable mais possible en édition manuelle) → ignorée silencieusement
  pour la déduction (le montant reste dans le calcul du salaire net, juste
  pas de `AdvanceDeduction` créé) plutôt que de faire échouer la validation
  du cycle.
- Employé offboardé avec un solde d'avance restant → hors scope automatique ;
  reste visible sur la fiche compte pour règlement manuel par le comptable
  (pas de recouvrement automatisé).

## Tests

Tests serveur (Vitest, cohérent avec le reste du repo) :

- Calcul et application du plafond (`maxAdvancePercent`).
- Blocage de la double-demande active.
- Pré-remplissage correct de `avances` à la génération/sync d'un cycle pour
  un employé ayant un solde restant.
- Décompte + transition de statut à la validation d'un cycle (cas soldé en
  un cycle, cas étalé sur plusieurs cycles).
- Endpoints CRUD (`approve`, `reject`, `pay`) et leurs transitions de statut
  invalides (ex. approuver une avance déjà rejetée → erreur).

Smoke-test navigateur avant merge (comme pour les reviews/peer-feedback) :
demande self-service → approbation → versement → génération d'un cycle de
paie → vérification que la ligne avance apparaît pré-remplie → validation du
cycle → vérification du solde mis à jour sur la fiche compte employé.

## Points ouverts avant l'implémentation

Aucun — toutes les décisions de conception ont été validées avec
l'utilisateur (canal de demande, règle de plafond, mode de pré-remplissage,
étalement du remboursement, périmètre excluant le tableau de bord RH-compta
et les alertes).
