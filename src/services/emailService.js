import emailjs from '@emailjs/browser';

const SERVICE_ID = process.env.REACT_APP_EMAILJS_SERVICE_ID || '';
const PUBLIC_KEY = process.env.REACT_APP_EMAILJS_PUBLIC_KEY || '';

export const EMAIL_CONFIGURED =
  !!SERVICE_ID && !SERVICE_ID.includes('PASTE') &&
  !!PUBLIC_KEY && !PUBLIC_KEY.includes('PASTE');

function extractEmailJsError(err) {
  if (!err) return 'Unknown EmailJS error';
  if (typeof err === 'string') return err;

  const status = err.status ? `status ${err.status}` : '';
  const text = err.text || err.message || '';

  if (status && text) return `${status}: ${text}`;
  if (status) return status;
  if (text) return text;

  try {
    return JSON.stringify(err);
  } catch {
    return 'Unknown EmailJS error';
  }
}

export async function sendEmailTemplate({ templateId, params }) {
  if (!templateId) {
    throw new Error('Email template id is missing.');
  }

  if (!EMAIL_CONFIGURED) {
    console.log('[CrashGuard] Email simulation (set EmailJS keys in .env for real delivery):');
    console.table({ templateId, ...params });
    await new Promise((resolve) => setTimeout(resolve, 400));
    return { success: true, real: false, simulated: true };
  }

  try {
    const response = await emailjs.send(SERVICE_ID, templateId, params, PUBLIC_KEY);
    return { success: true, real: true, response };
  } catch (err) {
    throw new Error(
      `EmailJS send failed (service: ${SERVICE_ID}, template: ${templateId}) - ${extractEmailJsError(err)}`
    );
  }
}
