import { createContext, useContext, useEffect, useState, ReactNode } from "react";

interface PrintContextType {
  printDocument: (content: ReactNode, wide?: boolean) => void;
}

const PrintContext = createContext<PrintContextType | undefined>(undefined);

// En esta aplicación, ya publicada en su propio dominio (Netlify), no
// hay ningún iframe de por medio: window.print() funciona de forma
// normal, igual que en cualquier página web.
export function PrintProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<ReactNode | null>(null);
  const [wide, setWide] = useState(false);

  const printDocument = (node: ReactNode, isWide = false) => {
    setWide(isWide);
    setContent(node);
  };

  useEffect(() => {
    if (!content) return;
    const t = setTimeout(() => window.print(), 80);
    const onAfterPrint = () => setContent(null);
    window.addEventListener("afterprint", onAfterPrint);
    return () => {
      clearTimeout(t);
      window.removeEventListener("afterprint", onAfterPrint);
    };
  }, [content]);

  return (
    <PrintContext.Provider value={{ printDocument }}>
      {children}
      <div className="print-sheet">
        <div className={"doc-container" + (wide ? " wide" : "")}>{content}</div>
      </div>
    </PrintContext.Provider>
  );
}

export function usePrint() {
  const ctx = useContext(PrintContext);
  if (!ctx) throw new Error("usePrint debe usarse dentro de <PrintProvider>");
  return ctx;
}
