import { apiClient } from '@/lib/apiClient';
import { MobileMoneyOperator } from '@/types';

export interface OnboardingContext {
  firstName: string;
  lastName: string;
  companyName: string;
}

export interface OnboardingSubmission {
  cnssNumber?: string;
  mobileMoneyOperator?: MobileMoneyOperator;
  mobileMoneyNumber?: string;
  mobileMoneyAccount?: string;
  document?: File;
}

export async function getOnboardingContext(token: string): Promise<OnboardingContext> {
  return apiClient.get<OnboardingContext>(`/onboarding/${token}`);
}

export async function submitOnboarding(token: string, data: OnboardingSubmission): Promise<{ success: boolean }> {
  const formData = new FormData();
  if (data.cnssNumber) formData.append('cnssNumber', data.cnssNumber);
  if (data.mobileMoneyOperator) formData.append('mobileMoneyOperator', data.mobileMoneyOperator);
  if (data.mobileMoneyNumber) formData.append('mobileMoneyNumber', data.mobileMoneyNumber);
  if (data.mobileMoneyAccount) formData.append('mobileMoneyAccount', data.mobileMoneyAccount);
  if (data.document) formData.append('document', data.document);
  return apiClient.patch<{ success: boolean }>(`/onboarding/${token}`, formData);
}
