import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import BirthdayCenter from './BirthdayCenter'

function renderBirthday(overrides = {}) {
  const api = {
    checkBirthdays: vi.fn(() => Promise.resolve()),
    prepareBirthdaySession: vi.fn(() => Promise.resolve({ donors: [{ name: 'Nome' }] })),
    toggleBirthdayInhibition: vi.fn(() => Promise.resolve()),
  }
  const call = vi.fn((operation) => operation())
  const props = {
    isOpen: true,
    state: {
      donors: [],
      birthdays: {
        status: 'ready',
        dateKey: '13/10/2026',
        sourceFileName: 'compleanni.csv',
        matches: [{ name: 'Nome', surname: 'Cognome', phone: '393331234567', valid: true }],
        invalidRows: [],
      },
    },
    api,
    call,
    onClose: vi.fn(),
    onPrepared: vi.fn(),
    onConfigure: vi.fn(),
    ...overrides,
  }
  return { ...render(<BirthdayCenter {...props} />), api, call, props }
}

describe('BirthdayCenter', () => {
  it('checks, suppresses and prepares birthday recipients', async () => {
    const { api, props } = renderBirthday()
    fireEvent.click(screen.getByRole('button', { name: 'Controlla ora' }))
    await waitFor(() => expect(api.checkBirthdays).toHaveBeenCalledWith({ force: true, notify: false }))
    fireEvent.click(screen.getByRole('button', { name: /Non inviare oggi/i }))
    await waitFor(() => expect(api.toggleBirthdayInhibition).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByRole('button', { name: /Prepara gli auguri/i }))
    await waitFor(() => expect(api.prepareBirthdaySession).toHaveBeenCalledTimes(1))
    expect(props.onPrepared).toHaveBeenCalled()
    expect(props.onClose).toHaveBeenCalled()
  })

  it('routes a missing birthday source to configuration', () => {
    const onClose = vi.fn()
    const onConfigure = vi.fn()
    renderBirthday({
      onClose,
      onConfigure,
      state: { donors: [], birthdays: { status: 'not-configured', error: 'Manca il file' } },
    })
    fireEvent.click(screen.getByRole('button', { name: /Configura il file/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onConfigure).toHaveBeenCalledTimes(1)
  })
})
