import { createContext, useContext, useState, ReactNode } from "react";

interface ToastContextType {
  showToast: (msg: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState("");
  const [visible, setVisible] = useState(false);

  const showToast = (text: string) => {
    setMsg(text);
    setVisible(true);
    setTimeout(() => setVisible(false), 2800);
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {visible && <div className="toast">{msg}</div>}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast debe usarse dentro de <ToastProvider>");
  return ctx;
}
