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

  it('mostra il prompt per configurare le comunicazioni e-mail all avvio', async () => {
    const onState = vi.fn(() => vi.fn())
    const getState = vi.fn(() => Promise.resolve({
      connection: 'disconnected',
      donors: [],
      queue: 'idle',
      progress: { current: 0, total: 0, sent: 0, failed: 0, skipped: 0, unknown: 0 },
      logs: [],
      settings: {
        emailNotificationsEnabled: false,
        emailProvider: 'gmail',
        gmailAddress: '',
        emailRecipients: [],
        reportRecipients: [],
      },
      emailCredentialsConfigured: false,
      presets: [],
      notifications: { items: [], unreadCount: 0 },
      birthdays: { status: 'not-configured', matches: [], invalidRows: [] },
    }))
    window.whatsappSender = { getState, onState, onOpenBirthdays: vi.fn(() => vi.fn()) }
    localStorage.setItem('avis_tutorial_seen', '1')
    render(<App />)

    expect(await screen.findByRole('dialog', { name: /Configura le comunicazioni e-mail/i })).toBeInTheDocument()
    expect(screen.getByText(/recap di emergenza e inviare i log allo sviluppatore/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Configura ora/i }))
    expect(screen.getByRole('dialog', { name: /Impostazioni/i })).toBeInTheDocument()
  })

  it('non mostra il prompt se Gmail è già configurato', async () => {
    const onState = vi.fn(() => vi.fn())
    const getState = vi.fn(() => Promise.resolve({
      connection: 'disconnected',
      donors: [],
      queue: 'idle',
      progress: { current: 0, total: 0, sent: 0, failed: 0, skipped: 0, unknown: 0 },
      logs: [],
      settings: {
        emailNotificationsEnabled: false,
        emailProvider: 'gmail',
        gmailAddress: '',
        emailAddresses: { gmail: 'avis@example.org' },
        emailRecipients: [],
        reportRecipients: [],
      },
      emailCredentialsConfigured: false,
      emailCredentialsByProvider: { gmail: true },
      presets: [],
      notifications: { items: [], unreadCount: 0 },
      birthdays: { status: 'not-configured', matches: [], invalidRows: [] },
    }))
    window.whatsappSender = { getState, onState, onOpenBirthdays: vi.fn(() => vi.fn()) }
    localStorage.setItem('avis_tutorial_seen', '1')
    render(<App />)

    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Configura le comunicazioni e-mail/i })).not.toBeInTheDocument())
  })
})
