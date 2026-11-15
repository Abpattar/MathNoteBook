import { useEffect, useRef, useMemo, useState } from 'react';
import { renderMath } from '../utils/katexRender';
import type { DisplayMode, SolutionStep } from '../types/canvas';
import './MathDisplay.css';

interface MathDisplayProps {
  steps: SolutionStep[];
  mode: DisplayMode;
  currentStep: number;
  onStepReveal: (stepNumber: number) => void;
  onShowAll: () => void;
  onHint: (stepNumber: number) => void;
  onRestart?: () => void;
  onBackToCanvas?: () => void;
  disabled?: boolean;
}

export function MathDisplay({
  steps,
  mode,
  currentStep,
  onStepReveal,
  onShowAll,
  onHint,
  onRestart,
  onBackToCanvas,
  disabled = false
}: MathDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [revealedHints, setRevealedHints] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [currentStep]);

  const visibleSteps = useMemo(() => {
    return steps.filter(step => step.step_number <= currentStep);
  }, [steps, currentStep]);

  const isFinalStep = currentStep >= steps.length;

  const handleNextStep = () => {
    if (currentStep < steps.length) {
      onStepReveal(currentStep + 1);
    }
  };

  const handleShowAll = () => {
    onShowAll();
  };

  const handleRestart = () => {
    if (onRestart) {
      onRestart();
    } else {
      onStepReveal(1);
    }
  };

  const handleHintToggle = (stepNumber: number) => {
    setRevealedHints(prev => {
      const next = new Set(prev);
      if (next.has(stepNumber)) {
        next.delete(stepNumber);
      } else {
        next.add(stepNumber);
      }
      return next;
    });
    onHint(stepNumber);
  };

  if (steps.length === 0) {
    return (
      <div className="math-display empty" role="status" aria-live="polite">
        <div className="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
          <p>No solution yet. Type an equation below and click <strong>Solve</strong>.</p>
          {onBackToCanvas && (
            <button className="control-btn secondary" onClick={onBackToCanvas}>
              ✏️ Go to Canvas
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`math-display ${mode}-mode`}
      role="region"
      aria-label="Step-by-step solution"
      aria-live="polite"
    >
      <div className="solution-container">
        {visibleSteps.map((step, index) => (
          <div
            key={step.step_number}
            className={`solution-step ${step.is_final_answer ? 'final-answer' : ''}`}
            style={{ animationDelay: `${index * 80}ms` }}
          >
            <div className="step-header">
              <span className="step-number">Step {step.step_number}</span>
              {step.is_final_answer && (
                <span className="final-answer-badge" aria-label="Final answer">
                  Final Answer
                </span>
              )}
            </div>

            <div className="step-math" dangerouslySetInnerHTML={{ __html: renderMath(step.display_math) }} />

            <div className="step-explanation">
              {step.explanation}
            </div>

            {step.hint && (
              <button
                className="step-hint-btn"
                onClick={() => handleHintToggle(step.step_number)}
                disabled={disabled}
                aria-label={`Toggle hint for step ${step.step_number}`}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="hint-icon">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4" />
                  <path d="M12 8h.01" />
                </svg>
                <span>{revealedHints.has(step.step_number) ? 'Hide Hint' : 'Show Hint'}</span>
              </button>
            )}

            {step.hint && revealedHints.has(step.step_number) && (
              <div className="step-hint" role="status" aria-live="polite">
                {step.hint}
              </div>
            )}

            {step.is_final_answer && step.final_answer_text && (
              <div
                className="final-answer-text"
                role="alert"
                dangerouslySetInnerHTML={{ __html: renderMath(step.final_answer_text) }}
              />
            )}
          </div>
        ))}

        {!isFinalStep && steps.length > 0 && (
          <div className="step-controls">
            <button
              className="control-btn primary"
              onClick={handleNextStep}
              disabled={disabled}
              aria-label="Reveal next step"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14" />
                <path d="M12 5l7 7-7 7" />
              </svg>
              Next Step ({currentStep + 1}/{steps.length})
            </button>
            <button
              className="control-btn secondary"
              onClick={handleShowAll}
              disabled={disabled}
              aria-label="Show all steps"
            >
              Show All Steps
            </button>
            {onBackToCanvas && (
              <button
                className="control-btn secondary"
                onClick={onBackToCanvas}
                disabled={disabled}
                aria-label="Back to canvas"
              >
                ✏️ Canvas
              </button>
            )}
          </div>
        )}

        {isFinalStep && steps.length > 0 && (
          <div className="step-controls">
            <button
              className="control-btn secondary"
              onClick={handleRestart}
              disabled={disabled}
              aria-label="Restart steps from beginning"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
              Replay Steps
            </button>
            {onBackToCanvas && (
              <button
                className="control-btn secondary"
                onClick={onBackToCanvas}
                disabled={disabled}
                aria-label="Back to canvas"
              >
                ✏️ Back to Canvas
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}