// src/services/emailService.js
// ---------------------------------------------------------------------------
// SETUP INSTRUCTIONS for real emails:
// 1. Go to https://www.emailjs.com → Sign up free
// 2. Add a Service: Email Services → Gmail (connect your Gmail)
// 3. Create a Template with these variables in the body:
//
//    Subject: 🚨 CrashGuard Alert — {{driver_name}} has been in a crash
//
//    Body:
//    Dear {{emergency_name}},
//
//    A crash has been detected. Severity: {{severity}}
//    Driver: {{driver_name}} | Phone: {{driver_phone}}
//    Vehicle: {{vehicle}} | Plate: {{plate}} | Blood: {{blood}}
//    Time: {{timestamp}}
//    GPS: {{gps}} ({{location}})
//
//    AI Summary: {{summary}}
//    Confidence Score: {{score}}%
//
//    Please contact emergency services immediately.
//    — CrashGuard AI System
//
// 4. Copy your Service ID, Template ID, and Public Key into .env
// ---------------------------------------------------------------------------

import emailjs from '@emailjs/browser';

const SERVICE_ID  = process.env.REACT_APP_EMAILJS_SERVICE_ID   || '';
const TEMPLATE_ID = process.env.REACT_APP_EMAILJS_TEMPLATE_ID  || '';
const PUBLIC_KEY  = process.env.REACT_APP_EMAILJS_PUBLIC_KEY   || '';

export const EMAIL_CONFIGURED =
  !!SERVICE_ID && !SERVICE_ID.includes('PASTE') &&
  !!TEMPLATE_ID && !!PUBLIC_KEY;

/**
 * Send emergency alert email to the driver's emergency contact.
 * Falls back to console.log simulation if EmailJS is not configured.
 */
export async function sendEmergencyEmail({ user, incident }) {
  const params = {
    to_email:       user.emergencyEmail  || '',
    emergency_name: user.emergencyName   || 'Emergency Contact',
    driver_name:    user.name            || 'Driver',
    driver_phone:   user.phone           || 'N/A',
    vehicle:        user.vehicle         || 'Unknown Vehicle',
    plate:          user.plate           || 'N/A',
    blood:          user.blood           || 'Unknown',
    severity:       incident.severity?.toUpperCase() || 'UNKNOWN',
    timestamp:      new Date(incident.timestamp).toLocaleString('en-SG'),
    gps:            `${incident.gps?.lat}° N, ${incident.gps?.lng}° E`,
    location:       incident.location    || 'Singapore',
    summary:        incident.summary     || '',
    score:          Math.round((incident.score || 0) * 100),
  };

  if (EMAIL_CONFIGURED) {
    const response = await emailjs.send(SERVICE_ID, TEMPLATE_ID, params, PUBLIC_KEY);
    return { success: true, real: true, response };
  } else {
    // Simulation mode - log what would be sent
    console.log('[CrashGuard] Email simulation (add EmailJS keys to .env to send real emails):');
    console.table(params);
    // Simulate network delay
    await new Promise(r => setTimeout(r, 600));
    return { success: true, real: false, params };
  }
}
