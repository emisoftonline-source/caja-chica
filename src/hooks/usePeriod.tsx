import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./useAuth";
import { CashPeriod, MonthlyClosure } from "../types";

export interface MonthlyClosureWithName extends MonthlyClosure {
  periodo_nombre: string;
}

interface PeriodContextType {
  period: CashPeriod | null;
  closures: MonthlyClosureWithName[];
  loading: boolean;
  refresh: () => Promise<void>;
}

const PeriodContext = createContext<PeriodContextType | undefined>(undefined);

export function PeriodProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const [period, setPeriod] = useState<CashPeriod | null>(null);
  const [closures, setClosures] = useState<MonthlyClosureWithName[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    if (!profile) return;
    setLoading(true);
    const { data: openPeriod } = await supabase
      .from("cash_periods")
      .select("*")
      .eq("company_id", profile.company_id)
      .eq("estado", "abierto")
      .maybeSingle();
    setPeriod((openPeriod as CashPeriod) || null);

    const { data: closureRows } = await supabase
      .from("monthly_closures")
      .select("*, cash_periods(nombre)")
      .eq("company_id", profile.company_id)
      .order("created_at", { ascending: false });
    const mapped = (closureRows || []).map((c: any) => ({ ...c, periodo_nombre: c.cash_periods?.nombre || "—" }));
    setClosures(mapped);
    setLoading(false);
  };

  useEffect(() => {
    if (profile) refresh();
    else {
      setPeriod(null);
      setClosures([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.company_id]);

  return <PeriodContext.Provider value={{ period, closures, loading, refresh }}>{children}</PeriodContext.Provider>;
}

export function usePeriod() {
  const ctx = useContext(PeriodContext);
  if (!ctx) throw new Error("usePeriod debe usarse dentro de <PeriodProvider>");
  return ctx;
}
