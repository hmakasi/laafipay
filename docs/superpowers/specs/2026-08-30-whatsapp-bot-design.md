# Bot conversationnel WhatsApp — Distribution de bulletins & Demande de congé

Date : 2026-08-30
Statut : approuvé, en attente du plan d'implémentation

## Contexte

LaafiPay envoie déjà des notifications WhatsApp sortantes à sens unique
(`server/src/lib/whatsapp.ts`, template Meta Cloud API `bulletin_disponible`,
déclenché depuis `payslips.routes.ts`). Il n'existe aucun webhook entrant, aucune
gestion de conversation avec état, aucune authentification employé sur WhatsApp.

Ce projet ajoute deux flux conversationnels complets :

1. **Distribution du bulletin de paie** : notification → authentification PIN →
   envoi du PDF.
2. **Demande de congé** : menu de sélection → saisie des dates → récapitulatif →
   confirmation → notification manager.

## Hors scope

- Approbation manager depuis WhatsApp (reste sur le portail web existant).
- Auto-génération du PIN par un admin RH.
- Création de PIN inline dans la conversation WhatsApp.
- SMS et email (restent des stubs, hors sujet de ce projet).

## Modèle de données (migration Prisma)

```prisma
model Employee {
  // ... champs existants ...
  whatsappPinHash            String?
  whatsappPinFailedAttempts  Int       @default(0)
  whatsappPinLockedUntil     DateTime?
}

model Payslip {
  // ... champs existants ...
  pdfUrl String?   // cache Vercel Blob du PDF déjà généré
}

enum LeaveType {
  conge_paye
  maladie
  sans_solde
  evenement_familial
  maternite
  paternite
  recuperation
  conge_anciennete   // nouveau
  examen_formation   // nouveau
}

model WhatsAppSession {
  id         String   @id @default(cuid())
  phone      String   @unique
  employeeId String
  employee   Employee @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  flow       String   // 'payslip_delivery' | 'leave_request'
  step       String
  data       Json     @default("{}")
  expiresAt  DateTime // TTL 10 min d'inactivité, renouvelé à chaque message

  @@index([employeeId])
}
```

- Le PIN est haché avec bcrypt (déjà une dépendance du serveur), jamais stocké
  en clair.
- Verrouillage anti-bruteforce : 3 tentatives échouées → `whatsappPinLockedUntil`
  = maintenant + 15 min. Un admin RH peut aussi réinitialiser
  `whatsappPinFailedAttempts`/`whatsappPinLockedUntil` manuellement depuis le
  portail.
- **Règle d'acquisition des congés d'ancienneté** : à confirmer avec l'utilisateur
  avant l'implémentation de cette partie précise (barème exact du Code du
  travail burkinabè par tranche d'années de service). Le reste du projet ne
  dépend pas de ce chiffre et peut être implémenté indépendamment.

## Setup du PIN (portail self-service)

Nouveau champ dans `src/pages/self/SelfServicePage.tsx` : "Définir mon code PIN
WhatsApp" (saisie + confirmation, 4 chiffres). Nouvel endpoint
`PUT /api/employees/me/whatsapp-pin` qui hache et stocke le PIN. Aucune
création/modification du PIN n'est possible depuis WhatsApp lui-même.

## Architecture du moteur de conversation

Un point d'entrée unique :

- `GET /api/whatsapp/webhook` — handshake de vérification Meta (`hub.challenge`).
- `POST /api/whatsapp/webhook` — réception des messages/interactions. Vérifie la
  signature `X-Hub-Signature-256` avec l'app secret avant tout traitement.

Traitement d'un message entrant :

1. Résoudre l'employé par numéro de téléphone (`normalizeWhatsAppNumber`
   existant, recherche inverse par `Employee.phone`).
2. Charger la `WhatsAppSession` active pour ce téléphone (si `expiresAt` dépassé,
   la traiter comme inexistante et informer l'utilisateur que la session a
   expiré).
3. S'il n'y a pas de session active, interpréter le message comme un
   déclencheur de nouveau flux (clic sur le bouton du template
   `bulletin_disponible`, ou clic sur "Demander un congé" du menu principal) et
   créer la session correspondante.
4. Sinon, déléguer à la fonction de l'étape courante du flux actif.

Organisation des fichiers (cohérente avec le style actuel du repo — fonctions
et fichiers par domaine, pas de hiérarchie de classes) :

- `server/src/routes/whatsappWebhook.routes.ts` — point d'entrée HTTP, résolution
  employé/session, vérification de signature.
- `server/src/lib/whatsappSession.ts` — CRUD/TTL de `WhatsAppSession`.
- `server/src/lib/whatsappFlows/payslip.ts` — étapes du flux 1
  (`awaiting_pin` → envoi PDF).
- `server/src/lib/whatsappFlows/leave.ts` — étapes du flux 2
  (`choosing_type` → `awaiting_start_date` → `awaiting_end_date` →
  `awaiting_confirmation`).
- `server/src/lib/payslipPdf.ts` — génération du PDF côté serveur (voir
  ci-dessous).
- `server/src/lib/whatsapp.ts` — étendu avec l'envoi de messages interactifs
  (List Message, Reply Buttons) et l'envoi de documents (Media API), en plus
  de l'envoi de templates déjà existant.

## Flux 1 — Distribution du bulletin de paie

1. **Déclencheur** (existant, inchangé) : le cron mensuel ou une action RH
   envoie le template `bulletin_disponible` avec un bouton "Obtenir mon
   bulletin".
2. **Clic bouton** → le webhook reçoit l'interaction → crée une
   `WhatsAppSession` (`flow: 'payslip_delivery'`, `step: 'awaiting_pin'`) →
   répond "Veuillez entrer votre code PIN à 4 chiffres."
3. **Réponse PIN** :
   - Employé sans `whatsappPinHash` défini → message l'invitant à définir son
     PIN depuis le portail self-service, session fermée.
   - Compte verrouillé (`whatsappPinLockedUntil` futur) → message d'erreur avec
     le délai restant, session fermée.
   - PIN incorrect → incrémente `whatsappPinFailedAttempts`, message d'erreur
     avec le nombre de tentatives restantes ; à la 3e tentative, verrouille le
     compte.
   - PIN correct → réinitialise le compteur de tentatives, récupère
     `Payslip.pdfUrl` s'il existe déjà, sinon génère le PDF via
     `payslipPdf.ts` et l'upload sur Vercel Blob (stocke l'URL) → envoie le
     document via l'API Media WhatsApp → message de confirmation avec bouton
     "Revenir au menu principal" → ferme la session.

## Flux 2 — Demande de congé

1. **Déclencheur** : bouton "Demander un congé" du menu principal WhatsApp →
   crée une session (`flow: 'leave_request'`, `step: 'choosing_type'`) →
   affiche les soldes actuels (requête `LeaveBalance` de l'employé pour
   l'année en cours) suivis d'un **List Message** interactif à 6 options
   (limite Meta : 10 lignes max, donc large marge) :
   - Congé payé légal
   - Permission exceptionnelle (mariage, naissance, décès...)
   - Congé de maternité / paternité
   - Congé maladie (sur justificatif médical)
   - Congé pour examen / formation
   - Congé sans solde
2. **Sélection du type** → `step: 'awaiting_start_date'` → "Indiquez la date de
   début (format : JJ/MM/AAAA)."
3. **Date de début** → validation format (JJ/MM/AAAA, date réelle, pas dans le
   passé) ; erreur → redemande avec message d'aide ; succès →
   `step: 'awaiting_end_date'` → "Indiquez la date de fin (inclus)."
4. **Date de fin** → validation (format valide, ≥ date de début) ; succès →
   calcule la durée en jours ouvrés (nouvelle fonction utilitaire, exclut
   samedi/dimanche — jours fériés hors scope de ce projet) et le solde restant
   après validation (`LeaveBalance.remaining - duréeDemandée` pour le type
   choisi) → `step: 'awaiting_confirmation'` → affiche le récapitulatif complet
   avec deux boutons interactifs "✅ Confirmer" / "❌ Annuler" (limite Meta : 3
   boutons max, donc OK).
5. **Confirmation** :
   - "❌ Annuler" → message "Demande annulée." → ferme la session.
   - "✅ Confirmer" → crée un `LeaveRequest` (`channel: 'whatsapp'`,
     `status: 'en_attente'`) → incrémente `LeaveBalance.pending` du type
     concerné → envoie un nouveau template Meta au manager (`demande_conge_manager`,
     à créer et faire approuver dans Meta Business Manager, sur le même modèle
     que `bulletin_disponible`) → message de confirmation à l'employé → ferme
     la session.
6. **Retour de la décision du manager** (portail web existant, inchangé dans sa
   logique d'approbation) : quand le statut du `LeaveRequest` passe à `approuve`
   ou `refuse` depuis le portail, envoi d'un template de notification à
   l'employé (`conge_valide` / `conge_refuse` — deux nouveaux templates à créer
   et faire approuver). Ce déclenchement se fait depuis le point du code qui
   traite déjà la mise à jour de statut dans `leaves.routes.ts`.

## Génération du PDF côté serveur

`PayslipOfficialTemplate.tsx` utilise déjà jsPDF côté navigateur. On porte la
même mise en page dans un module Node pur, `server/src/lib/payslipPdf.ts`,
consommant les mêmes données `Payslip` (déjà toutes en base : `primes`,
`indemnites`, `retenues`, montants, etc.) sans dépendance DOM. Le PDF généré
est uploadé sur Vercel Blob (déjà utilisé pour d'autres fichiers dans le
repo), et son URL est mise en cache sur `Payslip.pdfUrl` pour éviter de
régénérer à chaque demande WhatsApp du même bulletin.

Risque accepté : deux implémentations de mise en page (navigateur + serveur) à
maintenir en parallèle. Toute modification visuelle du bulletin officiel devra
être répercutée dans les deux fichiers — à documenter en commentaire dans les
deux fichiers pour limiter la dérive.

## Sécurité

- PIN haché (bcrypt), jamais en clair, ni en base ni dans les logs.
- Verrouillage anti-bruteforce (3 tentatives, 15 min).
- Vérification de la signature Meta (`X-Hub-Signature-256`, app secret) sur
  chaque requête webhook entrante avant tout traitement.
- Sessions WhatsApp à TTL court (10 min d'inactivité) pour limiter la fenêtre
  d'attaque sur un téléphone compromis/partagé.
- Les tokens d'accès Meta restent en variables d'environnement serveur
  (`server/.env`, non versionné), comme c'est déjà le cas.

## Test local

Le webhook Meta exige une URL HTTPS publique. En développement local, on
utilise **ngrok** (`ngrok http 4000`) pour exposer l'API locale, puis on
configure temporairement cette URL comme webhook dans Meta Business Manager.
Le plan d'implémentation détaillera la procédure pas à pas et les payloads de
test à simuler (`curl` avec des corps de requête représentatifs du format
webhook Meta) pour ne pas dépendre uniquement de vrais messages WhatsApp
pendant le développement.

## Points ouverts avant l'implémentation

- Barème exact des jours de congé d'ancienneté (Code du travail burkinabè) —
  à confirmer avec l'utilisateur avant d'écrire cette partie spécifique.
- Création et approbation des 3 nouveaux templates Meta
  (`demande_conge_manager`, `conge_valide`, `conge_refuse`) dans Meta Business
  Manager — dépendance externe hors du contrôle du code, à faire par
  l'utilisateur ou son équipe avant que ces notifications puissent réellement
  partir (le code doit néanmoins gérer proprement l'échec si le template n'est
  pas encore approuvé, sur le même modèle que `sendPayslipWhatsAppNotification`
  actuel).
