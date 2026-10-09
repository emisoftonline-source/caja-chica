import { Navigate } from "react-router-dom";
import { ReactNode } from "react";
import { useAuth } from "../hooks/useAuth";
import { UserRole } from "../types";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { loading, profile } = useAuth();
  if (loading) return <div className="full-loading">Cargando…</div>;
  if (!profile) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function RequireRole({ roles, children }: { roles: UserRole[]; children: ReactNode }) {
  const { profile } = useAuth();
  if (!profile) return null;
  if (!roles.includes(profile.role)) {
    return (
      <div className="card">
        <div className="page-title">Acceso restringido</div>
        <p className="page-sub">Tu rol no tiene permiso para ver esta sección.</p>
      </div>
    );
  }
  return <>{children}</>;
}
