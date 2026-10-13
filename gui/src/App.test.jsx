import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import App from './App'

describe('App', () => {
  it('loads the initial state and can dismiss the first-run tutorial', async () => {
    const onState = vi.fn(() => vi.fn())
    const getState = vi.fn(() => Promise.resolve({
      connection: 'disconnected',
      donors: [],
      queue: 'idle',
      progress: { current: 0, total: 0, sent: 0, failed: 0, skipped: 0, unknown: 0 },
      logs: [],
      settings: { reportRecipients: [] },
      presets: [],
      notifications: { items: [], unreadCount: 0 },
      birthdays: { status: 'not-configured', matches: [], invalidRows: [] },
    }))
    window.whatsappSender = { getState, onState, onOpenBirthdays: vi.fn(() => vi.fn()) }
    localStorage.clear()
    render(<App />)

    expect(screen.getByRole('dialog', { name: /Benvenuto/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Salta per ora/i }))
    await waitFor(() => expect(getState).toHaveBeenCalledTimes(1))
    expect(screen.getByText('Carica lista e seleziona donatori')).toBeInTheDocument()
    expect(onState).toHaveBeenCalledTimes(1)
  })
})
