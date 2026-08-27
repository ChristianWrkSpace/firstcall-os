import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
export { createAdminClient } from "./supabase-admin";


const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Server client — use in Server Components, Route Handlers, and Server Actions
export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // `setAll` was called from a Server Component, where Next.js
          // forbids cookie writes. Middleware handles session refresh, so
          // dropping the write here is safe.
        }
      },
    },
  });
}
