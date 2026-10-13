import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import SettingsModal from './SettingsModal'

function renderSettings() {
  const api = {
    saveSettings: vi.fn(() => Promise.resolve()),
    setStartWithWindows: vi.fn(() => Promise.resolve()),
    selectBirthdaySource: vi.fn(() => Promise.resolve()),
    checkBirthdays: vi.fn(() => Promise.resolve()),
    savePreset: vi.fn(() => Promise.resolve({ presets: [] })),
    loadPresetAttachment: vi.fn(() => Promise.resolve()),
  }
  const call = vi.fn((operation) => operation())
  const props = {
    isOpen: true,
    onClose: vi.fn(),
    state: {
      settings: { startWithWindows: true, notificationsEnabled: true, reportRecipients: [], postSessionAction: 'none' },
      presets: [{ name: 'Standard', message: 'Ciao', settings: {} }],
      defaultOutputDir: 'Desktop',
      defaultLogDir: 'Log',
      updater: { status: 'idle' },
    },
    api,
    call,
    options: { minDelayMs: 1000, maxDelayMs: 2000, pauseAfter: 35, pauseMinutes: 1 },
    setOptions: vi.fn(),
    selectedPreset: 'Standard',
    setSelectedPreset: vi.fn(),
    setPresetName: vi.fn(),
    setMessage: vi.fn(),
    onStartTutorial: vi.fn(),
    onOpenGuide: vi.fn(),
    onOpenDeveloperReport: vi.fn(),
  }
  return { ...render(<SettingsModal {...props} />), api, call, props }
}

describe('SettingsModal', () => {
  it('persists system toggles and report recipients', async () => {
    const { api, props } = renderSettings()
    const startCheckbox = screen.getByRole('checkbox', { name: /Avvia AVIS Sender/i })
    fireEvent.click(startCheckbox)
    expect(api.setStartWithWindows).toHaveBeenCalledWith(false)
    fireEvent.change(screen.getByPlaceholderText(/Etichetta/i), { target: { value: 'Presidente' } })
    fireEvent.change(screen.getByPlaceholderText(/Numero/i), { target: { value: '3331234567' } })
    fireEvent.click(screen.getByRole('button', { name: /Aggiungi$/i }))
    await waitFor(() => expect(api.saveSettings).toHaveBeenCalledWith({ reportRecipients: [expect.objectContaining({ label: 'Presidente' })] }))
    fireEvent.click(screen.getByRole('button', { name: 'Chiudi impostazioni' }))
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })

  it('switches to the birthday tab and checks the source', async () => {
    const { api } = renderSettings()
    fireEvent.click(screen.getByRole('button', { name: /Compleanni/i }))
    expect(screen.getByText('Auguri di compleanno')).toBeInTheDocument()
    const checkButton = screen.getByRole('button', { name: /Controlla/i })
    fireEvent.click(checkButton)
    await waitFor(() => expect(api.checkBirthdays).toHaveBeenCalledWith({ force: true, notify: false }))
  })
})
