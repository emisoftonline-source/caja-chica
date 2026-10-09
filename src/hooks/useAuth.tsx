import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "../lib/supabase";
import { Profile, Company } from "../types";

interface AuthContextType {
  loading: boolean;
  profile: Profile | null;
  company: Company | null;
  refreshProfile: () => Promise<void>;
  refreshCompany: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [company, setCompany] = useState<Company | null>(null);

  const loadProfile = async (userId: string) => {
    const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
    if (error || !data) {
      setProfile(null);
      return null;
    }
    setProfile(data as Profile);
    return data as Profile;
  };

  const loadCompany = async (companyId: string) => {
    const { data } = await supabase.from("companies").select("*").eq("id", companyId).single();
    setCompany((data as Company) || null);
  };

  const refreshProfile = async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (auth.user) await loadProfile(auth.user.id);
  };

  const refreshCompany = async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    const p = await loadProfile(auth.user.id);
    if (p) await loadCompany(p.company_id);
  };

  useEffect(() => {
    let active = true;

    const init = async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      if (data.session?.user) {
        const p = await loadProfile(data.session.user.id);
        if (p?.active === false) {
          await supabase.auth.signOut();
          setProfile(null);
        } else if (p) {
          await loadCompany(p.company_id);
        }
      }
      setLoading(false);
    };
    init();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const p = await loadProfile(session.user.id);
        if (p?.active === false) {
          await supabase.auth.signOut();
          setProfile(null);
        } else if (p) {
          await loadCompany(p.company_id);
        }
      } else {
        setProfile(null);
        setCompany(null);
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    if (data.user) {
      const p = await loadProfile(data.user.id);
      if (!p) return { error: "No se encontró un perfil para este usuario." };
      if (p.active === false) {
        await supabase.auth.signOut();
        setProfile(null);
        return { error: "Tu cuenta está inhabilitada. Contacta a un Super Administrador." };
      }
      await loadCompany(p.company_id);
    }
    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setCompany(null);
  };

  return (
    <AuthContext.Provider value={{ loading, profile, company, refreshProfile, refreshCompany, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
