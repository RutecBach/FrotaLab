import { cookies } from 'next/headers';
import type { SessionUser } from './api';
import { apiOrigin } from './api-origin';

export async function getSession(): Promise<{ user: SessionUser; csrfToken: string } | null> {
  const token = (await cookies()).get('frotalab')?.value;
  if (!token) return null;
  try {
    const response = await fetch(`${apiOrigin}/api/auth/me`, {
      headers: { cookie: `frotalab=${token}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(3000),
    });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}

export async function hasActiveSession(): Promise<boolean> {
  return (await getSession()) !== null;
}
