import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import StepSummary from './StepSummary'

describe('StepSummary', () => {
  it('shows the rendered message and starts only when valid', () => {
    const onStart = vi.fn()
    const onBack = vi.fn()
    render(
      <StepSummary
        state={{ fileName: 'donatori.csv', imageName: '', imageDataUrl: '', donors: [{ name: 'Nome', surname: 'Cognome', valid: true, selected: true }], settings: {} }}
        message="Ciao [nome] [cognome]"
        selectedPreset="Standard"
        options={{ minDelayMs: 1000, maxDelayMs: 2000, pauseAfter: 35, pauseMinutes: 1, postSessionAction: 'none' }}
        setOptions={vi.fn()}
        canStart
        firstSelectedDonor={{ name: 'Nome', surname: 'Cognome' }}
        onBack={onBack}
        onGoToStep={vi.fn()}
        onStart={onStart}
        onOpenSettings={vi.fn()}
      />,
    )
    expect(screen.getByText('Ciao Nome Cognome')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Avvia Invio Messaggi/i }))
    fireEvent.click(screen.getByRole('button', { name: /Indietro: Messaggio/i }))
    expect(onStart).toHaveBeenCalledTimes(1)
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('validates and adds a quick report recipient and updates post-session action', () => {
    const saveSettings = vi.fn()
    window.whatsappSender = { saveSettings }
    const onAddSessionRecipient = vi.fn()
    const setOptions = vi.fn()
    render(
      <StepSummary
        state={{ donors: [], settings: { reportRecipients: [] } }}
        message="Messaggio"
        selectedPreset="Standard"
        options={{ minDelayMs: 1000, maxDelayMs: 2000, pauseAfter: 35, pauseMinutes: 1, postSessionAction: 'none' }}
        setOptions={setOptions}
        canStart={false}
        firstSelectedDonor={null}
        sessionReportRecipients={[]}
        onAddSessionRecipient={onAddSessionRecipient}
        onBack={vi.fn()}
        onGoToStep={vi.fn()}
        onStart={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Aggiungi numero/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Salva' }))
    expect(screen.getByText(/Inserisci un’etichetta/i)).toBeInTheDocument()
    fireEvent.change(screen.getByPlaceholderText(/Etichetta/i), { target: { value: 'Segreteria' } })
    fireEvent.change(screen.getByPlaceholderText(/Cellulare/i), { target: { value: '3331234567' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salva' }))
    expect(saveSettings).toHaveBeenCalledWith({ reportRecipients: [expect.objectContaining({ label: 'Segreteria' })] })
    expect(onAddSessionRecipient).toHaveBeenCalledTimes(1)
    fireEvent.change(screen.getByLabelText('Azione per il PC al termine:'), { target: { value: 'sleep' } })
    expect(setOptions).toHaveBeenCalled()
  })

  it('renders multi-attachment count, chips, and position label in summary', () => {
    render(
      <StepSummary
        state={{
          fileName: 'donatori.csv',
          donors: [{ name: 'Mario', surname: 'Rossi', valid: true, selected: true }],
          attachments: [
            { name: 'circolare.pdf', size: 1048576, badge: 'PDF' },
            { name: 'scheda.xlsx', size: 204800, badge: 'XLS' },
          ],
          attachmentPosition: 'last',
          settings: {},
        }}
        message="Gentile [nome], alleghiamo i file."
        selectedPreset="Comunicazione"
        options={{ minDelayMs: 1000, maxDelayMs: 2000, pauseAfter: 35, pauseMinutes: 1, postSessionAction: 'none' }}
        setOptions={vi.fn()}
        canStart
        firstSelectedDonor={{ name: 'Mario', surname: 'Rossi' }}
        onBack={vi.fn()}
        onGoToStep={vi.fn()}
        onStart={vi.fn()}
      />,
    )

    expect(screen.getByText(/2 file/i)).toBeInTheDocument()
    expect(screen.getByText(/Didascalia dell’ultimo allegato/i)).toBeInTheDocument()
    expect(screen.getByText('circolare.pdf')).toBeInTheDocument()
    expect(screen.getByText('scheda.xlsx')).toBeInTheDocument()
  })
})
