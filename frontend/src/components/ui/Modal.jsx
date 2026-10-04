import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Accessible dialog on the shared .modal styles: focus moves in on
// open (to [data-autofocus] or the first control), Tab is trapped,
// Escape closes it, focus returns to the opener, and the page behind
// doesn't scroll. Backdrop clicks only close it when asked, so a
// half-written form isn't lost to a stray click. While `busy`, it
// can't be dismissed.
export default function Modal({
  eyebrow,
  title,
  description,
  onClose,
  busy = false,
  size,
  closeOnBackdrop = false,
  className = "",
  children,
}) {
  const dialogRef = useRef(null);
  const closeRef = useRef(onClose);
  const busyRef = useRef(busy);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    closeRef.current = onClose;
    busyRef.current = busy;
  });

  useEffect(() => {
    const opener = document.activeElement;
    const dialog = dialogRef.current;
    const first =
      dialog?.querySelector("[data-autofocus]") ||
      dialog?.querySelector(
        "input:not([type='hidden']):not([disabled]), textarea, select"
      ) ||
      dialog?.querySelector(FOCUSABLE);

    (first || dialog)?.focus();

    function onKeyDown(event) {
      if (event.key === "Escape" && !busyRef.current) {
        event.stopPropagation();
        closeRef.current?.();
        return;
      }

      if (event.key !== "Tab" || !dialog) return;

      const nodes = [...dialog.querySelectorAll(FOCUSABLE)];

      if (nodes.length === 0) {
        event.preventDefault();
        return;
      }

      const head = nodes[0];
      const tail = nodes[nodes.length - 1];

      if (event.shiftKey && document.activeElement === head) {
        event.preventDefault();
        tail.focus();
      } else if (!event.shiftKey && document.activeElement === tail) {
        event.preventDefault();
        head.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;

      if (opener && typeof opener.focus === "function") {
        opener.focus();
      }
    };
  }, []);

  return createPortal(
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (
          closeOnBackdrop &&
          event.target === event.currentTarget &&
          !busy
        ) {
          onClose?.();
        }
      }}
    >
      <div
        ref={dialogRef}
        className={`modal ${size === "wide" ? "modal-wide" : ""} ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
      >
        <div className="modal-header">
          <div className="modal-titles">
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            <h2 id={titleId}>{title}</h2>
            {description && (
              <p id={descriptionId} className="modal-lede">
                {description}
              </p>
            )}
          </div>

          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
          >
            <X aria-hidden="true" />
          </button>
        </div>

        {children}
      </div>
    </div>,
    document.body
  );
}
