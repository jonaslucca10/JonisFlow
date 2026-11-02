// Cliente API do frontend. Cookies httpOnly (access + refresh) são enviados
// automaticamente com credentials: 'include'. Tokens nunca são expostos ao JS.
// Padrão: URL relativa /api (Next rewrites → backend). Se NEXT_PUBLIC_API_URL for
// definido (deploy sem rewrite), usa URL absoluta.

const EXTERNAL = process.env.NEXT_PUBLIC_API_URL;

export async function api<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const base = EXTERNAL ? `${EXTERNAL}/api` : '/api';
  const res = await fetch(`${base}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    credentials: 'include',
  });

  // Refresh automático: access token expirou → tentar /refresh uma vez
  if (res.status === 401 && !path.startsWith('/auth/')) {
    await fetch(`${base}/auth/refresh`, { method: 'POST', credentials: 'include' });
    return api<T>(path, options);
  }

  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data?.error?.message || data?.error || `Erro ${res.status}`;
    throw new Error(message);
  }
  return data as T;
}
