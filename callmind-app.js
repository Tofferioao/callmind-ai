const getElement = (id) => document.getElementById(id);

const ui = {
  startBtn: getElement("startBtn"),
  hangupBtn: getElement("hangupBtn"),
  fallbackSendBtn: getElement("fallbackSendBtn"),
  fallbackInput: getElement("fallbackInput"),
  recordingState: getElement("recordingState"),
  transcriptValue: getElement("transcriptValue"),
  chatList: getElement("chatList"),
  supportResponseText: getElement("supportResponseText"),
  intentBadge: getElement("intentBadge"),
  scoreBadge: getElement("scoreBadge"),
  durationBadge: getElement("durationBadge"),
  callTimer: getElement("callTimer"),
  callAvatar: getElement("callAvatar"),
  callCard: getElement("callCard"),
  ttsPlayer: getElement("ttsPlayer"),
  ttsHint: getElement("ttsHint"),
  reportPreview: getElement("reportPreview"),
  callIdText: getElement("callIdText"),
  downloadReportBtn: getElement("downloadReportBtn"),
  fallbackNotice: getElement("fallbackNotice"),
  compatibilityPill: getElement("compatibilityPill"),
  healthDot: getElement("healthDot"),
  healthText: getElement("healthText"),
};

const nowIso = () => new Date().toISOString();
const createId = () => (window.crypto?.randomUUID ? window.crypto.randomUUID() : `call-${Date.now()}-${Math.random().toString(16).slice(2)}`);

const SUPPORT_INTENTS = {
  vpn_issue: {
    keywords: ["vpn", "forticlient", "anyconnect", "acceso remoto", "conexion vpn", "no conecta la vpn", "tunnel"],
    response:
      "Entiendo el problema con la VPN. Primero verifica tu conexión a internet, confirma que las credenciales sean correctas, cierra y abre el cliente VPN, y vuelve a intentar. Si aparece un código de error, compártelo con soporte para revisar el perfil y la autenticación.",
  },
  password_reset: {
    keywords: ["contrasena", "contraseña", "password", "bloqueada", "reset", "mfa", "otp", "codigo no llega", "login"],
    response:
      "Parece un caso de acceso o restablecimiento de contraseña. Usa el flujo oficial de reseteo, valida que la cuenta no esté bloqueada, revisa que el MFA reciba el código y vuelve a probar el acceso. Si el código no llega, soporte puede validar el método de autenticación.",
  },
  email_issue: {
    keywords: ["correo", "outlook", "mail", "buzon", "email", "sincroniza", "enviar correo", "recibir correo"],
    response:
      "Vamos a revisar el correo. Confirma la conexión a internet, prueba Outlook y webmail, revisa el espacio del buzón, valida credenciales y fuerza una sincronización. Si el problema sigue, comparte el mensaje exacto para revisar la cuenta y el servicio.",
  },
  internet_issue: {
    keywords: ["internet", "wifi", "wi-fi", "red", "conexion", "conectividad", "navegar", "caida", "sin internet"],
    response:
      "Si el problema es de internet, verifica si ocurre por Wi‑Fi o cable, reinicia el adaptador de red, prueba abrir otro sitio y confirma si otros equipos navegan bien. Si la falla persiste, podríamos estar ante una caída local o un problema de enlace que soporte debe revisar.",
  },
  computer_slow: {
    keywords: ["lento", "lentitud", "equipo lento", "pc lenta", "tarda mucho", "se congela", "cpu", "ram", "disco lleno"],
    response:
      "Gracias por el detalle. Cuando el equipo va lento, conviene cerrar aplicaciones pesadas, revisar si hay reinicios pendientes, comprobar espacio en disco y validar consumo de CPU, memoria y antivirus. Si el comportamiento continúa, soporte puede revisar procesos y salud del sistema.",
  },
  printer_issue: {
    keywords: ["impresora", "imprimir", "printer", "cola de impresion", "papel", "atasco", "toner", "cartucho"],
    response:
      "Revisemos la impresora. Confirma que tenga energía, papel y conexión, limpia la cola de impresión, verifica si está seleccionada como predeterminada y prueba desde otra aplicación. Si sigue fallando, soporte puede revisar controladores, red o consumibles.",
  },
  access_request: {
    keywords: ["permiso", "acceso", "alta", "solicitar acceso", "perfil", "rol", "aprobacion", "autorizacion"],
    response:
      "Para una solicitud de acceso, necesitamos validar el sistema, el tipo de permiso y la aprobación correspondiente. Indica el recurso que necesitas, tu usuario y el motivo del acceso para que soporte gestione la validación o el escalado adecuado.",
  },
  malware_suspicion: {
    keywords: ["malware", "virus", "ransomware", "infectado", "amenaza", "seguridad", "phishing"],
    response:
      "Esto debe tratarse como un posible incidente de seguridad. Si hay riesgo, desconecta el equipo de la red de inmediato, no borres archivos ni apagues el equipo si hay evidencia activa, y avisa a seguridad o soporte para que continúen con el protocolo de contención.",
  },
  unknown: {
    keywords: [],
    response:
      "Necesito un poco más de contexto para ayudarte. Cuéntame qué aplicación o equipo falla, el mensaje de error exacto y desde cuándo ocurre para orientarte con el siguiente paso.",
  },
};

const state = {
  callActive: false,
  backendMode: false,
  demoMode: true,
  hasSpeechRecognition: false,
  isListening: false,
  isProcessing: false,
  isSpeaking: false,
  pendingTranscript: "",
  silenceTimer: null,
  callId: null,
  startedAt: null,
  endedAt: null,
  conversation: [],
  detectedIntents: [],
  latestIntent: "unknown",
  latestScore: 0,
  latestSummary: "",
  supportResponse: "",
  reportBlobUrl: null,
  recognition: null,
  mediaRecorder: null,
  mediaStream: null,
  fallbackChunks: [],
  fallbackRecordingUrl: null,
  timerInterval: null,
  manualFallbackRequired: false,
  apiBaseUrl: (window.CALLMIND_API_BASE_URL || "").replace(/\/$/, ""),
};

const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition || null;
state.hasSpeechRecognition = Boolean(SpeechRecognitionCtor);

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");

const normalizeText = (text) =>
  text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

const formatDuration = (seconds) => {
  const value = Math.max(0, Math.floor(seconds || 0));
  const minutes = String(Math.floor(value / 60)).padStart(2, "0");
  const secs = String(value % 60).padStart(2, "0");
  return `${minutes}:${secs}`;
};

const setStatus = (message, tone = "neutral") => {
  ui.recordingState.textContent = message;
  ui.callCard.dataset.status = tone;
};

const setHealth = (ok, message) => {
  ui.healthDot.style.background = ok ? "#5be7b0" : "#ff7f7f";
  ui.healthText.textContent = message;
};

const setCallVisualState = (stateName) => {
  ui.callCard.dataset.state = stateName;
  ui.callAvatar.dataset.state = stateName;
};

const resetReportLink = () => {
  if (state.reportBlobUrl) {
    URL.revokeObjectURL(state.reportBlobUrl);
    state.reportBlobUrl = null;
  }
  ui.downloadReportBtn.href = "#";
  ui.downloadReportBtn.style.pointerEvents = "none";
  ui.downloadReportBtn.style.opacity = "0.5";
};

const renderConversation = () => {
  if (!state.conversation.length) {
    ui.chatList.innerHTML = `
      <div class="empty-state">
        <strong>La conversación aparecerá aquí</strong>
        <p>Inicia una llamada para ver el historial tipo chat con el usuario y la IA.</p>
      </div>
    `;
    return;
  }

  ui.chatList.innerHTML = state.conversation
    .map((message) => {
      const label = message.speaker === "user" ? "Usuario" : "IA";
      const meta = message.speaker === "assistant" && message.intent ? `<span class="message-tag">${message.intent}</span>` : "";
      return `
        <article class="message ${message.speaker}">
          <div class="message-head">
            <span class="message-label">${label}</span>
            <span class="message-time">${new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
          </div>
          <p>${escapeHtml(message.text)}</p>
          ${meta}
        </article>
      `;
    })
    .join("");

  ui.chatList.scrollTop = ui.chatList.scrollHeight;
};

const renderBadges = () => {
  ui.intentBadge.textContent = state.latestIntent;
  ui.scoreBadge.textContent = `Score: ${state.latestScore || "--"}`;
  ui.durationBadge.textContent = state.callActive
    ? formatDuration((Date.now() - state.startedAt) / 1000)
    : formatDuration(state.startedAt && state.endedAt ? (state.endedAt - state.startedAt) / 1000 : 0);
  ui.callTimer.textContent = ui.durationBadge.textContent;
  ui.supportResponseText.textContent = state.supportResponse || "La respuesta de soporte aparecerá aquí.";
  ui.callIdText.textContent = state.callId ? `Call ID: ${state.callId}` : "Call ID: --";
  ui.transcriptValue.textContent = state.conversation.filter((message) => message.speaker === "user").slice(-1)[0]?.text || "Esperando llamada";
  ui.reportPreview.textContent = state.latestSummary || "El reporte se generará al finalizar la llamada.";
};

const renderCompatibility = () => {
  if (state.hasSpeechRecognition && !state.manualFallbackRequired) {
    ui.compatibilityPill.textContent = "Reconocimiento de voz disponible";
    ui.fallbackNotice.hidden = true;
    ui.fallbackInput.hidden = true;
    ui.fallbackSendBtn.hidden = true;
  } else {
    ui.compatibilityPill.textContent = "Fallback con MediaRecorder y texto manual";
    ui.fallbackNotice.hidden = false;
    ui.fallbackInput.hidden = false;
    ui.fallbackSendBtn.hidden = false;
  }
};

const showManualFallback = (message) => {
  state.manualFallbackRequired = true;
  ui.fallbackNotice.hidden = false;
  ui.fallbackInput.hidden = false;
  ui.fallbackSendBtn.hidden = false;
  ui.fallbackInput.disabled = false;
  ui.fallbackSendBtn.disabled = false;
  ui.fallbackNotice.style.display = "grid";
  if (message) {
    ui.fallbackNotice.querySelector("p").textContent = message;
  }
};

const appendMessage = (message) => {
  state.conversation.push(message);
  renderConversation();
};

const detectIntent = (text) => {
  const normalized = normalizeText(text);
  for (const [intent, config] of Object.entries(SUPPORT_INTENTS)) {
    if (intent === "unknown") continue;
    if (config.keywords.some((keyword) => normalized.includes(normalizeText(keyword)))) {
      return intent;
    }
  }
  return "unknown";
};

const generateSupportResponse = (intent, text) => {
  if (intent === "unknown") {
    return SUPPORT_INTENTS.unknown.response;
  }

  if (intent === "password_reset" && /mfa|otp|codigo/.test(normalizeText(text))) {
    return "Parece que el bloqueo está relacionado con el segundo factor. Revisa si el código llegó al canal correcto, valida que el teléfono o app autenticadora estén sincronizados y, si no recibes el código, soporte puede revisar el enrolamiento MFA.";
  }

  return SUPPORT_INTENTS[intent]?.response || SUPPORT_INTENTS.unknown.response;
};

const calculateSatisfactionScore = (conversation, intent) => {
  const turns = conversation.length;
  const intentBonus = intent === "unknown" ? 0 : 9;
  return Math.max(68, Math.min(98, 73 + intentBonus + Math.min(turns * 2, 8)));
};

const summarizeConversation = (conversation, intent) => {
  if (!conversation.length) {
    return "Llamada sin interacción registrada.";
  }

  const userTurns = conversation.filter((message) => message.speaker === "user");
  const lastIssue = userTurns[userTurns.length - 1]?.text || "incidente no detallado";
  const label = intent === "unknown" ? "incidente general" : intent.replace(/_/g, " ");
  return `Se atendió una llamada de soporte sobre ${label}. El usuario describió: ${lastIssue}. Se ofrecieron pasos iniciales de diagnóstico y escalado si fuera necesario.`;
};

const buildSupportPayload = (text) => ({
  text,
  conversation_history: state.conversation.map((message) => ({
    speaker: message.speaker,
    text: message.text,
    intent: message.intent || null,
    timestamp: message.timestamp,
  })),
});

const generateCallReport = (ended) => {
  const startedAt = state.startedAt ? new Date(state.startedAt).toISOString() : nowIso();
  const endedAt = ended ? nowIso() : startedAt;
  const endTimestamp = ended ? Date.now() : state.startedAt || Date.now();
  const durationSeconds = state.startedAt ? Math.max(0, Math.round((endTimestamp - state.startedAt) / 1000)) : 0;
  const latestIntent = state.latestIntent || "unknown";
  const summary = summarizeConversation(state.conversation, latestIntent);

  return {
    call_id: state.callId || createId(),
    started_at: startedAt,
    ended_at: endedAt,
    duration_seconds: durationSeconds,
    status: ended ? "completed" : "in_progress",
    conversation: state.conversation.map((message) => {
      if (message.speaker === "assistant") {
        return {
          speaker: "assistant",
          text: message.text,
          intent: message.intent || "unknown",
          timestamp: message.timestamp,
        };
      }

      return {
        speaker: "user",
        text: message.text,
        timestamp: message.timestamp,
      };
    }),
    detected_intents: state.detectedIntents,
    summary,
    satisfaction_score: state.latestScore || calculateSatisfactionScore(state.conversation, latestIntent),
  };
};

const updateDownloadLink = (report) => {
  if (state.reportBlobUrl) {
    URL.revokeObjectURL(state.reportBlobUrl);
  }

  const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
  state.reportBlobUrl = URL.createObjectURL(blob);
  ui.downloadReportBtn.href = state.reportBlobUrl;
  ui.downloadReportBtn.download = `call_${report.call_id}_report.json`;
  ui.downloadReportBtn.style.pointerEvents = "auto";
  ui.downloadReportBtn.style.opacity = "1";
};

const startTimer = () => {
  stopTimer();
  state.timerInterval = window.setInterval(() => {
    if (state.callActive && state.startedAt) {
      ui.callTimer.textContent = formatDuration((Date.now() - state.startedAt) / 1000);
      ui.durationBadge.textContent = ui.callTimer.textContent;
    }
  }, 1000);
};

const stopTimer = () => {
  if (state.timerInterval) {
    window.clearInterval(state.timerInterval);
    state.timerInterval = null;
  }
};

const ensureMicPermission = async () => {
  if (!navigator.mediaDevices?.getUserMedia) {
    return false;
  }

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  stream.getTracks().forEach((track) => track.stop());
  return true;
};

const createRecognition = () => {
  if (!SpeechRecognitionCtor) {
    return null;
  }

  const recognition = new SpeechRecognitionCtor();
  recognition.lang = "es-ES";
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;
  return recognition;
};

const stopRecognition = () => {
  clearTimeout(state.silenceTimer);
  state.silenceTimer = null;
  state.pendingTranscript = "";

  if (state.recognition) {
    try {
      state.recognition.onresult = null;
      state.recognition.onend = null;
      state.recognition.onerror = null;
      state.recognition.stop();
    } catch {
      // noop
    }
  }

  state.isListening = false;
};

const startRecognition = () => {
  if (!state.callActive || !state.hasSpeechRecognition) {
    return false;
  }

  if (!state.recognition) {
    state.recognition = createRecognition();
  }

  if (!state.recognition) {
    return false;
  }

  const recognition = state.recognition;

  recognition.onresult = (event) => {
    const transcript = Array.from(event.results)
      .map((result) => result[0]?.transcript || "")
      .join(" ")
      .trim();

    if (!transcript) {
      return;
    }

    state.pendingTranscript = transcript;
    ui.transcriptValue.textContent = transcript;
    setStatus("Escuchando... detectando fin de frase", "listening");
    clearTimeout(state.silenceTimer);
    state.silenceTimer = window.setTimeout(() => {
      if (state.pendingTranscript && state.callActive && !state.isProcessing && !state.isSpeaking) {
        stopRecognition();
        processTurn(state.pendingTranscript);
      }
    }, 1400);
  };

  recognition.onerror = (event) => {
    if (event.error === "not-allowed" || event.error === "service-not-allowed") {
      state.demoMode = true;
      showManualFallback("El navegador bloqueó el reconocimiento. Usa el fallback manual.");
      setStatus("El navegador bloqueó el reconocimiento. Usa el fallback manual.", "fallback");
      renderCompatibility();
      stopRecognition();
      return;
    }

    if (state.callActive && !state.isProcessing && !state.isSpeaking) {
      setTimeout(() => startRecognition(), 300);
    }
  };

  recognition.onend = () => {
    state.isListening = false;
    if (!state.callActive || state.isProcessing || state.isSpeaking) {
      return;
    }

    if (state.pendingTranscript) {
      const transcript = state.pendingTranscript;
      state.pendingTranscript = "";
      processTurn(transcript);
      return;
    }

    setStatus("Escuchando nuevamente...", "listening");
    setTimeout(() => {
      if (state.callActive && !state.isProcessing && !state.isSpeaking) {
        startRecognition();
      }
    }, 300);
  };

  try {
    recognition.start();
    state.isListening = true;
    setStatus("Escuchando... habla con naturalidad", "listening");
    setCallVisualState("listening");
    return true;
  } catch (error) {
    console.warn("Recognition start failed:", error);
    return false;
  }
};

const speak = (text) =>
  new Promise((resolve) => {
    if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
      resolve(false);
      return;
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

      let settled = false;
      const finish = (succeeded) => {
        if (settled) {
          return;
        }
        settled = true;
        window.clearTimeout(timeoutId);
        state.isSpeaking = false;
        setStatus(state.callActive ? "Escuchando nuevamente..." : "Llamada finalizada", state.callActive ? "listening" : "ended");
        setCallVisualState(state.callActive ? "listening" : "idle");
        resolve(succeeded);
      };

      const timeoutId = window.setTimeout(() => {
        try {
          window.speechSynthesis.cancel();
        } catch {
          // noop
        }
        finish(false);
      }, 7000);

      utterance.onstart = () => {
        state.isSpeaking = true;
        setStatus("Respondiendo...", "speaking");
        setCallVisualState("speaking");
      };

      utterance.onend = () => finish(true);

      utterance.onerror = () => finish(false);

      window.speechSynthesis.speak(utterance);
    } catch (error) {
      console.warn("Speech synthesis failed:", error);
      resolve(false);
    }
  });

const fetchBackendStatus = async () => {
  const healthUrl = state.apiBaseUrl ? `${state.apiBaseUrl}/api/health` : "/api/health";

  try {
    const response = await fetch(healthUrl, { cache: "no-store" });
    if (!response.ok) throw new Error("health check failed");
    const data = await response.json();
    state.demoMode = false;
    state.backendMode = true;
    setHealth(true, data.status === "ok" ? "Backend disponible" : "Backend disponible");
  } catch {
    state.demoMode = true;
    state.backendMode = false;
    setHealth(true, "Demo local sin backend");
  }
};

const postSupportResponse = async (text) => {
  if (!state.backendMode) {
    const intent = detectIntent(text);
    const response = generateSupportResponse(intent, text);
    const score = calculateSatisfactionScore(state.conversation, intent);
    return { intent, response, score };
  }

  const endpoint = `${state.apiBaseUrl || ""}/api/support/respond`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildSupportPayload(text)),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || "No fue posible procesar la respuesta.");
  }

  return data;
};

const processTurn = async (text) => {
  const trimmed = text.trim();
  if (!trimmed) {
    setStatus("No se detectó texto útil. Vuelve a hablar.", "listening");
    if (state.callActive) {
      startRecognition();
    }
    return;
  }

  state.isProcessing = true;
  setCallVisualState("processing");
  setStatus("Procesando...", "processing");
  state.pendingTranscript = "";
  clearTimeout(state.silenceTimer);
  state.silenceTimer = null;

  appendMessage({ speaker: "user", text: trimmed, timestamp: nowIso() });

  try {
    const support = await postSupportResponse(trimmed);
    const intent = support.intent || detectIntent(trimmed);
    const responseText = support.response || support.support_response || generateSupportResponse(intent, trimmed);
    const score = Number.isFinite(Number(support.score)) ? Number(support.score) : calculateSatisfactionScore(state.conversation, intent);

    state.latestIntent = intent;
    state.latestScore = score;
    state.supportResponse = responseText;
    state.detectedIntents = Array.from(new Set([...state.detectedIntents, intent].filter(Boolean)));
    state.latestSummary = summarizeConversation(state.conversation, intent);

    appendMessage({ speaker: "assistant", text: responseText, intent, timestamp: nowIso() });
    renderBadges();
    await speak(responseText);
  } catch (error) {
    console.warn("Turn processing failed:", error);
    const fallbackIntent = detectIntent(trimmed);
    const responseText = generateSupportResponse(fallbackIntent, trimmed);
    const score = calculateSatisfactionScore(state.conversation, fallbackIntent);

    state.latestIntent = fallbackIntent;
    state.latestScore = score;
    state.supportResponse = responseText;
    state.detectedIntents = Array.from(new Set([...state.detectedIntents, fallbackIntent].filter(Boolean)));
    state.latestSummary = summarizeConversation(state.conversation, fallbackIntent);

    appendMessage({ speaker: "assistant", text: responseText, intent: fallbackIntent, timestamp: nowIso() });
    renderBadges();
    await speak(responseText);
  } finally {
    state.isProcessing = false;
    if (state.callActive && !state.isSpeaking && state.hasSpeechRecognition) {
      setStatus("Escuchando nuevamente...", "listening");
      startRecognition();
    }
  }
};

const startMediaRecorderFallback = async () => {
  if (!navigator.mediaDevices?.getUserMedia) {
    return false;
  }

  state.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  state.fallbackChunks = [];
  const options = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
    ? { mimeType: "audio/webm;codecs=opus" }
    : MediaRecorder.isTypeSupported("audio/webm")
      ? { mimeType: "audio/webm" }
      : {};

  state.mediaRecorder = new MediaRecorder(state.mediaStream, options);
  state.mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      state.fallbackChunks.push(event.data);
    }
  };
  state.mediaRecorder.onstop = () => {
    const blob = new Blob(state.fallbackChunks, { type: state.mediaRecorder.mimeType || "audio/webm" });
    state.fallbackRecordingUrl = URL.createObjectURL(blob);
    ui.ttsHint.hidden = false;
    ui.ttsHint.textContent = "Se guardó una grabación de respaldo. El texto manual se usará para procesar la llamada.";
    state.mediaStream?.getTracks().forEach((track) => track.stop());
    state.mediaStream = null;
  };

  state.mediaRecorder.start();
  return true;
};

const stopMediaRecorder = () => {
  if (state.mediaRecorder && state.mediaRecorder.state !== "inactive") {
    state.mediaRecorder.stop();
  }
};

const prepareNewCall = () => {
  state.callId = createId();
  state.startedAt = Date.now();
  state.endedAt = null;
  state.conversation = [];
  state.detectedIntents = [];
  state.latestIntent = "unknown";
  state.latestScore = 0;
  state.latestSummary = "";
  state.supportResponse = "";
  state.pendingTranscript = "";
  state.callActive = true;
  state.isProcessing = false;
  state.isSpeaking = false;
  state.manualFallbackRequired = false;
  resetReportLink();
  ui.reportPreview.textContent = "El reporte se generará al finalizar la llamada.";
  ui.callIdText.textContent = `Call ID: ${state.callId}`;
  ui.downloadReportBtn.textContent = "Descargar reporte JSON";
  ui.startBtn.disabled = true;
  ui.hangupBtn.disabled = false;
  ui.fallbackSendBtn.disabled = false;
  ui.fallbackInput.disabled = false;
  ui.fallbackInput.value = "";
  ui.transcriptValue.textContent = "Esperando llamada";
  ui.supportResponseText.textContent = "La respuesta de soporte aparecerá aquí.";
  ui.intentBadge.textContent = "unknown";
  ui.scoreBadge.textContent = "Score: --";
  ui.durationBadge.textContent = "00:00";
  ui.callTimer.textContent = "00:00";
  ui.chatList.innerHTML = "";
  renderConversation();
  renderBadges();
  startTimer();
};

const stopCall = () => {
  if (!state.callActive) {
    return;
  }

  state.callActive = false;
  state.endedAt = Date.now();
  window.speechSynthesis?.cancel?.();
  stopRecognition();
  stopMediaRecorder();
  stopTimer();
  ui.startBtn.disabled = false;
  ui.hangupBtn.disabled = true;
  ui.fallbackSendBtn.disabled = true;
  ui.fallbackInput.disabled = true;
  state.isProcessing = false;
  state.isSpeaking = false;
  setCallVisualState("idle");
  setStatus("Llamada finalizada", "ended");
  const report = generateCallReport(true);
  state.latestSummary = report.summary;
  renderBadges();
  updateDownloadLink(report);
  ui.reportPreview.textContent = JSON.stringify(report, null, 2);
};

const startCall = async () => {
  if (state.callActive) {
    return;
  }

  prepareNewCall();
  setCallVisualState("starting");
  setStatus("Solicitando acceso al micrófono...", "starting");

  try {
    await ensureMicPermission();
  } catch (error) {
    console.warn("Microphone permission failed:", error);
    showManualFallback("El micrófono no está disponible. Usa el fallback manual.");
    state.demoMode = true;
    setStatus("El micrófono no está disponible. Usa el fallback manual.", "fallback");
    renderCompatibility();
    await startMediaRecorderFallback().catch(() => null);
    ui.fallbackInput.focus();
    return;
  }

  if (!state.hasSpeechRecognition) {
    state.demoMode = true;
    showManualFallback("Tu navegador no soporta reconocimiento de voz. Usa el campo de texto como fallback.");
    setStatus("Tu navegador no soporta reconocimiento de voz. Usa el campo de texto como fallback.", "fallback");
    renderCompatibility();
    await startMediaRecorderFallback().catch(() => null);
    ui.fallbackInput.focus();
    return;
  }

  const listeningStarted = startRecognition();
  if (!listeningStarted) {
    state.demoMode = true;
    showManualFallback("No fue posible iniciar el reconocimiento. Cambiando al fallback manual.");
    setStatus("No fue posible iniciar el reconocimiento. Cambiando al fallback manual.", "fallback");
    renderCompatibility();
    await startMediaRecorderFallback().catch(() => null);
    ui.fallbackInput.focus();
    return;
  }

  setStatus("Escuchando... habla con naturalidad", "listening");
  setCallVisualState("listening");
};

const sendManualFallback = async () => {
  const text = ui.fallbackInput.value.trim();
  if (!text) {
    setStatus("Escribe lo que el usuario dijo para continuar.", "fallback");
    ui.fallbackInput.focus();
    return;
  }

  if (!state.callActive) {
    await startCall();
  }

  await processTurn(text);
  ui.fallbackInput.value = "";
};

const init = async () => {
  renderConversation();
  renderCompatibility();
  ui.hangupBtn.disabled = true;
  ui.fallbackSendBtn.disabled = true;
  ui.fallbackInput.disabled = true;
  await fetchBackendStatus();
  renderCompatibility();
  setHealth(true, state.backendMode ? "Backend disponible" : "Demo local sin backend");
  setStatus("Esperando llamada", "idle");
  setCallVisualState("idle");
  renderBadges();
};

ui.startBtn.addEventListener("click", startCall);
ui.hangupBtn.addEventListener("click", stopCall);
ui.fallbackSendBtn.addEventListener("click", sendManualFallback);
ui.fallbackInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && event.ctrlKey) {
    event.preventDefault();
    sendManualFallback();
  }
});

window.speechSynthesis?.addEventListener?.("voiceschanged", () => {
  // keep voices warm for the next utterance
});

init();
