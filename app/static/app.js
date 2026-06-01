const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const recordingState = document.getElementById("recordingState");
const transcriptionText = document.getElementById("transcriptionText");
const supportResponseText = document.getElementById("supportResponseText");
const intentBadge = document.getElementById("intentBadge");
const scoreBadge = document.getElementById("scoreBadge");
const ttsPlayer = document.getElementById("ttsPlayer");
const ttsHint = document.getElementById("ttsHint");
const reportPreview = document.getElementById("reportPreview");
const callIdText = document.getElementById("callIdText");
const downloadReportBtn = document.getElementById("downloadReportBtn");
const healthDot = document.getElementById("healthDot");
const healthText = document.getElementById("healthText");

let mediaRecorder = null;
let mediaStream = null;
let recordedChunks = [];

const setBusy = (busy) => {
  startBtn.disabled = busy;
  stopBtn.disabled = !busy;
};

const setHealth = (ok, message) => {
  healthDot.style.background = ok ? "#4ed8c4" : "#ff7b7b";
  healthText.textContent = message;
};

const resetOutput = () => {
  transcriptionText.textContent = "La transcripción aparecerá aquí.";
  supportResponseText.textContent = "La respuesta generada aparecerá aquí.";
  intentBadge.textContent = "unknown";
  scoreBadge.textContent = "Score: --";
  reportPreview.textContent = "El resumen estructurado aparecerá aquí.";
  callIdText.textContent = "Call ID: --";
  ttsPlayer.hidden = true;
  ttsPlayer.removeAttribute("src");
  ttsHint.hidden = false;
  downloadReportBtn.style.pointerEvents = "none";
  downloadReportBtn.style.opacity = "0.5";
  downloadReportBtn.href = "#";
};

const fetchHealth = async () => {
  try {
    const response = await fetch("/api/health");
    if (!response.ok) {
      throw new Error("health check failed");
    }
    const data = await response.json();
    setHealth(true, data.status === "ok" ? "Servicio operativo" : "Servicio disponible");
  } catch (error) {
    setHealth(false, "Backend no disponible");
  }
};

const stopTracks = () => {
  if (mediaStream) {
    mediaStream.getTracks().forEach((track) => track.stop());
    mediaStream = null;
  }
};

const uploadRecording = async (blob) => {
  const formData = new FormData();
  const fileName = blob.type.includes("webm") ? "callmind-recording.webm" : "callmind-recording.wav";
  formData.append("audio", blob, fileName);

  try {
    const response = await fetch("/api/calls", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.detail || "No fue posible procesar la llamada.");
    }

    transcriptionText.textContent = data.transcription;
    supportResponseText.textContent = data.support_response;
    intentBadge.textContent = data.intent;
    scoreBadge.textContent = `Score: ${data.satisfaction_score}`;
    callIdText.textContent = `Call ID: ${data.call_id}`;
    reportPreview.textContent = JSON.stringify(
      {
        call_id: data.call_id,
        transcription: data.transcription,
        intent: data.intent,
        support_response: data.support_response,
        satisfaction_score: data.satisfaction_score,
        tts_audio_url: data.tts_audio_url,
        report_url: data.report_url,
      },
      null,
      2,
    );

    if (data.tts_audio_url) {
      ttsPlayer.src = data.tts_audio_url;
      ttsPlayer.hidden = false;
      ttsHint.hidden = true;
    }

    if (data.report_url) {
      downloadReportBtn.href = data.report_url;
      downloadReportBtn.download = `call_${data.call_id}_report.json`;
      downloadReportBtn.style.pointerEvents = "auto";
      downloadReportBtn.style.opacity = "1";
    }

    recordingState.textContent = "Llamada procesada correctamente.";
  } catch (error) {
    console.error(error);
    recordingState.textContent = error.message || "Ocurrió un error al procesar el audio.";
  }
};

const startRecording = async () => {
  resetOutput();

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    recordingState.textContent = "Tu navegador no soporta grabación de audio.";
    return;
  }

  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const options = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? { mimeType: "audio/webm;codecs=opus" }
      : MediaRecorder.isTypeSupported("audio/webm")
        ? { mimeType: "audio/webm" }
        : {};

    recordedChunks = [];
    mediaRecorder = new MediaRecorder(mediaStream, options);
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = async () => {
      const mimeType = mediaRecorder.mimeType || "audio/webm";
      const blob = new Blob(recordedChunks, { type: mimeType });
      await uploadRecording(blob);
      stopTracks();
      setBusy(false);
    };

    mediaRecorder.start();
    setBusy(true);
    recordingState.textContent = "Grabando... pulsa detener cuando termines.";
  } catch (error) {
    console.error(error);
    recordingState.textContent = "No se pudo acceder al micrófono.";
    stopTracks();
    setBusy(false);
  }
};

const stopRecording = () => {
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
    recordingState.textContent = "Procesando audio y generando respuesta...";
  }
};

startBtn.addEventListener("click", startRecording);
stopBtn.addEventListener("click", stopRecording);

fetchHealth();
resetOutput();
