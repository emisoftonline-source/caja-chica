import { FormEvent, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { supabaseAdminClient } from "../lib/supabaseAdminClient";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/useToast";
import { Profile, UserRole, ROLE_LABELS } from "../types";
import { friendlyError } from "../lib/format";
import Modal from "../components/Modal";

function NewUserForm({
  currentRole,
  onCreated,
  onCancel,
}: {
  currentRole: UserRole | undefined;
  onCreated: () => void;
  onCancel: () => void;
}) {
  const { showToast } = useToast();
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [rol, setRol] = useState<UserRole>("cajero");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Solo un Super Administrador puede elegir el rol del usuario que crea
  // (y es la única función, fn_set_user_role, que puede aplicarlo). Un
  // Administrador no ve este selector: todo usuario que cree queda como
  // Cajero, igual que exige la base de datos.
  const puedeElegirRol = currentRole === "superadmin";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!nombre.trim() || !email.trim() || !password.trim()) {
      setError("Completa todos los campos obligatorios.");
      return;
    }
    if (password.trim().length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    setSaving(true);
    // Se usa el cliente secundario (sin sesión persistente) para que
    // registrar a este nuevo usuario no reemplace la sesión del
    // administrador que está haciendo la operación. Nota de seguridad:
    // el "role" que se manda aquí como metadata es solo informativo —
    // la base de datos (handle_new_user) lo ignora por completo y
    // siempre crea al usuario como Cajero. El rol real, si corresponde
    // otro, se aplica justo abajo con fn_set_user_role, que sí está
    // protegida y solo funciona si quien la ejecuta es Super Administrador.
    const { data: signUpData, error: signUpError } = await supabaseAdminClient.auth.signUp({
      email: email.trim(),
      password: password.trim(),
      options: { data: { full_name: nombre.trim() } },
    });
    if (signUpError) {
      setSaving(false);
      setError(friendlyError(signUpError));
      return;
    }

    if (puedeElegirRol && rol !== "cajero" && signUpData.user) {
      const { error: roleError } = await supabase.rpc("fn_set_user_role", {
        p_user_id: signUpData.user.id,
        p_role: rol,
      });
      if (roleError) {
        setSaving(false);
        // El usuario ya quedó creado (como Cajero); se informa el problema
        // al asignar el rol para que se corrija luego desde la lista.
        setError("Usuario creado como Cajero, pero no se pudo asignar el rol elegido: " + friendlyError(roleError));
        onCreated();
        return;
      }
    }

    setSaving(false);
    showToast("Usuario creado. Ya puede ingresar con su correo y contraseña.");
    onCreated();
  };

  return (
    <form onSubmit={submit}>
      {error && <div className="field-error">{error}</div>}
      <div className="field">
        <label>Nombre completo</label>
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} required />
      </div>
      <div className="field">
        <label>Correo electrónico</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div className="field pw-field" style={{ position: "relative" }}>
        <label>Contraseña de acceso</label>
        <input type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" required />
        <button type="button" className="pw-toggle" onClick={() => setShowPw(!showPw)}>
          {showPw ? "Ocultar" : "Ver"}
        </button>
      </div>
      {puedeElegirRol ? (
        <div className="field">
          <label>Rol</label>
          <select value={rol} onChange={(e) => setRol(e.target.value as UserRole)}>
            <option value="cajero">Cajero</option>
            <option value="admin">Administrador</option>
            <option value="superadmin">Super Administrador</option>
          </select>
        </div>
      ) : (
        <div className="field-hint" style={{ marginBottom: 13 }}>
          Este usuario se crea con el rol Cajero. Solo un Super Administrador puede asignar otros roles.
        </div>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn btn-primary btn-block" type="submit" disabled={saving}>
          {saving ? "Creando…" : "Crear usuario"}
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function EditUserRow({
  user,
  puedeAsignarRol,
  onSave,
  onCancel,
}: {
  user: Profile;
  puedeAsignarRol: boolean;
  onSave: (nombre: string, rol: UserRole) => void;
  onCancel: () => void;
}) {
  const [nombre, setNombre] = useState(user.full_name);
  const [rol, setRol] = useState<UserRole>(user.role);

  return (
    <tr>
      <td colSpan={5}>
        <div className="edit-row-inputs">
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre" style={{ minWidth: 150 }} />
          {puedeAsignarRol ? (
            <select value={rol} onChange={(e) => setRol(e.target.value as UserRole)}>
              <option value="cajero">Cajero</option>
              <option value="admin">Administrador</option>
              <option value="superadmin">Super Administrador</option>
            </select>
          ) : (
            <span className="field-hint" style={{ margin: 0 }}>
              Rol: {ROLE_LABELS[user.role]}
            </span>
          )}
          <button className="btn btn-primary btn-sm" onClick={() => onSave(nombre.trim(), rol)}>
            Guardar
          </button>
          <button className="btn btn-sm" onClick={onCancel}>
            Cancelar
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function Usuarios() {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [toToggle, setToToggle] = useState<Profile | null>(null);
  const [toPassword, setToPassword] = useState<Profile | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [showNewPw, setShowNewPw] = useState(false);
  const [pwError, setPwError] = useState("");

  const closePasswordModal = () => {
    setToPassword(null);
    setNewPassword("");
    setShowNewPw(false);
    setPwError("");
  };

  const puedeAsignarRolYEstado = profile?.role === "superadmin";

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("profiles").select("*").order("created_at", { ascending: true });
    setUsers((data as Profile[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const saveEdit = async (userId: string, nombre: string, rol: UserRole) => {
    const { error: nameErr } = await supabase.rpc("fn_admin_update_profile", { p_user_id: userId, p_full_name: nombre });
    if (nameErr) {
      showToast(friendlyError(nameErr));
      return;
    }
    const current = users.find((u) => u.id === userId);
    if (puedeAsignarRolYEstado && current && current.role !== rol) {
      const { error: roleErr } = await supabase.rpc("fn_set_user_role", { p_user_id: userId, p_role: rol });
      if (roleErr) {
        showToast(friendlyError(roleErr));
        setEditingId(null);
        load();
        return;
      }
    }
    showToast("Usuario actualizado");
    setEditingId(null);
    load();
  };

  const confirmToggle = async () => {
    if (!toToggle) return;
    const nextActive = toToggle.active === false;
    const { error } = await supabase.rpc("fn_set_user_active", { p_user_id: toToggle.id, p_active: nextActive });
    if (error) {
      showToast(friendlyError(error));
    } else {
      showToast(nextActive ? "Usuario habilitado" : "Usuario inhabilitado. Ya no podrá iniciar sesión.");
      load();
    }
    setToToggle(null);
  };

  const confirmPassword = async () => {
    if (!toPassword) return;
    if (newPassword.length < 6) {
      setPwError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    const { error } = await supabase.rpc("fn_admin_set_password", {
      p_user_id: toPassword.id,
      p_new_password: newPassword,
    });
    if (error) {
      setPwError(friendlyError(error));
      return;
    }
    showToast("Contraseña de " + toPassword.full_name + " actualizada. Ya puede ingresar con la nueva.");
    closePasswordModal();
  };

  return (
    <div>
      <div className="page-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 10 }}>
        <div>
          <h1 className="page-title">Usuarios</h1>
          <p className="page-sub">
            Creación, accesos y asignación de roles.{" "}
            {puedeAsignarRolYEstado && "Como Super Administrador, también puedes inhabilitar usuarios."}
          </p>
        </div>
        {!showForm && (
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            + Registrar usuario
          </button>
        )}
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 16, maxWidth: 460 }}>
          <div className="section-title">Nuevo usuario</div>
          <NewUserForm
            currentRole={profile?.role}
            onCreated={() => {
              setShowForm(false);
              load();
            }}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Correo</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5} className="empty-state">
                    Cargando…
                  </td>
                </tr>
              )}
              {!loading &&
                users.map((u) =>
                  editingId === u.id ? (
                    <EditUserRow
                      key={u.id}
                      user={u}
                      puedeAsignarRol={puedeAsignarRolYEstado}
                      onCancel={() => setEditingId(null)}
                      onSave={(nombre, rol) => saveEdit(u.id, nombre, rol)}
                    />
                  ) : (
                    <tr key={u.id} style={u.active === false ? { opacity: 0.6 } : undefined}>
                      <td>{u.full_name}</td>
                      <td className="mono">{u.email}</td>
                      <td>{ROLE_LABELS[u.role]}</td>
                      <td>
                        {u.active === false ? (
                          <span className="badge badge-anulado">Inhabilitado</span>
                        ) : (
                          <span className="badge badge-activo">● Activo</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => setEditingId(u.id)}>
                            Editar
                          </button>
                          {puedeAsignarRolYEstado && u.id !== profile?.id && (
                            <button className="btn btn-ghost btn-sm" onClick={() => setToPassword(u)}>
                              Cambiar contraseña
                            </button>
                          )}
                          {puedeAsignarRolYEstado &&
                            u.id !== profile?.id &&
                            (u.active === false ? (
                              <button className="btn btn-ghost btn-sm" onClick={() => setToToggle(u)}>
                                Habilitar
                              </button>
                            ) : (
                              <button className="btn btn-ghost btn-sm" style={{ color: "var(--negative)" }} onClick={() => setToToggle(u)}>
                                Inhabilitar
                              </button>
                            ))}
                        </div>
                      </td>
                    </tr>
                  )
                )}
            </tbody>
          </table>
        </div>
      </div>

      {toPassword && (
        <Modal
          title={"Cambiar contraseña de " + toPassword.full_name}
          onCancel={closePasswordModal}
          onConfirm={confirmPassword}
          confirmLabel="Guardar contraseña"
          confirmTone="primary"
        >
          <p>Escribe la nueva contraseña y compártela con el usuario. Si tenía una sesión abierta, se cerrará.</p>
          {pwError && <div className="field-error">{pwError}</div>}
          <div className="field pw-field" style={{ position: "relative" }}>
            <label>Nueva contraseña</label>
            <input
              type={showNewPw ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              autoFocus
            />
            <button type="button" className="pw-toggle" onClick={() => setShowNewPw(!showNewPw)}>
              {showNewPw ? "Ocultar" : "Ver"}
            </button>
          </div>
        </Modal>
      )}

      {toToggle && (
        <Modal
          title={(toToggle.active === false ? "¿Habilitar a " : "¿Inhabilitar a ") + toToggle.full_name + "?"}
          onCancel={() => setToToggle(null)}
          onConfirm={confirmToggle}
          confirmLabel={toToggle.active === false ? "Habilitar usuario" : "Inhabilitar usuario"}
          confirmTone={toToggle.active === false ? "primary" : "danger"}
        >
          <p>
            {toToggle.active === false
              ? "Podrá volver a iniciar sesión normalmente."
              : "No podrá iniciar sesión hasta que un Super Administrador lo vuelva a habilitar. Su historial de registros no se ve afectado."}
          </p>
        </Modal>
      )}
    </div>
  );
}
