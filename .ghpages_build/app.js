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
let demoMode = false; // when true, use client-side demo flow instead of backend

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
    demoMode = false;
  } catch (error) {
    // Switch to demo mode when backend is not reachable (useful for GitHub Pages)
    demoMode = true;
    setHealth(true, "Demo (sin backend)");
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
    console.warn("Backend upload failed, switching to demo flow:", error);
    // If backend is not reachable, fall back to client-side demo processing
    demoMode = true;
    await demoProcess(blob);
  }
};


function detectIntentLocal(text) {
  const t = text.toLowerCase();
  if (t.includes("vpn") || t.includes("forticlient") || t.includes("anyconnect") || t.includes("conect")) return "vpn_issue";
  if (t.includes("contras") || t.includes("password") || t.includes("login") || t.includes("bloque")) return "password_reset";
  if (t.includes("correo") || t.includes("outlook") || t.includes("email") || t.includes("mail")) return "email_issue";
  if (t.includes("internet") || t.includes("red") || t.includes("wifi") || t.includes("conexi")) return "network_issue";
  if (t.includes("laptop") || t.includes("pantalla") || t.includes("teclado") || t.includes("mouse")) return "device_issue";
  if (t.includes("instalar") || t.includes("aplicacion") || t.includes("software") || t.includes("licencia")) return "software_issue";
  return "unknown";
}

const LOCAL_RESPONSES = {
  vpn_issue: "Entiendo que tienes problemas para conectarte a la VPN corporativa. Primero verifica tu conexión a internet, luego confirma que tus credenciales estén correctas, reinicia el cliente VPN y prueba nuevamente. Si el error continúa, comparte el código de error con soporte para revisar tu perfil de acceso.",
  password_reset: "Parece que necesitas ayuda con acceso o restablecimiento de contraseña. Verifica el flujo de restablecimiento y contacta con soporte si persiste.",
  email_issue: "Revisa la sincronización de tu cliente de correo, el espacio del buzón y los mensajes de error. Si persiste, comparte el detalle con soporte.",
  network_issue: "Reinicia tu router/adaptador y prueba otra red. Si otros dispositivos funcionan, es problema local del equipo.",
  device_issue: "Revisa conexiones físicas, reinicia el equipo y verifica detección de hardware. Si falla, soporte puede coordinar revisión técnica.",
  software_issue: "Verifica versión, permisos y licencias. Prueba reinstalar la aplicación. Si continúa, contacta con soporte con capturas del error.",
  unknown: "Necesito más información para identificar el incidente. Describe el problema, mensajes de error y cuándo ocurre.",
};

async function demoProcess(blob) {
  // Simulate a short processing delay
  recordingState.textContent = "Procesando (modo demo)...";
  await new Promise((r) => setTimeout(r, 800));

  const fallback = "No puedo entrar a mi VPN corporativa.";
  const transcription = fallback;
  const intent = detectIntentLocal(transcription);
  const support_response = LOCAL_RESPONSES[intent] || LOCAL_RESPONSES.unknown;
  const satisfaction_score = intent === "unknown" ? 75 : 92;

  transcriptionText.textContent = transcription;
  supportResponseText.textContent = support_response;
  intentBadge.textContent = intent;
  scoreBadge.textContent = `Score: ${satisfaction_score}`;
  callIdText.textContent = `Call ID: demo`;

  // Use the sample mp3 bundled in the site (root) if available
  const sampleTts = "call_257261139.mp3";
  ttsPlayer.src = sampleTts;
  ttsPlayer.hidden = false;
  ttsHint.hidden = true;

  // Build a downloadable JSON report in-browser
  const report = {
    call_id: "demo",
    transcription,
    intent,
    support_response,
    satisfaction_score,
    created_at: new Date().toISOString(),
  };
  const blobJson = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blobJson);
  downloadReportBtn.href = url;
  downloadReportBtn.download = `call_demo_report.json`;
  downloadReportBtn.style.pointerEvents = "auto";
  downloadReportBtn.style.opacity = "1";

  reportPreview.textContent = JSON.stringify(report, null, 2);
  recordingState.textContent = "Procesado (demo)";
}

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
