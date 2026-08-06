import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PermissionGate } from '@/components/auth/PermissionGate';
import { useToggleUserActiveMutation, useUpdateUserRoleMutation, useUsersQuery } from '@/hooks/useUsers';
import { CreateUserDialog } from './CreateUserDialog';
import { USER_ROLES } from '@/lib/constants';
import { formatDate, getInitials } from '@/lib/utils';
import { UserRole } from '@/types';

export function UsersPage() {
  const { t } = useTranslation();
  const { data: users, isLoading } = useUsersQuery();
  const updateRoleMutation = useUpdateUserRoleMutation();
  const toggleActiveMutation = useToggleUserActiveMutation();

  const handleRoleChange = async (userId: string, role: UserRole) => {
    await updateRoleMutation.mutateAsync({ userId, role });
    toast.success(t('app.save'));
  };

  const handleToggleActive = async (userId: string, isActive: boolean) => {
    await toggleActiveMutation.mutateAsync({ userId, isActive: !isActive });
    toast.success(t('app.save'));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t('settings.users')}</h1>
        <PermissionGate permission="users:write">
          <CreateUserDialog />
        </PermissionGate>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('settings.users')}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('employees.fullName')}</TableHead>
                  <TableHead>{t('employees.email')}</TableHead>
                  <TableHead>{t('settings.roles')}</TableHead>
                  <TableHead>{t('app.status')}</TableHead>
                  <TableHead>Dernière connexion</TableHead>
                  <PermissionGate permission="users:write">
                    <TableHead className="text-right">{t('app.actions')}</TableHead>
                  </PermissionGate>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users?.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-primary/10 text-xs text-primary">
                            {getInitials(u.firstName, u.lastName)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">
                          {u.firstName} {u.lastName}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell>
                      <PermissionGate permission="users:write" fallback={<Badge variant="accent">{t(`roles.${u.role}`)}</Badge>}>
                        <Select value={u.role} onValueChange={(v) => handleRoleChange(u.id, v as UserRole)}>
                          <SelectTrigger className="w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {USER_ROLES.map((r) => (
                              <SelectItem key={r} value={r}>
                                {t(`roles.${r}`)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </PermissionGate>
                    </TableCell>
                    <TableCell>
                      <Badge variant={u.isActive ? 'success' : 'secondary'}>{u.isActive ? t('app.active') : t('app.inactive')}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{u.lastLogin ? formatDate(u.lastLogin, 'dd/MM/yyyy HH:mm') : '—'}</TableCell>
                    <PermissionGate permission="users:write">
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => handleToggleActive(u.id, u.isActive)}>
                          {u.isActive ? t('employees.deactivate') : t('app.enabled')}
                        </Button>
                      </TableCell>
                    </PermissionGate>
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
