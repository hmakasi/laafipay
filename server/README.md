# LaafiPay API

Backend Node.js/Express + PostgreSQL (Prisma) pour LaafiPay. Cette première tranche couvre
l'authentification et le module Employés ; les autres modules restent servis par le mock frontend
(`src/services/api/*.ts`) en attendant leur migration.

## Démarrage

```bash
# 1. Base de données (depuis la racine du dépôt)
docker compose up -d

# 2. Backend
cd server
cp .env.example .env
npm install
npx prisma migrate dev --name init
npx prisma db seed

npm run dev   # http://localhost:4000
```

## Comptes de démonstration

Tous les comptes seedés partagent le même mot de passe : **`Demo1234!`**

| E-mail | Rôle |
|---|---|
| admin@entreprise.bf | admin |
| a.ouedraogo@entreprise.bf | hr_manager |
| s.nikiema@entreprise.bf | manager |
| m.kabore@entreprise.bf | accountant |
| r.yameogo@entreprise.bf | employee |
| n.ouedraogo@entreprise.bf | manager |

## Explorer les données

```bash
npx prisma studio
```
