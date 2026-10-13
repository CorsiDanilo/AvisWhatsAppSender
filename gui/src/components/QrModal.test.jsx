import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import QrModal from './QrModal'

const baseState = { connection: 'disconnected', qrDataUrl: '' }

describe('QrModal', () => {
  it('does not render when closed', () => {
    const { container } = render(
      <QrModal isOpen={false} onClose={vi.fn()} state={baseState} api={{}} call={vi.fn()} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the QR and reconnects through the shared call wrapper', async () => {
    const call = vi.fn((operation) => operation())
    const reconnect = vi.fn(() => Promise.resolve())
    render(
      <QrModal
        isOpen
        onClose={vi.fn()}
        state={{ connection: 'qr', qrDataUrl: 'data:image/png;base64,abc' }}
        api={{ reconnect }}
        call={call}
      />,
    )

    expect(screen.getByRole('img', { name: 'Codice QR per WhatsApp' })).toHaveAttribute(
      'src',
      'data:image/png;base64,abc',
    )
    fireEvent.click(screen.getByRole('button', { name: /Riconnetti WhatsApp/i }))
    await waitFor(() => expect(reconnect).toHaveBeenCalledTimes(1))
    expect(call).toHaveBeenCalledTimes(1)
  })

  it('resets the session through the explicit reset API and closes from the footer', async () => {
    const resetWhatsAppSession = vi.fn(() => Promise.resolve())
    const onClose = vi.fn()
    const call = vi.fn((operation) => operation())
    render(
      <QrModal isOpen onClose={onClose} state={baseState} api={{ resetWhatsAppSession }} call={call} />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Azzera sessione/i }))
    await waitFor(() => expect(resetWhatsAppSession).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByRole('button', { name: /Chiudi e continua/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
