import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";
import { usePeriod } from "../hooks/usePeriod";
import { Expense } from "../types";
import { fmt, fmtDateTime } from "../lib/format";
import { TIPO_PAGO_LABELS } from "../types";

export default function Dashboard() {
  const { profile } = useAuth();
  const { period, loading: periodLoading } = usePeriod();
  const [totalFondos, setTotalFondos] = useState(0);
  const [totalGastado, setTotalGastado] = useState(0);
  const [recientes, setRecientes] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!period) {
        setLoading(false);
        return;
      }
      setLoading(true);
      const [{ data: funds }, { data: expenses }, { data: recent }] = await Promise.all([
        supabase.from("fund_entries").select("monto").eq("period_id", period.id),
        supabase.from("expenses").select("monto").eq("period_id", period.id).eq("estado", "activo"),
        supabase
          .from("expenses")
          .select("*")
          .eq("period_id", period.id)
          .order("created_at", { ascending: false })
          .limit(5),
      ]);
      setTotalFondos((funds || []).reduce((s, f: any) => s + Number(f.monto), 0));
      setTotalGastado((expenses || []).reduce((s, g: any) => s + Number(g.monto), 0));
      setRecientes((recent as Expense[]) || []);
      setLoading(false);
    };
    load();
  }, [period?.id]);

  const saldo = totalFondos - totalGastado;

  if (periodLoading || loading) return <div className="empty-state">Cargando…</div>;

  if (!period) {
    return (
      <div className="card empty-state">
        No hay un período abierto. {profile?.role !== "cajero" && "Ve a Cierre mensual o contacta al Super Administrador."}
      </div>
    );
  }

  return (
    <div>
      <div className="page-head">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-sub">
          Período actual: {period.nombre} ·{" "}
          <span className={"badge " + (period.estado === "abierto" ? "badge-activo" : "badge-anulado")}>
            {period.estado === "abierto" ? "ABIERTO" : "CERRADO"}
          </span>
        </p>
      </div>
      <div className="grid-3" style={{ marginBottom: 16 }}>
        <div className="card stat-card stat-positive">
          <div className="stat-label">Saldo disponible</div>
          <div className="stat-value mono">{fmt(saldo)}</div>
          <div className="stat-foot">Fondos − gastos activos</div>
        </div>
        <div className="card stat-card">
          <div className="stat-label">Fondo total ingresado</div>
          <div className="stat-value mono">{fmt(totalFondos)}</div>
        </div>
        <div className="card stat-card stat-spent">
          <div className="stat-label">Total gastado</div>
          <div className="stat-value mono">{fmt(totalGastado)}</div>
          <div className="stat-foot">Solo gastos activos</div>
        </div>
      </div>
      <div className="card">
        <div className="section-title">Últimos movimientos</div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Persona</th>
                <th>Motivo</th>
                <th>Tipo</th>
                <th>Monto</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {recientes.map((g) => (
                <tr key={g.id}>
                  <td className="mono">{fmtDateTime(g.created_at)}</td>
                  <td>{g.persona}</td>
                  <td>{g.motivo}</td>
                  <td>{TIPO_PAGO_LABELS[g.tipo_pago]}</td>
                  <td className={"amount " + (g.estado === "anulado" ? "" : "amount-neg")}>{fmt(g.monto)}</td>
                  <td>
                    {g.estado === "activo" ? (
                      <span className="badge badge-activo">● Activo</span>
                    ) : (
                      <span className="badge badge-anulado">Anulado</span>
                    )}
                  </td>
                </tr>
              ))}
              {recientes.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty-state">
                    Sin movimientos aún en este período.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
