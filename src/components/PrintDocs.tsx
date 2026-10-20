import { Company, DOC_TIPO_LABELS, Expense, FundEntry, CashPeriod, TIPO_PAGO_LABELS } from "../types";
import { MonthlyClosureWithName } from "../hooks/usePeriod";
import { fmt, fmtDateTime, fmtNumero } from "../lib/format";

const docLabel = (g: Expense) => (g.doc_tipo && g.doc_numero ? `${DOC_TIPO_LABELS[g.doc_tipo]} ${g.doc_numero}` : "—");

function CompanyMark({ company }: { company: Company | null }) {
  if (company?.logo_url) {
    return (
      <div className="p-logo">
        <img src={company.logo_url} alt={company.nombre} />
      </div>
    );
  }
  return <div className="p-logo fallback">{(company?.nombre || "C").slice(0, 1)}</div>;
}

function Header({ company, subtitle }: { company: Company | null; subtitle: string }) {
  return (
    <div className="print-header">
      <CompanyMark company={company} />
      <div>
        <p className="print-title">{company?.nombre || "Mi Empresa"}</p>
        <p className="print-sub">{subtitle}</p>
      </div>
    </div>
  );
}

function NoPrintNote() {
  return <div className="no-print-note">Documento generado desde el sistema de Caja Chica.</div>;
}

export function PrintReceipt({ gasto, company }: { gasto: Expense; company: Company | null }) {
  return (
    <div>
      <Header
        company={company}
        subtitle={"Comprobante de gasto de caja chica" + (gasto.estado === "anulado" ? " — ANULADO" : "")}
      />
      <div className="print-kv">
        <span>N° de gasto</span>
        <strong>{fmtNumero(gasto.numero)}</strong>
      </div>
      <div className="print-kv">
        <span>Fecha</span>
        <strong>{fmtDateTime(gasto.created_at)}</strong>
      </div>
      <div className="print-kv">
        <span>Factura / Recibo</span>
        <strong>{docLabel(gasto)}</strong>
      </div>
      <div className="print-kv">
        <span>Nombre</span>
        <strong>{gasto.persona}</strong>
      </div>
      <div className="print-kv">
        <span>Motivo</span>
        <strong>{gasto.motivo}</strong>
      </div>
      <div className="print-kv">
        <span>Tipo de pago</span>
        <strong>{TIPO_PAGO_LABELS[gasto.tipo_pago]}</strong>
      </div>
      <div className="print-kv">
        <span>Monto</span>
        <strong>{fmt(gasto.monto)}</strong>
      </div>
      <div className="print-kv">
        <span>Estado</span>
        <strong>{gasto.estado === "anulado" ? "ANULADO" : "ACTIVO"}</strong>
      </div>
      {gasto.estado === "anulado" && gasto.motivo_anulacion && (
        <div className="print-kv">
          <span>Motivo de anulación</span>
          <strong>{gasto.motivo_anulacion}</strong>
        </div>
      )}
      <div className="sign-grid">
        <div className="sign-block">
          <div className="sign-line">
            <div className="sign-role">ENTREGUÉ CONFORME</div>
            <div>{gasto.entregado_nombre || gasto.persona}</div>
            <div className="sign-meta">C.I. {gasto.entregado_ci || "________________"}</div>
          </div>
        </div>
        <div className="sign-block">
          <div className="sign-line">
            <div className="sign-role">RECIBÍ CONFORME</div>
            <div>{gasto.recibido_nombre || "Contabilidad"}</div>
            <div className="sign-meta">C.I. {gasto.recibido_ci || "________________"}</div>
          </div>
        </div>
      </div>
      <NoPrintNote />
    </div>
  );
}

export function PrintFondos({
  funds,
  company,
  periodo,
}: {
  funds: FundEntry[];
  company: Company | null;
  periodo: CashPeriod | null;
}) {
  const total = funds.reduce((s, f) => s + f.monto, 0);
  return (
    <div>
      <Header company={company} subtitle={"Historial de aumentos de fondo — " + (periodo?.nombre || "")} />
      <table className="print-table">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Detalle</th>
            <th>Usuario</th>
            <th>Monto</th>
          </tr>
        </thead>
        <tbody>
          {funds.map((f) => (
            <tr key={f.id}>
              <td>{fmtDateTime(f.created_at)}</td>
              <td>{f.detalle}</td>
              <td>{f.usuario_nombre || "—"}</td>
              <td>{fmt(f.monto)}</td>
            </tr>
          ))}
          {funds.length === 0 && (
            <tr>
              <td colSpan={4}>Sin registros para estos filtros.</td>
            </tr>
          )}
          <tr className="print-total-row">
            <td colSpan={3}>Total</td>
            <td>{fmt(total)}</td>
          </tr>
        </tbody>
      </table>
      <NoPrintNote />
    </div>
  );
}

export function PrintGastosListado({
  expenses,
  company,
  periodo,
}: {
  expenses: Expense[];
  company: Company | null;
  periodo: CashPeriod | null;
}) {
  const activos = expenses.filter((g) => g.estado === "activo");
  const anulados = expenses.filter((g) => g.estado === "anulado");
  const totalActivos = activos.reduce((s, g) => s + g.monto, 0);
  return (
    <div>
      <Header company={company} subtitle={"Rendición de gastos — " + (periodo?.nombre || "")} />
      <div className="print-kv">
        <span>Total de registros</span>
        <strong>{expenses.length}</strong>
      </div>
      <div className="print-kv">
        <span>Activos</span>
        <strong>
          {activos.length} · {fmt(totalActivos)}
        </strong>
      </div>
      <div className="print-kv">
        <span>Anulados</span>
        <strong>{anulados.length}</strong>
      </div>
      <table className="print-table">
        <thead>
          <tr>
            <th>N°</th>
            <th>Fecha</th>
            <th>Nombre</th>
            <th>Motivo</th>
            <th>Factura / Recibo</th>
            <th>Tipo</th>
            <th>Monto</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {expenses.map((g) => (
            <tr key={g.id}>
              <td>{fmtNumero(g.numero)}</td>
              <td>{fmtDateTime(g.created_at)}</td>
              <td>{g.persona}</td>
              <td>{g.motivo}</td>
              <td>{docLabel(g)}</td>
              <td>{TIPO_PAGO_LABELS[g.tipo_pago]}</td>
              <td>{fmt(g.monto)}</td>
              <td>{g.estado === "anulado" ? "ANULADO" : "ACTIVO"}</td>
            </tr>
          ))}
          {expenses.length === 0 && (
            <tr>
              <td colSpan={8}>Sin registros para estos filtros.</td>
            </tr>
          )}
          <tr className="print-total-row">
            <td colSpan={6}>Total activos</td>
            <td colSpan={2}>{fmt(totalActivos)}</td>
          </tr>
        </tbody>
      </table>
      <NoPrintNote />
    </div>
  );
}

export function PrintReporte({
  company,
  periodo,
  activos,
  anulados,
  porTipo,
  closures,
}: {
  company: Company | null;
  periodo: CashPeriod | null;
  activos: Expense[];
  anulados: Expense[];
  porTipo: { tipo: string; total: number }[];
  closures: MonthlyClosureWithName[];
}) {
  const totalActivos = activos.reduce((s, g) => s + g.monto, 0);
  const totalAnulados = anulados.reduce((s, g) => s + g.monto, 0);
  return (
    <div>
      <Header company={company} subtitle={"Rendición de gastos de caja chica — " + (periodo?.nombre || "")} />
      <p style={{ fontWeight: 700, fontSize: 12.5, marginBottom: 4 }}>Gastado por tipo de pago</p>
      <table className="print-table">
        <thead>
          <tr>
            <th>Tipo de pago</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {porTipo.map((p) => (
            <tr key={p.tipo}>
              <td>{p.tipo}</td>
              <td>{fmt(p.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ fontWeight: 700, fontSize: 12.5, margin: "14px 0 4px 0" }}>Gastos activos vs. anulados</p>
      <table className="print-table">
        <thead>
          <tr>
            <th>Estado</th>
            <th>Cantidad</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Activos</td>
            <td>{activos.length}</td>
            <td>{fmt(totalActivos)}</td>
          </tr>
          <tr>
            <td>Anulados</td>
            <td>{anulados.length}</td>
            <td>{fmt(totalAnulados)}</td>
          </tr>
        </tbody>
      </table>
      <p style={{ fontWeight: 700, fontSize: 12.5, margin: "14px 0 4px 0" }}>Historial de cierres</p>
      <table className="print-table">
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
              <td>{fmt(c.fondos_total)}</td>
              <td>{fmt(c.gastado_total)}</td>
              <td>{fmt(c.saldo_devuelto)}</td>
            </tr>
          ))}
          {closures.length === 0 && (
            <tr>
              <td colSpan={4}>Sin cierres registrados</td>
            </tr>
          )}
        </tbody>
      </table>
      <NoPrintNote />
    </div>
  );
}

export function PrintCierre({
  company,
  periodoNombre,
  closure,
  cerradoPorNombre,
}: {
  company: Company | null;
  periodoNombre: string;
  closure: { fondos_total: number; gastado_total: number; saldo_devuelto: number; created_at: string };
  cerradoPorNombre: string;
}) {
  return (
    <div>
      <Header company={company} subtitle={"Cierre mensual — " + periodoNombre} />
      <div className="print-kv">
        <span>Fecha de cierre</span>
        <strong>{fmtDateTime(closure.created_at)}</strong>
      </div>
      <div className="print-kv">
        <span>Cerrado por</span>
        <strong>{cerradoPorNombre}</strong>
      </div>
      <div className="print-kv">
        <span>Fondos ingresados</span>
        <strong>{fmt(closure.fondos_total)}</strong>
      </div>
      <div className="print-kv">
        <span>Total gastado</span>
        <strong>{fmt(closure.gastado_total)}</strong>
      </div>
      <div className="print-kv">
        <span>Saldo devuelto a Gerencia</span>
        <strong>{fmt(closure.saldo_devuelto)}</strong>
      </div>
      <div className="sign-grid">
        <div className="sign-block">
          <div className="sign-line">
            <div className="sign-role">ENTREGA CAJA CHICA</div>
            <div>{cerradoPorNombre}</div>
            <div className="sign-meta">C.I. ________________</div>
          </div>
        </div>
        <div className="sign-block">
          <div className="sign-line">
            <div className="sign-role">RECIBE GERENCIA</div>
            <div>________________________</div>
            <div className="sign-meta">C.I. ________________</div>
          </div>
        </div>
      </div>
      <NoPrintNote />
    </div>
  );
}
