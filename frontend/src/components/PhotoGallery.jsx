import { useState } from "react";

export default function PhotoGallery({
  photos,
  alt = "Issue photo",
}) {
  const [open, setOpen] = useState(null);

  const list = (photos || []).filter(Boolean);

  if (list.length === 0) {
    return null;
  }

  if (list.length === 1) {
    return (
      <img
        className="complaint-image"
        src={list[0]}
        alt={alt}
      />
    );
  }

  return (
    <>
      <div className="photo-grid">
        {list.map((url, index) => (
          <button
            key={url}
            type="button"
            className="photo-thumb"
            onClick={() => setOpen(index)}
            aria-label={`Open photo ${index + 1} of ${list.length}`}
          >
            <img src={url} alt={`${alt} ${index + 1}`} />
          </button>
        ))}
      </div>

      {open !== null && (
        <div
          className="modal-backdrop"
          onClick={() => setOpen(null)}
        >
          <div className="lightbox">
            <img
              src={list[open]}
              alt={`${alt} ${open + 1}`}
            />

            <div className="lightbox-controls">
              <button
                type="button"
                disabled={open === 0}
                onClick={(event) => {
                  event.stopPropagation();
                  setOpen(open - 1);
                }}
              >
                ← Prev
              </button>

              <span>
                {open + 1} / {list.length}
              </span>

              <button
                type="button"
                disabled={open === list.length - 1}
                onClick={(event) => {
                  event.stopPropagation();
                  setOpen(open + 1);
                }}
              >
                Next →
              </button>

              <button
                type="button"
                onClick={() => setOpen(null)}
              >
                ✕ Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
