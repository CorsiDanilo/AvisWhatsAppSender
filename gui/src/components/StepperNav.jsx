export default function StepperNav({ currentStep, onSelectStep, maxStepReached, disabled }) {
  const steps = [
    { number: 1, label: 'Destinatari', subtitle: 'File & Selezione' },
    { number: 2, label: 'Messaggio & Ritmo', subtitle: 'Testo, foto & tempi' },
    { number: 3, label: 'Riepilogo & Invio', subtitle: 'Verifica & Avvio' },
  ]

  return (
    <nav className="stepper-nav" aria-label="Progresso configurazione invio">
      <div className="stepper-track">
        {steps.map((step, index) => {
          const isActive = currentStep === step.number
          const isCompleted = currentStep > step.number
          const isClickable = !disabled && (step.number <= maxStepReached || isCompleted)

          return (
            <div key={step.number} className="stepper-item-wrapper">
              <button
                type="button"
                className={`stepper-node ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''} ${
                  isClickable ? 'clickable' : 'disabled'
                }`}
                onClick={() => isClickable && onSelectStep(step.number)}
                disabled={!isClickable}
                aria-current={isActive ? 'step' : undefined}
              >
                <div className="stepper-badge">
                  {isCompleted ? '✓' : step.number}
                </div>
                <div className="stepper-text">
                  <span className="stepper-label">{step.label}</span>
                  <span className="stepper-subtitle">{step.subtitle}</span>
                </div>
              </button>
              {index < steps.length - 1 && (
                <div className={`stepper-connector ${isCompleted ? 'completed' : ''}`} />
              )}
            </div>
          )
        })}
      </div>
    </nav>
  )
}
