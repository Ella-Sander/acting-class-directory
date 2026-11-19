import { BRAND, PUBLIC_ORIGIN, SUPPORT_EMAIL } from './brand.js';
export { SUPPORT_EMAIL } from './brand.js';
export const NOTIFICATION_SENDER = 'notifications@vocalcatalog.com';
const header = value => String(value || '').replace(/[\r\n\u0000-\u001f\u007f]/g, ' ').slice(0, 180);
const base64 = value => btoa(Array.from(new TextEncoder().encode(value), byte => String.fromCharCode(byte)).join(''));

export async function sendSupportEmail(env, { subject, text, replyTo = SUPPORT_EMAIL }) {
  if (!env.SUBMISSION_EMAIL) return 'not_configured';
  const raw = [
    `From: Vocal Catalog <${NOTIFICATION_SENDER}>`, `To: ${SUPPORT_EMAIL}`,
    `Reply-To: ${header(replyTo)}`, `Subject: ${header(subject)}`,
    'MIME-Version: 1.0', 'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64', '', base64(text).match(/.{1,76}/g).join('\r\n'), '',
  ].join('\r\n');
  try {
    // Native MIME messages work with Email Routing's verified destinations;
    // the newer structured Email Sending API requires separate beta onboarding.
    const { EmailMessage } = await import('cloudflare:email');
    await env.SUBMISSION_EMAIL.send(new EmailMessage(NOTIFICATION_SENDER, SUPPORT_EMAIL, raw));
    return 'sent';
  } catch (error) {
    console.error('Submission notification failed', header(error?.code || 'EMAIL_DELIVERY_ERROR'));
    return 'failed';
  }
}

export async function notifySubmission(env, id, payload) {
  if (!env.SUBMISSION_EMAIL) return 'not_configured';
  const message = {
    from: NOTIFICATION_SENDER,
    to: SUPPORT_EMAIL,
    replyTo: payload.contact_email,
    subject: `${BRAND}: ${header(payload.type?.replaceAll('_', ' '))} submission`,
    text: [
      `New ${payload.type} submission to ${BRAND}`,
      `Submission ID: ${id}`,
      `Name: ${payload.name || '(profile request)'}`,
      `Contact: ${payload.contact_name || ''} <${payload.contact_email}>`,
      `Website: ${payload.website_url || payload.registration_url || '(not supplied)'}`,
      '', 'Submitted details:', JSON.stringify(payload, null, 2), '',
      `Review: ${PUBLIC_ORIGIN}/admin/review/`,
      'This submission is saved as pending. An email notification does not publish or approve it.',
    ].join('\n'),
  };
  return sendSupportEmail(env, message);
}
