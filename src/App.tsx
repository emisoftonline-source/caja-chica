import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { PeriodProvider } from "./hooks/usePeriod";
import { ToastProvider } from "./hooks/useToast";
import { PrintProvider } from "./hooks/usePrint";
import { RequireAuth, RequireRole } from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Fondos from "./pages/Fondos";
import Gastos from "./pages/Gastos";
import Cierre from "./pages/Cierre";
import Reportes from "./pages/Reportes";
import Usuarios from "./pages/Usuarios";
import Configuracion from "./pages/Configuracion";

function AppShell() {
  const { loading } = useAuth();
  if (loading) return <div className="full-loading">Cargando…</div>;

  return (
    <PeriodProvider>
      <PrintProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <RequireAuth>
                <Layout />
              </RequireAuth>
            }
          >
            <Route index element={<Dashboard />} />
            <Route
              path="fondos"
              element={
                <RequireRole roles={["superadmin", "admin"]}>
                  <Fondos />
                </RequireRole>
              }
            />
            <Route path="gastos" element={<Gastos />} />
            <Route
              path="cierre"
              element={
                <RequireRole roles={["superadmin", "admin"]}>
                  <Cierre />
                </RequireRole>
              }
            />
            <Route
              path="reportes"
              element={
                <RequireRole roles={["superadmin", "admin"]}>
                  <Reportes />
                </RequireRole>
              }
            />
            <Route
              path="usuarios"
              element={
                <RequireRole roles={["superadmin", "admin"]}>
                  <Usuarios />
                </RequireRole>
              }
            />
            <Route
              path="configuracion"
              element={
                <RequireRole roles={["superadmin", "admin"]}>
                  <Configuracion />
                </RequireRole>
              }
            />
          </Route>
        </Routes>
      </PrintProvider>
    </PeriodProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppShell />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
