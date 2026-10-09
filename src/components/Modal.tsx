import { ReactNode } from "react";

interface ModalProps {
  title: string;
  children: ReactNode;
  onCancel: () => void;
  onConfirm?: () => void;
  confirmLabel?: string;
  confirmTone?: "primary" | "danger";
  cancelLabel?: string;
}

export default function Modal({
  title,
  children,
  onCancel,
  onConfirm,
  confirmLabel,
  confirmTone = "primary",
  cancelLabel,
}: ModalProps) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        <div>{children}</div>
        <div className="modal-actions">
          <button className="btn" onClick={onCancel}>
            {cancelLabel || "Cancelar"}
          </button>
          {onConfirm && (
            <button
              className={"btn " + (confirmTone === "danger" ? "btn-danger" : "btn-primary")}
              onClick={onConfirm}
            >
              {confirmLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
