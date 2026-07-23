import { createClient, type Session, type SupabaseClient, type User } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useState } from "react";

export type SupabaseAuthController = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  configured: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
};

export function useSupabaseAuth(supabaseUrl: string, publishableKey: string): SupabaseAuthController {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const client = useMemo(
    () => createAuthClient(supabaseUrl.trim(), publishableKey.trim()),
    [publishableKey, supabaseUrl]
  );

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    if (!client) {
      setSession(null);
      setLoading(false);
      return;
    }

    void client.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      setSession(data.session);
      setError(sessionError?.message || null);
      setLoading(false);
    });

    const { data: listener } = client.auth.onAuthStateChange((_event, nextSession) => {
      if (active) {
        setSession(nextSession);
        setLoading(false);
      }
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [client]);

  const signIn = useCallback(async (email: string, password: string) => {
    const auth = requireClient(client);
    setError(null);
    const { error: signInError } = await auth.auth.signInWithPassword({
      email: email.trim(),
      password
    });
    if (signInError) {
      setError(signInError.message);
      throw signInError;
    }
  }, [client]);

  const signUp = useCallback(async (email: string, password: string) => {
    const auth = requireClient(client);
    setError(null);
    const { data, error: signUpError } = await auth.auth.signUp({
      email: email.trim(),
      password
    });
    if (signUpError) {
      setError(signUpError.message);
      throw signUpError;
    }
    return !data.session;
  }, [client]);

  const signOut = useCallback(async () => {
    const auth = requireClient(client);
    setError(null);
    const { error: signOutError } = await auth.auth.signOut({ scope: "local" });
    if (signOutError) {
      setError(signOutError.message);
      throw signOutError;
    }
  }, [client]);

  return {
    user: session?.user || null,
    session,
    loading,
    configured: Boolean(client),
    error,
    signIn,
    signUp,
    signOut
  };
}

function createAuthClient(supabaseUrl: string, publishableKey: string): SupabaseClient | null {
  if (!supabaseUrl || !publishableKey) return null;
  return createClient(supabaseUrl, publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: "live-scanner-auth"
    }
  });
}

function requireClient(client: SupabaseClient | null): SupabaseClient {
  if (!client) throw new Error("Сначала укажите Supabase URL и publishable key.");
  return client;
}
