import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import DeveloperReportModal from './DeveloperReportModal'

describe('DeveloperReportModal', () => {
  it('offers all delivery methods and sends the selected method', async () => {
    const sendDeveloperReport = vi.fn(() => Promise.resolve({ method: 'gmail-smtp' }))
    render(<DeveloperReportModal isOpen errorContext="queue failed" api={{ sendDeveloperReport }} onClose={vi.fn()} />)
    expect(screen.getByRole('button', { name: /Gmail AVIS/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Copia negli appunti/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Gmail AVIS/i }))
    await waitFor(() => expect(sendDeveloperReport).toHaveBeenCalledWith({ errorContext: 'queue failed', method: 'gmail-smtp' }))
    expect(screen.getByText(/Log inviato/i)).toBeInTheDocument()
  })

  it('closes without rendering when hidden', () => {
    const { container } = render(<DeveloperReportModal isOpen={false} onClose={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })
})
