import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

const AUTH_TIMEOUT_MS = 12000;

interface Profile {
  id: string;
  nome: string;
  setor: string;
  funcao: string;
  unidade: string;
  resumo_dia_dia: string;
  responsabilidades: string;
  qualidades: string;
  pontos_melhoria: string;
  tempo_casa: string;
  decisores: string;
  ferramentas_criticas: string;
  principal_gargalo: string;
  onboarding_completo: boolean;
  whatsapp: string;
  whatsapp_consent: boolean;
}

interface UserRole {
  role: "admin" | "gestor" | "colaborador";
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: "admin" | "gestor" | "colaborador";
  loading: boolean;
  signUp: (email: string, password: string, nome: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<"admin" | "gestor" | "colaborador">("colaborador");
  const [loading, setLoading] = useState(true);

  const withTimeout = async <T,>(promise: Promise<T>, message: string): Promise<T> => {
    let timeoutId: number | undefined;

    try {
      return await Promise.race([
        promise,
        new Promise<never>((_, reject) => {
          timeoutId = window.setTimeout(() => reject(new Error(message)), AUTH_TIMEOUT_MS);
        }),
      ]);
    } finally {
      if (timeoutId) window.clearTimeout(timeoutId);
    }
  };

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        console.error("Erro ao carregar perfil", error);
        setProfile(null);
        return null;
      }

      setProfile(data);
      return data;
    } catch (error) {
      console.error("Falha inesperada ao carregar perfil", error);
      setProfile(null);
      return null;
    }
  };

  const fetchRole = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        console.error("Erro ao carregar papel do usuário", error);
      }

      const nextRole = (data?.role as "admin" | "gestor" | "colaborador") || "colaborador";
      setRole(nextRole);
      return nextRole;
    } catch (error) {
      console.error("Falha inesperada ao carregar papel do usuário", error);
      setRole("colaborador");
      return "colaborador";
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
      await fetchRole(user.id);
    }
  };

  useEffect(() => {
    let isActive = true;

    const syncAuthState = async (nextSession: Session | null, event?: string) => {
      if (!isActive) return;

      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (!nextSession?.user) {
        setProfile(null);
        setRole("colaborador");
        setLoading(false);
        return;
      }

      // Only show loading spinner on initial load or sign-in, not on token refresh
      const isInitialOrSignIn = !event || event === "SIGNED_IN" || event === "INITIAL_SESSION";
      if (isInitialOrSignIn) setLoading(true);

      await Promise.allSettled([
        fetchProfile(nextSession.user.id),
        fetchRole(nextSession.user.id),
      ]);

      if (isActive) setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        void syncAuthState(session);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      void syncAuthState(session);
    });

    return () => {
      isActive = false;
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string, nome: string) => {
    try {
      const { error } = await withTimeout(
        supabase.auth.signUp({
          email,
          password,
          options: {
            data: { nome },
            emailRedirectTo: window.location.origin,
          },
        }),
        "O cadastro demorou mais que o esperado. Tente novamente em instantes."
      );

      return { error };
    } catch (error) {
      return {
        error: error instanceof Error ? error : new Error("Não foi possível concluir o cadastro."),
      };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await withTimeout(
        supabase.auth.signInWithPassword({ email, password }),
        "O login demorou mais que o esperado. Tente novamente em instantes."
      );

      return { error };
    } catch (error) {
      return {
        error: error instanceof Error ? error : new Error("Não foi possível fazer login."),
      };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRole("colaborador");
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, role, loading, signUp, signIn, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

const DEFAULT_AUTH: AuthContextType = {
  user: null,
  session: null,
  profile: null,
  role: "colaborador",
  loading: true,
  signUp: async () => ({ error: new Error("AuthProvider not mounted") }),
  signIn: async () => ({ error: new Error("AuthProvider not mounted") }),
  signOut: async () => {},
  refreshProfile: async () => {},
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  return ctx ?? DEFAULT_AUTH;
}
