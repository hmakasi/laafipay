import { useState } from 'react';
import { toast } from 'sonner';
import { Check, ShieldCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useApproveSignupRequestMutation, useRejectSignupRequestMutation, useSignupRequestsQuery } from '@/hooks/useAdmin';
import { formatDate } from '@/lib/utils';
import { COUNTRY_META } from '@/lib/constants';
import { SignupRequest } from '@/types';

const STATUS_LABEL: Record<SignupRequest['status'], string> = {
  en_attente: 'En attente',
  approuve: 'Approuvée',
  rejete: 'Rejetée',
};

const STATUS_VARIANT: Record<SignupRequest['status'], 'warning' | 'success' | 'destructive'> = {
  en_attente: 'warning',
  approuve: 'success',
  rejete: 'destructive',
};

export function SignupRequestsPage() {
  const [statusFilter, setStatusFilter] = useState<SignupRequest['status'] | 'all'>('en_attente');
  const { data: requests, isLoading } = useSignupRequestsQuery(statusFilter === 'all' ? undefined : statusFilter);
  const approveMutation = useApproveSignupRequestMutation();
  const rejectMutation = useRejectSignupRequestMutation();

  const handleApprove = async (request: SignupRequest) => {
    try {
      const result = await approveMutation.mutateAsync(request.id);
      if (result.emailSent) {
        toast.success(`Compte créé, identifiants envoyés à ${request.email}`);
      } else {
        toast.warning(
          `Compte créé mais l'e-mail n'a pas pu être envoyé (${result.emailError}). Mot de passe temporaire à transmettre manuellement : ${result.temporaryPassword}`,
          { duration: 30_000 }
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'approbation");
    }
  };

  const handleReject = async (request: SignupRequest) => {
    try {
      await rejectMutation.mutateAsync({ id: request.id });
      toast.success('Demande rejetée');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors du rejet');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold">Demandes d'inscription</h1>
            <p className="text-sm text-muted-foreground">Approuve ou rejette les demandes de création d'entreprise.</p>
          </div>
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="en_attente">En attente</SelectItem>
            <SelectItem value="approuve">Approuvées</SelectItem>
            <SelectItem value="rejete">Rejetées</SelectItem>
            <SelectItem value="all">Toutes</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : !requests || requests.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">Aucune demande pour l'instant.</CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <Card key={r.id}>
              <CardContent className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{r.companyName}</span>
                    <Badge variant={STATUS_VARIANT[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {r.firstName} {r.lastName} · {r.email}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {COUNTRY_META[r.countryCode].flag} {COUNTRY_META[r.countryCode].name} ({r.currencyCode}) · Demandée le{' '}
                    {formatDate(r.createdAt)}
                    {r.reviewedAt && ` · traitée le ${formatDate(r.reviewedAt)} par ${r.reviewedBy}`}
                  </div>
                </div>
                {r.status === 'en_attente' && (
                  <div className="flex shrink-0 gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={rejectMutation.isPending}
                      onClick={() => handleReject(r)}
                    >
                      <X className="mr-2 h-4 w-4" />
                      Rejeter
                    </Button>
                    <Button size="sm" disabled={approveMutation.isPending} onClick={() => handleApprove(r)}>
                      <Check className="mr-2 h-4 w-4" />
                      Approuver
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
