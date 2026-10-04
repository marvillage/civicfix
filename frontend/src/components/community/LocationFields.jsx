import { useState } from "react";
import { LocateFixed } from "lucide-react";

const fmt = (value) =>
  Number.isFinite(value) ? String(Number(value.toFixed(5))) : "";

// Keyboard-friendly companion to a map picker: "Use my location"
// plus latitude / longitude fields. onChange(lat, lng, { recenter })
// asks the parent to move the map to the new point.
export default function LocationFields({
  latitude,
  longitude,
  onChange,
  idPrefix = "location",
  locateLabel = "Use my location",
}) {
  const [latText, setLatText] = useState(fmt(latitude));
  const [lngText, setLngText] = useState(fmt(longitude));
  const [synced, setSynced] = useState({ latitude, longitude });
  const [status, setStatus] = useState("");
  const [locating, setLocating] = useState(false);

  // Follow points set elsewhere (map clicks, geolocation) without
  // clobbering what the user is typing.
  if (synced.latitude !== latitude || synced.longitude !== longitude) {
    setSynced({ latitude, longitude });

    if (Number(latText) !== latitude) setLatText(fmt(latitude));
    if (Number(lngText) !== longitude) setLngText(fmt(longitude));
  }

  function commit(nextLat, nextLng) {
    const lat = Number(nextLat);
    const lng = Number(nextLng);

    if (
      nextLat !== "" &&
      nextLng !== "" &&
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      Math.abs(lat) <= 90 &&
      Math.abs(lng) <= 180
    ) {
      onChange(lat, lng, { recenter: true });
    }
  }

  function locate() {
    if (!navigator.geolocation) {
      setStatus(
        "This browser can't share a location. Click the map or type coordinates."
      );
      return;
    }

    setLocating(true);
    setStatus("Finding you…");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        setStatus("Centred on your location.");
        onChange(position.coords.latitude, position.coords.longitude, {
          recenter: true,
        });
      },
      () => {
        setLocating(false);
        setStatus(
          "Couldn't get your location. Click the map or type the coordinates."
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }

  return (
    <div className="location-fields-block">
      <div className="location-locate">
        <button
          type="button"
          className="btn-secondary btn-sm"
          onClick={locate}
          disabled={locating}
        >
          <LocateFixed aria-hidden="true" />
          {locating ? "Locating…" : locateLabel}
        </button>

        <span className="field-hint" role="status" aria-live="polite">
          {status}
        </span>
      </div>

      <div className="form-row location-coords">
        <div className="field">
          <label htmlFor={`${idPrefix}-lat`}>Latitude</label>
          <input
            id={`${idPrefix}-lat`}
            type="number"
            inputMode="decimal"
            step="0.0001"
            min="-90"
            max="90"
            value={latText}
            onChange={(event) => {
              setLatText(event.target.value);
              commit(event.target.value, lngText);
            }}
          />
        </div>

        <div className="field">
          <label htmlFor={`${idPrefix}-lng`}>Longitude</label>
          <input
            id={`${idPrefix}-lng`}
            type="number"
            inputMode="decimal"
            step="0.0001"
            min="-180"
            max="180"
            value={lngText}
            onChange={(event) => {
              setLngText(event.target.value);
              commit(latText, event.target.value);
            }}
          />
        </div>
      </div>
    </div>
  );
}
