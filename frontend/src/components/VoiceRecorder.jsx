import { useEffect, useRef, useState } from "react";
import { Mic, Square, Trash2 } from "lucide-react";

const MAX_SECONDS = 120;

function clock(seconds) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

// Records a short voice note and hands the file to `onChange`
// (null when discarded). Styles: styles/pages/issue.css.
export default function VoiceRecorder({ onChange }) {
  const [recording, setRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [error, setError] = useState("");
  const [seconds, setSeconds] = useState(0);

  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const startedRef = useRef(0);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Release the preview URL when it is replaced or on unmount.
  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  // Stop the microphone if the form unmounts mid-recording.
  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);

      if (recorderRef.current?.state === "recording") {
        recorderRef.current.stop();
      }
    };
  }, []);

  function stopRecording() {
    clearInterval(timerRef.current);

    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }

    setRecording(false);
  }

  async function startRecording() {
    setError("");

    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setError("Voice notes aren't supported in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });

        const file = new File([blob], "voice-note.webm", {
          type: blob.type,
        });

        setAudioUrl(URL.createObjectURL(blob));
        onChangeRef.current?.(file);

        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start();
      recorderRef.current = recorder;
      startedRef.current = Date.now();
      setSeconds(0);
      setRecording(true);

      // Tick the timer and stop automatically at the limit.
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startedRef.current) / 1000);

        setSeconds(Math.min(elapsed, MAX_SECONDS));

        if (elapsed >= MAX_SECONDS) {
          stopRecording();
        }
      }, 250);
    } catch {
      setError(
        "Microphone access was blocked. Allow it in your browser to record a voice note."
      );
    }
  }

  function discard() {
    setAudioUrl(null);
    setSeconds(0);
    onChangeRef.current?.(null);
  }

  return (
    <div className="voice-recorder">
      {!recording && !audioUrl && (
        <button
          type="button"
          className="btn-secondary voice-start"
          onClick={startRecording}
        >
          <Mic aria-hidden="true" />
          Record a voice note
          <span className="voice-limit">up to 2 min</span>
        </button>
      )}

      {recording && (
        <div className="voice-live" role="status">
          <span className="voice-live-dot" aria-hidden="true" />
          <span className="voice-live-label">Recording</span>
          <span className="voice-live-time">
            {clock(seconds)}
            <small> / {clock(MAX_SECONDS)}</small>
          </span>

          <button
            type="button"
            className="btn-sm voice-stop"
            onClick={stopRecording}
          >
            <Square aria-hidden="true" />
            Stop
          </button>
        </div>
      )}

      {audioUrl && !recording && (
        <div className="voice-preview">
          <audio controls src={audioUrl}>
            Your browser can't play this recording.
          </audio>

          <button
            type="button"
            className="btn-danger-ghost btn-sm"
            onClick={discard}
          >
            <Trash2 aria-hidden="true" />
            Discard
          </button>
        </div>
      )}

      {error && (
        <p className="voice-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
