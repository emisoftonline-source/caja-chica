import { ChangeEvent, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/useToast";
import { friendlyError } from "../lib/format";

export default function Configuracion() {
  const { company, refreshCompany } = useAuth();
  const { showToast } = useToast();
  const [nombre, setNombre] = useState(company?.nombre || "");
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const saveNombre = async () => {
    if (!nombre.trim()) return;
    setSaving(true);
    const { error } = await supabase.rpc("fn_update_company", { p_nombre: nombre.trim(), p_logo_url: null });
    setSaving(false);
    if (error) {
      showToast(friendlyError(error));
      return;
    }
    showToast("Nombre de la empresa actualizado");
    refreshCompany();
  };

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !company) return;
    if (!file.type.startsWith("image/")) {
      setError("Selecciona un archivo de imagen (PNG, JPG o SVG).");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("La imagen no debe superar 2 MB.");
      return;
    }
    setError("");
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${company.id}/logo-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("logos").upload(path, file, { upsert: true });
    if (uploadError) {
      setUploading(false);
      setError(friendlyError(uploadError));
      return;
    }
    const { data: pub } = supabase.storage.from("logos").getPublicUrl(path);
    const { error: rpcError } = await supabase.rpc("fn_update_company", { p_nombre: null, p_logo_url: pub.publicUrl });
    setUploading(false);
    if (rpcError) {
      setError(friendlyError(rpcError));
      return;
    }
    showToast("Logo actualizado. Se reflejará para todos los usuarios.");
    refreshCompany();
  };

  const quitarLogo = async () => {
    const { error } = await supabase.rpc("fn_update_company", { p_nombre: null, p_logo_url: "" });
    if (error) {
      showToast(friendlyError(error));
      return;
    }
    showToast("Logo eliminado.");
    refreshCompany();
  };

  return (
    <div>
      <div className="page-head">
        <h1 className="page-title">Configuración</h1>
        <p className="page-sub">
          Datos de la empresa y logo visible en el panel, login y comprobantes. Lo que configures aquí se aplica
          automáticamente a todos los administradores y cajeros.
        </p>
      </div>
      <div className="grid-2">
        <div className="card">
          <div className="section-title">Empresa</div>
          <div className="field">
            <label>Nombre de la empresa</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} />
              <button className="btn btn-primary btn-sm" onClick={saveNombre} disabled={saving}>
                {saving ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
          <div className="field">
            <label>Logo</label>
            {error && <div className="field-error">{error}</div>}
            <label className="logo-drop" htmlFor="logo-upload">
              {uploading ? "Subiendo…" : "Arrastra un archivo o haz clic para subir el logo (PNG, JPG o SVG, máx. 2MB)"}
              <input id="logo-upload" type="file" accept="image/*" onChange={handleFile} disabled={uploading} />
            </label>
            <div className="field-hint">Tamaño recomendado: 475 × 166 px (formato rectangular tipo banner).</div>
            {company?.logo_url && (
              <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10 }}>
                <div className="logo-current">
                  <img src={company.logo_url} alt="Logo actual" />
                </div>
                <button type="button" className="btn btn-ghost btn-sm" onClick={quitarLogo}>
                  Quitar logo
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="card">
          <div className="section-title">Vista previa</div>
          <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 20, textAlign: "center", background: "var(--surface-2)" }}>
            <div className={company?.logo_url ? "brand-mark-logo" : "brand-mark-fallback"} style={{ margin: "0 auto 10px auto" }}>
              {company?.logo_url ? <img src={company.logo_url} alt="" /> : (company?.nombre || "C").slice(0, 1)}
            </div>
            <div style={{ fontWeight: 600 }}>{company?.nombre}</div>
            <div className="field-hint">Así se verá en el menú lateral, el inicio de sesión y los comprobantes impresos.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
