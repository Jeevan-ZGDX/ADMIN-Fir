import { useState, useRef } from "react";
import axios from "axios";

const FIRAudio = () => {
  const [recording, setRecording] = useState(false);
  const [audioURL, setAudioURL] = useState(null);
  const [audioBlob, setAudioBlob] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const mediaRecorderRef = useRef(null);
  const chunks = useRef([]);

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorderRef.current = new MediaRecorder(stream);
    mediaRecorderRef.current.start();
    setRecording(true);
    setUploadStatus("");

    mediaRecorderRef.current.ondataavailable = (e) => {
      chunks.current.push(e.data);
    };

    mediaRecorderRef.current.onstop = () => {
      const blob = new Blob(chunks.current, { type: "audio/wav" });
      setAudioBlob(blob);
      setAudioURL(URL.createObjectURL(blob));
      chunks.current = [];
    };
  };

  const stopRecording = () => {
    mediaRecorderRef.current.stop();
    setRecording(false);
  };

  const submitAudio = async () => {
    if (!audioBlob) {
      setUploadStatus("No audio recorded");
      return;
    }

    setUploading(true);
    setUploadStatus("Uploading to IPFS...");

    try {
      const formData = new FormData();
      formData.append("file", audioBlob, "audio_complaint.wav");

      const response = await axios.post("http://localhost:5000/fir/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      const { ipfsHash, txHash, gatewayUrl, firId } = response.data;
      setUploadStatus(
        `✓ Upload successful!\nIPFS Hash: ${ipfsHash}\nTX Hash: ${txHash.substring(0, 20)}...\nFIR ID: ${firId}`
      );
      console.log("Upload response:", response.data);
    } catch (error) {
      setUploadStatus(`✗ Upload failed: ${error.message}`);
      console.error("Upload error:", error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fir-audio">
      <h2>FIR Audio Recording</h2>
      {!recording ? (
        <button onClick={startRecording} disabled={uploading}>
          Start Recording
        </button>
      ) : (
        <button onClick={stopRecording}>Stop Recording</button>
      )}
      {audioURL && (
        <div>
          <h3>Recorded Audio:</h3>
          <audio controls src={audioURL}></audio>
          <div style={{ marginTop: "1rem" }}>
            <button
              onClick={submitAudio}
              disabled={uploading}
              style={{
                backgroundColor: uploading ? "#ccc" : "#4CAF50",
                color: "white",
                padding: "10px 20px",
                border: "none",
                borderRadius: "4px",
                cursor: uploading ? "not-allowed" : "pointer",
                fontSize: "16px",
                marginTop: "10px",
              }}
            >
              {uploading ? "Uploading..." : "Submit to IPFS"}
            </button>
          </div>
          {uploadStatus && (
            <div
              style={{
                marginTop: "1rem",
                padding: "10px",
                backgroundColor: uploadStatus.includes("✓") ? "#d4edda" : "#f8d7da",
                color: uploadStatus.includes("✓") ? "#155724" : "#721c24",
                borderRadius: "4px",
                border: `1px solid ${uploadStatus.includes("✓") ? "#c3e6cb" : "#f5c6cb"}`,
              }}
            >
              {uploadStatus}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FIRAudio;
