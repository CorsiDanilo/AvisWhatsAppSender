import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ErrorBoundary from './ErrorBoundary'

function BrokenComponent() {
  throw new Error('errore di prova')
}

describe('ErrorBoundary', () => {
  it('shows a recovery screen and sends the crash report', async () => {
    const report = vi.fn(() => Promise.resolve())
    const originalError = console.error
    console.error = vi.fn()
    window.whatsappSender = { sendDeveloperReport: report }
    try {
      render(
        <ErrorBoundary>
          <BrokenComponent />
        </ErrorBoundary>,
      )
      expect(screen.getByText('errore di prova')).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: /Invia log allo sviluppatore/i }))
      await waitFor(() => expect(report).toHaveBeenCalledWith(expect.stringContaining('React UI Crash: errore di prova')))
      expect(screen.getByText(/Client di posta aperto/i)).toBeInTheDocument()
    } finally {
      console.error = originalError
      delete window.whatsappSender
    }
  })
})
