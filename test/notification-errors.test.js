const assert = require('node:assert/strict');
const test = require('node:test');

const {
  notificationContextForChannel,
  notificationErrorBody,
} = require('../sender/notification-errors');

test('classifica il test e-mail come errore e-mail, non WhatsApp', () => {
  assert.equal(notificationContextForChannel('sender:send-email-test'), 'email');
  assert.equal(notificationContextForChannel('sender:send-developer-report'), 'email');
});

test('traduce un rifiuto SMTP Gmail in un messaggio e-mail dedicato', () => {
  const body = notificationErrorBody(
    new Error('Invalid login: 534 5.7.9 Application-specific password required'),
    'email',
  );

  assert.match(body, /e-mail|Gmail/i);
  assert.match(body, /Gmail|password per app/i);
  assert.doesNotMatch(body, /WhatsApp/i);
});

test('mantiene la classificazione WhatsApp per gli errori di collegamento', () => {
  assert.match(
    notificationErrorBody(new Error('auth_failure'), 'whatsapp'),
    /WhatsApp/i,
  );
});
