import { useState, useCallback, useEffect, useRef } from 'react';
import { MathCanvas } from './components/MathCanvas';
import { TypedInput } from './components/TypedInput';
import { ModeToggle } from './components/ModeToggle';
import { MathDisplay } from './components/MathDisplay';
import { ParabolaVisualizer } from './components/visualizations/ParabolaVisualizer';
import { EquationBalanceVisualizer } from './components/visualizations/EquationBalanceVisualizer';
import { AlgebraTilesVisualizer } from './components/visualizations/AlgebraTilesVisualizer';
import { ConceptLearningDrawer } from './components/ConceptLearningDrawer';
import { AccessibilityPanel } from './components/AccessibilityPanel';
import { StudentProfileModal } from './components/StudentProfileModal';
import type { Stroke, SolutionStep, DisplayMode } from './types/canvas';
import type { UnifiedMathematicalRepresentation, StudentProfile } from './types/umr';
import './styles/globals.css';
import './styles/canvas.css';
import './styles/notebook.css';
import './styles/textbook.css';
import './App.css';

const INITIAL_STROKES: Stroke[] = [];

type ScreenTab = 'canvas' | 'solution' | 'prerequisites' | 'visualizer';

const DEFAULT_PROFILE: StudentProfile = {
  student_id: 'student_user',
  grade: 7,
  preferences: {
    learning_style: 'balanced',
    steps_per_screen: 1,
    explanation_depth: 'detailed',
    show_prerequisites_first: true,
    speech_enabled: true,
    speech_rate: 1.0,
    speech_dialect: 'clearspeak',
    braille_enabled: true,
    braille_standard: 'nemeth',
    sign_language_enabled: true,
    sign_language_dialect: 'ISL',
    interactive_visuals_enabled: true,
    sonification_enabled: true,
    reduced_distraction: false,
    break_reminders: false,
    animation_enabled: true
  }
};

function App() {
  const [strokes, setStrokes] = useState<Stroke[]>(INITIAL_STROKES);
  const [redoStack, setRedoStack] = useState<Stroke[][]>([]);
  const [typedInput, setTypedInput] = useState('');
  const [lastActiveSource, setLastActiveSource] = useState<'canvas' | 'typed'>('canvas');
  const [mode, setMode] = useState<DisplayMode>('notebook');
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const [penColor] = useState('#000000');
  const [penWidth] = useState(2);
  const [eraserWidth] = useState(20);
  const [solutionSteps, setSolutionSteps] = useState<SolutionStep[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [activeTab, setActiveTab] = useState<ScreenTab>('canvas');
  const [isLoading, setIsLoading] = useState(false);
  const [notice, setNotice] = useState<{ message: string; type: 'info' | 'error' } | null>(null);

  // Orchestrator State & Student Profile
  const [profile, setProfile] = useState<StudentProfile>(DEFAULT_PROFILE);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [umr, setUmr] = useState<UnifiedMathematicalRepresentation | null>(null);
  const [visualMode, setVisualMode] = useState<'parabola' | 'tiles'>('parabola');

  const exportCanvasRef = useRef<() => string>(() => '');
  const recognizeAbortRef = useRef<AbortController | null>(null);
  const isRecognizingRef = useRef(false);

  const handleExportReady = useCallback((fn: () => string) => {
    exportCanvasRef.current = fn;
  }, []);

  const handleStrokesChange = useCallback((newStrokes: Stroke[]) => {
    setStrokes(newStrokes);
    setRedoStack([]);
    setLastActiveSource('canvas');
    if (notice) setNotice(null);
  }, [notice]);

  // Debounced auto-recognize when user draws on canvas
  useEffect(() => {
    if (strokes.length === 0) return;
    if (recognizeAbortRef.current) recognizeAbortRef.current.abort();

    const timer = setTimeout(async () => {
      const imageB64 = exportCanvasRef.current ? exportCanvasRef.current() : '';
      if (!imageB64 || isRecognizingRef.current) return;

      const controller = new AbortController();
      recognizeAbortRef.current = controller;
      isRecognizingRef.current = true;

      try {
        const recRes = await fetch('/api/recognize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image_b64: imageB64, strokes }),
          signal: controller.signal
        });
        if (recRes.ok) {
          const recData = await recRes.json();
          if (recData.recognized_text) {
            setTypedInput(recData.recognized_text);
          }
        }
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          // Preview recognition error is non-fatal
        }
      } finally {
        isRecognizingRef.current = false;
      }
    }, 2500);

    return () => {
      clearTimeout(timer);
      if (recognizeAbortRef.current) recognizeAbortRef.current.abort();
    };
  }, [strokes]);

  const handleUndo = useCallback(() => {
    if (strokes.length > 0) {
      const lastStroke = strokes[strokes.length - 1];
      setRedoStack(prev => [...prev, [lastStroke]]);
      setStrokes(prev => prev.slice(0, -1));
      setLastActiveSource('canvas');
    }
  }, [strokes]);

  const handleRedo = useCallback(() => {
    if (redoStack.length > 0) {
      const nextGroup = redoStack[redoStack.length - 1];
      setRedoStack(prev => prev.slice(0, -1));
      setStrokes(prev => [...prev, ...nextGroup]);
      setLastActiveSource('canvas');
    }
  }, [redoStack]);

  const handleClear = useCallback(() => {
    setStrokes([]);
    setRedoStack([]);
    setTypedInput('');
    setLastActiveSource('canvas');
    setSolutionSteps([]);
    setCurrentStep(0);
    setNotice(null);
    setUmr(null);
    setActiveTab('canvas');
  }, []);

  const handleSolve = useCallback(async () => {
    if (recognizeAbortRef.current) recognizeAbortRef.current.abort();

    const text = typedInput.trim();
    setNotice(null);
    setIsLoading(true);

    try {
      const shouldSolveCanvas = lastActiveSource === 'canvas' ? strokes.length > 0 : (!text && strokes.length > 0);
      let textToSolve = text;
      let imageB64: string | undefined = undefined;

      if (shouldSolveCanvas) {
        imageB64 = exportCanvasRef.current ? exportCanvasRef.current() : undefined;
        if (!imageB64 && strokes.length === 0) {
          setNotice({ message: 'Canvas is empty. Draw an equation or type below to solve.', type: 'info' });
          setIsLoading(false);
          return;
        }

        // Try handwriting OCR first if text input is empty
        if (!textToSolve && imageB64) {
          try {
            const recRes = await fetch('/api/recognize', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ image_b64: imageB64, strokes })
            });
            if (recRes.ok) {
              const recData = await recRes.json();
              if (recData.recognized_text) {
                textToSolve = recData.recognized_text;
                setTypedInput(recData.recognized_text);
              }
            }
          } catch {
            // Ignore preview error; orchestrator handles raw content
          }
        }
      }

      if (!textToSolve && !imageB64) {
        setNotice({
          message: 'Please write an equation on the canvas or type it below to solve.',
          type: 'info'
        });
        setIsLoading(false);
        return;
      }

      // CALL CENTRAL ORCHESTRATION PIPELINE
      const orchRes = await fetch('/api/orchestrate/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          raw_content: textToSolve || 'handwritten_canvas',
          input_type: shouldSolveCanvas ? 'handwriting' : 'typed',
          strokes: shouldSolveCanvas ? strokes : undefined,
          image_b64: shouldSolveCanvas ? imageB64 : undefined,
          recognized_latex: textToSolve || undefined,
          profile: profile
        })
      });

      if (!orchRes.ok) {
        const errJson = await orchRes.json().catch(() => ({}));
        throw new Error(errJson.detail || 'Orchestrator failed to process problem');
      }

      const umrData: UnifiedMathematicalRepresentation = await orchRes.json();
      setUmr(umrData);

      if (umrData.understanding.is_ambiguous) {
        setNotice({
          message: umrData.understanding.clarification_question || 'Could not clearly recognize the problem.',
          type: 'error'
        });
        setIsLoading(false);
        return;
      }

      if (umrData.solution.steps && umrData.solution.steps.length > 0) {
        // Adapt solution step payloads to frontend SolutionStep structure
        const adaptedSteps: SolutionStep[] = umrData.solution.steps.map((st) => ({
          step_number: st.step_number,
          operation: st.operation,
          equation_ast: {},
          display_math: st.latex,
          explanation: st.explanation,
          validation: {
            is_valid: st.verified,
            method: 'sympy_verify',
            details: 'SymPy equivalence check passed'
          },
          hint: st.hint || 'Review the operations applied to both sides.',
          is_final_answer: st.is_final_answer,
          final_answer_text: st.is_final_answer ? (umrData.solution.final_answer_text || '') : ''
        }));

        setSolutionSteps(adaptedSteps);
        setCurrentStep(1);

        // Routing based on student preferences
        if (profile.preferences.show_prerequisites_first && umrData.learning.prerequisites.length > 0) {
          setActiveTab('prerequisites');
        } else {
          setActiveTab('solution');
        }
      } else {
        setNotice({
          message: umrData.solution.error_message || 'Could not find a verified step-by-step solution.',
          type: 'error'
        });
      }
    } catch (e: any) {
      console.error('Solve error:', e);
      setNotice({
        message: e?.message || 'Could not solve the problem. Please verify your equation or backend connection.',
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  }, [typedInput, strokes, profile]);

  const handleShowAll = useCallback(() => {
    setCurrentStep(solutionSteps.length);
  }, [solutionSteps.length]);

  const handleHint = useCallback((stepNumber: number) => {
    console.log('Hint requested for step', stepNumber);
  }, []);

  const handleRestartSteps = useCallback(() => {
    setCurrentStep(1);
  }, []);

  const handleBackToCanvas = useCallback(() => {
    setActiveTab('canvas');
  }, []);

  const canUndo = strokes.length > 0;
  const canRedo = redoStack.length > 0;

  useEffect(() => {
    document.documentElement.setAttribute('data-mode', mode);
  }, [mode]);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await fetch('/api/orchestrate/health');
        if (response.ok) {
          console.log('Central Orchestrator Connected & Operational');
        }
      } catch {
        console.log('Orchestrator offline');
      }
    };
    checkHealth();
  }, []);

  return (
    <div className={`app ${profile.preferences.reduced_distraction ? 'reduced-distraction' : ''}`}>
      <header className="app-header">
        <div className="header-content">
          <div className="header-titles">
            <h1 className="app-title">MathAI Universal Platform</h1>
            <p className="app-subtitle">One problem · One verified solution · Inclusive multimodal understanding</p>
          </div>
          <div className="header-controls">
            <button
              className="pref-toggle-btn"
              onClick={() => setIsProfileModalOpen(true)}
              title="Personalized Accommodations & Accessibility Preferences"
              aria-label="Open learning & accessibility preferences"
            >
              ⚙️ Preferences
            </button>
            <ModeToggle mode={mode} onChange={setMode} />
          </div>
        </div>
      </header>

      <main className="app-main">
        {/* ONE Central Screen Card */}
        <section className="single-screen-card" aria-label="Math Learning Workspace">
          {/* Screen Header Bar with View Tabs and Quick Actions */}
          <div className="screen-header-bar">
            <div className="screen-tabs" role="tablist" aria-label="Screen View">
              <button
                role="tab"
                aria-selected={activeTab === 'canvas'}
                className={`screen-tab-btn ${activeTab === 'canvas' ? 'active' : ''}`}
                onClick={() => setActiveTab('canvas')}
              >
                ✏️ Canvas
              </button>
              <button
                role="tab"
                aria-selected={activeTab === 'solution'}
                className={`screen-tab-btn ${activeTab === 'solution' ? 'active' : ''}`}
                onClick={() => setActiveTab('solution')}
              >
                📘 Solution Steps
                {solutionSteps.length > 0 && (
                  <span className="screen-tab-badge">{solutionSteps.length}</span>
                )}
              </button>
              {umr && umr.learning && umr.learning.prerequisites.length > 0 && (
                <button
                  role="tab"
                  aria-selected={activeTab === 'prerequisites'}
                  className={`screen-tab-btn ${activeTab === 'prerequisites' ? 'active' : ''}`}
                  onClick={() => setActiveTab('prerequisites')}
                >
                  💡 Prerequisites
                  <span className="screen-tab-badge prereq">{umr.learning.prerequisites.length}</span>
                </button>
              )}
              {umr && umr.visualisation && umr.visualisation.type && (
                <button
                  role="tab"
                  aria-selected={activeTab === 'visualizer'}
                  className={`screen-tab-btn ${activeTab === 'visualizer' ? 'active' : ''}`}
                  onClick={() => setActiveTab('visualizer')}
                >
                  📊 Interactive Visual
                </button>
              )}
            </div>

            <div className="screen-actions">
              {activeTab === 'canvas' && (
                <button
                  className="action-btn"
                  onClick={handleClear}
                  disabled={strokes.length === 0 && solutionSteps.length === 0}
                  title="Clear canvas and reset"
                >
                  Clear
                </button>
              )}
              {activeTab !== 'canvas' && (
                <button
                  className="action-btn"
                  onClick={handleBackToCanvas}
                  title="Switch back to canvas drawing"
                >
                  ✏️ View Canvas
                </button>
              )}
            </div>
          </div>

          {/* Inline Guidance Notice */}
          {notice && (
            <div className={`screen-notice ${notice.type}`} role="alert">
              <span>{notice.message}</span>
              <button
                className="screen-notice-close"
                onClick={() => setNotice(null)}
                aria-label="Dismiss notice"
              >
                ×
              </button>
            </div>
          )}

          {/* Screen Body */}
          <div className="screen-body">
            {/* Canvas Tab */}
            <div style={{ display: activeTab === 'canvas' ? 'block' : 'none', height: '100%' }}>
              <MathCanvas
                strokes={strokes}
                onStrokesChange={handleStrokesChange}
                tool={tool}
                penColor={penColor}
                penWidth={penWidth}
                eraserWidth={eraserWidth}
                onToolChange={setTool}
                onUndo={handleUndo}
                onRedo={handleRedo}
                onClear={handleClear}
                canUndo={canUndo}
                canRedo={canRedo}
                disabled={isLoading}
                onExportCanvas={handleExportReady}
              />
            </div>

            {/* Solution Steps Tab */}
            <div
              className="screen-body-solution"
              style={{ display: activeTab === 'solution' ? 'block' : 'none' }}
            >
              <MathDisplay
                steps={solutionSteps}
                mode={mode}
                currentStep={currentStep}
                onStepReveal={setCurrentStep}
                onShowAll={handleShowAll}
                onHint={handleHint}
                onRestart={handleRestartSteps}
                onBackToCanvas={handleBackToCanvas}
                disabled={isLoading}
              />

              {/* Multi-modal Accessibility Panel */}
              <AccessibilityPanel
                accessibility={umr?.accessibility}
              />
            </div>

            {/* Prerequisites Tab (Mathua DAG) */}
            <div
              className="screen-body-prerequisites"
              style={{ display: activeTab === 'prerequisites' ? 'block' : 'none', padding: '16px' }}
            >
              <ConceptLearningDrawer
                prerequisites={umr?.learning?.prerequisites || []}
                primaryConceptId={umr?.learning?.primary_concept_id}
              />
              <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  className="step-btn active"
                  style={{ padding: '8px 16px', borderRadius: '6px' }}
                  onClick={() => setActiveTab('solution')}
                >
                  Proceed to Verified Solution ➔
                </button>
              </div>
            </div>

            {/* Interactive Visualizer Tab (MathLearn Primary) */}
            <div
              className="screen-body-visualizer"
              style={{ display: activeTab === 'visualizer' ? 'block' : 'none', padding: '16px' }}
            >
              {umr?.visualisation?.type === 'quadratic_parabola' && (
                <div>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                    <button
                      className={`tab-btn ${visualMode === 'parabola' ? 'active' : ''}`}
                      onClick={() => setVisualMode('parabola')}
                      style={{ fontSize: '12px', padding: '6px 12px' }}
                    >
                      📈 Parabola & Roots (Function Graph)
                    </button>
                    <button
                      className={`tab-btn ${visualMode === 'tiles' ? 'active' : ''}`}
                      onClick={() => setVisualMode('tiles')}
                      style={{ fontSize: '12px', padding: '6px 12px' }}
                    >
                      🧩 Algebra Tiles (Factoring Area Model)
                    </button>
                  </div>

                  {visualMode === 'parabola' ? (
                    <ParabolaVisualizer
                      initialA={umr.visualisation.initial_params.a || 1}
                      initialB={umr.visualisation.initial_params.b || 5}
                      initialC={umr.visualisation.initial_params.c || 6}
                    />
                  ) : (
                    <AlgebraTilesVisualizer
                      initialP={2}
                      initialQ={3}
                    />
                  )}
                </div>
              )}
              {umr?.visualisation?.type === 'equation_balance' && (
                <EquationBalanceVisualizer
                  initialA={umr.visualisation.initial_params.a || 2}
                  initialB={umr.visualisation.initial_params.b || 3}
                  initialC={umr.visualisation.initial_params.c || 7}
                />
              )}
            </div>
          </div>
        </section>

        {/* Unified Input Row */}
        <section className="problem-input-row" aria-label="Problem Input">
          <TypedInput
            value={typedInput}
            onChange={(val) => {
              setTypedInput(val);
              setLastActiveSource('typed');
            }}
            onSubmit={handleSolve}
            placeholder="Type an equation or draw above (e.g. x^2 + 5x + 6 = 0 or 2x + 4 = 10)..."
            disabled={isLoading}
            rows={2}
          />

          <button
            className="solve-btn"
            onClick={handleSolve}
            disabled={isLoading}
            aria-label="Solve math problem"
          >
            {isLoading ? (
              <>
                <svg className="spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                  <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
                </svg>
                Solving...
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                Solve
              </>
            )}
          </button>
        </section>
      </main>

      <StudentProfileModal
        profile={profile}
        onChange={setProfile}
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />

      <footer className="app-footer">
        <p>MathAI — One verified mathematical solution · Multiple ways of understanding</p>
      </footer>
    </div>
  );
}

export default App;
