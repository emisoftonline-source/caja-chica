import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { usePeriod } from "../hooks/usePeriod";
import { ROLE_LABELS } from "../types";

const NAV = [
  { to: "/", key: "dashboard", label: "Dashboard", icon: "◧", roles: ["superadmin", "admin", "cajero"] },
  { to: "/fondos", key: "fondos", label: "Fondos", icon: "＄", roles: ["superadmin", "admin"] },
  { to: "/gastos", key: "gastos", label: "Gastos", icon: "▤", roles: ["superadmin", "admin", "cajero"] },
  { to: "/cierre", key: "cierre", label: "Cierre mensual", icon: "◐", roles: ["superadmin", "admin"] },
  { to: "/reportes", key: "reportes", label: "Rendición de Gastos", icon: "▥", roles: ["superadmin", "admin"] },
  { to: "/usuarios", key: "usuarios", label: "Usuarios", icon: "◍", roles: ["superadmin", "admin"] },
  { to: "/configuracion", key: "config", label: "Configuración", icon: "⚙", roles: ["superadmin", "admin"] },
];

export default function Layout() {
  const { profile, company, signOut } = useAuth();
  const { period } = usePeriod();
  const [menuOpen, setMenuOpen] = useState(false);
  if (!profile) return null;

  const visibleNav = NAV.filter((n) => n.roles.includes(profile.role));

  return (
    <div className="app-shell">
      <button className="mobile-menu-btn" onClick={() => setMenuOpen(true)} aria-label="Abrir menú">
        ☰
      </button>

      {menuOpen && <div className="sidebar-backdrop" onClick={() => setMenuOpen(false)} />}

      <aside className={"sidebar" + (menuOpen ? " open" : "")}>
        <div className="brand">
          {company?.logo_url ? (
            <div className="brand-mark-logo">
              <img src={company.logo_url} alt={company.nombre} />
            </div>
          ) : (
            <div className="brand-mark-fallback">{(company?.nombre || "C").slice(0, 1)}</div>
          )}
          <div>
            <div className="brand-name">{company?.nombre || "Caja Chica"}</div>
            <div className="brand-sub">Caja chica</div>
          </div>
          <button className="sidebar-close-btn" onClick={() => setMenuOpen(false)} aria-label="Cerrar menú">
            ✕
          </button>
        </div>
        <div className="nav-group-label">MENÚ</div>
        {visibleNav.map((n) => (
          <NavLink
            key={n.key}
            to={n.to}
            end={n.to === "/"}
            className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}
            onClick={() => setMenuOpen(false)}
          >
            <span className="nav-icon">{n.icon}</span>
            {n.label}
          </NavLink>
        ))}
        <div className="sidebar-foot">
          <div className="sidebar-foot-row">
            <span>{profile.full_name}</span>
            <button className="logout-btn" onClick={signOut}>
              Cerrar sesión
            </button>
          </div>
          <div style={{ marginTop: 6 }}>{ROLE_LABELS[profile.role]}</div>
        </div>
      </aside>
      <div className="main-col">
        <div className="topbar">
          <span className={"period-pill" + (period?.estado !== "abierto" ? " closed" : "")}>
            <span className="dot" />
            {period ? `${period.nombre} · ${period.estado === "abierto" ? "ABIERTO" : "CERRADO"}` : "Sin período activo"}
          </span>
        </div>
        <div className="content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
