import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./useAuth";
import { usePeriod } from "./usePeriod";
import { CashPeriod } from "../types";

// Lista de todos los períodos de la empresa (el abierto y los cerrados),
// del más reciente al más antiguo. Sirve para consultar meses anteriores.
// Se vuelve a cargar cuando cambia el período abierto (por ejemplo, tras
// un cierre de mes).
export function usePeriodList() {
  const { profile } = useAuth();
  const { period } = usePeriod();
  const [periods, setPeriods] = useState<CashPeriod[]>([]);

  useEffect(() => {
    if (!profile) {
      setPeriods([]);
      return;
    }
    let active = true;
    supabase
      .from("cash_periods")
      .select("*")
      .eq("company_id", profile.company_id)
      .order("periodo_mes", { ascending: false })
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (active) setPeriods((data as CashPeriod[]) || []);
      });
    return () => {
      active = false;
    };
  }, [profile?.company_id, period?.id]);

  return periods;
}
