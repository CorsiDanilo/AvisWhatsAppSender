import { useEffect, useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'

function formatNotificationDate(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('it-IT', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function NotificationCenter({ isOpen, state, api, call, onClose }) {
  const [activeTab, setActiveTab] = useState('unread')
  const closeButtonRef = useRef(null)
  const items = state.notifications?.items || []
  const unreadItems = items.filter((item) => !item.readAt)
  const readItems = items.filter((item) => Boolean(item.readAt))
  const visibleItems = activeTab === 'unread' ? unreadItems : readItems

  useEffect(() => {
    if (!isOpen) return undefined
    closeButtonRef.current?.focus()
    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  async function toggleRead(item) {
    try {
      await call(() => api.setNotificationRead(item.id, item.readAt ? false : true))
    } catch {
      // The shared application error surface handles the failure.
    }
  }

  async function markAllRead() {
    try {
      await call(() => api.markAllNotificationsRead())
      setActiveTab('read')
    } catch {
      // The shared application error surface handles the failure.
    }
  }

  async function clearAll() {
    if (!items.length) return
    if (!window.confirm('Cancellare tutte le notifiche dall\'elenco?')) return
    try {
      await call(() => api.clearAllNotifications())
    } catch {
      // The shared application error surface handles the failure.
    }
  }

  async function deleteSingle(id) {
    try {
      await call(() => api.deleteNotification(id))
    } catch {
      // The shared application error surface handles the failure.
    }
  }

  async function openNotificationAction(item) {
    if (item.action === 'open-birthdays') {
      try {
        await call(() => api.openBirthdays())
        onClose()
      } catch {
        // The shared application error surface handles the failure.
      }
    }
  }

  return (
    <>
      <div
        className="notifications-backdrop"
        role="presentation"
        onMouseDown={(event) => event.target === event.currentTarget && onClose()}
      />
      <aside
        className="notifications-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="notifications-title"
      >
        <header className="notifications-header">
          <div>
            <span className="eyebrow">Centro operativo</span>
            <h2 id="notifications-title">Notifiche</h2>
          </div>
          <button ref={closeButtonRef} type="button" className="guide-close" onClick={onClose} aria-label="Chiudi notifiche">
            ×
          </button>
        </header>

        <div className="notifications-toolbar">
          <div className="notifications-tabs" role="tablist" aria-label="Filtro notifiche">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'unread'}
              className={`notifications-tab ${activeTab === 'unread' ? 'active' : ''}`}
              onClick={() => setActiveTab('unread')}
            >
              Da leggere <span>{unreadItems.length}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'read'}
              className={`notifications-tab ${activeTab === 'read' ? 'active' : ''}`}
              onClick={() => setActiveTab('read')}
            >
              Già lette <span>{readItems.length}</span>
            </button>
          </div>
          <div className="notifications-toolbar-actions">
            <button
              type="button"
              className="link-btn notifications-mark-all"
              onClick={markAllRead}
              disabled={!unreadItems.length}
            >
              Segna tutte lette
            </button>
            <button
              type="button"
              className="link-btn notifications-clear-all"
              onClick={clearAll}
              disabled={!items.length}
              title="Cancella tutte le notifiche"
            >
              <Trash2 size={13} /> Cancella tutte
            </button>
          </div>
        </div>

        <div className="notifications-list" role="tabpanel">
          {!visibleItems.length && (
            <div className="notifications-empty">
              <span className="notifications-empty-icon" aria-hidden="true">✓</span>
              <strong>{activeTab === 'unread' ? 'Nessuna notifica da leggere' : 'Nessuna notifica letta'}</strong>
              <p>{activeTab === 'unread' ? 'Qui compariranno gli avvisi generati dall’applicazione.' : 'Le notifiche segnate come lette resteranno disponibili qui.'}</p>
            </div>
          )}
          {visibleItems.map((item) => (
            <article className={`notification-item ${item.readAt ? 'is-read' : 'is-unread'}`} key={item.id}>
              <div className="notification-item-marker" aria-hidden="true" />
              <div className="notification-item-content">
                <div className="notification-item-heading">
                  <strong>{item.title}</strong>
                  <time dateTime={item.createdAt}>{formatNotificationDate(item.createdAt)}</time>
                </div>
                <p>{item.body}</p>
                <div className="notification-item-actions">
                  {item.action === 'open-birthdays' && (
                    <button type="button" className="button button-secondary button-small" onClick={() => openNotificationAction(item)}>
                      Apri compleanni
                    </button>
                  )}
                  <button type="button" className="link-btn" onClick={() => toggleRead(item)}>
                    {item.readAt ? 'Segna come non letta' : 'Segna come letta'}
                  </button>
                  <button
                    type="button"
                    className="link-btn notification-item-delete"
                    onClick={() => deleteSingle(item.id)}
                    title="Elimina notifica"
                  >
                    <Trash2 size={13} /> Elimina
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </aside>
    </>
  )
}

export default NotificationCenter
