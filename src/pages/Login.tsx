import { FormEvent, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";
import { friendlyError } from "../lib/format";

export default function Login() {
  const { signIn, profile } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

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
        <div className="login-logo-fallback">C</div>
        <div className="login-title">Caja Chica</div>
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
