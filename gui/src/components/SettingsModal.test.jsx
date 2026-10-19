import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import SettingsModal from './SettingsModal'

function renderSettings(settingsPatch = {}, statePatch = {}, apiPatch = {}) {
  const api = {
    saveSettings: vi.fn(() => Promise.resolve()),
    setStartWithWindows: vi.fn(() => Promise.resolve()),
    selectBirthdaySource: vi.fn(() => Promise.resolve()),
    checkBirthdays: vi.fn(() => Promise.resolve()),
    saveGmailPassword: vi.fn(() => Promise.resolve()),
    clearGmailPassword: vi.fn(() => Promise.resolve()),
    sendEmailTest: vi.fn(() => Promise.resolve()),
    openExternalUrl: vi.fn(() => Promise.resolve({ opened: true })),
    savePreset: vi.fn(() => Promise.resolve({ presets: [] })),
    loadPresetAttachment: vi.fn(() => Promise.resolve()),
  }
  const call = vi.fn((operation) => operation())
  Object.assign(api, apiPatch)
  const props = {
    isOpen: true,
    onClose: vi.fn(),
    state: {
      settings: { startWithWindows: true, notificationsEnabled: true, reportRecipients: [], postSessionAction: 'none', ...settingsPatch },
      presets: [{ name: 'Standard', message: 'Ciao', settings: {} }],
      defaultOutputDir: 'Desktop',
      defaultLogDir: 'Log',
      updater: { status: 'idle' },
      ...statePatch,
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
    initialTab: 'communications',
  }
  return { ...render(<SettingsModal {...props} />), api, call, props }
}

describe('SettingsModal', () => {
  it('persists system toggles and report recipients', async () => {
    const { api, props } = renderSettings()
    fireEvent.click(screen.getByRole('button', { name: 'Generali' }))
    fireEvent.click(screen.getByRole('checkbox', { name: /Avvia AVIS Sender/i }))
    expect(api.setStartWithWindows).toHaveBeenCalledWith(false)
    fireEvent.click(screen.getByRole('button', { name: /Comunicazioni/i }))
    fireEvent.change(screen.getByLabelText(/Canale di invio del report/i), { target: { value: 'whatsapp' } })
    fireEvent.change(screen.getByPlaceholderText(/Etichetta/i), { target: { value: 'Presidente' } })
    fireEvent.change(screen.getByPlaceholderText(/Numero/i), { target: { value: '3331234567' } })
    fireEvent.click(screen.getByRole('button', { name: /Aggiungi$/i }))
    await waitFor(() => expect(api.saveSettings).toHaveBeenCalledWith({ reportRecipients: [expect.objectContaining({ label: 'Presidente' })] }))
    fireEvent.click(screen.getByRole('button', { name: 'Chiudi impostazioni' }))
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })

  it('configura le comunicazioni in un tab dedicato con destinatari distinti', async () => {
    const { api } = renderSettings()

    fireEvent.click(screen.getByRole('button', { name: /Comunicazioni/i }))
    expect(screen.getByRole('heading', { name: /Report di fine invio/i })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/Canale di invio del report/i), { target: { value: 'email' } })
    await waitFor(() => expect(api.saveSettings).toHaveBeenCalledWith({ reportDeliveryMode: 'email' }))
    expect(screen.getByText(/Destinatari del report via e-mail/i)).toBeInTheDocument()
    expect(screen.queryByText(/Destinatari WhatsApp del report/i)).not.toBeInTheDocument()
    expect(screen.queryByText('Sistema & Notifiche')).not.toBeInTheDocument()
  })

  it('mostra etichetta e cestino anche per i destinatari e-mail del report', () => {
    renderSettings({
      reportDeliveryMode: 'email',
      reportEmailRecipients: [{ id: 'email-1', label: 'Ufficio', email: 'ufficio@avis.it', enabled: true }],
    })

    expect(screen.getByText('🏷️ Ufficio')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '🗑️ Rimuovi' })).toBeInTheDocument()
  })

  it('mostra Sistema & Notifiche esclusivamente nella tab Generali', () => {
    renderSettings()
    expect(screen.queryByText('Sistema & Notifiche')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Generali' }))
    expect(screen.getByText('Sistema & Notifiche')).toBeInTheDocument()
  })

  it('usa l’icona del cestino per eliminare un preset', () => {
    renderSettings()
    fireEvent.click(screen.getByRole('button', { name: /Modelli & Preset/i }))
    expect(screen.getByTitle('Elimina Standard').querySelector('.lucide-trash-2')).toBeInTheDocument()
  })

  it('mostra un feedback di salvataggio del provider prima della card Gmail', async () => {
    let completeSave
    const { api } = renderSettings({}, {}, {
      saveGmailPassword: vi.fn(() => new Promise((resolve) => { completeSave = resolve })),
    })
    fireEvent.change(screen.getByLabelText(/Indirizzo e-mail mittente/i), { target: { value: 'avis@example.org' } })
    fireEvent.change(screen.getByLabelText(/Password per app Gmail/i), { target: { value: 'app-password' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salva provider' }))

    expect(screen.getByRole('button', { name: /Salvataggio/i })).toBeDisabled()
    await waitFor(() => expect(api.saveGmailPassword).toHaveBeenCalledWith('app-password'))
    completeSave()

    expect(await screen.findByText(/Provider Gmail salvato in modo cifrato/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Modifica provider Gmail/i })).toBeInTheDocument()
  })

  it('mantiene sempre attive le notifiche e-mail per le emergenze senza mostrare un toggle', () => {
    renderSettings()
    expect(screen.queryByRole('checkbox', { name: 'Attiva notifiche e-mail per le emergenze' })).not.toBeInTheDocument()
    expect(screen.getByText(/recap di emergenza, gli avvisi di spegnimento e l’invio dei log/i)).toBeInTheDocument()
  })

  it('switches to the birthday tab and checks the source', async () => {
    const { api } = renderSettings()
    fireEvent.click(screen.getByRole('button', { name: /Compleanni/i }))
    expect(screen.getByText('Auguri di compleanno')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Controlla/i }))
    await waitFor(() => expect(api.checkBirthdays).toHaveBeenCalledWith({ force: true, notify: false }))
  })

  it('saves Gmail credentials and emergency recipients without putting the password in settings', async () => {
    const { api } = renderSettings()
    fireEvent.change(screen.getByLabelText(/Indirizzo e-mail mittente/i), { target: { value: 'avis@example.org' } })
    fireEvent.change(screen.getByLabelText(/Password per app Gmail/i), { target: { value: 'app-password' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salva provider' }))
    await waitFor(() => expect(api.saveGmailPassword).toHaveBeenCalledWith('app-password'))
    expect(await screen.findByRole('button', { name: /Modifica provider Gmail/i })).toBeInTheDocument()
    await waitFor(() => expect(api.saveSettings).toHaveBeenCalledWith({ gmailAddress: 'avis@example.org' }))
    fireEvent.click(screen.getByRole('button', { name: /Invia e-mail di prova/i }))
    await waitFor(() => expect(api.sendEmailTest).toHaveBeenCalledWith('avis@example.org'))
    expect(await screen.findByRole('status')).toHaveTextContent(/E-mail inviata correttamente/i)

    fireEvent.change(screen.getByPlaceholderText(/Nome destinatario e-mail/i), { target: { value: 'Segreteria' } })
    fireEvent.change(screen.getByPlaceholderText(/e-mail del destinatario/i), { target: { value: 'segreteria@example.org' } })
    fireEvent.click(screen.getByRole('button', { name: /Aggiungi destinatario e-mail/i }))
    await waitFor(() => expect(api.saveSettings).toHaveBeenCalledWith(expect.objectContaining({
      emailRecipients: [expect.objectContaining({ label: 'Segreteria', email: 'segreteria@example.org' })],
    })))
  })

  it('mantiene visibile lo stato della password cifrata al riaprire le impostazioni', () => {
    renderSettings({}, { emailCredentialsConfigured: true })
    expect(screen.getByText(/Password per app salvata in modo cifrato/i)).toBeInTheDocument()
  })

  it('mostra una card Gmail compatta quando il provider è configurato', () => {
    renderSettings(
      { emailProvider: 'gmail', gmailAddress: 'avis@gmail.com', emailAddresses: { gmail: 'avis@gmail.com' } },
      { emailCredentialsConfigured: true, emailCredentialsByProvider: { gmail: true } },
    )

    expect(screen.getByText('Gmail')).toBeInTheDocument()
    expect(screen.getByText('avis@gmail.com')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Modifica provider Gmail/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Rimuovi provider Gmail/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Salva provider' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Modifica provider Gmail/i }))
    expect(screen.getByRole('button', { name: 'Salva provider' })).toBeInTheDocument()
    expect(screen.getByLabelText(/Indirizzo e-mail mittente/i)).toHaveValue('avis@gmail.com')
  })

  it('rimuove le credenziali Gmail e l indirizzo salvato dalla card', async () => {
    const { api } = renderSettings(
      { emailProvider: 'gmail', gmailAddress: 'avis@gmail.com', emailAddresses: { gmail: 'avis@gmail.com' } },
      { emailCredentialsConfigured: true, emailCredentialsByProvider: { gmail: true } },
    )

    fireEvent.click(screen.getByRole('button', { name: /Rimuovi provider Gmail/i }))
    await waitFor(() => expect(api.clearGmailPassword).toHaveBeenCalledTimes(1))
    expect(api.saveSettings).toHaveBeenCalledWith({ gmailAddress: '' })
    expect(screen.getByRole('button', { name: 'Salva provider' })).toBeInTheDocument()
  })

  it('sincronizza la card Gmail quando arrivano le impostazioni persistite', async () => {
    const view = renderSettings()
    const persistedState = {
      ...view.props.state,
      emailCredentialsConfigured: true,
      settings: {
        ...view.props.state.settings,
        emailNotificationsEnabled: true,
        emailProvider: 'gmail',
        gmailAddress: 'avis@example.org',
        emailAddresses: { gmail: 'avis@example.org' },
      },
    }
    view.rerender(<SettingsModal {...view.props} state={persistedState} />)
    await waitFor(() => {
      expect(screen.getByText('avis@example.org')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Modifica provider Gmail/i })).toBeInTheDocument()
    })
  })

  it('apre la guida per la password app Gmail', () => {
    renderSettings({ emailProvider: 'gmail' })
    expect(screen.getByLabelText(/Password per app Gmail/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Come creo una password per app/i }))
    expect(screen.getByRole('dialog', { name: /Guida password per app Gmail/i })).toBeInTheDocument()
    expect(screen.getAllByText(/Account Google/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/Verifica in due passaggi/i)).toBeInTheDocument()
    expect(screen.getAllByText(/Password per le app/i).length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: /Password per le app Google/i })).toHaveAttribute(
      'href',
      'https://myaccount.google.com/apppasswords',
    )
  })

  it('apre il link della guida nel browser di sistema', async () => {
    const { api } = renderSettings({ emailProvider: 'gmail' })
    fireEvent.click(screen.getByRole('button', { name: /Come creo una password per app/i }))
    fireEvent.click(screen.getByRole('link', { name: /Apri la pagina di sicurezza Google/i }))
    await waitFor(() => expect(api.openExternalUrl).toHaveBeenCalledWith('https://myaccount.google.com/security'))
    fireEvent.click(screen.getByRole('link', { name: /Password per le app Google/i }))
    await waitFor(() => expect(api.openExternalUrl).toHaveBeenCalledWith('https://myaccount.google.com/apppasswords'))
  })

  it('mostra i campi Gmail vuoti quando il provider non è configurato', () => {
    renderSettings(
      { emailProvider: 'gmail', gmailAddress: '', emailAddresses: { gmail: '' } },
      { emailCredentialsConfigured: false, emailCredentialsByProvider: { gmail: false } },
    )
    expect(screen.getByLabelText(/Indirizzo e-mail mittente/i)).toHaveValue('')
    expect(screen.getByLabelText(/Password per app Gmail/i)).toHaveValue('')
    expect(screen.queryByText(/Password Gmail salvata in modo cifrato/i)).not.toBeInTheDocument()
  })

  it('mostra i destinatari e-mail come righe attivabili', async () => {
    const { api } = renderSettings({
      emailRecipients: [{ id: 'email-1', label: 'Danilo', email: 'danilo@example.org', enabled: true }],
    })
    expect(screen.getByText(/Danilo/)).toBeInTheDocument()
    expect(screen.getByText('danilo@example.org')).toBeInTheDocument()
    const recipientToggle = screen.getByRole('checkbox', { name: /Attiva destinatario Danilo/i })
    expect(recipientToggle).toBeChecked()
    fireEvent.click(recipientToggle)
    await waitFor(() => expect(api.saveSettings).toHaveBeenCalledWith({
      emailRecipients: [{ id: 'email-1', label: 'Danilo', email: 'danilo@example.org', enabled: false }],
    }))
  })

  it('mantiene l indirizzo Gmail mentre arriva uno snapshot senza credenziali', () => {
    const view = renderSettings(
      { emailProvider: 'gmail', emailAddresses: { gmail: '' }, gmailAddress: '' },
      { emailCredentialsConfigured: false, emailCredentialsByProvider: { gmail: false } },
    )
    fireEvent.change(screen.getByLabelText(/Indirizzo e-mail mittente/i), { target: { value: 'avis@gmail.com' } })
    view.rerender(<SettingsModal {...view.props} state={{ ...view.props.state, settings: { ...view.props.state.settings } }} />)
    expect(screen.getByLabelText(/Indirizzo e-mail mittente/i)).toHaveValue('avis@gmail.com')
  })

  it('blocca il salvataggio Gmail con dati e-mail non validi', async () => {
    const { api } = renderSettings({ emailProvider: 'gmail' })
    fireEvent.change(screen.getByLabelText(/Indirizzo e-mail mittente/i), { target: { value: 'indirizzo-non-valido' } })
    fireEvent.change(screen.getByLabelText(/Password per app Gmail/i), { target: { value: 'password-valida' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salva provider' }))
    expect(await screen.findByText(/indirizzo e-mail Gmail valido/i)).toBeInTheDocument()
    expect(api.saveGmailPassword).not.toHaveBeenCalled()
  })
})
