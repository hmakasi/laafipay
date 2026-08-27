import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '@/types';
import { changePassword as changePasswordApi, login as loginApi, logout as logoutApi } from '@/services/api/auth';
import { CompanySignupPayload, signupCompany } from '@/services/api/companies';
import { queryClient } from '@/lib/queryClient';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (payload: CompanySignupPayload) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const { user, token } = await loginApi(email, password);
          // Le cache React Query n'est pas partitionné par utilisateur/entreprise
          // (clés comme ['companies','me'] identiques pour tout le monde) — sans
          // ce clear(), changer de compte dans le même onglet pouvait montrer les
          // données en cache du compte précédent le temps que les requêtes
          // refetch (jusqu'à 30 min avec certains staleTime).
          queryClient.clear();
          set({ user, token, isAuthenticated: true, isLoading: false });
        } catch (err) {
          set({
            error: err instanceof Error ? err.message : 'Erreur de connexion',
            isLoading: false,
          });
          throw err;
        }
      },

      // Ne connecte plus personne : la demande part en attente
      // d'approbation par un admin LaafiPay (voir /admin/signup-requests),
      // aucun compte/token n'existe encore à ce stade.
      signup: async (payload) => {
        set({ isLoading: true, error: null });
        try {
          await signupCompany(payload);
          set({ isLoading: false });
        } catch (err) {
          set({
            error: err instanceof Error ? err.message : 'Erreur de création',
            isLoading: false,
          });
          throw err;
        }
      },

      changePassword: async (currentPassword, newPassword) => {
        const user = await changePasswordApi(currentPassword, newPassword);
        set({ user: { ...get().user, ...user } });
      },

      logout: async () => {
        await logoutApi();
        queryClient.clear();
        set({ user: null, token: null, isAuthenticated: false });
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'laafipay-auth',
      partialize: (state) => ({ user: state.user, token: state.token, isAuthenticated: state.isAuthenticated }),
    }
  )
);
