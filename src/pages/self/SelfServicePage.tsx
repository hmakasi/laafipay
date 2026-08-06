import { useTranslation } from 'react-i18next';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MyPayslipsTab } from '@/pages/self/MyPayslipsTab';
import { MyLeavesTab } from '@/pages/self/MyLeavesTab';

export function SelfServicePage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{t('nav.selfService')}</h1>

      <Tabs defaultValue="payslips">
        <TabsList>
          <TabsTrigger value="payslips">{t('nav.myPayslips')}</TabsTrigger>
          <TabsTrigger value="leaves">{t('nav.myLeaves')}</TabsTrigger>
        </TabsList>
        <TabsContent value="payslips">
          <MyPayslipsTab />
        </TabsContent>
        <TabsContent value="leaves">
          <MyLeavesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
