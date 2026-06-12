"use client";

import { useEffect, useRef, useCallback } from "react";
import { X } from "lucide-react";

/** All focusable element selectors — used for focus trap */
const FOCUSABLE =
  'a[href], area[href], input:not([disabled]), select:not([disabled]), ' +
  'textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
}

export default function Modal({ open, title, onClose, children, footer, size = "md" }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  /** Trap Tab / Shift+Tab inside the modal box */
  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }

      if (e.key !== "Tab") return;

      const box = boxRef.current;
      if (!box) return;

      const focusable = Array.from(box.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => !el.closest("[aria-hidden='true']")
      );

      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        // Shift+Tab: if focus would leave the front, wrap to last
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        // Tab: if focus would leave the back, wrap to first
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [onClose]
  );

  // Attach / detach keyboard handler and manage body scroll lock
  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Focus the first focusable element (or the box itself as fallback)
    requestAnimationFrame(() => {
      const box = boxRef.current;
      if (!box) return;
      const first = box.querySelector<HTMLElement>(FOCUSABLE);
      (first ?? box).focus();
    });

    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
      // Restore focus to the element that triggered the modal
      previouslyFocused?.focus();
    };
  }, [open, handleKey]);

  // Close on overlay backdrop click (not on box click)
  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === overlayRef.current) onClose();
  };

  const maxWidthMap: Record<NonNullable<ModalProps["size"]>, string> = {
    sm: "400px",
    md: "640px",
    lg: "860px",
  };

  return (
    <div
      ref={overlayRef}
      className={`modal-overlay${open ? " open" : ""}`}
      onClick={handleOverlayClick}
      aria-modal="true"
      aria-hidden={!open}
      role="dialog"
      aria-labelledby="modal-title"
    >
      <div
        ref={boxRef}
        className="modal-box"
        tabIndex={-1}
        style={{ maxWidth: maxWidthMap[size] }}
      >
        <div className="modal-header">
          <h2 id="modal-title">{title}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
