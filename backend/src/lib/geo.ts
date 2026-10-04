// ─────────────────────────────────────────────
// GEO HELPERS
// Great-circle distance and circle containment for small
// city-scale radii (metres). Pure functions, no I/O.
// ─────────────────────────────────────────────

export const EARTH_RADIUS_M = 6_371_000;

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

// ~0.1 mm: keeps points exactly on the circle's edge inside the
// box despite floating-point rounding.
const EDGE_PADDING_DEG = 1e-9;

const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

// Haversine distance between two coordinates, in metres.
export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
) {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(Math.min(1, a)));
}

export function distanceMeters(a: GeoPoint, b: GeoPoint) {
  return haversineMeters(
    a.latitude,
    a.longitude,
    b.latitude,
    b.longitude
  );
}

// Is the point inside (or on the edge of) the circle?
export function isInsideCircle(
  point: GeoPoint,
  center: GeoPoint,
  radiusM: number
) {
  return distanceMeters(point, center) <= radiusM;
}

// A lat/lng rectangle that fully contains the circle. Cheap to
// express as a database range filter, so queries prefilter with
// it and then confirm with the exact haversine distance.
// Near the poles or across the antimeridian it widens to every
// longitude rather than risk missing a match.
export function boundingBox(
  center: GeoPoint,
  radiusM: number
): BoundingBox {
  const angular = radiusM / EARTH_RADIUS_M;
  const latDelta = toDeg(angular) + EDGE_PADDING_DEG;
  const minLat = Math.max(-90, center.latitude - latDelta);
  const maxLat = Math.min(90, center.latitude + latDelta);

  // Widest longitude reach of the circle (exact, not the
  // small-angle approximation, so the box never undershoots).
  const ratio = Math.sin(angular) / Math.cos(toRad(center.latitude));

  if (minLat <= -90 || maxLat >= 90 || !(ratio < 1)) {
    return { minLat, maxLat, minLng: -180, maxLng: 180 };
  }

  const lngDelta = toDeg(Math.asin(ratio)) + EDGE_PADDING_DEG;
  const minLng = center.longitude - lngDelta;
  const maxLng = center.longitude + lngDelta;

  if (minLng < -180 || maxLng > 180) {
    return { minLat, maxLat, minLng: -180, maxLng: 180 };
  }

  return { minLat, maxLat, minLng, maxLng };
}
