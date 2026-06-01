const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const voiceBtn = document.getElementById("voiceBtn");
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
let demoMode = false;
let currentSupportResponse = "";
let currentIntent = "unknown";
let currentReportUrl = null;

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
  currentSupportResponse = "";
  currentIntent = "unknown";
  currentReportUrl = null;
};

const fetchHealth = async () => {
  try {
    const response = await fetch("/api/health", { cache: "no-store" });
    if (!response.ok) throw new Error("health check failed");
    const data = await response.json();
    demoMode = false;
    setHealth(true, data.status === "ok" ? "Servicio operativo" : "Servicio disponible");
  } catch {
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

const speakText = (text) => {
  if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
    return false;
  }

  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "es-ES";
    utterance.rate = 0.98;
    utterance.pitch = 1;
    utterance.volume = 1;

    const voices = window.speechSynthesis.getVoices();
    const spanishVoice = voices.find((voice) => /es(-|_)?/i.test(voice.lang) || /spanish|español/i.test(voice.name));
    if (spanishVoice) {
      utterance.voice = spanishVoice;
    }

    utterance.onstart = () => {
      recordingState.textContent = "Leyendo la respuesta en voz alta...";
    };

    utterance.onend = () => {
      recordingState.textContent = demoMode ? "Procesado (demo)" : "Llamada procesada correctamente.";
    };

    utterance.onerror = () => {
      recordingState.textContent = demoMode ? "Procesado (demo)" : "Llamada procesada correctamente.";
    };

    window.speechSynthesis.speak(utterance);
    return true;
  } catch (error) {
    console.warn("Speech synthesis failed:", error);
    return false;
  }
};

const voiceCurrentResponse = () => {
  if (currentSupportResponse) {
    const ok = speakText(currentSupportResponse);
    if (!ok) {
      recordingState.textContent = "No se pudo reproducir la voz en este navegador.";
    }
  } else {
    recordingState.textContent = "No hay respuesta para leer todavía.";
  }
};

const updateOutputs = ({ transcription, intent, supportResponse, score, callId, reportJson, reportUrl, ttsUrl }) => {
  transcriptionText.textContent = transcription;
  supportResponseText.textContent = supportResponse;
  intentBadge.textContent = intent;
  scoreBadge.textContent = `Score: ${score}`;
  callIdText.textContent = `Call ID: ${callId}`;
  reportPreview.textContent = JSON.stringify(reportJson, null, 2);

  currentSupportResponse = supportResponse;
  currentIntent = intent;

  if (ttsUrl) {
    ttsPlayer.src = ttsUrl;
    ttsPlayer.hidden = false;
    ttsHint.hidden = true;
  } else {
    ttsPlayer.hidden = true;
    ttsPlayer.removeAttribute("src");
    ttsHint.hidden = false;
  }

  if (reportUrl) {
    currentReportUrl = reportUrl;
    downloadReportBtn.href = reportUrl;
    downloadReportBtn.download = `call_${callId}_report.json`;
    downloadReportBtn.style.pointerEvents = "auto";
    downloadReportBtn.style.opacity = "1";
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

async function demoProcess() {
  recordingState.textContent = "Procesando (modo demo)...";
  await new Promise((r) => setTimeout(r, 650));

  const transcription = "No puedo entrar a mi VPN corporativa.";
  const intent = detectIntentLocal(transcription);
  const supportResponse = LOCAL_RESPONSES[intent] || LOCAL_RESPONSES.unknown;
  const score = intent === "unknown" ? 75 : 92;
  const reportJson = {
    call_id: "demo",
    transcription,
    intent,
    support_response: supportResponse,
    satisfaction_score: score,
    created_at: new Date().toISOString(),
  };
  const blobJson = new Blob([JSON.stringify(reportJson, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blobJson);

  updateOutputs({
    transcription,
    intent,
    supportResponse,
    score,
    callId: "demo",
    reportJson,
    reportUrl: url,
    ttsUrl: null,
  });

  voiceCurrentResponse();
  recordingState.textContent = "Procesado (demo)";
}

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

    updateOutputs({
      transcription: data.transcription,
      intent: data.intent,
      supportResponse: data.support_response,
      score: data.satisfaction_score,
      callId: data.call_id,
      reportJson: {
        call_id: data.call_id,
        transcription: data.transcription,
        intent: data.intent,
        support_response: data.support_response,
        satisfaction_score: data.satisfaction_score,
        tts_audio_url: data.tts_audio_url,
        report_url: data.report_url,
      },
      reportUrl: data.report_url,
      ttsUrl: data.tts_audio_url,
    });

    voiceCurrentResponse();
    recordingState.textContent = "Llamada procesada correctamente.";
  } catch (error) {
    console.warn("Backend upload failed, switching to demo flow:", error);
    demoMode = true;
    await demoProcess();
  }
};

const startRecording = async () => {
  resetOutput();

  if (demoMode) {
    setBusy(true);
    recordingState.textContent = "Ejecutando demo sin backend ni micrófono...";
    await demoProcess();
    setBusy(false);
    return;
  }

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    recordingState.textContent = "Tu navegador no soporta grabación de audio. Activando demo...";
    demoMode = true;
    await demoProcess();
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
    recordingState.textContent = "No se pudo acceder al micrófono. Activando demo...";
    demoMode = true;
    await demoProcess();
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
voiceBtn.addEventListener("click", voiceCurrentResponse);

window.speechSynthesis?.addEventListener?.("voiceschanged", () => {
  if (currentSupportResponse && !window.speechSynthesis.speaking) {
    // noop: keep voices loaded for the manual voice button.
  }
});

fetchHealth();
resetOutput();
