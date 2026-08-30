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

```bash
BODY='{"entry":[{"changes":[{"value":{"messages":[{"from":"22670000000","type":"text","text":{"body":"Demander un congé"}}]}}]}]}'
SIGNATURE=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "$WHATSAPP_APP_SECRET" | sed 's/^.* //')
curl -X POST http://localhost:4000/api/whatsapp/webhook \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: sha256=$SIGNATURE" \
  -d "$BODY"
```

Remplacer `22670000000` par le numéro (sans "+") d'un employé de test existant en base pour que `resolveEmployeeByWhatsAppPhone` le retrouve.

## Dépendances externes bloquantes (hors code)

- Les templates `demande_conge_manager`, `conge_valide`, `conge_refuse` doivent être créés et **approuvés** dans Meta Business Manager avant qu'un envoi réel fonctionne — sans ça, `sendWhatsAppTemplate` renvoie un échec propre (voir Task 8/9), ce qui n'empêche pas de tester le reste du flux.
