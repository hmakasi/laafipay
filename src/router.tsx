import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { RequirePermission } from '@/components/auth/PermissionGate';
import { useAuthStore } from '@/store/authStore';
import { LoginPage } from '@/pages/LoginPage';
import { SignupPage } from '@/pages/SignupPage';
import { OnboardingPage } from '@/pages/OnboardingPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { CompanySettingsPage } from '@/pages/CompanySettingsPage';
import { EmployeesListPage } from '@/pages/employees/EmployeesListPage';
import { EmployeeDetailPage } from '@/pages/employees/EmployeeDetailPage';
import { EmployeeFormPage } from '@/pages/employees/EmployeeFormPage';
import { PayrollCyclesPage } from '@/pages/payroll/PayrollCyclesPage';
import { PayrollCycleDetailPage } from '@/pages/payroll/PayrollCycleDetailPage';
import { LegalSettingsPage } from '@/pages/payroll/LegalSettingsPage';
import { PayrollComponentsSetup } from '@/pages/payroll/PayrollComponentsSetup';
import { LivePayslipPreviewPage } from '@/pages/payroll/LivePayslipPreviewPage';
import { PaymentsListPage } from '@/pages/payments/PaymentsListPage';
import { PaymentOrderDetailPage } from '@/pages/payments/PaymentOrderDetailPage';
import { PayslipsListPage } from '@/pages/payslips/PayslipsListPage';
import { SelfServicePage } from '@/pages/self/SelfServicePage';
import { LeavesListPage } from '@/pages/leaves/LeavesListPage';
import { ReportsPage } from '@/pages/ReportsPage';
import { UsersPage } from '@/pages/users/UsersPage';
import { AuditPage } from '@/pages/audit/AuditPage';
import { LandingPage } from '@/pages/LandingPage';
import { ComptaLayout } from '@/components/compta/ComptaLayout';
import { ComptaDashboardPage } from '@/pages/compta/ComptaDashboardPage';
import { ComptaComingSoonPage } from '@/pages/compta/ComptaComingSoonPage';
import { TresorerieRapprochementPage } from '@/pages/compta/TresorerieRapprochementPage';
import { WhatsAppAccountingPage } from '@/pages/compta/WhatsAppAccountingPage';
import { PasserellePaiePage } from '@/pages/compta/PasserellePaiePage';

function NotFoundRedirect() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return <Navigate to={isAuthenticated ? '/dashboard' : '/'} replace />;
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/onboard/:token" element={<OnboardingPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="dashboard" element={<DashboardPage />} />

            <Route
              path="employees"
              element={
                <RequirePermission permission="employees:read">
                  <EmployeesListPage />
                </RequirePermission>
              }
            />
            <Route
              path="employees/new"
              element={
                <RequirePermission permission="employees:write">
                  <EmployeeFormPage />
                </RequirePermission>
              }
            />
            <Route
              path="employees/:id/edit"
              element={
                <RequirePermission permission="employees:write">
                  <EmployeeFormPage />
                </RequirePermission>
              }
            />
            <Route
              path="employees/:id"
              element={
                <RequirePermission permission="employees:read">
                  <EmployeeDetailPage />
                </RequirePermission>
              }
            />

            <Route
              path="payroll"
              element={
                <RequirePermission permission="payroll:read">
                  <PayrollCyclesPage />
                </RequirePermission>
              }
            />
            <Route
              path="payroll/legal-settings"
              element={
                <RequirePermission permission="settings:write">
                  <LegalSettingsPage />
                </RequirePermission>
              }
            />
            <Route
              path="payroll/settings"
              element={
                <RequirePermission permission="settings:write">
                  <PayrollComponentsSetup />
                </RequirePermission>
              }
            />
            <Route
              path="payroll/apercu-direct"
              element={
                <RequirePermission permission="payroll:write">
                  <LivePayslipPreviewPage />
                </RequirePermission>
              }
            />
            <Route
              path="payroll/:id"
              element={
                <RequirePermission permission="payroll:read">
                  <PayrollCycleDetailPage />
                </RequirePermission>
              }
            />

            <Route
              path="payments"
              element={
                <RequirePermission permission="payments:read">
                  <PaymentsListPage />
                </RequirePermission>
              }
            />
            <Route
              path="payments/:id"
              element={
                <RequirePermission permission="payments:read">
                  <PaymentOrderDetailPage />
                </RequirePermission>
              }
            />
            <Route
              path="payslips"
              element={
                <RequirePermission permission="payslips:read">
                  <PayslipsListPage />
                </RequirePermission>
              }
            />
            <Route
              path="self"
              element={
                <RequirePermission permission="self:payslips">
                  <SelfServicePage />
                </RequirePermission>
              }
            />
            <Route
              path="leaves"
              element={
                <RequirePermission permission="leaves:read">
                  <LeavesListPage />
                </RequirePermission>
              }
            />
            <Route
              path="reports"
              element={
                <RequirePermission permission="reports:read">
                  <ReportsPage />
                </RequirePermission>
              }
            />
            <Route
              path="users"
              element={
                <RequirePermission permission="users:read">
                  <UsersPage />
                </RequirePermission>
              }
            />
            <Route
              path="audit"
              element={
                <RequirePermission permission="audit:read">
                  <AuditPage />
                </RequirePermission>
              }
            />
            <Route
              path="settings"
              element={
                <RequirePermission permission="settings:write">
                  <CompanySettingsPage />
                </RequirePermission>
              }
            />
          </Route>

          <Route path="compta" element={<ComptaLayout />}>
            <Route index element={<ComptaDashboardPage />} />
            <Route path="passerelle-paie" element={<PasserellePaiePage />} />
            <Route path="whatsapp" element={<WhatsAppAccountingPage />} />
            <Route path="tresorerie" element={<TresorerieRapprochementPage />} />
            <Route path="fiscal" element={<ComptaComingSoonPage title="Copilote Fiscal" />} />
            <Route path="journal" element={<ComptaComingSoonPage title="Journal & Écritures" />} />
            <Route path="rapports" element={<ComptaComingSoonPage title="États financiers" />} />
            <Route path="parametres" element={<ComptaComingSoonPage title="Paramètres LaafiCompta" />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFoundRedirect />} />
      </Routes>
    </BrowserRouter>
  );
}
