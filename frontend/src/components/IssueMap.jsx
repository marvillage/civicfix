import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.heat";

const SEVERITY_COLORS = {
  LOW: "#4caf6d",
  MEDIUM: "#d9a253",
  HIGH: "#e0742f",
  CRITICAL: "#e5484d",
};

function markerIcon(severity) {
  const color =
    SEVERITY_COLORS[severity] || "#43a896";

  return L.divIcon({
    className: "issue-marker",
    html: `<span style="background:${color}"></span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -10],
  });
}

export default function IssueMap({
  issues,
  linkBase = "/issues",
  heat = false,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const heatRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    const map = L.map(containerRef.current, {
      center: [20.5937, 78.9629],
      zoom: 5,
      scrollWheelZoom: true,
    });

    L.tileLayer(
      "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }
    ).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    markersRef.current.forEach((marker) =>
      marker.remove()
    );
    markersRef.current = [];

    if (heatRef.current) {
      heatRef.current.remove();
      heatRef.current = null;
    }

    const points = (issues || []).filter(
      (issue) =>
        Number.isFinite(issue.latitude) &&
        Number.isFinite(issue.longitude)
    );

    if (heat) {
      const weight = {
        LOW: 0.4,
        MEDIUM: 0.6,
        HIGH: 0.85,
        CRITICAL: 1,
      };

      heatRef.current = L.heatLayer(
        points.map((issue) => [
          issue.latitude,
          issue.longitude,
          weight[issue.severity] || 0.6,
        ]),
        {
          radius: 32,
          blur: 22,
          maxZoom: 16,
        }
      ).addTo(map);
    } else {
      points.forEach((issue) => {
        const marker = L.marker(
          [issue.latitude, issue.longitude],
          { icon: markerIcon(issue.severity) }
        ).addTo(map);

        const status = (issue.status || "")
          .replace(/_/g, " ")
          .toLowerCase();

        marker.bindPopup(
          `<strong>${issue.title}</strong><br>` +
            `<small>${issue.category?.replace(/_/g, " ") || ""} · ${status}</small><br>` +
            `<a href="${linkBase}/${issue.id}">View issue →</a>`
        );

        markersRef.current.push(marker);
      });
    }

    if (points.length > 0) {
      const bounds = L.latLngBounds(
        points.map((issue) => [
          issue.latitude,
          issue.longitude,
        ])
      );

      map.fitBounds(bounds, {
        padding: [40, 40],
        maxZoom: 15,
      });
    }
  }, [issues, heat, linkBase]);

  return (
    <div
      ref={containerRef}
      className="issue-map"
      role="application"
      aria-label="Map of reported issues"
    />
  );
}
