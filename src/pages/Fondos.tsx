import { FormEvent, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";
import { usePeriod } from "../hooks/usePeriod";
import { usePrint } from "../hooks/usePrint";
import { useToast } from "../hooks/useToast";
import { FundEntry } from "../types";
import { fmt, fmtDateTime, friendlyError } from "../lib/format";
import { PrintFondos } from "../components/PrintDocs";

export default function Fondos() {
  const { profile, company } = useAuth();
  const { period, refresh: refreshPeriod } = usePeriod();
  const { printDocument } = usePrint();
  const { showToast } = useToast();

  const [funds, setFunds] = useState<FundEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [monto, setMonto] = useState("");
  const [detalle, setDetalle] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [busqueda, setBusqueda] = useState("");

  const puedeAgregar = profile?.role === "admin" || profile?.role === "superadmin";

  const load = async () => {
    if (!period) {
      setFunds([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("fund_entries")
      .select("*, profiles(full_name)")
      .eq("period_id", period.id)
      .order("created_at", { ascending: false });
    const mapped = (data || []).map((f: any) => ({ ...f, usuario_nombre: f.profiles?.full_name }));
    setFunds(mapped);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period?.id]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    const val = parseFloat(monto);
    if (!val || val <= 0 || !detalle.trim() || !period) {
      setError("Completa el monto y el detalle.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.rpc("fn_agregar_fondo", {
      p_period_id: period.id,
      p_monto: val,
      p_detalle: detalle.trim(),
    });
    setSaving(false);
    if (error) {
      setError(friendlyError(error));
      return;
    }
    setMonto("");
    setDetalle("");
    showToast("Fondo registrado: " + fmt(val));
    load();
    refreshPeriod();
  };

  const filtered = funds.filter((f) => {
    const iso = f.created_at.slice(0, 10);
    if (desde && iso < desde) return false;
    if (hasta && iso > hasta) return false;
    if (busqueda) {
      const n = busqueda.toLowerCase();
      if (!(f.usuario_nombre || "").toLowerCase().includes(n) && !f.detalle.toLowerCase().includes(n)) return false;
    }
    return true;
  });

  return (
    <div>
      <div className="page-head">
        <h1 className="page-title">Fondos</h1>
        <p className="page-sub">Historial de aumentos de fondo entregados por Contabilidad.</p>
      </div>
      <div className="grid-2">
        <div className="card">
          <div className="section-title">
            Historial de fondos
            <button className="btn btn-sm" onClick={() => printDocument(<PrintFondos funds={filtered} company={company} periodo={period} />, true)}>
              Imprimir historial
            </button>
          </div>
          <div className="filters-row">
            <input type="text" placeholder="Buscar por usuario o detalle..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} style={{ minWidth: 180 }} />
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span className="field-hint" style={{ margin: 0 }}>
                Desde
              </span>
              <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span className="field-hint" style={{ margin: 0 }}>
                Hasta
              </span>
              <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
            </span>
            {(desde || hasta || busqueda) && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setDesde("");
                  setHasta("");
                  setBusqueda("");
                }}
              >
                Limpiar
              </button>
            )}
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Detalle</th>
                  <th>Usuario</th>
                  <th>Monto</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={4} className="empty-state">
                      Cargando…
                    </td>
                  </tr>
                )}
                {!loading &&
                  filtered.map((f) => (
                    <tr key={f.id}>
                      <td className="mono">{fmtDateTime(f.created_at)}</td>
                      <td>{f.detalle}</td>
                      <td>{f.usuario_nombre || "—"}</td>
                      <td className="amount amount-pos">{fmt(f.monto)}</td>
                    </tr>
                  ))}
                {!loading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={4} className="empty-state">
                      Sin resultados para estos filtros.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {puedeAgregar ? (
          period ? (
            <div className="card">
              <div className="section-title">Añadir fondo</div>
              <form onSubmit={submit}>
                {error && <div className="field-error">{error}</div>}
                <div className="field">
                  <label>Monto (Bs.)</label>
                  <input type="number" step="0.01" min="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="0.00" required />
                </div>
                <div className="field">
                  <label>Detalle / motivo</label>
                  <input type="text" value={detalle} onChange={(e) => setDetalle(e.target.value)} placeholder="Reposición mensual" required />
                </div>
                <div className="field-hint" style={{ marginBottom: 12 }}>
                  La fecha y hora quedan registradas automáticamente al confirmar.
                </div>
                <button className="btn btn-primary btn-block" type="submit" disabled={saving}>
                  {saving ? "Guardando…" : "Registrar fondo"}
                </button>
              </form>
            </div>
          ) : (
            <div className="card empty-state">No hay un período abierto para registrar fondos.</div>
          )
        ) : (
          <div className="card role-guard">
            <p>El rol Cajero no puede añadir ni editar fondos.</p>
          </div>
        )}
      </div>
    </div>
  );
}
