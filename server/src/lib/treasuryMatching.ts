import { prisma } from './prisma.js';

const MATCH_WINDOW_DAYS = 7;
const MS_PER_DAY = 86_400_000;

// Seul rapprochement automatique qu'on peut honnêtement faire sans accès à
// une vraie banque/API Mobile Money : matcher un décaissement importé à un
// versement de salaire déjà connu de l'app (PaymentTransaction, "Passerelle
// Paie & Charges Sociales"). Tout le reste (clients 411, fournisseurs 401)
// n'a pas de source de vérité interne — laissé "en_attente" pour un
// rapprochement manuel par le comptable plutôt que d'inventer un match.
export interface AutoMatchResult {
  matched: boolean;
  paymentTransactionId?: string;
  compte?: string;
  libelleCompte?: string;
}

export async function attemptAutoMatch(companyId: string, date: Date, montant: number): Promise<AutoMatchResult> {
  const windowStart = new Date(date.getTime() - MATCH_WINDOW_DAYS * MS_PER_DAY);
  const windowEnd = new Date(date.getTime() + MATCH_WINDOW_DAYS * MS_PER_DAY);

  const candidates = await prisma.paymentTransaction.findMany({
    where: {
      status: 'reussi',
      amount: montant,
      processedAt: { gte: windowStart, lte: windowEnd },
      order: { companyId },
    },
    select: { id: true },
  });

  if (candidates.length !== 1) {
    // Zéro candidat (rien à matcher) ou plusieurs (ambigu, ex. deux
    // employés payés du même montant le même jour) — dans les deux cas on
    // laisse la main au comptable plutôt que de deviner.
    return { matched: false };
  }

  const alreadyLinked = await prisma.treasuryTransaction.findFirst({
    where: { matchedPaymentTransactionId: candidates[0].id },
    select: { id: true },
  });
  if (alreadyLinked) return { matched: false };

  return {
    matched: true,
    paymentTransactionId: candidates[0].id,
    compte: '421',
    libelleCompte: 'Personnel — rémunérations dues',
  };
}
