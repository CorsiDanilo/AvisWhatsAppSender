import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import Guide from './Guide'

describe('Guide', () => {
  it('starts the interactive tutorial and closes the guide', () => {
    const onClose = vi.fn()
    const onStartTutorial = vi.fn()
    render(<Guide onClose={onClose} onStartTutorial={onStartTutorial} />)
    fireEvent.click(screen.getByRole('button', { name: /Avvia Tutorial Interattivo/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onStartTutorial).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Chiudi guida' }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('documents the current import, WhatsApp recovery and result workflow', () => {
    render(<Guide onClose={vi.fn()} onStartTutorial={vi.fn()} />)

    expect(screen.getByText(/prime 5 righe/i)).toBeInTheDocument()
    expect(screen.getByText(/Riconnetti WhatsApp/i)).toBeInTheDocument()
    expect(screen.getAllByText(/invio da verificare/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText('esito_falliti.csv').length).toBeGreaterThan(0)
    expect(screen.getByText(/Centro notifiche/i)).toBeInTheDocument()
  })
})
