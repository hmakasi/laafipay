import { useAuthStore } from '@/store/authStore';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = useAuthStore.getState().token;
  const headers: HeadersInit = {
    ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (res.status === 204) {
    return undefined as T;
  }

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const payload = isJson ? await res.json() : await res.text();

  if (!res.ok) {
    const message = isJson && typeof payload === 'object' && payload && 'message' in payload ? String((payload as { message: unknown }).message) : `Erreur ${res.status}`;
    throw new Error(message);
  }

  return payload as T;
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path),
  getBlob: async (path: string): Promise<Blob> => {
    const token = useAuthStore.getState().token;
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      const message = await res.text().catch(() => `Erreur ${res.status}`);
      throw new Error(message || `Erreur ${res.status}`);
    }
    return res.blob();
  },
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body instanceof FormData ? body : JSON.stringify(body) }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: body instanceof FormData ? body : JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body instanceof FormData ? body : JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

// Logos et documents sont désormais des URL Vercel Blob absolues (voir
// companies.routes.ts, employees.routes.ts, onboarding.routes.ts) — le
// fallback relatif ci-dessous ne sert plus qu'à couvrir une éventuelle
// donnée ancienne/mal formée plutôt qu'un cas d'usage normal.
const SERVER_ORIGIN = BASE_URL.replace(/\/api\/?$/, '');

export function resolveUploadUrl(path: string | undefined): string | undefined {
  if (!path) return undefined;
  if (/^https?:\/\//.test(path)) return path; // cas normal désormais : URL Blob déjà absolue
  return `${SERVER_ORIGIN}${path}`;
}

export function buildQueryString(params: Record<string, unknown>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  });
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}
