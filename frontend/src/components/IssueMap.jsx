import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.heat";
import { CATEGORY_META, STATUS_LABEL } from "../lib/labels";
import { useTheme } from "../context/theme";

// Leaflet map of cases. Pins are road-sign diamonds colored by
// category (the same --series-* color the charts use); popups and
// the "near me" ring are themed in styles/pages/issue.css.
//
// Props: issues, linkBase ("/issues"), heat (Hotspots view),
// center ({ lat, lng } — "you are here"), radius (metres, draws the
// search ring), height, label.

const INDIA = [20.5937, 78.9629];

const ESCAPES = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

function categoryKey(category) {
  return CATEGORY_META[category] ? category : "OTHER";
}

function pinIcon(issue) {
  const cat = categoryKey(issue.category);

  return L.divIcon({
    className: "issue-pin-wrap",
    html: `<span class="issue-pin cat-${cat}${
      issue.isEmergency ? " is-alert" : ""
    }"><span></span></span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -16],
  });
}

function popupHtml(issue, linkBase) {
  const cat = categoryKey(issue.category);
  const backers = issue._count?.upvotes ?? 0;
  const status = STATUS_LABEL[issue.status] ?? issue.status ?? "";

  return `<div class="map-pop">
    <span class="map-pop-cat"><span class="cat-dot cat-${cat}"></span>${esc(
      CATEGORY_META[cat].label
    )}${issue.isEmergency ? ' <span class="map-pop-alert">Red Alert</span>' : ""}</span>
    <a class="map-pop-title" data-route href="${esc(
      `${linkBase}/${issue.id}`
    )}">${esc(issue.title || "Untitled case")}</a>
    <span class="map-pop-meta">${esc(status)} · ${backers} backer${
      backers === 1 ? "" : "s"
    }</span>
  </div>`;
}

// leaflet.heat paints on canvas, so it needs literal colors:
// read the warm ramp from the design tokens.
function heatGradient() {
  const css = getComputedStyle(document.documentElement);
  const stops = {
    0.3: "--yellow-400",
    0.55: "--series-2",
    0.8: "--series-4",
    1: "--status-critical",
  };

  const gradient = {};

  for (const [stop, token] of Object.entries(stops)) {
    const value = css.getPropertyValue(token).trim();
    if (value) gradient[stop] = value;
  }

  return Object.keys(gradient).length ? gradient : undefined;
}

export default function IssueMap({
  issues,
  linkBase = "/issues",
  heat = false,
  center = null,
  radius = null,
  height = 460,
  label = "Map of reported cases",
  className = "",
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  const { theme } = useTheme();

  useEffect(() => {
    navigateRef.current = navigate;
  }, [navigate]);

  // Create the map once.
  useEffect(() => {
    const node = containerRef.current;

    if (!node || mapRef.current) {
      return undefined;
    }

    const map = L.map(node, {
      center: INDIA,
      zoom: 5,
      scrollWheelZoom: false,
    });

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    // Popup links navigate inside the app instead of reloading.
    map.on("popupopen", (event) => {
      const link = event.popup
        .getElement()
        ?.querySelector("a[data-route]");

      if (!link) return;

      link.onclick = (clickEvent) => {
        if (
          clickEvent.button !== 0 ||
          clickEvent.metaKey ||
          clickEvent.ctrlKey ||
          clickEvent.shiftKey
        ) {
          return;
        }

        clickEvent.preventDefault();
        navigateRef.current(link.getAttribute("href"));
      };
    });

    // Wheel zoom only after the map is clicked, so the page scrolls.
    map.on("click", () => map.scrollWheelZoom.enable());
    map.on("mouseout", () => map.scrollWheelZoom.disable());

    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(node);

    mapRef.current = map;

    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  // Draw pins / heat / "near me" ring.
  useEffect(() => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    layerRef.current?.remove();

    const group = L.featureGroup().addTo(map);
    layerRef.current = group;

    const points = (issues || []).filter(
      (issue) =>
        issue &&
        Number.isFinite(issue.latitude) &&
        Number.isFinite(issue.longitude)
    );

    if (heat) {
      const weight = { LOW: 0.45, MEDIUM: 0.65, HIGH: 0.85, CRITICAL: 1 };

      L.heatLayer(
        points.map((issue) => [
          issue.latitude,
          issue.longitude,
          weight[issue.severity] ?? 0.6,
        ]),
        {
          radius: 34,
          blur: 24,
          maxZoom: 16,
          minOpacity: 0.4,
          max: 0.6,
          gradient: heatGradient(),
        }
      ).addTo(group);
    } else {
      points.forEach((issue) => {
        L.marker([issue.latitude, issue.longitude], {
          icon: pinIcon(issue),
          title: issue.title || "Case",
          alt: issue.title || "Case",
          riseOnHover: true,
          zIndexOffset: issue.isEmergency ? 500 : 0,
        })
          .bindPopup(popupHtml(issue, linkBase), {
            className: "map-popup",
            maxWidth: 260,
          })
          .addTo(group);
      });
    }

    let ring = null;
    const hasCenter =
      center && Number.isFinite(center.lat) && Number.isFinite(center.lng);

    if (hasCenter) {
      L.marker([center.lat, center.lng], {
        icon: L.divIcon({
          className: "issue-pin-wrap",
          html: '<span class="you-pin"></span>',
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        }),
        interactive: false,
        keyboard: false,
        title: "You are here",
        zIndexOffset: 1000,
      }).addTo(group);

      if (radius) {
        ring = L.circle([center.lat, center.lng], {
          radius,
          className: "radar-ring",
          weight: 2,
          interactive: false,
        }).addTo(group);
      }
    }

    if (ring) {
      map.fitBounds(ring.getBounds(), { padding: [24, 24] });
    } else if (points.length > 1) {
      map.fitBounds(
        L.latLngBounds(points.map((i) => [i.latitude, i.longitude])),
        { padding: [40, 40], maxZoom: 15 }
      );
    } else if (points.length === 1) {
      map.setView([points[0].latitude, points[0].longitude], 15);
    } else if (hasCenter) {
      map.setView([center.lat, center.lng], 15);
    }
  }, [issues, heat, linkBase, center, radius, theme]);

  return (
    <div
      className={`map-frame issue-map ${className}`}
      style={{ height }}
    >
      <div
        ref={containerRef}
        className="issue-map-canvas"
        role="region"
        aria-label={label}
      />

      {heat && (
        <div className="map-heat-legend" aria-hidden="true">
          <span>Fewer</span>
          <span className="map-heat-ramp" />
          <span>More reports</span>
        </div>
      )}
    </div>
  );
}
