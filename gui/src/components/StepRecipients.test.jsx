import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import StepRecipients from './StepRecipients'

function renderRecipients() {
  const api = {
    setSelection: vi.fn(),
    setAllSelected: vi.fn(),
    addDonor: vi.fn(() => Promise.resolve()),
    updateDonor: vi.fn(() => Promise.resolve()),
    inspectCsv: vi.fn(() => Promise.resolve()),
  }
  const call = vi.fn((operation) => operation())
  const props = {
    state: {
      fileName: 'donatori.csv',
      filePath: 'C:/tmp/donatori.csv',
      sheetName: 'CSV',
      donors: [
        { name: 'Nome', surname: 'Cognome', phone: '3331234567', rawPhone: '3331234567', valid: true, selected: true, status: 'pending' },
        { name: 'Numero', surname: 'Errato', phone: '', rawPhone: 'abc', valid: false, selected: false, status: 'failed' },
      ],
    },
    api,
    call,
    isRunning: false,
    isPaused: false,
    onNext: vi.fn(),
  }
  return { ...render(<StepRecipients {...props} />), api, call, props }
}

describe('StepRecipients', () => {
  it('filters donors, selects rows and applies mass actions', () => {
    const { api } = renderRecipients()
    fireEvent.change(screen.getByRole('textbox', { name: 'Cerca donatori' }), { target: { value: 'Nome' } })
    expect(screen.getByText('Nome Cognome')).toBeInTheDocument()
    expect(screen.queryByText('Numero Errato')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Seleziona tutti' }))
    expect(api.setAllSelected).toHaveBeenCalledWith(true)
    fireEvent.click(screen.getByRole('checkbox', { name: 'Seleziona Nome Cognome' }))
    expect(api.setSelection).toHaveBeenCalledWith(0, false)
  })

  it('adds a recipient through the inline editor', async () => {
    const { api } = renderRecipients()
    fireEvent.click(screen.getByRole('button', { name: /Aggiungi destinatario/i }))
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Nome Alternativo' } })
    fireEvent.change(screen.getByLabelText('Cognome'), { target: { value: 'Cognome Alternativo' } })
    fireEvent.change(screen.getByLabelText('Telefono'), { target: { value: '3337654321' } })
    fireEvent.click(screen.getByRole('button', { name: /Aggiungi riga/i }))
    await waitFor(() => expect(api.addDonor).toHaveBeenCalledWith(expect.objectContaining({ name: 'Nome Alternativo', surname: 'Cognome Alternativo', phone: '3337654321' }), []))
  })
})
