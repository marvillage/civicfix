import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Images, X } from "lucide-react";

const MAX_TILES = 5;

// Photo mosaic (1–5 tiles) with a keyboard-friendly lightbox.
// Styles: styles/pages/issue.css.
export default function PhotoGallery({ photos, alt = "Case photo" }) {
  const [open, setOpen] = useState(null);
  const close = useCallback(() => setOpen(null), []);

  const list = [...new Set((photos || []).filter(Boolean))];

  if (list.length === 0) {
    return null;
  }

  const tiles = list.slice(0, MAX_TILES);
  const hidden = list.length - tiles.length;

  return (
    <>
      <div className={`gallery gallery-n${tiles.length}`}>
        {tiles.map((url, index) => (
          <button
            key={url}
            type="button"
            className="gallery-tile"
            onClick={() => setOpen(index)}
            title="Enlarge photo"
          >
            <img
              src={url}
              alt={
                list.length > 1
                  ? `${alt}, photo ${index + 1} of ${list.length}`
                  : alt
              }
              loading={index === 0 ? "eager" : "lazy"}
            />

            {hidden > 0 && index === tiles.length - 1 && (
              <span className="gallery-more" aria-hidden="true">
                +{hidden}
              </span>
            )}
          </button>
        ))}

        {list.length > 1 && (
          <span className="gallery-count" aria-hidden="true">
            <Images />
            {list.length}
          </span>
        )}
      </div>

      {open !== null && (
        <Lightbox
          list={list}
          index={open}
          alt={alt}
          onIndex={setOpen}
          onClose={close}
        />
      )}
    </>
  );
}

function Lightbox({ list, index, alt, onIndex, onClose }) {
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const count = list.length;

  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    function onKey(event) {
      if (event.key === "Escape") {
        onClose();
      } else if (event.key === "ArrowLeft") {
        onIndex((i) => Math.max(0, i - 1));
      } else if (event.key === "ArrowRight") {
        onIndex((i) => Math.min(count - 1, i + 1));
      } else if (event.key === "Tab") {
        // Keep focus inside the dialog.
        const focusable = [
          ...(dialogRef.current?.querySelectorAll(
            "button:not(:disabled)"
          ) ?? []),
        ];

        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [count, onClose, onIndex]);

  const label =
    count > 1 ? `${alt}, photo ${index + 1} of ${count}` : alt;

  return (
    <div
      className="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={label}
      ref={dialogRef}
      onClick={onClose}
    >
      <div
        className="lightbox-inner"
        onClick={(event) => event.stopPropagation()}
      >
        <img src={list[index]} alt={label} />

        {count > 1 && (
          <div className="lightbox-bar">
            <button
              type="button"
              className="icon-button"
              aria-label="Previous photo"
              disabled={index === 0}
              onClick={() => onIndex(index - 1)}
            >
              <ChevronLeft />
            </button>

            <span aria-live="polite">
              {index + 1} / {count}
            </span>

            <button
              type="button"
              className="icon-button"
              aria-label="Next photo"
              disabled={index === count - 1}
              onClick={() => onIndex(index + 1)}
            >
              <ChevronRight />
            </button>
          </div>
        )}
      </div>

      <button
        ref={closeRef}
        type="button"
        className="icon-button lightbox-close"
        aria-label="Close photo viewer"
        onClick={onClose}
      >
        <X />
      </button>
    </div>
  );
}
