import test from 'node:test';
import assert from 'node:assert/strict';
import { notifySubmission, SUPPORT_EMAIL, NOTIFICATION_SENDER } from '../src/submission-email.js';
import worker from '../src/worker.js';
import { seoFixture } from '../scripts/seo-fixture.mjs';
import { registerHooks } from 'node:module';
registerHooks({
  resolve(specifier, context, next) { return specifier === 'cloudflare:email' ? { url: 'test:cloudflare-email', shortCircuit: true } : next(specifier, context); },
  load(url, context, next) { return url === 'test:cloudflare-email' ? { format: 'module', source: 'export class EmailMessage { constructor(from,to,raw) { this.from=from; this.to=to; this.raw=raw; } }', shortCircuit: true } : next(url, context); },
});

test('saved submissions notify the fixed support inbox with submitter reply-to and review link', async () => {
  const { db, env } = seoFixture(); const messages = [];
  env.SUBMISSION_EMAIL = { async send(message) {
    assert.ok(db.prepare("SELECT id FROM submissions WHERE status='pending'").get(), 'Database save happens before email');
    messages.push(message);
  } };
  try {
    const response = await worker.fetch(new Request('https://example.com/api/submissions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'teacher', name: 'Email test teacher', description: 'A sourced teaching profile.', contact_email: 'teacher@example.org', website_url: 'https://email-test.example.org', to: 'attacker@example.org' }) }), env);
    assert.equal(response.status, 201);
    const result = await response.json(); assert.equal(result.emailNotification, 'sent');
    assert.equal(messages.length, 1); assert.equal(messages[0].to, SUPPORT_EMAIL);
    assert.equal(messages[0].from, NOTIFICATION_SENDER); assert.ok(messages[0].raw.includes('Reply-To: teacher@example.org\r\n'));
    const body = Buffer.from(messages[0].raw.split('\r\n\r\n')[1].replaceAll('\r\n', ''), 'base64').toString('utf8');
    assert.ok(body.includes(result.submissionId));
    assert.ok(body.includes('https://vocalcatalog.com/admin/review/'));
  } finally { db.close(); }
});

test('email delivery failure does not discard a valid saved submission', async () => {
  const { db, env } = seoFixture(); env.SUBMISSION_EMAIL = { async send() { throw Object.assign(new Error('Recipient not verified'), { code: 'E_RECIPIENT_NOT_VERIFIED' }); } };
  try {
    const response = await worker.fetch(new Request('https://example.com/api/submissions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'teacher', name: 'Delivery retry test', description: 'A sourced teaching profile.', contact_email: 'teacher@example.org', website_url: 'https://delivery-test.example.org' }) }), env);
    assert.equal(response.status, 201); const result = await response.json(); assert.equal(result.emailNotification, 'failed');
    assert.equal(db.prepare('SELECT status FROM submissions WHERE id=?').get(result.submissionId).status, 'pending');
  } finally { db.close(); }
  assert.equal(await notifySubmission({}, 'test', {}), 'not_configured');
});
