import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";
import { usePeriod } from "../hooks/usePeriod";
import { usePeriodList } from "../hooks/usePeriodList";
import { usePrint } from "../hooks/usePrint";
import { Expense, TipoPago, TIPO_PAGO_LABELS } from "../types";
import { fmt } from "../lib/format";
import { PrintReporte } from "../components/PrintDocs";

export default function Reportes() {
  const { company } = useAuth();
  const { period: periodoActual, closures } = usePeriod();
  const periods = usePeriodList();
  const [selectedId, setSelectedId] = useState("");
  // Por defecto el mes actual; también se puede elegir un mes cerrado.
  const period = periods.find((p) => p.id === selectedId) || periodoActual;
  const { printDocument } = usePrint();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!period) {
        setExpenses([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      const { data } = await supabase.from("expenses").select("*").eq("period_id", period.id);
      setExpenses((data as Expense[]) || []);
      setLoading(false);
    };
    load();
  }, [period?.id]);

  const activos = expenses.filter((g) => g.estado === "activo");
  const anulados = expenses.filter((g) => g.estado === "anulado");
  const porTipo: { tipo: string; total: number }[] = (["efectivo", "qr", "cheque"] as TipoPago[]).map((tipo) => ({
    tipo: TIPO_PAGO_LABELS[tipo],
    total: activos.filter((g) => g.tipo_pago === tipo).reduce((s, g) => s + g.monto, 0),
  }));

  if (loading) return <div className="empty-state">Cargando…</div>;

  return (
    <div>
      <div className="page-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 10 }}>
        <div>
          <h1 className="page-title">Rendición de Gastos</h1>
          <p className="page-sub">
            Vista consolidada de gastos, fondos y cierres{period ? " — " + period.nombre : ""}.
          </p>
        </div>
        {periods.length > 1 && (
          <select value={period?.id || ""} onChange={(e) => setSelectedId(e.target.value)} aria-label="Período">
            {periods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre + (p.estado === "abierto" ? " (actual)" : " — cerrado")}
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="grid-3" style={{ marginBottom: 16 }}>
        {porTipo.map((p) => (
          <div className="card" key={p.tipo}>
            <div className="stat-label">Gastado en {p.tipo}</div>
            <div className="stat-value mono" style={{ fontSize: 20 }}>
              {fmt(p.total)}
            </div>
          </div>
        ))}
      </div>
      <div className="grid-2">
        <div className="card">
          <div className="section-title">Gastos activos vs. anulados</div>
          <div className="kv-row">
            <span className="k">Activos ({activos.length})</span>
            <span className="v amount-neg">{fmt(activos.reduce((s, g) => s + g.monto, 0))}</span>
          </div>
          <div className="kv-row">
            <span className="k">Anulados ({anulados.length})</span>
            <span className="v" style={{ color: "var(--anulado)" }}>
              {fmt(anulados.reduce((s, g) => s + g.monto, 0))}
            </span>
          </div>
          <button
            className="btn"
            style={{ marginTop: 14 }}
            onClick={() => printDocument(<PrintReporte company={company} periodo={period} activos={activos} anulados={anulados} porTipo={porTipo} closures={closures} />, true)}
          >
            Imprimir rendición de gastos
          </button>
        </div>
        <div className="card">
          <div className="section-title">Historial de cierres</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Período</th>
                  <th>Fondos</th>
                  <th>Gastado</th>
                  <th>Devuelto</th>
                </tr>
              </thead>
              <tbody>
                {closures.map((c) => (
                  <tr key={c.id}>
                    <td>{c.periodo_nombre}</td>
                    <td className="amount">{fmt(c.fondos_total)}</td>
                    <td className="amount amount-neg">{fmt(c.gastado_total)}</td>
                    <td className="amount amount-pos">{fmt(c.saldo_devuelto)}</td>
                  </tr>
                ))}
                {closures.length === 0 && (
                  <tr>
                    <td colSpan={4} className="empty-state">
                      Sin cierres todavía.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
