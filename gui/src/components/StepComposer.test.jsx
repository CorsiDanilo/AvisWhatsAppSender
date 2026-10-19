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
    fireEvent.click(screen.getByRole('button', { name: /Seleziona allegato/i }))
    expect(api.selectImage).toHaveBeenCalledTimes(1)
    expect(call).toHaveBeenCalledTimes(1)
  })

  it('apre direttamente la gestione Modelli & Preset', () => {
    const onOpenSettings = vi.fn()
    renderComposer({ onOpenSettings })

    fireEvent.click(screen.getByRole('button', { name: /Gestisci modelli/i }))

    expect(onOpenSettings).toHaveBeenCalledWith('presets')
  })

  it('renders a PDF attachment card and preview when a PDF is selected', () => {
    renderComposer({
      state: {
        donors: [{ name: 'Mario', surname: 'Rossi', phone: '3331112233', valid: true, selected: true }],
        presets: [],
        imageName: 'convocazione.pdf',
        imagePath: 'C:\\docs\\convocazione.pdf',
        imageDataUrl: '',
        attachmentType: 'document',
        attachmentBadge: 'PDF',
        attachmentLabel: 'Documento PDF',
        attachmentSize: 1048576, // 1.0 MB
      },
    })
    expect(screen.getAllByText('convocazione.pdf').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Documento PDF/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/1\.0 MB/i).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Rimuovi' })).toBeInTheDocument()
  })

  it('renders multi-attachment list with reorder, remove, and caption position options', () => {
    const api = {
      reorderAttachments: vi.fn(),
      removeAttachment: vi.fn(),
      setAttachmentPosition: vi.fn(),
      selectImage: vi.fn(),
      clearImage: vi.fn(),
    }
    renderComposer({
      api,
      state: {
        donors: [{ name: 'Mario', surname: 'Rossi', phone: '3331112233', valid: true, selected: true }],
        presets: [],
        attachments: [
          { name: 'locandina.png', path: 'C:\\locandina.png', size: 500000, type: 'image', badge: 'IMG' },
          { name: 'modulo.pdf', path: 'C:\\modulo.pdf', size: 1048576, type: 'document', badge: 'PDF' },
        ],
        attachmentPosition: 'first',
      },
    })

    expect(screen.getByText('Allegati (2)')).toBeInTheDocument()
    expect(screen.getAllByText('locandina.png').length).toBeGreaterThan(0)
    expect(screen.getAllByText('modulo.pdf').length).toBeGreaterThan(0)
    expect(screen.getByText('Didascalia 1° allegato')).toBeInTheDocument()
    expect(screen.getByText('Didascalia ultimo allegato')).toBeInTheDocument()
    expect(screen.getByText('Messaggio a parte')).toBeInTheDocument()

    // Test position change
    fireEvent.click(screen.getByText('Didascalia ultimo allegato'))
    expect(api.setAttachmentPosition).toHaveBeenCalledWith('last')

    // Test reorder
    fireEvent.click(screen.getByLabelText('Sposta giù locandina.png'))
    expect(api.reorderAttachments).toHaveBeenCalledWith(0, 1)

    // Test remove
    fireEvent.click(screen.getByLabelText('Rimuovi modulo.pdf'))
    expect(api.removeAttachment).toHaveBeenCalledWith(1)
  })
})
