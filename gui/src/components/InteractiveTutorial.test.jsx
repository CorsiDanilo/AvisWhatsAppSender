import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TutorialDock, WelcomeModal } from './InteractiveTutorial'
import { TUTORIAL_STEPS } from './tutorialData'

describe('InteractiveTutorial', () => {
  it('starts or skips the welcome tutorial', () => {
    const onStartTour = vi.fn()
    const onSkip = vi.fn()
    render(<WelcomeModal onStartTour={onStartTour} onSkip={onSkip} />)
    fireEvent.click(screen.getByRole('button', { name: /Inizia il Tutorial/i }))
    fireEvent.click(screen.getByRole('button', { name: /Salta per ora/i }))
    expect(onStartTour).toHaveBeenCalledTimes(1)
    expect(onSkip).toHaveBeenCalledTimes(1)
  })

  it('supports tutorial navigation, simulation and exit', () => {
    const onNext = vi.fn()
    const onPrev = vi.fn()
    const onExit = vi.fn()
    const onStartSimulation = vi.fn()
    const stepData = { title: 'Prova', description: 'Descrizione', actionLabel: 'Avanti' }
    const { rerender } = render(
      <TutorialDock
        currentStepIndex={2}
        totalSteps={5}
        stepData={stepData}
        onNext={onNext}
        onPrev={onPrev}
        onExit={onExit}
        isSimulating={false}
        onStartSimulation={onStartSimulation}
        simulationDone={false}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Precedente/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Avanti' }))
    expect(onPrev).toHaveBeenCalledTimes(1)
    expect(onNext).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Chiudi tutorial' }))
    expect(onExit).toHaveBeenCalledTimes(1)

    rerender(
      <TutorialDock
        currentStepIndex={5}
        totalSteps={5}
        stepData={stepData}
        onNext={onNext}
        onPrev={onPrev}
        onExit={onExit}
        isSimulating={false}
        onStartSimulation={onStartSimulation}
        simulationDone={false}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Avvia Simulazione/i }))
    expect(onStartSimulation).toHaveBeenCalledTimes(1)
  })

  it('covers the current recovery, notification and reporting features', () => {
    const tutorialText = TUTORIAL_STEPS.map((step) => `${step.title} ${step.description}`).join(' ')

    expect(tutorialText).toMatch(/Riconnetti WhatsApp/i)
    expect(tutorialText).toMatch(/da verificare/i)
    expect(tutorialText).toMatch(/compleanni/i)
    expect(tutorialText).toMatch(/notifiche/i)
    expect(tutorialText).toMatch(/esito_falliti\.csv/i)
    expect(tutorialText).toMatch(/aggiornamenti/i)
  })
})
