import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { CITY_CENTER, cssVar } from "./helpers";

// Leaflet renders tooltip strings as HTML; labels can hold
// user-written text (case titles), so always pass a text node.
function textNode(text) {
  const node = document.createElement("span");
  node.textContent = text;
  return node;
}

// Small reusable Leaflet map.
//
// markers: [{ id, lat, lng, label?, tone?: "accent" | "navy" | "dot", color? }]
//   ("dot" draws a small round marker filled with `color`)
// circles: [{ id, lat, lng, radius, label?, active?, draft?, muted? }]
// onPick(lat, lng): turns on click-to-pick (crosshair cursor)
// onSelect(id): called when a circle is clicked
// fitKey: the map re-fits to its shapes whenever this value changes
//   (defaults to the shapes themselves). Pickers pass a key that
//   ignores the picked point so the map doesn't jump on each click.
// focusId: fit to that one circle instead of everything.
//
// Colors come from CSS custom properties, so circles follow the
// light/dark theme; the map redraws when <html data-theme> changes.
export default function MiniMap({
  center = CITY_CENTER,
  zoom = 14,
  markers = [],
  circles = [],
  onPick,
  onSelect,
  fitKey,
  focusId,
  height = 320,
  label = "Map",
  pickHint,
  className = "",
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const handlers = useRef({ onPick, onSelect });
  const initialView = useRef({ center, zoom });
  const [theme, setTheme] = useState(
    () => document.documentElement.dataset.theme || ""
  );

  useEffect(() => {
    handlers.current = { onPick, onSelect };
  });

  // Create the map once; tear it down on unmount.
  useEffect(() => {
    const node = containerRef.current;

    if (!node) return undefined;

    const map = L.map(node, {
      center: initialView.current.center,
      zoom: initialView.current.zoom,
      scrollWheelZoom: false,
    });

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    layerRef.current = L.layerGroup().addTo(map);

    map.on("click", (event) => {
      handlers.current.onPick?.(event.latlng.lat, event.latlng.lng);
    });

    const resize = new ResizeObserver(() => map.invalidateSize());
    resize.observe(node);

    mapRef.current = map;

    return () => {
      resize.disconnect();
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  // Redraw shapes when the theme flips (colors are read from CSS).
  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() =>
      setTheme(root.dataset.theme || "")
    );

    observer.observe(root, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const layer = layerRef.current;

    if (!layer) return;

    layer.clearLayers();

    const base = cssVar("--series-1");
    const accent = cssVar("--accent");
    const surface = cssVar("--surface");
    const ink = cssVar("--navy-900");
    const muted = cssVar("--series-other");

    circles.forEach((shape) => {
      const highlight = shape.active || shape.draft;
      const stroke = highlight ? accent : shape.muted ? muted : base;

      const circle = L.circle([shape.lat, shape.lng], {
        radius: shape.radius,
        color: stroke,
        weight: highlight ? 3 : 2,
        opacity: shape.muted ? 0.85 : 0.95,
        fillColor: stroke,
        fillOpacity: highlight ? 0.2 : shape.muted ? 0.06 : 0.1,
        dashArray: shape.draft ? "8 6" : null,
        bubblingMouseEvents: false,
        // Muted and draft circles let clicks through to the map, so
        // picking a point inside another zone still works.
        interactive: !shape.draft && !shape.muted,
      });

      if (shape.label) {
        circle.bindTooltip(textNode(shape.label), {
          direction: "top",
          className: "mini-map-tip",
        });
      }

      if (shape.id && !shape.draft && !shape.muted) {
        circle.on("click", () => handlers.current.onSelect?.(shape.id));
      }

      circle.addTo(layer);

      L.circleMarker([shape.lat, shape.lng], {
        radius: 5,
        color: surface,
        weight: 2,
        fillColor: highlight ? ink : stroke,
        fillOpacity: 1,
        interactive: false,
      }).addTo(layer);
    });

    markers.forEach((point) => {
      const dot = point.tone === "dot";
      const marker = L.marker([point.lat, point.lng], {
        icon: dot
          ? L.divIcon({
              className: "mini-dot",
              // color is a CSS value such as var(--series-3)
              html: `<span style="background:${point.color ?? "var(--series-1)"}"></span>`,
              iconSize: [16, 16],
              iconAnchor: [8, 8],
            })
          : L.divIcon({
              className: `mini-pin mini-pin-${point.tone ?? "accent"}`,
              html: "<span></span>",
              iconSize: [30, 38],
              iconAnchor: [15, 36],
            }),
        keyboard: false,
        interactive: !!point.label,
      });

      if (point.label) {
        marker.bindTooltip(textNode(point.label), {
          direction: "top",
          offset: dot ? [0, -8] : [0, -34],
          className: "mini-map-tip",
        });
      }

      marker.addTo(layer);
    });
  }, [circles, markers, theme]);

  const shapeKey = useMemo(
    () =>
      JSON.stringify([
        circles.map((c) => [c.lat, c.lng, c.radius]),
        markers.map((m) => [m.lat, m.lng]),
      ]),
    [circles, markers]
  );

  const viewKey = fitKey ?? shapeKey;
  const latest = useRef({ circles, markers, focusId, zoom });

  useEffect(() => {
    latest.current = { circles, markers, focusId, zoom };
  });

  // Fit the view to the shapes when the key changes (only then,
  // not on every redraw).
  useEffect(() => {
    const map = mapRef.current;
    const { circles, markers, focusId, zoom } = latest.current;

    if (!map) return;

    const bounds = L.latLngBounds([]);
    const focused = focusId
      ? circles.filter((shape) => shape.id === focusId)
      : [];
    const fitCircles = focused.length ? focused : circles;
    const fitMarkers = focused.length ? [] : markers;

    fitCircles.forEach((shape) => {
      bounds.extend(L.latLng(shape.lat, shape.lng).toBounds(shape.radius * 2));
    });

    fitMarkers.forEach((point) => bounds.extend([point.lat, point.lng]));

    if (!bounds.isValid()) return;

    if (fitCircles.length === 0 && fitMarkers.length === 1) {
      map.setView([markers[0].lat, markers[0].lng], Math.max(zoom, 15));
      return;
    }

    map.fitBounds(bounds, { padding: [28, 28], maxZoom: 16 });
  }, [viewKey]);

  return (
    <div
      className={`map-frame mini-map ${onPick ? "is-picking" : ""} ${className}`}
    >
      <div
        ref={containerRef}
        className="mini-map-canvas"
        style={{ height, minHeight: height }}
        role="application"
        aria-label={label}
      />

      {pickHint && (
        <p className="mini-map-hint" aria-hidden="true">
          {pickHint}
        </p>
      )}
    </div>
  );
}
