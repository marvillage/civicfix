import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../api/axios";

const CATEGORIES = [
  "ROAD_DAMAGE",
  "STREETLIGHT",
  "GARBAGE",
  "WATER_LEAKAGE",
  "DRAINAGE",
  "OTHER",
];

const SEVERITIES = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL",
];

export default function FieldReport() {
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("ROAD_DAMAGE");
  const [severity, setSeverity] = useState("MEDIUM");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState([]);
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function getLocation() {
    setError("");

    navigator.geolocation?.getCurrentPosition(
      (position) => {
        setLatitude(
          position.coords.latitude.toString()
        );
        setLongitude(
          position.coords.longitude.toString()
        );
      },
      () =>
        setError(
          "Unable to get your location. Please allow location access."
        )
    );
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");

    if (images.length === 0) {
      setError("Add at least one photo.");
      return;
    }

    if (!latitude || !longitude) {
      setError("Location is required.");
      return;
    }

    const formData = new FormData();
    formData.append("title", title);
    formData.append("category", category);
    formData.append("severity", severity);
    formData.append("description", description);
    formData.append("latitude", latitude);
    formData.append("longitude", longitude);

    images.forEach((file) =>
      formData.append("images", file)
    );

    setLoading(true);

    try {
      const response = await api.post(
        "/complaints/field",
        formData
      );

      navigate(
        `/authority/issues/${response.data.issue.id}`
      );
    } catch (error) {
      setError(
        error.response?.data?.message ||
          "Unable to log the field report."
      );
      setLoading(false);
    }
  }

  function formatLabel(value) {
    return value
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (char) =>
        char.toUpperCase()
      );
  }

  return (
    <div className="page">
      <div className="form-container">
        <div className="page-header">
          <Link to="/authority">‹ Back</Link>

          <p className="eyebrow">FIELD SURVEY</p>

          <h1>Log an issue from the field</h1>

          <p>
            Spotted a problem on your rounds? Log it
            directly — it's created pre-acknowledged
            and assigned to you.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="complaint-form"
        >
          <div className="form-group">
            <label htmlFor="field-title">Title</label>

            <input
              id="field-title"
              type="text"
              value={title}
              onChange={(event) =>
                setTitle(event.target.value)
              }
              placeholder="e.g. Collapsed drain cover on 4th Cross"
              required
            />
          </div>

          <div className="location-fields">
            <div className="form-group">
              <label htmlFor="field-category">
                Category
              </label>

              <select
                id="field-category"
                value={category}
                onChange={(event) =>
                  setCategory(event.target.value)
                }
              >
                {CATEGORIES.map((value) => (
                  <option key={value} value={value}>
                    {formatLabel(value)}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="field-severity">
                Severity
              </label>

              <select
                id="field-severity"
                value={severity}
                onChange={(event) =>
                  setSeverity(event.target.value)
                }
              >
                {SEVERITIES.map((value) => (
                  <option key={value} value={value}>
                    {formatLabel(value)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="field-description">
              Description
            </label>

            <textarea
              id="field-description"
              value={description}
              onChange={(event) =>
                setDescription(event.target.value)
              }
              rows={4}
            />
          </div>

          <div className="form-group">
            <label htmlFor="field-images">
              Photos (up to 5)
            </label>

            <input
              id="field-images"
              type="file"
              accept="image/*"
              multiple
              onChange={(event) =>
                setImages(
                  [...(event.target.files || [])].slice(
                    0,
                    5
                  )
                )
              }
              required
            />

            {images.length > 0 && (
              <p>
                {images.length} photo
                {images.length > 1 ? "s" : ""} selected
              </p>
            )}
          </div>

          <div className="location-section">
            <div className="section-header">
              <div>
                <h2>Location</h2>
                <p>
                  Use GPS while standing at the spot.
                </p>
              </div>

              <button
                type="button"
                onClick={getLocation}
              >
                Use My Location
              </button>
            </div>

            <div className="location-fields">
              <div className="form-group">
                <label htmlFor="field-lat">
                  Latitude
                </label>

                <input
                  id="field-lat"
                  type="text"
                  value={latitude}
                  onChange={(event) =>
                    setLatitude(event.target.value)
                  }
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="field-lng">
                  Longitude
                </label>

                <input
                  id="field-lng"
                  type="text"
                  value={longitude}
                  onChange={(event) =>
                    setLongitude(event.target.value)
                  }
                  required
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="form-error">{error}</div>
          )}

          <button type="submit" disabled={loading}>
            {loading
              ? "Logging…"
              : "Log field report"}
          </button>
        </form>
      </div>
    </div>
  );
}
