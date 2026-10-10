import { FormEvent, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";
import { friendlyError } from "../lib/format";
import { Company } from "../types";

export default function Login() {
  const { signIn, profile } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [company, setCompany] = useState<Company | null>(null);

  // Antes de iniciar sesión todavía no sabemos a qué empresa pertenece
  // quien está entrando, así que mostramos la primera (y normalmente
  // única) empresa registrada — es la misma que se configura en
  // Configuración, con su nombre y su logo.
  useEffect(() => {
    let active = true;
    supabase
      .from("companies")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (active) setCompany((data as Company) || null);
      });
    return () => {
      active = false;
    };
  }, []);

  if (profile) return <Navigate to="/" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await signIn(email.trim(), password);
    setLoading(false);
    if (error) setError(friendlyError({ message: error }));
  };

  const handleReset = async () => {
    if (!email.trim()) {
      setError("Escribe tu correo para enviarte el enlace de recuperación.");
      return;
    }
    await supabase.auth.resetPasswordForEmail(email.trim());
    setResetSent(true);
  };

  return (
    <div className="login-wrap">
      <div className="login-card">
        {company?.logo_url ? (
          <div className="brand-mark-logo" style={{ margin: "0 auto 14px auto", width: 142, height: 50 }}>
            <img src={company.logo_url} alt={company.nombre} />
          </div>
        ) : (
          <div className="login-logo-fallback">{(company?.nombre || "C").slice(0, 1)}</div>
        )}
        <div className="login-title">{company?.nombre || "Caja Chica"}</div>
        <div className="login-sub">Ingresa a tu cuenta</div>
        <form onSubmit={submit}>
          {error && <div className="field-error">{error}</div>}
          {resetSent && (
            <div className="field-error" style={{ color: "var(--positive)", background: "var(--positive-wash)" }}>
              Si el correo existe, te enviamos un enlace para restablecer tu contraseña.
            </div>
          )}
          <div className="field">
            <label>Correo electrónico</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </div>
          <div className="field">
            <label>Contraseña</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button className="btn btn-primary btn-block" type="submit" disabled={loading}>
            {loading ? "Ingresando…" : "Iniciar sesión"}
          </button>
        </form>
        <button className="btn btn-ghost btn-sm" style={{ width: "100%", marginTop: 10 }} onClick={handleReset}>
          ¿Olvidaste tu contraseña?
        </button>
      </div>
    </div>
  );
}
