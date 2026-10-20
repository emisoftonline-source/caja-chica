import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";
import { usePeriod } from "../hooks/usePeriod";
import { usePrint } from "../hooks/usePrint";
import { useToast } from "../hooks/useToast";
import { fmt, friendlyError, fmtDate } from "../lib/format";
import { PrintCierre } from "../components/PrintDocs";
import Modal from "../components/Modal";

export default function Cierre() {
  const { profile, company } = useAuth();
  const { period, closures, refresh } = usePeriod();
  const { printDocument } = usePrint();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [totalFondos, setTotalFondos] = useState(0);
  const [totalGastado, setTotalGastado] = useState(0);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [closing, setClosing] = useState(false);

  const load = async () => {
    if (!period) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const [{ data: funds }, { data: expenses }] = await Promise.all([
      supabase.from("fund_entries").select("monto").eq("period_id", period.id),
      supabase.from("expenses").select("monto").eq("period_id", period.id).eq("estado", "activo"),
    ]);
    setTotalFondos((funds || []).reduce((s, f: any) => s + Number(f.monto), 0));
    setTotalGastado((expenses || []).reduce((s, g: any) => s + Number(g.monto), 0));
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period?.id]);

  const saldo = totalFondos - totalGastado;

  const cerrarPeriodo = async () => {
    if (!period) return;
    setClosing(true);
    const { error } = await supabase.rpc("fn_cerrar_periodo", {
      p_period_id: period.id,
    });
    setClosing(false);
    setConfirming(false);
    if (error) {
      showToast(friendlyError(error));
      return;
    }
    showToast("El período ha sido cerrado correctamente.");
    refresh();
  };

  const imprimirResumenActual = () => {
    if (!period) return;
    printDocument(
      <PrintCierre
        company={company}
        periodoNombre={period.nombre}
        closure={{
          fondos_total: totalFondos,
          gastado_total: totalGastado,
          saldo_devuelto: saldo,
          created_at: new Date().toISOString(),
        }}
        cerradoPorNombre={(profile?.full_name || "") + " (resumen preliminar)"}
      />
    );
  };

  const imprimirCierre = (c: (typeof closures)[number]) => {
    printDocument(
      <PrintCierre
        company={company}
        periodoNombre={c.periodo_nombre}
        closure={c}
        cerradoPorNombre={profile?.full_name || ""}
      />
    );
  };

  return (
    <div>
      <div className="page-head">
        <h1 className="page-title">Cierre mensual</h1>
        <p className="page-sub">Cierra el período actual y registra la devolución a Gerencia.</p>
      </div>
      <div className="grid-2">
        <div className="card">
          <div className="section-title">
            Resumen — {period?.nombre || "Sin período"}
            {period && (
              <button className="btn btn-sm" onClick={imprimirResumenActual}>
                Imprimir resumen
              </button>
            )}
          </div>
          {loading ? (
            <div className="empty-state">Cargando…</div>
          ) : (
            <>
              <div className="kv-row">
                <span className="k">Fondos ingresados</span>
                <span className="v">{fmt(totalFondos)}</span>
              </div>
              <div className="kv-row">
                <span className="k">Total gastado</span>
                <span className="v amount-neg">{fmt(totalGastado)}</span>
              </div>
              <div className="kv-row">
                <span className="k">Saldo a devolver a Gerencia</span>
                <span className="v amount-pos">{fmt(saldo)}</span>
              </div>
              <button className="btn btn-primary btn-block" style={{ marginTop: 16 }} disabled={!period} onClick={() => setConfirming(true)}>
                Cierre de mes / Devolver a Gerencia
              </button>
              {!period && (
                <div className="field-hint" style={{ marginTop: 8 }}>
                  No hay un período abierto.
                </div>
              )}
            </>
          )}
        </div>
        <div className="card">
          <div className="section-title">Cierres anteriores</div>
          {closures.length === 0 && <div className="empty-state">Aún no hay cierres registrados.</div>}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Período</th>
                  <th>Fecha</th>
                  <th>Devuelto</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {closures.map((c) => (
                  <tr key={c.id}>
                    <td>{c.periodo_nombre}</td>
                    <td className="mono">{fmtDate(c.created_at)}</td>
                    <td className="amount amount-pos">{fmt(c.saldo_devuelto)}</td>
                    <td>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => navigate("/gastos?periodo=" + c.period_id)}>
                          Ver gastos
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => imprimirCierre(c)}>
                          Imprimir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {confirming && (
        <Modal
          title={"Cierre de " + (period?.nombre || "")}
          onCancel={() => setConfirming(false)}
          onConfirm={cerrarPeriodo}
          confirmLabel={closing ? "Cerrando…" : "Sí, cerrar mes"}
        >
          <div className="kv-row">
            <span className="k">Fondos ingresados</span>
            <span className="v">{fmt(totalFondos)}</span>
          </div>
          <div className="kv-row">
            <span className="k">Total gastado</span>
            <span className="v">{fmt(totalGastado)}</span>
          </div>
          <div className="kv-row">
            <span className="k">Saldo a devolver</span>
            <span className="v">{fmt(saldo)}</span>
          </div>
          <p style={{ marginTop: 14 }}>
            El nuevo período comenzará con saldo Bs. 0,00. Los registros de este período permanecen disponibles para
            consulta.
          </p>
        </Modal>
      )}
    </div>
  );
}
