import { sendEmailTemplate } from './emailService';

const OLLAMA_URL = process.env.REACT_APP_OLLAMA_URL || 'http://localhost:11434/api/generate';
const OLLAMA_MODEL = process.env.REACT_APP_OLLAMA_MODEL || 'llama3';
const CRASH_MODEL_URL = process.env.REACT_APP_CRASH_MODEL_URL || 'http://127.0.0.1:5000/analyze';
const ANALYSIS_PROVIDER = String(process.env.REACT_APP_ANALYSIS_PROVIDER || 'auto').toLowerCase();
const DISPATCHER_TEMPLATE_ID =
  process.env.REACT_APP_EMAILJS_TEMPLATE_DISPATCHER_ID || 'template_dispatcher';
const LOVED_ONES_TEMPLATE_ID =
  process.env.REACT_APP_EMAILJS_TEMPLATE_LOVED_ONES_ID || 'template_loved_ones';

const sentEventKeys = new Set();

function randomBetween(min, max, decimals = 0) {
  const factor = 10 ** decimals;
  const n = min + Math.random() * (max - min);
  return Math.round(n * factor) / factor;
}

function arbitraryFallbacks() {
  return {
    driverName: 'Unknown Driver',
    contactNumber: '+1-000-000-0000',
    bloodGroup: 'Unknown',
    gpsLat: randomBetween(1.2, 1.5, 6),
    gpsLng: randomBetween(103.6, 104.0, 6),
    impactScore: randomBetween(45, 95, 0),
    speed: randomBetween(35, 120, 0),
    gyro: randomBetween(1.2, 9.5, 2),
    accel: randomBetween(0.8, 3.8, 2),
    batteryLevel: `${randomBetween(18, 97, 0)}%`,
    dispatcherSummary: 'Crash likelihood high. Immediate dispatch and medical triage recommended.',
    lovedOnesMessage: 'Possible accident detected. Emergency services have been notified.',
  };
}

function validateTemplateConfiguration() {
  if (!DISPATCHER_TEMPLATE_ID || !LOVED_ONES_TEMPLATE_ID) {
    throw new Error('Missing EmailJS template IDs for dispatcher/loved ones.');
  }

  if (DISPATCHER_TEMPLATE_ID === LOVED_ONES_TEMPLATE_ID) {
    throw new Error(
      'Dispatcher and loved ones template IDs must be different. Set REACT_APP_EMAILJS_TEMPLATE_LOVED_ONES_ID to a different template in .env.'
    );
  }
}

function normalizeRecipients(value) {
  return [...new Set(
    String(value || '')
      .split(/[;,]/)
      .map(v => v.trim().toLowerCase())
      .filter(Boolean)
  )];
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function safeJsonParse(text) {
  if (!text || typeof text !== 'string') return null;

  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function normalizeSeverityLevel(input, fallback = 'LOW') {
  const normalized = String(input || '').toUpperCase();
  return ['LOW', 'MEDIUM', 'HIGH'].includes(normalized) ? normalized : fallback;
}

function normalizeConfidence(input, fallback = 0) {
  const n = Number(input);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(1, n > 1 ? n / 100 : n));
}

function parseOllamaAnalysis(payload) {
  const parsed = safeJsonParse(payload?.response || '');
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Ollama returned non-JSON analysis.');
  }

  const rawCrash = parsed.crashDetected;
  const crashDetected = typeof rawCrash === 'boolean'
    ? rawCrash
    : String(rawCrash).trim().toLowerCase() === 'true';
  const severityLevel = normalizeSeverityLevel(parsed.severityLevel, 'LOW');
  const confidenceScore = Number(parsed.confidenceScore);
  if (!Number.isFinite(confidenceScore)) {
    throw new Error('Ollama confidenceScore is invalid.');
  }

  const enriched = parsed.enriched && typeof parsed.enriched === 'object'
    ? parsed.enriched
    : {};

  return {
    crashDetected,
    severityLevel,
    confidenceScore: normalizeConfidence(confidenceScore, 0),
    enriched: {
      driverName: String(enriched.driverName || '').trim(),
      contactNumber: String(enriched.contactNumber || '').trim(),
      bloodGroup: String(enriched.bloodGroup || '').trim(),
      gpsLat: Number(enriched.gpsLat),
      gpsLng: Number(enriched.gpsLng),
      impactScore: Number(enriched.impactScore),
      speed: Number(enriched.speed),
      gyro: Number(enriched.gyro),
      accel: Number(enriched.accel),
      batteryLevel: String(enriched.batteryLevel || '').trim(),
      dispatcherSummary: String(enriched.dispatcherSummary || '').trim(),
      lovedOnesMessage: String(enriched.lovedOnesMessage || '').trim(),
    },
  };
}

function parseLocalModelAnalysis(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Local model returned invalid JSON payload.');
  }

  const confidenceScore = normalizeConfidence(payload.confidenceScore, 0);
  const crashDetected = typeof payload.crashDetected === 'boolean'
    ? payload.crashDetected
    : confidenceScore >= 0.25;

  const severityFromConfidence = confidenceScore >= 0.8
    ? 'HIGH'
    : confidenceScore >= 0.55
      ? 'MEDIUM'
      : 'LOW';
  const severityLevel = normalizeSeverityLevel(payload.severityLevel, severityFromConfidence);
  const enriched = payload.enriched && typeof payload.enriched === 'object'
    ? payload.enriched
    : {};

  return {
    crashDetected,
    severityLevel,
    confidenceScore,
    enriched: {
      driverName: String(enriched.driverName || '').trim(),
      contactNumber: String(enriched.contactNumber || '').trim(),
      bloodGroup: String(enriched.bloodGroup || '').trim(),
      gpsLat: Number(enriched.gpsLat),
      gpsLng: Number(enriched.gpsLng),
      impactScore: Number(enriched.impactScore),
      speed: Number(enriched.speed),
      gyro: Number(enriched.gyro),
      accel: Number(enriched.accel),
      batteryLevel: String(enriched.batteryLevel || '').trim(),
      dispatcherSummary: String(enriched.dispatcherSummary || '').trim(),
      lovedOnesMessage: String(enriched.lovedOnesMessage || '').trim(),
    },
  };
}

function severityToTag(severityLevel) {
  const normalized = String(severityLevel || '').toUpperCase();
  if (normalized === 'HIGH') return 'severe';
  if (normalized === 'MEDIUM') return 'moderate';
  return 'minor';
}

function batteryLevel() {
  if (typeof navigator === 'undefined' || typeof navigator.getBattery !== 'function') {
    return 'N/A';
  }
  return navigator.getBattery()
    .then((battery) => `${Math.round((battery.level || 0) * 100)}%`)
    .catch(() => 'N/A');
}

function buildMapsLink(gps) {
  const lat = Number(gps?.lat);
  const lng = Number(gps?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return '';
  return `https://maps.google.com/?q=${lat},${lng}`;
}

function buildEventKey({ incident, metrics, user }) {
  const incidentId = incident?.id || incident?.reportId;
  if (incidentId) return `incident:${incidentId}`;

  const t = incident?.timestamp || '';
  const impact = metrics?.impactScore ?? '';
  const speed = metrics?.speed ?? '';
  return `fallback:${user?.email || 'anon'}:${t}:${impact}:${speed}`;
}

function incidentLevelToAnalysis(incident) {
  const sevTag = String(incident?.severity || '').toLowerCase();
  const score = normalizeConfidence(incident?.score, 0);
  if (sevTag === 'severe' && score >= 0.8) {
    return { crashDetected: true, severityLevel: 'HIGH', confidenceScore: score, enriched: {} };
  }
  if (sevTag === 'moderate' && score >= 0.65) {
    return { crashDetected: true, severityLevel: 'MEDIUM', confidenceScore: score, enriched: {} };
  }
  return null;
}

async function analyzeWithOllama(context) {
  const prompt = [
    'You are a vehicle crash detection and emergency report generator.',
    'Return strict JSON only with no markdown and no extra text.',
    'Always fill every field in "enriched" with plausible values.',
    'Schema:',
    '{',
    '  "crashDetected": boolean,',
    '  "severityLevel": "LOW|MEDIUM|HIGH",',
    '  "confidenceScore": number,',
    '  "enriched": {',
    '    "driverName": string,',
    '    "contactNumber": string,',
    '    "bloodGroup": string,',
    '    "gpsLat": number,',
    '    "gpsLng": number,',
    '    "impactScore": number,',
    '    "speed": number,',
    '    "gyro": number,',
    '    "accel": number,',
    '    "batteryLevel": string,',
    '    "dispatcherSummary": string,',
    '    "lovedOnesMessage": string',
    '  }',
    '}',
    'Input context:',
    JSON.stringify(context),
  ].join('\n');

  const response = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt,
      stream: false,
      options: { temperature: 0 },
    }),
  });

  if (!response.ok) {
    const msg = await response.text();
    throw new Error(`Ollama request failed (${response.status}) ${msg}`.trim());
  }

  const payload = await response.json();
  return parseOllamaAnalysis(payload);
}

async function analyzeWithLocalModel(context) {
  const response = await fetch(CRASH_MODEL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      timestamp: new Date().toISOString(),
      context,
    }),
  });

  if (!response.ok) {
    const msg = await response.text();
    throw new Error(`Local model request failed (${response.status}) ${msg}`.trim());
  }

  const payload = await response.json();
  return parseLocalModelAnalysis(payload);
}

export async function analyzeCrash(context) {
  if (ANALYSIS_PROVIDER === 'local_model') {
    return analyzeWithLocalModel(context);
  }

  if (ANALYSIS_PROVIDER === 'ollama') {
    return analyzeWithOllama(context);
  }

  try {
    return await analyzeWithLocalModel(context);
  } catch {
    return analyzeWithOllama(context);
  }
}

export async function sendDispatcherEmail(reportData) {
  const dispatcherEmail = String(reportData.user?.dispatcherEmail || '').trim().toLowerCase();
  if (!isValidEmail(dispatcherEmail)) {
    return { sent: false, skipped: true, reason: 'dispatcher_email_missing' };
  }

  const params = {
    to_email: dispatcherEmail,
    subject: '🚨 Crash Incident Report – Immediate Dispatch Required',
    report_id: reportData.reportId,
    timestamp: reportData.timestampLocal,
    timestamp_local: reportData.timestampLocal,
    timestamp_utc: reportData.timestampUtc,
    severity_level: reportData.severityLevel,
    ai_confidence: `${Math.round(reportData.confidenceScore * 100)}%`,
    gps_coordinates: `${reportData.gps.lat}, ${reportData.gps.lng}`,
    google_maps_link: reportData.googleMapsLink,
    driver_name: reportData.user.name || 'Driver',
    contact_number: reportData.user.phone || 'N/A',
    blood_group: reportData.user.blood || 'Unknown',
    impact_score: String(reportData.metrics.impactScore),
    speed_at_impact: `${reportData.metrics.speed} km/h`,
    gyro: String(reportData.metrics.gyro),
    accel: String(reportData.metrics.accel),
    device_battery_level: reportData.metrics.batteryLevel,
    incident_summary: reportData.dispatcherSummary,
    crash_image_data: reportData.crashImageDataUrl || '',
    crash_image_url: reportData.crashImageDataUrl || '',
  };

  const result = await sendEmailTemplate({
    templateId: DISPATCHER_TEMPLATE_ID,
    params,
  });

  return { sent: true, recipient: dispatcherEmail, real: result.real };
}

export async function sendLovedOnesEmail(reportData) {
  const dispatcherEmail = String(reportData.user?.dispatcherEmail || '').trim().toLowerCase();
  const lovedOnesRecipients = normalizeRecipients(reportData.user?.emergencyEmail)
    .filter(isValidEmail)
    .filter(email => email !== dispatcherEmail);

  if (lovedOnesRecipients.length === 0) {
    return { sent: false, skipped: true, reason: 'loved_ones_email_missing', recipients: [] };
  }

  const paramsFor = (email) => ({
    to_email: email,
    subject: '⚠️ Possible Accident Detected',
    driver_name: reportData.user.name || 'Driver',
    location_link: reportData.googleMapsLink,
    emergency_message: reportData.lovedOnesMessage || 'Emergency services have been notified.',
    contact_number: reportData.user.phone || 'N/A',
    timestamp_local: reportData.timestampLocal,
    timestamp_utc: reportData.timestampUtc,
  });

  const sends = await Promise.all(
    lovedOnesRecipients.map((email) => sendEmailTemplate({
      templateId: LOVED_ONES_TEMPLATE_ID,
      params: paramsFor(email),
    }))
  );

  const allReal = sends.every(result => result.real);
  return { sent: true, recipients: lovedOnesRecipients, real: allReal };
}

export async function handleCrashEvent({ user, incident, metrics }) {
  validateTemplateConfiguration();

  const eventKey = buildEventKey({ incident, metrics, user });
  if (sentEventKeys.has(eventKey)) {
    return { sent: false, duplicate: true, reason: 'duplicate_event' };
  }

  sentEventKeys.add(eventKey);

  try {
    const inferredAnalysis = incidentLevelToAnalysis(incident);
    const analysis = inferredAnalysis || await analyzeCrash({ user, incident, metrics });
    const severityLevel = String(analysis?.severityLevel || '').toUpperCase();
    const confidence = normalizeConfidence(analysis?.confidenceScore, 0);
    const shouldSend = Boolean(
      analysis?.crashDetected &&
      (
        (severityLevel === 'HIGH' && confidence >= 0.8) ||
        (severityLevel === 'MEDIUM' && confidence >= 0.65)
      )
    );

    if (!shouldSend) {
      return { sent: false, crashDetected: false, analysis };
    }

    const reportId = incident?.reportId
      || (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `report_${Date.now()}`);
    const fallbacks = arbitraryFallbacks();
    const ai = analysis.enriched || {};

    const gps = {
      lat: Number.isFinite(ai.gpsLat)
        ? ai.gpsLat
        : (Number.isFinite(Number(incident?.gps?.lat)) ? Number(incident.gps.lat) : fallbacks.gpsLat),
      lng: Number.isFinite(ai.gpsLng)
        ? ai.gpsLng
        : (Number.isFinite(Number(incident?.gps?.lng)) ? Number(incident.gps.lng) : fallbacks.gpsLng),
    };
    const eventTime = incident?.timestamp ? new Date(incident.timestamp) : new Date();
    const safeEventTime = Number.isNaN(eventTime.getTime()) ? new Date() : eventTime;
    const timestampIso = safeEventTime.toISOString();
    const timestampUtc = safeEventTime.toUTCString();
    const timestampLocal = safeEventTime.toLocaleString();

    const resolvedUser = {
      ...user,
      name: ai.driverName || user?.name || fallbacks.driverName,
      phone: ai.contactNumber || user?.phone || fallbacks.contactNumber,
      blood: ai.bloodGroup || user?.blood || fallbacks.bloodGroup,
    };

    const resolvedMetrics = {
      impactScore: Number.isFinite(ai.impactScore)
        ? ai.impactScore
        : (Number.isFinite(Number(metrics?.impactScore)) ? Number(metrics.impactScore) : fallbacks.impactScore),
      speed: Number.isFinite(ai.speed)
        ? ai.speed
        : (Number.isFinite(Number(metrics?.speed)) ? Number(metrics.speed) : fallbacks.speed),
      gyro: Number.isFinite(ai.gyro)
        ? ai.gyro
        : (Number.isFinite(Number(metrics?.gyro)) ? Number(metrics.gyro) : fallbacks.gyro),
      accel: Number.isFinite(ai.accel)
        ? ai.accel
        : (Number.isFinite(Number(metrics?.accel)) ? Number(metrics.accel) : fallbacks.accel),
      batteryLevel: ai.batteryLevel
        || metrics?.batteryLevel
        || await batteryLevel()
        || fallbacks.batteryLevel,
    };

    const reportData = {
      reportId,
      timestampIso,
      timestampUtc,
      timestampLocal,
      severityLevel: analysis.severityLevel,
      confidenceScore: analysis.confidenceScore,
      gps,
      googleMapsLink: buildMapsLink(gps),
      user: resolvedUser,
      metrics: resolvedMetrics,
      dispatcherSummary: ai.dispatcherSummary || fallbacks.dispatcherSummary,
      lovedOnesMessage: ai.lovedOnesMessage || fallbacks.lovedOnesMessage,
      crashImageDataUrl: String(incident?.screenshotDataUrl || '').trim(),
    };

    const [dispatcher, lovedOnes] = await Promise.all([
      sendDispatcherEmail(reportData),
      sendLovedOnesEmail(reportData),
    ]);

    const sentTo = [
      ...(dispatcher.sent ? [dispatcher.recipient] : []),
      ...(lovedOnes.sent ? lovedOnes.recipients : []),
    ];

    if (sentTo.length === 0) {
      throw new Error('No valid dispatcher or loved one recipient configured.');
    }

    return {
      sent: true,
      crashDetected: true,
      analysis,
      severity: severityToTag(analysis.severityLevel),
      score: analysis.confidenceScore,
      reportId,
      recipients: sentTo,
      dispatcher,
      lovedOnes,
      real: Boolean(dispatcher.real || lovedOnes.real),
    };
  } catch (err) {
    sentEventKeys.delete(eventKey);
    throw err;
  }
}

