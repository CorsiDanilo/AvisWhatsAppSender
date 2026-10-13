import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import NotificationCenter from './NotificationCenter'

const state = {
  notifications: {
    items: [
      { id: 'birthday-1', title: 'Compleanno', body: 'Oggi è il compleanno di Nome', createdAt: '2026-10-13T09:00:00.000Z', readAt: null, action: 'open-birthdays' },
      { id: 'old-1', title: 'Già letta', body: 'Messaggio archiviato', createdAt: '2026-10-12T09:00:00.000Z', readAt: '2026-10-12T10:00:00.000Z' },
    ],
  },
}

describe('NotificationCenter', () => {
  it('filters unread/read notifications and marks all as read', async () => {
    const markAllNotificationsRead = vi.fn(() => Promise.resolve())
    const call = vi.fn((operation) => operation())
    render(
      <NotificationCenter
        isOpen
        state={state}
        api={{ markAllNotificationsRead }}
        call={call}
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByText('Oggi è il compleanno di Nome')).toBeInTheDocument()
    expect(screen.queryByText('Messaggio archiviato')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: /Già lette/i }))
    expect(screen.getByText('Messaggio archiviato')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: /Da leggere/i }))
    fireEvent.click(screen.getByRole('button', { name: /Segna tutte lette/i }))
    await waitFor(() => expect(markAllNotificationsRead).toHaveBeenCalledTimes(1))
  })

  it('routes notification actions and deletion through the API', async () => {
    const openBirthdays = vi.fn(() => Promise.resolve())
    const deleteNotification = vi.fn(() => Promise.resolve())
    const onClose = vi.fn()
    const call = vi.fn((operation) => operation())
    render(
      <NotificationCenter
        isOpen
        state={state}
        api={{ openBirthdays, deleteNotification }}
        call={call}
        onClose={onClose}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Apri compleanni' }))
    await waitFor(() => expect(openBirthdays).toHaveBeenCalledTimes(1))
    expect(onClose).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: /Elimina/i }))
    await waitFor(() => expect(deleteNotification).toHaveBeenCalledWith('birthday-1'))
  })
})
