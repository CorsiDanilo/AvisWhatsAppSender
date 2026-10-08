const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_NOTIFICATION_STATE = Object.freeze({ items: [] });

function normalizeNotificationItem(item = {}) {
  const title = String(item.title || '').trim();
  const body = String(item.body || '').trim();
  if (!title || !body) return null;

  return {
    id: String(item.id || crypto.randomUUID()),
    title,
    body,
    category: String(item.category || 'general'),
    action: String(item.action || ''),
    createdAt: String(item.createdAt || new Date().toISOString()),
    readAt: typeof item.readAt === 'string' && item.readAt ? item.readAt : null,
  };
}

function normalizeNotificationState(state = {}) {
  const items = Array.isArray(state.items)
    ? state.items.map(normalizeNotificationItem).filter(Boolean)
    : [];
  return { items };
}

function loadNotificationState(filePath) {
  try {
    return normalizeNotificationState(JSON.parse(fs.readFileSync(filePath, 'utf8')));
  } catch {
    return { ...DEFAULT_NOTIFICATION_STATE, items: [] };
  }
}

function saveNotificationState(filePath, state) {
  const normalized = normalizeNotificationState(state);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
  return normalized;
}

function appendNotification(state, notification) {
  const item = normalizeNotificationItem(notification);
  if (!item) return normalizeNotificationState(state);
  return { items: [item, ...normalizeNotificationState(state).items] };
}

function markNotificationRead(state, id, readAt = new Date().toISOString()) {
  const normalized = normalizeNotificationState(state);
  return {
    items: normalized.items.map((item) => (
      item.id === id ? { ...item, readAt: readAt || null } : item
    )),
  };
}

function markAllNotificationsRead(state, readAt = new Date().toISOString()) {
  const normalized = normalizeNotificationState(state);
  return {
    items: normalized.items.map((item) => ({ ...item, readAt: readAt || null })),
  };
}

function notificationUnreadCount(state) {
  return normalizeNotificationState(state).items.filter((item) => !item.readAt).length;
}

function shouldShowNotificationIndicator(state) {
  return notificationUnreadCount(state) > 0;
}

function shouldShowAttentionIndicator(notificationState, birthdays = {}) {
  return shouldShowNotificationIndicator(notificationState)
    || (Number(birthdays.pendingCount) > 0 && birthdays.sessionPrepared !== true);
}

module.exports = {
  DEFAULT_NOTIFICATION_STATE,
  appendNotification,
  loadNotificationState,
  markAllNotificationsRead,
  markNotificationRead,
  normalizeNotificationState,
  notificationUnreadCount,
  saveNotificationState,
  shouldShowAttentionIndicator,
  shouldShowNotificationIndicator,
};
