import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Check, Pencil, ShieldCheck, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  useAdminCompaniesQuery,
  useApproveSignupRequestMutation,
  useDeleteAdminCompanyMutation,
  useRejectSignupRequestMutation,
  useSignupRequestsQuery,
  useUpdateAdminCompanyMutation,
} from '@/hooks/useAdmin';
import { formatDate } from '@/lib/utils';
import { COUNTRY_META } from '@/lib/constants';
import { AdminCompany, SignupRequest } from '@/types';

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

function SignupRequestsTab() {
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
    <div className="space-y-4">
      <div className="flex justify-end">
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
                    <Button size="sm" variant="outline" disabled={rejectMutation.isPending} onClick={() => handleReject(r)}>
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

function EditCompanyDialog({ company, open, onOpenChange }: { company: AdminCompany; open: boolean; onOpenChange: (open: boolean) => void }) {
  const updateMutation = useUpdateAdminCompanyMutation();
  const form = useForm({ defaultValues: { name: company.name, legalName: company.legalName ?? '' } });

  const onSubmit = async (values: { name: string; legalName: string }) => {
    try {
      await updateMutation.mutateAsync({ id: company.id, data: { name: values.name, legalName: values.legalName || undefined } });
      toast.success('Entreprise mise à jour');
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la mise à jour');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Modifier {company.name}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom commercial</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="legalName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Raison sociale</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function CompaniesTab() {
  const { data: companies, isLoading } = useAdminCompaniesQuery();
  const deleteMutation = useDeleteAdminCompanyMutation();
  const [editingCompany, setEditingCompany] = useState<AdminCompany | null>(null);

  const handleDelete = async (company: AdminCompany) => {
    try {
      await deleteMutation.mutateAsync(company.id);
      toast.success(`${company.name} supprimée`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la suppression');
    }
  };

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!companies || companies.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center text-sm text-muted-foreground">Aucune entreprise pour l'instant.</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {companies.map((c) => (
        <Card key={c.id}>
          <CardContent className="flex items-center justify-between gap-4 p-4">
            <div className="min-w-0">
              <div className="font-medium">{c.name}</div>
              <div className="text-sm text-muted-foreground">
                {c.admins.length > 0 ? c.admins.map((a) => a.email).join(', ') : 'Aucun admin'}
              </div>
              <div className="text-xs text-muted-foreground">
                {COUNTRY_META[c.countryCode].flag} {COUNTRY_META[c.countryCode].name} ({c.currencyCode}) · {c.employeeCount} employé
                {c.employeeCount > 1 ? 's' : ''} · créée le {formatDate(c.createdAt)}
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button size="sm" variant="outline" onClick={() => setEditingCompany(c)}>
                <Pencil className="mr-2 h-4 w-4" />
                Modifier
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="outline" disabled={deleteMutation.isPending}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Supprimer
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Supprimer {c.name} ?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Action irréversible : l'entreprise, ses employés, ses paies et bulletins seront définitivement supprimés.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleDelete(c)}>Supprimer</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      ))}
      {editingCompany && (
        <EditCompanyDialog
          company={editingCompany}
          open={!!editingCompany}
          onOpenChange={(open) => !open && setEditingCompany(null)}
        />
      )}
    </div>
  );
}

export function SignupRequestsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold">Entreprise Partenaire</h1>
          <p className="text-sm text-muted-foreground">Approuve/rejette les demandes, et gère les entreprises déjà créées.</p>
        </div>
      </div>

      <Tabs defaultValue="requests">
        <TabsList>
          <TabsTrigger value="requests">Demandes</TabsTrigger>
          <TabsTrigger value="companies">Entreprises créées</TabsTrigger>
        </TabsList>
        <TabsContent value="requests">
          <SignupRequestsTab />
        </TabsContent>
        <TabsContent value="companies">
          <CompaniesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
