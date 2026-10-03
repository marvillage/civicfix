import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/axios";
import VoiceRecorder from "../../components/VoiceRecorder";
import SuccessCheck from "../../components/SuccessCheck";

export default function PublicReport() {
  const [images, setImages] = useState([]);
  const [voiceNote, setVoiceNote] = useState(null);
  const [isEmergency, setIsEmergency] = useState(false);
  const [description, setDescription] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [address, setAddress] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submittedIssue, setSubmittedIssue] =
    useState(null);

  useEffect(() => {
    const lat = Number(latitude);
    const lng = Number(longitude);

    if (
      !latitude ||
      !longitude ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng)
    ) {
      setAddress("");
      return;
    }

    let cancelled = false;

    const timer = setTimeout(async () => {
      try {
        const response = await api.get("/geocode", {
          params: { lat, lng },
        });

        if (!cancelled) {
          setAddress(response.data.address || "");
        }
      } catch (error) {
        console.error("Geocode error:", error);
      }
    }, 600);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [latitude, longitude]);

  function getLocation() {
    setError("");

    if (!navigator.geolocation) {
      setError(
        "Geolocation is not supported by your browser."
      );
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(
          position.coords.latitude.toString()
        );
        setLongitude(
          position.coords.longitude.toString()
        );
      },
      () => {
        setError(
          "Unable to get your location. Please allow location access."
        );
      }
    );
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");

    if (images.length === 0) {
      setError("Please select at least one photo.");
      return;
    }

    if (!latitude || !longitude) {
      setError("Please provide the location.");
      return;
    }

    const formData = new FormData();

    images.forEach((file) =>
      formData.append("images", file)
    );

    if (voiceNote) {
      formData.append("audio", voiceNote);
    }

    formData.append(
      "isEmergency",
      isEmergency ? "true" : "false"
    );
    formData.append("description", description);
    formData.append("latitude", latitude);
    formData.append("longitude", longitude);

    setLoading(true);

    try {
      const response = await api.post(
        "/complaints/anonymous",
        formData
      );

      setSubmittedIssue(
        response.data.complaint?.issue || null
      );
    } catch (error) {
      setError(
        error.response?.data?.message ||
          "Unable to submit the report. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  if (submittedIssue) {
    return (
      <div className="page">
        <div className="form-container">
          <div className="empty-state report-success">
            <svg
              className="success-check"
              viewBox="0 0 56 56"
              aria-hidden="true"
              style={{ margin: "0 auto 10px" }}
            >
              <circle
                className="circle"
                cx="28"
                cy="28"
                r="26"
              />
              <path
                className="mark"
                d="M16 29.5l8 8 16-17"
              />
            </svg>

            <h2>Report submitted ✓</h2>

            <p>
              Thank you for looking out for your
              neighborhood. The issue is now public and
              can be tracked by anyone.
            </p>

            <div className="issue-card-actions">
              <Link
                to={`/issues/${submittedIssue.id}`}
              >
                <button type="button">
                  Track this issue
                </button>
              </Link>

              <Link to="/register">
                <button
                  type="button"
                  className="secondary-button"
                >
                  Create an account to earn points
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="form-container">
        <div className="page-header">
          <Link to="/">‹ Back</Link>

          <p className="eyebrow">NO ACCOUNT NEEDED</p>

          <h1>Report an issue anonymously</h1>

          <p>
            Spotted a pothole, a dead streetlight, an
            overflowing bin? Report it in under a
            minute — no sign-up required. With an
            account you can track your reports and earn
            civic points.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="complaint-form"
        >
          <div className="form-group">
            <label htmlFor="image">
              Photos (up to 5)
            </label>

            <input
              id="image"
              type="file"
              accept="image/*"
              multiple
              onChange={(event) =>
                setImages(
                  [
                    ...(event.target.files || []),
                  ].slice(0, 5)
                )
              }
              required
            />

            {images.length > 0 && (
              <p>
                {images.length} photo
                {images.length > 1 ? "s" : ""}{" "}
                selected
              </p>
            )}
          </div>

          <div className="form-group">
            <label>Voice note (optional)</label>

            <VoiceRecorder onChange={setVoiceNote} />
          </div>

          <label className="emergency-toggle">
            <input
              type="checkbox"
              checked={isEmergency}
              onChange={(event) =>
                setIsEmergency(event.target.checked)
              }
            />

            <span>
              <strong>
                🚨 This is an emergency
              </strong>
              <small>
                Life-threatening hazard — alerts
                every admin instantly.
              </small>
            </span>
          </label>

          <div className="form-group">
            <label htmlFor="description">
              Description
            </label>

            <textarea
              id="description"
              value={description}
              onChange={(event) =>
                setDescription(event.target.value)
              }
              placeholder="Describe the problem..."
              rows={5}
            />
          </div>

          <div className="location-section">
            <div className="section-header">
              <div>
                <h2>Location</h2>

                <p>
                  The location helps authorities find
                  the issue.
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
                <label htmlFor="latitude">
                  Latitude
                </label>

                <input
                  id="latitude"
                  type="text"
                  value={latitude}
                  onChange={(event) =>
                    setLatitude(event.target.value)
                  }
                  placeholder="28.6139"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="longitude">
                  Longitude
                </label>

                <input
                  id="longitude"
                  type="text"
                  value={longitude}
                  onChange={(event) =>
                    setLongitude(event.target.value)
                  }
                  placeholder="77.2090"
                  required
                />
              </div>
            </div>

            {address && (
              <p className="location-address">
                📍 {address}
              </p>
            )}
          </div>

          {error && (
            <div className="form-error">{error}</div>
          )}

          <button type="submit" disabled={loading}>
            {loading && <span className="spinner" />}
            {loading
              ? "Submitting..."
              : "Submit Report"}
          </button>
        </form>
      </div>
    </div>
  );
}
