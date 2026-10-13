import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import StepComposer from './StepComposer'

function renderComposer(overrides = {}) {
  const setMessage = vi.fn()
  const setOptions = vi.fn()
  const api = { selectImage: vi.fn(), loadPresetAttachment: vi.fn(() => Promise.resolve()) }
  const call = vi.fn((operation) => operation())
  const props = {
    state: {
      donors: [
        { name: 'Nome', surname: 'Cognome', phone: '3331234567', valid: true, selected: true, customFields: { Gruppo: 'Adulti' } },
        { name: 'Nome Alternativo', surname: 'Cognome Alternativo', phone: '3337654321', valid: true, selected: true },
      ],
      presets: [{ name: 'Standard', message: 'Ciao [nome]', settings: {} }],
      imageName: '',
      imageDataUrl: '',
    },
    api,
    call,
    message: 'Ciao [nome]',
    setMessage,
    selectedPreset: 'Standard',
    setSelectedPreset: vi.fn(),
    setPresetName: vi.fn(),
    options: { minDelayMs: 1000, maxDelayMs: 2000, pauseAfter: 35, pauseMinutes: 1 },
    setOptions,
    firstSelectedDonor: { name: 'Nome', surname: 'Cognome', phone: '3331234567', customFields: { Gruppo: 'Adulti' } },
    onBack: vi.fn(),
    onNext: vi.fn(),
    onOpenSettings: vi.fn(),
    ...overrides,
  }
  return { ...render(<StepComposer {...props} />), props, api, call, setMessage, setOptions }
}

describe('StepComposer', () => {
  it('renders a personalized preview and edits the message', () => {
    const { setMessage } = renderComposer()
    expect(screen.getByText('Ciao Nome')).toBeInTheDocument()
    fireEvent.change(screen.getByRole('textbox', { name: 'Testo del messaggio' }), { target: { value: 'Nuovo testo' } })
    expect(setMessage).toHaveBeenCalledWith('Nuovo testo')
    fireEvent.change(screen.getByRole('spinbutton', { name: /Min. secondi/i }), { target: { value: '5' } })
    expect(setMessage).toHaveBeenCalledTimes(1)
  })

  it('searches preview donors and selects an image through the API', () => {
    const { api, call } = renderComposer()
    const search = screen.getByRole('textbox', { name: /Cerca donatore per anteprima/i })
    fireEvent.change(search, { target: { value: 'Alternativo' } })
    const suggestion = screen.getByRole('option', { name: /Nome Alternativo Cognome Alternativo/i })
    expect(suggestion).toHaveTextContent('Nome Alternativo Cognome Alternativo')
    fireEvent.click(suggestion)
    fireEvent.click(screen.getByRole('button', { name: /Seleziona foto/i }))
    expect(api.selectImage).toHaveBeenCalledTimes(1)
    expect(call).toHaveBeenCalledTimes(1)
  })
})
