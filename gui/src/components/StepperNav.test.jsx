import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import StepperNav from './StepperNav'

describe('StepperNav', () => {
  it('enables only reached steps and reports navigation', () => {
    const onSelectStep = vi.fn()
    render(<StepperNav currentStep={2} maxStepReached={2} onSelectStep={onSelectStep} disabled={false} />)

    const buttons = screen.getAllByRole('button')
    expect(buttons[0]).toBeEnabled()
    expect(buttons[1]).toBeEnabled()
    expect(buttons[2]).toBeDisabled()
    fireEvent.click(buttons[0])
    expect(onSelectStep).toHaveBeenCalledWith(1)
  })

  it('disables all navigation while sending', () => {
    render(<StepperNav currentStep={2} maxStepReached={3} onSelectStep={vi.fn()} disabled />)
    expect(screen.getAllByRole('button').every((button) => button.disabled)).toBe(true)
  })
})
