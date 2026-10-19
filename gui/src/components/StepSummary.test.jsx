import { fireEvent, render, screen, within } from '@testing-library/react'
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

  it('adds a quick report recipient only to the current session and updates post-session action', () => {
    const saveSettings = vi.fn()
    window.whatsappSender = { saveSettings }
    const onAddSessionRecipient = vi.fn()
    const setOptions = vi.fn()
    render(
      <StepSummary
        state={{ donors: [], settings: { reportDeliveryMode: 'whatsapp', reportRecipients: [] } }}
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
    expect(saveSettings).not.toHaveBeenCalled()
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

  it('renders three expanded read-only summary sections and collapses their bodies', () => {
    render(
      <StepSummary
        state={{
          fileName: 'donatori.csv',
          donors: [
            { name: 'Mario', surname: 'Rossi', phone: '3331234567', valid: true, selected: true },
            { name: 'Anna', surname: 'Bianchi', phone: '3337654321', valid: true, selected: true },
          ],
          settings: {},
        }}
        message="Messaggio"
        selectedPreset="Standard"
        options={{ minDelayMs: 1000, maxDelayMs: 2000, pauseAfter: 35, pauseMinutes: 1, postSessionAction: 'none' }}
        setOptions={vi.fn()}
        canStart
        firstSelectedDonor={{ name: 'Mario', surname: 'Rossi' }}
        onBack={vi.fn()}
        onGoToStep={vi.fn()}
        onStart={vi.fn()}
      />,
    )

    expect(screen.getAllByRole('button', { name: /Comprimi sezione/i })).toHaveLength(3)
    expect(screen.getByText('Mario Rossi')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Destinatari.*Comprimi sezione/i }))

    expect(screen.getByRole('button', { name: /Destinatari.*Espandi sezione/i })).toBeInTheDocument()
    expect(screen.queryByText('Mario Rossi')).not.toBeInTheDocument()
  })

  it('uses global report defaults until the current session overrides them', () => {
    render(
      <StepSummary
        state={{
          donors: [],
          settings: {
            reportDeliveryMode: 'both',
            postSessionAction: 'shutdown',
            reportRecipients: [{ id: 'global-phone', label: 'Segreteria', phone: '393331234567', enabled: true }],
            reportEmailRecipients: [{ id: 'global-email', label: 'Ufficio', email: 'ufficio@avis.it', enabled: true }],
          },
        }}
        message="Messaggio"
        selectedPreset="Standard"
        options={{ minDelayMs: 1000, maxDelayMs: 2000, pauseAfter: 35, pauseMinutes: 1, postSessionAction: null }}
        setOptions={vi.fn()}
        canStart={false}
        firstSelectedDonor={null}
        sessionReportRecipients={null}
        sessionReportEmailRecipients={null}
        reportDeliveryMode={null}
        onBack={vi.fn()}
        onGoToStep={vi.fn()}
        onStart={vi.fn()}
      />,
    )

    expect(screen.getByLabelText('Canale di invio del report')).toHaveValue('both')
    expect(screen.getByText('Segreteria')).toBeInTheDocument()
    expect(screen.getByText('Ufficio')).toBeInTheDocument()
    expect(screen.getByLabelText('Azione per il PC al termine:')).toHaveValue('shutdown')
  })

  it('configures report channel and email recipients for the current session', () => {
    const onTogglePhone = vi.fn()
    const onToggleEmail = vi.fn()
    const onRemovePhone = vi.fn()
    const onRemoveEmail = vi.fn()
    const onAddEmail = vi.fn()
    const onReportModeChange = vi.fn()
    const onOpenSettings = vi.fn()
    window.whatsappSender = { saveSettings: vi.fn() }

    render(
      <StepSummary
        state={{
          donors: [],
          settings: {
            reportDeliveryMode: 'both',
            reportRecipients: [{ id: 'phone-1', label: 'Segreteria', phone: '393331234567', enabled: true }],
            reportEmailRecipients: [{ id: 'email-1', label: 'Ufficio', email: 'ufficio@avis.it', enabled: true }],
          },
        }}
        message="Messaggio"
        selectedPreset="Standard"
        options={{ minDelayMs: 1000, maxDelayMs: 2000, pauseAfter: 35, pauseMinutes: 1, postSessionAction: 'none' }}
        setOptions={vi.fn()}
        canStart={false}
        firstSelectedDonor={null}
        sessionReportRecipients={[{ id: 'phone-1', label: 'Segreteria', phone: '393331234567', enabled: true }]}
        sessionReportEmailRecipients={[{ id: 'email-1', label: 'Ufficio', email: 'ufficio@avis.it', enabled: true }]}
        onToggleSessionRecipient={onTogglePhone}
        onToggleSessionEmailRecipient={onToggleEmail}
        onRemoveSessionRecipient={onRemovePhone}
        onRemoveSessionEmailRecipient={onRemoveEmail}
        onAddSessionEmailRecipient={onAddEmail}
        onReportDeliveryModeChange={onReportModeChange}
        onOpenSettings={onOpenSettings}
        onBack={vi.fn()}
        onGoToStep={vi.fn()}
        onStart={vi.fn()}
      />,
    )

    const settingsLink = screen.getByRole('button', { name: /Gestisci impostazioni e-mail e rubrica/i })
    const reportPanel = settingsLink.closest('.summary-report-panel')
    expect(within(reportPanel).getByText(/Invio selettivo del report/i)).toBeInTheDocument()
    expect(within(reportPanel).getByText('Azione sul PC')).toBeInTheDocument()
    expect(document.querySelector('.summary-actions-grid > .summary-pc-panel')).not.toBeInTheDocument()
    fireEvent.click(settingsLink)
    expect(onOpenSettings).toHaveBeenCalledWith('communications')

    const modeSelect = screen.getByLabelText('Canale di invio del report')
    expect(modeSelect).toHaveValue('both')
    fireEvent.change(modeSelect, { target: { value: 'email' } })
    expect(onReportModeChange).toHaveBeenCalledWith('email')

    fireEvent.click(screen.getByRole('checkbox', { name: /Ufficio/i }))
    expect(onToggleEmail).toHaveBeenCalledWith('email-1')

    fireEvent.click(screen.getByRole('button', { name: 'Rimuovi Segreteria' }))
    fireEvent.click(screen.getByRole('button', { name: 'Rimuovi Ufficio' }))
    expect(onRemovePhone).toHaveBeenCalledWith('phone-1')
    expect(onRemoveEmail).toHaveBeenCalledWith('email-1')
    expect(window.whatsappSender.saveSettings).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /Aggiungi e-mail/i }))
    fireEvent.change(screen.getByLabelText('Etichetta e-mail'), { target: { value: 'Presidente' } })
    fireEvent.change(screen.getByLabelText('Indirizzo e-mail'), { target: { value: 'presidente@avis.it' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salva e-mail' }))

    expect(onAddEmail).toHaveBeenCalledWith(expect.objectContaining({
      label: 'Presidente',
      email: 'presidente@avis.it',
    }))
  })

  it('keeps recipients added in the summary only for the current session', () => {
    const saveSettings = vi.fn()
    window.whatsappSender = { saveSettings }
    const sessionPhone = { id: 'session-phone', label: 'Già aggiunto', phone: '393331234567', enabled: true }
    const sessionEmail = { id: 'session-email', label: 'Già aggiunto', email: 'gia@avis.it', enabled: true }

    render(
      <StepSummary
        state={{ donors: [], settings: { reportDeliveryMode: 'both', reportRecipients: [], reportEmailRecipients: [] } }}
        message="Messaggio"
        selectedPreset="Standard"
        options={{ minDelayMs: 1000, maxDelayMs: 2000, pauseAfter: 35, pauseMinutes: 1, postSessionAction: 'none' }}
        setOptions={vi.fn()}
        canStart={false}
        firstSelectedDonor={null}
        sessionReportRecipients={[sessionPhone]}
        sessionReportEmailRecipients={[sessionEmail]}
        onAddSessionRecipient={vi.fn()}
        onAddSessionEmailRecipient={vi.fn()}
        onReportDeliveryModeChange={vi.fn()}
        onBack={vi.fn()}
        onGoToStep={vi.fn()}
        onStart={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Aggiungi numero/i }))
    fireEvent.change(screen.getByPlaceholderText(/Etichetta/i), { target: { value: 'Nuovo numero' } })
    fireEvent.change(screen.getByPlaceholderText(/Cellulare/i), { target: { value: '3337654321' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salva' }))

    expect(saveSettings).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /Aggiungi e-mail/i }))
    fireEvent.change(screen.getByLabelText('Etichetta e-mail'), { target: { value: 'Nuova e-mail' } })
    fireEvent.change(screen.getByLabelText('Indirizzo e-mail'), { target: { value: 'nuova@avis.it' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salva e-mail' }))

    expect(saveSettings).not.toHaveBeenCalled()
  })
})
