import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../api/axios";
import VoiceRecorder from "../../components/VoiceRecorder";
import SuccessCheck from "../../components/SuccessCheck";

export default function ReportIssue() {
  const navigate = useNavigate();

  const [images, setImages] = useState([]);
  const [voiceNote, setVoiceNote] = useState(null);
  const [isEmergency, setIsEmergency] = useState(false);
  const [description, setDescription] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [address, setAddress] = useState("");

  const [nearby, setNearby] = useState([]);
  const [upvoted, setUpvoted] = useState({});

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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
      setNearby([]);
      return;
    }

    let cancelled = false;

    const timer = setTimeout(async () => {
      try {
        const [geo, near] = await Promise.all([
          api.get("/geocode", {
            params: { lat, lng },
          }),
          api.get("/issues/nearby", {
            params: { lat, lng },
          }),
        ]);

        if (!cancelled) {
          setAddress(geo.data.address || "");
          setNearby(near.data.issues || []);
        }
      } catch (error) {
        console.error(
          "Location lookup error:",
          error
        );
      }
    }, 600);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [latitude, longitude]);

  async function handleUpvote(issueId) {
    try {
      await api.post(`/issues/${issueId}/upvote`);

      setUpvoted((previous) => ({
        ...previous,
        [issueId]: true,
      }));
    } catch (error) {
      const message =
        error.response?.data?.message || "";

      if (message.toLowerCase().includes("already")) {
        setUpvoted((previous) => ({
          ...previous,
          [issueId]: true,
        }));
      } else {
        setError(
          message || "Unable to upvote the issue."
        );
      }
    }
  }

  function formatStatus(status) {
    return (
      status
        ?.replace(/_/g, " ")
        .toLowerCase()
        .replace(/\b\w/g, (char) =>
          char.toUpperCase()
        ) || "Unknown"
    );
  }

  function handleImageChange(event) {
    setImages(
      [...(event.target.files || [])].slice(0, 5)
    );
  }

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
    setSuccess("");

    if (images.length === 0) {
      setError("Please select at least one photo.");
      return;
    }

    if (!latitude || !longitude) {
      setError(
        "Please provide your location."
      );
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
    formData.append(
      "description",
      description
    );
    formData.append(
      "latitude",
      latitude
    );
    formData.append(
      "longitude",
      longitude
    );

    setLoading(true);

    try {
      const response = await api.post(
        "/complaints",
        formData
      );

      console.log(
        "Complaint created:",
        response.data
      );

      setSuccess(
        "Complaint submitted successfully!"
      );

      setTimeout(() => {
        navigate("/citizen/complaints");
      }, 1900);
    } catch (error) {
      console.error(
        "Complaint submission error:",
        error
      );

      const message =
        error.response?.data?.message ||
        "Unable to submit complaint. Please try again.";

      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <div className="form-container">
        <img
          className="report-hero"
          src="/images/report-dusk.png"
          alt="Hands photographing a broken streetlight at dusk"
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />

        <div className="page-header">
          <button
            type="button"
            onClick={() =>
              navigate("/citizen")
            }
          >
            ‹ Back
          </button>

          <h1>Report an Issue</h1>

          <p>
            Help your community by reporting a
            civic problem.
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
              onChange={handleImageChange}
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
            <label>
              Voice note (optional)
            </label>

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
                Life-threatening hazard — open
                manhole, live wire, major flooding.
                Alerts every admin instantly and
                jumps the queue.
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
                setDescription(
                  event.target.value
                )
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
                  Your location helps authorities
                  identify the issue.
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
                    setLatitude(
                      event.target.value
                    )
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
                    setLongitude(
                      event.target.value
                    )
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

          {nearby.length > 0 && (
            <div className="nearby-panel">
              <h3>
                Already reported near this spot?
              </h3>

              <p>
                Upvoting an existing report raises its
                priority faster than filing a duplicate.
              </p>

              <div className="nearby-list">
                {nearby.map((issue) => (
                  <div
                    key={issue.id}
                    className="nearby-item"
                  >
                    <div className="nearby-info">
                      <strong>{issue.title}</strong>

                      <small>
                        {formatStatus(issue.category)} ·{" "}
                        {formatStatus(issue.status)} ·{" "}
                        {issue.distanceMeters} m away ·{" "}
                        👍 {issue._count?.upvotes || 0}
                      </small>
                    </div>

                    <div className="nearby-actions">
                      <button
                        type="button"
                        onClick={() =>
                          handleUpvote(issue.id)
                        }
                        disabled={upvoted[issue.id]}
                        className="secondary-button"
                      >
                        {upvoted[issue.id]
                          ? "Upvoted ✓"
                          : "Upvote"}
                      </button>

                      <Link
                        to={`/issues/${issue.id}`}
                        className="text-link"
                      >
                        View
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="form-error">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
          >
            {loading && <span className="spinner" />}
            {loading
              ? "Submitting..."
              : "Submit Complaint"}
          </button>
        </form>
      </div>

      {success && (
        <SuccessCheck
          title="Report submitted"
          message="Thank you for looking out for your neighbourhood. Taking you to your complaints…"
        />
      )}
    </div>
  );
}