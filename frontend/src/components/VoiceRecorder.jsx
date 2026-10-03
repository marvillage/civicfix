import { useEffect, useRef, useState } from "react";

export default function VoiceRecorder({ onChange }) {
  const [recording, setRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [error, setError] = useState("");
  const [seconds, setSeconds] = useState(0);

  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (recorderRef.current?.state === "recording") {
        recorderRef.current.stop();
      }

      clearInterval(timerRef.current);

      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  async function startRecording() {
    setError("");

    if (!navigator.mediaDevices?.getUserMedia) {
      setError(
        "Voice recording is not supported by this browser."
      );
      return;
    }

    try {
      const stream =
        await navigator.mediaDevices.getUserMedia({
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

        const file = new File(
          [blob],
          "voice-note.webm",
          { type: blob.type }
        );

        setAudioUrl(URL.createObjectURL(blob));
        onChange(file);

        stream
          .getTracks()
          .forEach((track) => track.stop());
      };

      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
      setSeconds(0);

      timerRef.current = setInterval(() => {
        setSeconds((previous) => {
          if (previous >= 119) {
            recorder.stop();
            clearInterval(timerRef.current);
            setRecording(false);
          }

          return previous + 1;
        });
      }, 1000);
    } catch {
      setError(
        "Microphone access was denied. Allow it to record a voice note."
      );
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    clearInterval(timerRef.current);
    setRecording(false);
  }

  function discard() {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }

    setAudioUrl(null);
    setSeconds(0);
    onChange(null);
  }

  return (
    <div className="voice-recorder">
      {!recording && !audioUrl && (
        <button
          type="button"
          className="secondary-button"
          onClick={startRecording}
        >
          🎙 Record a voice note
        </button>
      )}

      {recording && (
        <div className="voice-recording-row">
          <span className="voice-recording-dot" />
          <span className="voice-timer">
            {Math.floor(seconds / 60)}:
            {String(seconds % 60).padStart(2, "0")}
          </span>

          <button
            type="button"
            onClick={stopRecording}
          >
            ■ Stop
          </button>
        </div>
      )}

      {audioUrl && !recording && (
        <div className="voice-preview-row">
          <audio controls src={audioUrl} />

          <button
            type="button"
            className="secondary-button"
            onClick={discard}
          >
            Discard
          </button>
        </div>
      )}

      {error && (
        <p className="text-danger voice-error">
          {error}
        </p>
      )}
    </div>
  );
}
