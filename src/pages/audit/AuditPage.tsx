import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuditLogsQuery } from '@/hooks/useUsers';
import { formatDate } from '@/lib/utils';
import { AuditLog } from '@/types';

const ALL = '__all__';

const SEVERITY_VARIANT: Record<AuditLog['severity'], 'secondary' | 'warning' | 'destructive'> = {
  info: 'secondary',
  warning: 'warning',
  critical: 'destructive',
};

export function AuditPage() {
  const { t } = useTranslation();
  const [severity, setSeverity] = useState(ALL);

  const { data: logs, isLoading } = useAuditLogsQuery(
    severity !== ALL ? { severity: severity as AuditLog['severity'] } : undefined
  );

  const sorted = [...(logs ?? [])].sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t('audit.title')}</h1>
        <Select value={severity} onValueChange={setSeverity}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t('audit.severity')}</SelectItem>
            <SelectItem value="info">{t('audit.severity_info')}</SelectItem>
            <SelectItem value="warning">{t('audit.severity_warning')}</SelectItem>
            <SelectItem value="critical">{t('audit.severity_critical')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('audit.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : !sorted.length ? (
            <p className="py-8 text-center text-muted-foreground">{t('app.noResults')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('audit.timestamp')}</TableHead>
                  <TableHead>{t('audit.user')}</TableHead>
                  <TableHead>{t('audit.action')}</TableHead>
                  <TableHead>{t('audit.resource')}</TableHead>
                  <TableHead>{t('audit.severity')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-muted-foreground">{formatDate(log.timestamp, 'dd/MM/yyyy HH:mm')}</TableCell>
                    <TableCell>{log.userEmail}</TableCell>
                    <TableCell className="font-mono text-xs">{log.action}</TableCell>
                    <TableCell>
                      {log.resource}
                      {log.resourceId && <span className="text-muted-foreground"> · {log.resourceId}</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant={SEVERITY_VARIANT[log.severity]}>{t(`audit.severity_${log.severity}`)}</Badge>
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
