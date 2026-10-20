import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";
import { usePeriod } from "../hooks/usePeriod";
import { useToast } from "../hooks/useToast";
import { CashPeriod, DOC_TIPO_LABELS, Expense, FundEntry, TIPO_PAGO_LABELS } from "../types";
import { fmt, fmtDateTime, fmtNumero, friendlyError } from "../lib/format";
import Modal from "./Modal";

const yearOf = (p: CashPeriod) => Number(p.periodo_mes.slice(0, 4));

const csvCell = (v: unknown) => {
  const s = String(v ?? "");
  return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
const csvRow = (cells: unknown[]) => cells.map(csvCell).join(";");

// Solo Super Administrador: elimina todos los registros de una gestión
// (año) ya cerrada para que la base de datos no crezca sin límite. Antes
// de eliminar ofrece descargar un respaldo en un archivo que abre Excel.
export default function GestionesCard() {
  const { company } = useAuth();
  const { closures, refresh } = usePeriod();
  const { showToast } = useToast();
  const [periods, setPeriods] = useState<CashPeriod[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  const [toDelete, setToDelete] = useState<number | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!company) return;
    let active = true;
    supabase
      .from("cash_periods")
      .select("*")
      .eq("company_id", company.id)
      .then(({ data }) => {
        if (active) setPeriods((data as CashPeriod[]) || []);
      });
    return () => {
      active = false;
    };
  }, [company?.id, reloadKey]);

  const years = Array.from(new Set(periods.map(yearOf))).sort((a, b) => b - a);
  const info = (year: number) => {
    const ps = periods.filter((p) => yearOf(p) === year);
    const ids = new Set(ps.map((p) => p.id));
    return {
      total: ps.length,
      abierto: ps.some((p) => p.estado === "abierto"),
      gastado: closures.filter((c) => ids.has(c.period_id)).reduce((s, c) => s + Number(c.gastado_total), 0),
    };
  };

  const descargarRespaldo = async (year: number) => {
    const ps = periods.filter((p) => yearOf(p) === year);
    const ids = ps.map((p) => p.id);
    const nombre = (id: string) => ps.find((p) => p.id === id)?.nombre || "";
    const [{ data: exp }, { data: funds }] = await Promise.all([
      supabase.from("expenses").select("*").in("period_id", ids).order("numero", { ascending: true }),
      supabase.from("fund_entries").select("*").in("period_id", ids).order("created_at", { ascending: true }),
    ]);
    const lines: string[] = [];
    lines.push(csvRow(["RESPALDO GESTIÓN " + year, company?.nombre || ""]));
    lines.push("");
    lines.push(csvRow(["GASTOS"]));
    lines.push(csvRow(["N°", "Período", "Fecha", "Nombre", "Motivo", "Documento", "N° documento", "Tipo de pago", "Monto", "Estado"]));
    ((exp as Expense[]) || []).forEach((g) =>
      lines.push(
        csvRow([
          fmtNumero(g.numero),
          nombre(g.period_id),
          fmtDateTime(g.created_at),
          g.persona,
          g.motivo,
          g.doc_tipo ? DOC_TIPO_LABELS[g.doc_tipo] : "",
          g.doc_numero || "",
          TIPO_PAGO_LABELS[g.tipo_pago],
          Number(g.monto).toFixed(2),
          g.estado === "anulado" ? "ANULADO" : "ACTIVO",
        ])
      )
    );
    lines.push("");
    lines.push(csvRow(["FONDOS"]));
    lines.push(csvRow(["Período", "Fecha", "Detalle", "Monto"]));
    ((funds as FundEntry[]) || []).forEach((f) =>
      lines.push(csvRow([nombre(f.period_id), fmtDateTime(f.created_at), f.detalle, Number(f.monto).toFixed(2)]))
    );
    lines.push("");
    lines.push(csvRow(["CIERRES MENSUALES"]));
    lines.push(csvRow(["Período", "Fecha de cierre", "Fondos", "Gastado", "Devuelto a Gerencia"]));
    closures
      .filter((c) => ids.includes(c.period_id))
      .forEach((c) =>
        lines.push(
          csvRow([c.periodo_nombre, fmtDateTime(c.created_at), Number(c.fondos_total).toFixed(2), Number(c.gastado_total).toFixed(2), Number(c.saldo_devuelto).toFixed(2)])
        )
      );

    const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "respaldo-gestion-" + year + ".csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const cerrarModal = () => {
    setToDelete(null);
    setConfirmText("");
    setError("");
  };

  const eliminar = async () => {
    if (toDelete === null) return;
    if (confirmText.trim() !== String(toDelete)) {
      setError("Escribe el año " + toDelete + " para confirmar.");
      return;
    }
    setBusy(true);
    const { data, error: rpcError } = await supabase.rpc("fn_eliminar_gestion", { p_anio: toDelete });
    setBusy(false);
    if (rpcError) {
      setError(friendlyError(rpcError));
      return;
    }
    const r = (data || {}) as { gastos?: number; periodos?: number };
    showToast("Gestión " + toDelete + " eliminada: " + (r.periodos ?? 0) + " meses y " + (r.gastos ?? 0) + " gastos.");
    cerrarModal();
    setReloadKey((k) => k + 1);
    refresh();
  };

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="section-title">Mantenimiento de datos — eliminar por gestión</div>
      <p className="field-hint" style={{ marginBottom: 12 }}>
        Para que la base de datos no se llene, puedes eliminar todos los registros de una gestión (año) antigua:
        meses cerrados, gastos, fondos y cierres. Descarga el respaldo primero. Esta acción no se puede deshacer.
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Gestión</th>
              <th>Meses</th>
              <th>Total gastado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {years.map((y) => {
              const i = info(y);
              return (
                <tr key={y}>
                  <td className="mono">{y}</td>
                  <td>{i.total}</td>
                  <td className="amount amount-neg">{fmt(i.gastado)}</td>
                  <td>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => descargarRespaldo(y)}>
                        Descargar respaldo
                      </button>
                      {i.abierto ? (
                        <span className="field-hint" style={{ margin: 0, alignSelf: "center" }}>
                          Tiene el mes actual abierto
                        </span>
                      ) : (
                        <button className="btn btn-ghost btn-sm" style={{ color: "var(--negative)" }} onClick={() => setToDelete(y)}>
                          Eliminar gestión
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {years.length === 0 && (
              <tr>
                <td colSpan={4} className="empty-state">
                  Aún no hay registros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {toDelete !== null && (
        <Modal
          title={"¿Eliminar la gestión " + toDelete + "?"}
          onCancel={cerrarModal}
          onConfirm={busy ? undefined : eliminar}
          confirmLabel={busy ? "Eliminando…" : "Eliminar definitivamente"}
          confirmTone="danger"
        >
          <p>
            Se borrarán para siempre todos los meses cerrados de {toDelete}, con sus gastos, fondos y cierres. Si aún
            no descargaste el respaldo, cancela y hazlo primero.
          </p>
          {error && <div className="field-error">{error}</div>}
          <div className="field">
            <label>Para confirmar, escribe el año ({toDelete})</label>
            <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder={String(toDelete)} autoFocus />
          </div>
        </Modal>
      )}
    </div>
  );
}
