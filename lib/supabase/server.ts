/**
 * Supabase Server Client Utilities
 * Provides server-only clients for Supabase Auth and Database
 */

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseUrl, supabaseAnonKey, supabaseServiceRoleKey } from './client';

/**
 * Server client for API routes and server components
 * Uses the service role key for admin operations
 */
export function createSupabaseServerClient() {
  const cookieStorePromise = cookies();

  return createServerClient(supabaseUrl, supabaseServiceRoleKey, {
    cookies: {
      async get(name: string) {
        const cookieStore = await cookieStorePromise;
        return cookieStore.get(name)?.value;
      },
      async set(name: string, value: string, options: CookieOptions) {
        try {
          const cookieStore = await cookieStorePromise;
          cookieStore.set({ name, value, ...options });
        } catch (error) {
          // The `set` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
      async remove(name: string, options: CookieOptions) {
        try {
          const cookieStore = await cookieStorePromise;
          cookieStore.set({ name, value: '', ...options });
        } catch (error) {
          // The `delete` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
    },
  });
}

/**
 * Server client with user JWT for scoped operations
 * Use this when you need to act on behalf of a specific user
 */
export function createSupabaseServerClientWithToken(token: string) {
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    cookies: {
      get() {
        return undefined;
      },
      set() {},
      remove() {},
    },
  });
}

/**
 * Get the current user from a request
 * Returns null if not authenticated
 */
export async function getUserFromRequest(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.replace('Bearer ', '');
  const supabase = createSupabaseServerClientWithToken(token);

  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) {
    return null;
  }

  return user;
}

/**
 * Get the current user ID from a request
 * Throws if not authenticated
 */
export async function getUserIdFromRequest(request: Request): Promise<string> {
  const user = await getUserFromRequest(request);
  if (!user) {
    throw new Error('Unauthorized');
  }
  return user.id;
}
