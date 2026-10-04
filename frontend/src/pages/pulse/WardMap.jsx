import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useTheme } from "../../context/theme";

// Ward bubbles: area ∝ open cases, color = scorecard grade (status
// palette, always paired with the grade letter in the label).
const GRADE_TOKEN = {
  A: "--status-good",
  B: "--status-good",
  C: "--status-warn",
  D: "--status-serious",
  F: "--status-critical",
};

function cssVar(name) {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}

export default function WardMap({ wards, selectedId, onSelect, height = 360 }) {
  const nodeRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const fittedRef = useRef("");
  const { theme } = useTheme();

  useEffect(() => {
    const map = L.map(nodeRef.current, {
      zoomControl: true,
      scrollWheelZoom: false,
      attributionControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: "© OpenStreetMap contributors",
    }).addTo(map);

    map.setView([28.64, 77.21], 12);
    mapRef.current = map;
    layerRef.current = L.layerGroup().addTo(map);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;

    if (!map || !layer) return;

    layer.clearLayers();

    const placed = wards.filter(
      (ward) => Number.isFinite(ward.lat) && Number.isFinite(ward.lng)
    );

    if (placed.length === 0) return;

    const maxOpen = Math.max(1, ...placed.map((ward) => ward.open || 0));
    const surface = cssVar("--chart-surface") || "#fff";
    const ink = cssVar("--navy-900") || "#0a1730";

    for (const ward of placed) {
      const color = cssVar(GRADE_TOKEN[ward.grade] ?? "--series-other");
      const selected = ward.id === selectedId;
      const radius = 9 + 15 * Math.sqrt((ward.open || 0) / maxOpen);

      const circle = L.circleMarker([ward.lat, ward.lng], {
        radius,
        color: selected ? ink : surface,
        weight: selected ? 3 : 2,
        fillColor: color,
        fillOpacity: 0.78,
      });

      circle.bindTooltip(
        `<strong>${escapeHtml(ward.name)}</strong> · grade ${ward.grade ?? "–"}<br>${ward.open} open of ${ward.total}`,
        { direction: "top", offset: [0, -radius] }
      );
      circle.on("click", () => onSelect?.(ward.id));
      circle.addTo(layer);

      L.marker([ward.lat, ward.lng], {
        interactive: false,
        icon: L.divIcon({
          className: "ward-grade-label",
          html: `<span>${ward.grade ?? "–"}</span>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        }),
      }).addTo(layer);
    }

    // Re-frame only when the set of wards changes, not on selection,
    // so the reader's own zoom/pan is kept.
    const fitKey = placed.map((ward) => ward.id).join("|");

    if (fittedRef.current !== fitKey) {
      fittedRef.current = fitKey;
      map.fitBounds(
        L.latLngBounds(placed.map((ward) => [ward.lat, ward.lng])).pad(0.12),
        { maxZoom: 15 }
      );
    }
    // Colors are read from CSS variables, so redraw on theme change.
  }, [wards, selectedId, onSelect, theme]);

  return (
    <div className="map-frame ward-map" style={{ height }}>
      <div ref={nodeRef} style={{ height: "100%" }} />
    </div>
  );
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
