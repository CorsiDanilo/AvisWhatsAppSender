import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import SendingDashboard from './SendingDashboard'

function makeState(overrides = {}) {
  return {
    queue: 'running',
    queuePauseReason: null,
    logs: [],
    donors: [{ name: 'Nome', surname: 'Cognome', phone: '393331234567', selected: true, valid: true, status: 'pending' }],
    progress: { current: 0, total: 1, sent: 0, failed: 0, skipped: 0, unknown: 0 },
    settings: { minDelayMs: 1000, maxDelayMs: 2000, pauseAfter: 35, pauseMinutes: 1 },
    postSessionCountdown: null,
    lastOutcomeDir: '',
    ...overrides,
  }
}

describe('SendingDashboard', () => {
  it('pauses a running queue and exposes the stop action', () => {
    const call = vi.fn((operation) => operation())
    const api = { pause: vi.fn(), stop: vi.fn() }
    render(
      <SendingDashboard
        state={makeState()}
        counts={{}}
        isRunning
        isPaused={false}
        call={call}
        api={api}
        onBackToEdit={vi.fn()}
        connectionState="ready"
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Metti in Pausa/i }))
    expect(call).toHaveBeenCalledTimes(1)
    expect(api.pause).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: /Ferma sessione/i })).toBeInTheDocument()
  })

  it('blocks resume until WhatsApp is ready and explains a connection pause', () => {
    const state = makeState({ queue: 'paused', queuePauseReason: 'disconnected:network' })
    const call = vi.fn()
    render(
      <SendingDashboard
        state={state}
        counts={{}}
        isRunning={false}
        isPaused
        call={call}
        api={{ resume: vi.fn(), stop: vi.fn() }}
        onBackToEdit={vi.fn()}
        connectionState="disconnected"
      />,
    )

    expect(screen.getByText('WhatsApp non è pronto')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Riprendi invio/i })).toBeDisabled()
    expect(call).not.toHaveBeenCalled()
  })

  it('allows resume when ready and marks uncertain sends distinctly', () => {
    const call = vi.fn((operation) => operation())
    const resume = vi.fn()
    render(
      <SendingDashboard
        state={makeState({ queue: 'paused', queuePauseReason: 'send-uncertain' })}
        counts={{}}
        isRunning={false}
        isPaused
        call={call}
        api={{ resume, stop: vi.fn() }}
        onBackToEdit={vi.fn()}
        connectionState="ready"
      />,
    )

    expect(screen.getByText('Esito di un invio da verificare')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Riprendi invio/i }))
    expect(resume).toHaveBeenCalledTimes(1)
  })
})
