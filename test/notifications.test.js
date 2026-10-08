const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  appendNotification,
  clearAllNotifications,
  deleteNotification,
  loadNotificationState,
  markAllNotificationsRead,
  markNotificationRead,
  notificationUnreadCount,
  shouldShowNotificationIndicator,
  shouldShowAttentionIndicator,
  saveNotificationState,
} = require('../sender/notifications');

function temporaryDirectory() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'avis-notifications-'));
}

test('appends notifications newest first and counts only unread items', () => {
  let state = { items: [] };
  state = appendNotification(state, {
    id: 'first',
    title: 'Importazione',
    body: 'Lista caricata.',
    createdAt: '2026-10-08T08:00:00.000Z',
  });
  state = appendNotification(state, {
    id: 'second',
    title: 'Compleanni',
    body: 'Ci sono auguri da preparare.',
    action: 'open-birthdays',
    createdAt: '2026-10-08T09:00:00.000Z',
  });

  assert.deepEqual(state.items.map((item) => item.id), ['second', 'first']);
  assert.equal(notificationUnreadCount(state), 2);
  assert.equal(state.items[0].action, 'open-birthdays');
});

test('marks one notification read or unread without deleting it', () => {
  const state = {
    items: [{
      id: 'first',
      title: 'Test',
      body: 'Avviso',
      createdAt: '2026-10-08T08:00:00.000Z',
      readAt: null,
    }],
  };

  const read = markNotificationRead(state, 'first', '2026-10-08T10:00:00.000Z');
  assert.equal(read.items.length, 1);
  assert.equal(read.items[0].readAt, '2026-10-08T10:00:00.000Z');
  assert.equal(notificationUnreadCount(read), 0);

  const unread = markNotificationRead(read, 'first', null);
  assert.equal(unread.items[0].readAt, null);
  assert.equal(notificationUnreadCount(unread), 1);
});

test('marks all notifications as read and persists the notification history', () => {
  const directory = temporaryDirectory();
  const filePath = path.join(directory, 'notifications.json');
  try {
    const state = appendNotification({ items: [] }, {
      id: 'first',
      title: 'Test',
      body: 'Avviso',
      createdAt: '2026-10-08T08:00:00.000Z',
    });
    const read = markAllNotificationsRead(state, '2026-10-08T10:00:00.000Z');
    saveNotificationState(filePath, read);
    const loaded = loadNotificationState(filePath);

    assert.equal(loaded.items.length, 1);
    assert.equal(loaded.items[0].readAt, '2026-10-08T10:00:00.000Z');
    assert.equal(notificationUnreadCount(loaded), 0);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('shows the system indicator only when notifications are unread', () => {
  assert.equal(shouldShowNotificationIndicator({ items: [] }), false);
  assert.equal(shouldShowNotificationIndicator({
    items: [{ id: 'birthday', title: 'Compleanni', body: 'Auguri da preparare.', readAt: null }],
  }), true);
  assert.equal(shouldShowNotificationIndicator({
    items: [{ id: 'birthday', title: 'Compleanni', body: 'Auguri da preparare.', readAt: '2026-10-08T10:00:00.000Z' }],
  }), false);
});

test('shows a shared attention indicator for unread notifications or pending birthdays', () => {
  assert.equal(shouldShowAttentionIndicator({ items: [] }, { pendingCount: 0 }), false);
  assert.equal(shouldShowAttentionIndicator({
    items: [{ id: 'notice', title: 'Avviso', body: 'Da leggere.', readAt: null }],
  }, { pendingCount: 0 }), true);
  assert.equal(shouldShowAttentionIndicator({ items: [] }, {
    pendingCount: 1,
    sessionPrepared: false,
  }), true);
  assert.equal(shouldShowAttentionIndicator({ items: [] }, {
    pendingCount: 1,
    sessionPrepared: true,
  }), false);
});

test('cancella tutte le notifiche svuotando l\'elenco', () => {
  const state = {
    items: [
      { id: '1', title: 'Avviso 1', body: 'Test 1' },
      { id: '2', title: 'Avviso 2', body: 'Test 2' },
    ],
  };

  const cleared = clearAllNotifications(state);
  assert.deepEqual(cleared.items, []);
  assert.equal(notificationUnreadCount(cleared), 0);
});

test('elimina una singola notifica specifica per id', () => {
  const state = {
    items: [
      { id: '1', title: 'Avviso 1', body: 'Test 1' },
      { id: '2', title: 'Avviso 2', body: 'Test 2' },
    ],
  };

  const updated = deleteNotification(state, '1');
  assert.deepEqual(updated.items.map((i) => i.id), ['2']);
});

