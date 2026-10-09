import { FormEvent, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";
import { usePeriod } from "../hooks/usePeriod";
import { usePrint } from "../hooks/usePrint";
import { useToast } from "../hooks/useToast";
import { Expense, TipoPago, TIPO_PAGO_LABELS } from "../types";
import { fmt, fmtDateTime, friendlyError, onlyLetters, onlyCI } from "../lib/format";
import { PrintReceipt, PrintGastosListado } from "../components/PrintDocs";
import Modal from "../components/Modal";

interface GastoFormData {
  persona: string;
  motivo: string;
  monto: string;
  tipoPago: TipoPago;
  entregado: string;
  entregadoCI: string;
  recibido: string;
  recibidoCI: string;
}

const emptyForm = (): GastoFormData => ({
  persona: "",
  motivo: "",
  monto: "",
  tipoPago: "efectivo",
  entregado: "",
  entregadoCI: "",
  recibido: "",
  recibidoCI: "",
});

export default function Gastos() {
  const { profile, company } = useAuth();
  const { period, refresh: refreshPeriod } = usePeriod();
  const { printDocument } = usePrint();
  const { showToast } = useToast();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [saldo, setSaldo] = useState(0);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<GastoFormData>(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [toAnular, setToAnular] = useState<Expense | null>(null);
  const [motivoAnulacion, setMotivoAnulacion] = useState("");

  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [busqueda, setBusqueda] = useState("");

  const puedeAnular = profile?.role === "admin" || profile?.role === "superadmin";
  const puedeEditar = profile?.role === "admin" || profile?.role === "superadmin";

  const load = async () => {
    if (!period) {
      setExpenses([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [{ data: exp }, { data: funds }] = await Promise.all([
      supabase.from("expenses").select("*").eq("period_id", period.id).order("created_at", { ascending: false }),
      supabase.from("fund_entries").select("monto").eq("period_id", period.id),
    ]);
    const list = (exp as Expense[]) || [];
    setExpenses(list);
    const totalFondos = (funds || []).reduce((s, f: any) => s + Number(f.monto), 0);
    const totalGastado = list.filter((g) => g.estado === "activo").reduce((s, g) => s + Number(g.monto), 0);
    setSaldo(totalFondos - totalGastado);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period?.id]);

  const resetForm = () => {
    setForm(emptyForm());
    setEditingId(null);
    setShowForm(false);
    setFormError("");
  };

  const openEdit = (g: Expense) => {
    setForm({
      persona: g.persona,
      motivo: g.motivo,
      monto: String(g.monto),
      tipoPago: g.tipo_pago,
      entregado: g.entregado_nombre || "",
      entregadoCI: g.entregado_ci || "",
      recibido: g.recibido_nombre || "",
      recibidoCI: g.recibido_ci || "",
    });
    setEditingId(g.id);
    setShowForm(false);
    setFormError("");
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError("");
    const val = parseFloat(form.monto);
    if (!val || val <= 0 || !form.persona.trim() || !form.motivo.trim() || !period) {
      setFormError("Completa todos los campos obligatorios.");
      return;
    }
    setSaving(true);
    if (editingId) {
      const { error } = await supabase.rpc("fn_editar_gasto", {
        p_expense_id: editingId,
        p_nuevo_monto: val,
        p_persona: form.persona.trim(),
        p_motivo_gasto: form.motivo.trim(),
        p_tipo_pago: form.tipoPago,
        p_entregado_nombre: form.entregado.trim() || form.persona.trim(),
        p_entregado_ci: form.entregadoCI.trim(),
        p_recibido_nombre: form.recibido.trim() || "Contabilidad",
        p_recibido_ci: form.recibidoCI.trim(),
      });
      setSaving(false);
      if (error) {
        setFormError(friendlyError(error));
        return;
      }
      showToast("Gasto actualizado, con historial de auditoría");
    } else {
      const { error } = await supabase.rpc("fn_registrar_gasto", {
        p_period_id: period.id,
        p_persona: form.persona.trim(),
        p_motivo: form.motivo.trim(),
        p_monto: val,
        p_tipo_pago: form.tipoPago,
        p_entregado_nombre: form.entregado.trim() || form.persona.trim(),
        p_entregado_ci: form.entregadoCI.trim(),
        p_recibido_nombre: form.recibido.trim() || "Contabilidad",
        p_recibido_ci: form.recibidoCI.trim(),
      });
      setSaving(false);
      if (error) {
        setFormError(friendlyError(error));
        return;
      }
      showToast("Gasto registrado correctamente");
    }
    resetForm();
    load();
    refreshPeriod();
  };

  const confirmAnular = async () => {
    if (!toAnular) return;
    const { error } = await supabase.rpc("fn_anular_gasto", {
      p_expense_id: toAnular.id,
      p_motivo: motivoAnulacion.trim() || null,
    });
    if (error) {
      showToast(friendlyError(error));
    } else {
      showToast("Gasto anulado. Ya no afecta el saldo.");
      load();
      refreshPeriod();
    }
    setToAnular(null);
    setMotivoAnulacion("");
  };

  const filtered = expenses.filter((g) => {
    const iso = g.created_at.slice(0, 10);
    if (filtroEstado !== "todos" && g.estado !== filtroEstado) return false;
    if (filtroTipo !== "todos" && g.tipo_pago !== filtroTipo) return false;
    if (desde && iso < desde) return false;
    if (hasta && iso > hasta) return false;
    if (busqueda && !g.persona.toLowerCase().includes(busqueda.toLowerCase())) return false;
    return true;
  });

  return (
    <div>
      <div className="page-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 10 }}>
        <div>
          <h1 className="page-title">Registro de gastos</h1>
          <p className="page-sub">
            Saldo disponible: <strong className="mono">{fmt(saldo)}</strong>
          </p>
        </div>
        {!showForm && !editingId && period && (
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            + Registrar gasto
          </button>
        )}
      </div>

      {(showForm || editingId) && (
        <div className="card" style={{ marginBottom: 16, maxWidth: 560 }}>
          <div className="section-title">{editingId ? "Editar gasto" : "Nuevo gasto"}</div>
          <form onSubmit={submit}>
            {formError && <div className="field-error">{formError}</div>}
            <div className="field">
              <label>Nombre completo</label>
              <input type="text" value={form.persona} onChange={(e) => setForm({ ...form, persona: e.target.value })} placeholder="Nombre de quien recibe" required />
            </div>
            <div className="field">
              <label>Motivo</label>
              <input type="text" value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })} placeholder="Ej. Compra de material de oficina" required />
            </div>
            <div className="field-row">
              <div className="field">
                <label>Monto (Bs.)</label>
                <input type="number" step="0.01" min="0.01" value={form.monto} onChange={(e) => setForm({ ...form, monto: e.target.value })} placeholder="0.00" required />
              </div>
              <div className="field">
                <label>Tipo de pago</label>
                <select value={form.tipoPago} onChange={(e) => setForm({ ...form, tipoPago: e.target.value as TipoPago })}>
                  <option value="efectivo">Efectivo</option>
                  <option value="qr">QR</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label>Firma — Entregué conforme</label>
                <input type="text" value={form.entregado} onChange={(e) => setForm({ ...form, entregado: onlyLetters(e.target.value) })} placeholder="Solo letras" />
              </div>
              <div className="field">
                <label>C.I. de quien entrega</label>
                <input type="text" value={form.entregadoCI} onChange={(e) => setForm({ ...form, entregadoCI: onlyCI(e.target.value) })} placeholder="Número y extensión" />
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label>Firma — Recibí conforme</label>
                <input type="text" value={form.recibido} onChange={(e) => setForm({ ...form, recibido: onlyLetters(e.target.value) })} placeholder="Solo letras" />
              </div>
              <div className="field">
                <label>C.I. de quien recibe</label>
                <input type="text" value={form.recibidoCI} onChange={(e) => setForm({ ...form, recibidoCI: onlyCI(e.target.value) })} placeholder="Número y extensión" />
              </div>
            </div>
            <div className="field-hint" style={{ marginTop: -6, marginBottom: 12 }}>
              Estos nombres se imprimen junto a una línea en blanco para que la persona firme a mano sobre el comprobante impreso.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-primary btn-block" type="submit" disabled={saving}>
                {saving ? "Guardando…" : editingId ? "Guardar cambios" : "Registrar gasto"}
              </button>
              <button type="button" className="btn" onClick={resetForm}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <div className="filters-row">
          <input type="text" placeholder="Buscar por nombre..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} style={{ minWidth: 180 }} />
          <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
            <option value="todos">Todos los estados</option>
            <option value="activo">Activos</option>
            <option value="anulado">Anulados</option>
          </select>
          <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
            <option value="todos">Todos los tipos de pago</option>
            <option value="efectivo">Efectivo</option>
            <option value="qr">QR</option>
            <option value="cheque">Cheque</option>
          </select>
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
            <button className="btn btn-sm" onClick={() => printDocument(<PrintGastosListado expenses={filtered} company={company} periodo={period} />, true)}>
              Imprimir reporte
            </button>
          </span>
          {(desde || hasta || busqueda || filtroEstado !== "todos" || filtroTipo !== "todos") && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setDesde("");
                setHasta("");
                setBusqueda("");
                setFiltroEstado("todos");
                setFiltroTipo("todos");
              }}
            >
              Limpiar filtros
            </button>
          )}
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Nombre</th>
                <th>Motivo</th>
                <th>Tipo</th>
                <th>Monto</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} className="empty-state">
                    Cargando…
                  </td>
                </tr>
              )}
              {!loading &&
                filtered.map((g) => (
                  <tr key={g.id} style={g.estado === "anulado" ? { opacity: 0.6 } : undefined}>
                    <td className="mono">{fmtDateTime(g.created_at)}</td>
                    <td>{g.persona}</td>
                    <td>
                      {g.motivo}
                      {g.editado && (
                        <span className="field-hint" style={{ display: "block" }}>
                          editado
                        </span>
                      )}
                    </td>
                    <td>{TIPO_PAGO_LABELS[g.tipo_pago]}</td>
                    <td className="amount amount-neg">{fmt(g.monto)}</td>
                    <td>
                      {g.estado === "activo" ? (
                        <span className="badge badge-activo">● Activo</span>
                      ) : (
                        <span className="badge badge-anulado">Anulado</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => printDocument(<PrintReceipt gasto={g} company={company} />)}>
                          Imprimir
                        </button>
                        {g.estado === "activo" && puedeEditar && (
                          <button className="btn btn-ghost btn-sm" onClick={() => openEdit(g)}>
                            Editar
                          </button>
                        )}
                        {g.estado === "activo" && puedeAnular && (
                          <button className="btn btn-ghost btn-sm" style={{ color: "var(--negative)" }} onClick={() => setToAnular(g)}>
                            Anular
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="empty-state">
                    No hay gastos con estos filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {toAnular && (
        <Modal
          title={"¿Anular este gasto?"}
          onCancel={() => {
            setToAnular(null);
            setMotivoAnulacion("");
          }}
          onConfirm={confirmAnular}
          confirmLabel="Anular gasto"
          confirmTone="danger"
        >
          <p>El registro permanecerá en el historial, pero dejará de afectar el saldo disponible.</p>
          <div className="field">
            <label>Motivo de anulación (opcional)</label>
            <input type="text" value={motivoAnulacion} onChange={(e) => setMotivoAnulacion(e.target.value)} placeholder="Ej. Monto duplicado" />
          </div>
        </Modal>
      )}
    </div>
  );
}
