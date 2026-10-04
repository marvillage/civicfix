import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  boundingBox,
  distanceMeters,
  EARTH_RADIUS_M,
  GeoPoint,
  haversineMeters,
  isInsideCircle,
} from "../src/lib/geo";

// The point `distance` metres from `from` along `bearingDeg`
// (spherical destination formula), for building test circles.
function destination(
  from: GeoPoint,
  distance: number,
  bearingDeg: number
): GeoPoint {
  const rad = Math.PI / 180;
  const angular = distance / EARTH_RADIUS_M;
  const bearing = bearingDeg * rad;
  const lat1 = from.latitude * rad;
  const lng1 = from.longitude * rad;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angular) +
      Math.cos(lat1) * Math.sin(angular) * Math.cos(bearing)
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angular) * Math.cos(lat1),
      Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2)
    );

  return { latitude: lat2 / rad, longitude: lng2 / rad };
}

const connaughtPlace: GeoPoint = { latitude: 28.6315, longitude: 77.2167 };

describe("haversineMeters", () => {
  it("is zero for the same point", () => {
    assert.equal(haversineMeters(28.6, 77.2, 28.6, 77.2), 0);
  });

  it("matches known distances", () => {
    // One degree of latitude on a 6371 km sphere.
    assert.ok(Math.abs(haversineMeters(0, 0, 1, 0) - 111_195) < 1);

    // London → Paris ≈ 343.5 km
    const londonParis = haversineMeters(51.5074, -0.1278, 48.8566, 2.3522);
    assert.ok(Math.abs(londonParis - 343_556) < 500, `${londonParis}`);

    // New Delhi → Mumbai ≈ 1,148 km
    const delhiMumbai = haversineMeters(28.6139, 77.209, 19.076, 72.8777);
    assert.ok(Math.abs(delhiMumbai - 1_148_095) < 1_000, `${delhiMumbai}`);
  });

  it("is symmetric", () => {
    const a = haversineMeters(28.6, 77.2, 19.07, 72.87);
    const b = haversineMeters(19.07, 72.87, 28.6, 77.2);

    assert.ok(Math.abs(a - b) < 1e-6);
  });
});

describe("isInsideCircle", () => {
  it("contains points inside the radius and excludes points outside", () => {
    const near = destination(connaughtPlace, 450, 60);
    const far = destination(connaughtPlace, 550, 60);

    assert.equal(isInsideCircle(near, connaughtPlace, 500), true);
    assert.equal(isInsideCircle(far, connaughtPlace, 500), false);
    assert.equal(isInsideCircle(connaughtPlace, connaughtPlace, 100), true);
  });

  it("agrees with distanceMeters", () => {
    const point = destination(connaughtPlace, 1234, 200);

    assert.ok(Math.abs(distanceMeters(point, connaughtPlace) - 1234) < 0.5);
  });
});

describe("boundingBox", () => {
  for (const radius of [100, 1000, 5000]) {
    it(`fully contains a ${radius} m circle`, () => {
      const box = boundingBox(connaughtPlace, radius);

      for (let bearing = 0; bearing < 360; bearing += 5) {
        const edge = destination(connaughtPlace, radius, bearing);

        assert.ok(edge.latitude >= box.minLat && edge.latitude <= box.maxLat);
        assert.ok(
          edge.longitude >= box.minLng && edge.longitude <= box.maxLng
        );
      }
    });
  }

  it("is tight (no wider than the circle needs)", () => {
    const box = boundingBox(connaughtPlace, 5000);
    const north = destination(connaughtPlace, 5000, 0);

    assert.ok(Math.abs(box.maxLat - north.latitude) < 1e-6);
  });

  it("widens to every longitude near a pole or the antimeridian", () => {
    const polar = boundingBox({ latitude: 89.99, longitude: 10 }, 5000);
    assert.equal(polar.minLng, -180);
    assert.equal(polar.maxLng, 180);

    const dateline = boundingBox({ latitude: 0, longitude: 179.99 }, 5000);
    assert.equal(dateline.minLng, -180);
    assert.equal(dateline.maxLng, 180);
  });
});
