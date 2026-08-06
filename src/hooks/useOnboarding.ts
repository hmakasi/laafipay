import { useMutation, useQuery } from '@tanstack/react-query';
import { getOnboardingContext, OnboardingSubmission, submitOnboarding } from '@/services/api/onboarding';

export function useOnboardingContextQuery(token: string | undefined) {
  return useQuery({
    queryKey: ['onboarding', token],
    queryFn: () => getOnboardingContext(token!),
    enabled: !!token,
    retry: false,
  });
}

export function useSubmitOnboardingMutation(token: string) {
  return useMutation({
    mutationFn: (data: OnboardingSubmission) => submitOnboarding(token, data),
  });
}
