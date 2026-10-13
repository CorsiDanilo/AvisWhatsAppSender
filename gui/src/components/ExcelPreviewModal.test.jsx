import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ExcelPreviewModal from './ExcelPreviewModal'

const inspectionData = {
  filePath: 'C:/tmp/donatori.csv',
  inspection: {
    currentSheet: 'CSV',
    sheets: ['CSV'],
    headers: ['Nominativo', 'Cellulare', 'Gruppo'],
    detectedMapping: { name: 'Nominativo', phone: 'Cellulare', nameAndSurnameInOneColumn: true },
    sampleRows: [{ Nominativo: 'COGNOME Nome', Cellulare: '3331234567', Gruppo: 'Adulti' }],
  },
}

describe('ExcelPreviewModal', () => {
  it('previews normalized rows and confirms the selected mapping', () => {
    const onConfirm = vi.fn()
    render(<ExcelPreviewModal api={{}} inspectionData={inspectionData} onConfirm={onConfirm} onCancel={vi.fn()} />)
    expect(screen.getAllByText('Nome').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Cognome').length).toBeGreaterThan(0)
    expect(screen.getByText('3331234567')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Conferma e importa/i }))
    expect(onConfirm).toHaveBeenCalledWith(
      'C:/tmp/donatori.csv',
      'CSV',
      expect.objectContaining({ name: 'Nominativo', phone: 'Cellulare', nameAndSurnameInOneColumn: true }),
    )
  })

  it('reloads a selected sheet and exposes cancel', async () => {
    const inspectCsvSheet = vi.fn(() => Promise.resolve({
      inspection: {
        headers: ['Nome', 'Telefono'],
        sampleRows: [{ Nome: 'Nome', Telefono: '333' }],
        detectedMapping: { name: 'Nome', phone: 'Telefono' },
      },
    }))
    const onCancel = vi.fn()
    const data = { ...inspectionData, inspection: { ...inspectionData.inspection, sheets: ['CSV', 'Foglio2'] } }
    render(<ExcelPreviewModal api={{ inspectCsvSheet }} inspectionData={data} onConfirm={vi.fn()} onCancel={onCancel} />)
    fireEvent.change(screen.getByLabelText('Foglio di lavoro Excel'), { target: { value: 'Foglio2' } })
    await waitFor(() => expect(inspectCsvSheet).toHaveBeenCalledWith('C:/tmp/donatori.csv', 'Foglio2'))
    fireEvent.click(screen.getByRole('button', { name: 'Annulla' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
