import { useState, useCallback, useEffect, useRef } from 'react';
import { MathCanvas } from './components/MathCanvas';
import { TypedInput } from './components/TypedInput';
import { ModeToggle } from './components/ModeToggle';
import { MathDisplay } from './components/MathDisplay';
import type { Stroke, SolutionStep, DisplayMode } from './types/canvas';
import './styles/globals.css';
import './styles/canvas.css';
import './styles/notebook.css';
import './styles/textbook.css';
import './App.css';

const INITIAL_STROKES: Stroke[] = [];

type ScreenTab = 'canvas' | 'solution';

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
    if (strokes.length === 0) {
      return;
    }

    if (recognizeAbortRef.current) {
      recognizeAbortRef.current.abort();
    }

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
          // Background preview recognition error is non-fatal
        }
      } finally {
        isRecognizingRef.current = false;
      }
    }, 2500);

    return () => {
      clearTimeout(timer);
      if (recognizeAbortRef.current) {
        recognizeAbortRef.current.abort();
      }
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
    setActiveTab('canvas');
  }, []);

  const handleSolve = useCallback(async () => {
    if (recognizeAbortRef.current) {
      recognizeAbortRef.current.abort();
    }

    const text = typedInput.trim();
    let candidates: any[] = [];
    let instruction: string | undefined = undefined;

    setNotice(null);
    setIsLoading(true);

    try {
      const shouldSolveCanvas = lastActiveSource === 'canvas' ? strokes.length > 0 : (!text && strokes.length > 0);

      if (shouldSolveCanvas) {
        // User drew on canvas: capture and recognize the screen drawing
        const imageB64 = exportCanvasRef.current ? exportCanvasRef.current() : '';
        if (!imageB64) {
          setNotice({ message: 'Canvas image could not be captured. Please draw again or type below.', type: 'error' });
          setIsLoading(false);
          return;
        }

        const recRes = await fetch('/api/recognize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image_b64: imageB64, strokes })
        });

        if (!recRes.ok) {
          throw new Error('Handwriting recognition failed');
        }

        const recData = await recRes.json();
        if (recData.candidates && recData.candidates.length > 0) {
          candidates = recData.candidates;
          instruction = recData.instruction;
          if (recData.recognized_text) {
            setTypedInput(recData.recognized_text);
          }
        } else if (text) {
          // Fallback to currently transcribed or typed text if vision is rate-limited or ambiguous
          try {
            const fallbackRes = await fetch('/api/recognize-typed', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text })
            });
            if (fallbackRes.ok) {
              const fallbackData = await fallbackRes.json();
              if (fallbackData.candidates && fallbackData.candidates.length > 0) {
                candidates = fallbackData.candidates;
                instruction = fallbackData.instruction;
              }
            }
          } catch {
            // Ignore fallback error
          }
        }

        if (candidates.length === 0) {
          const question = recData.clarification?.question || 'Could not read handwriting from screen. Please check your drawing or type below.';
          setNotice({ message: question, type: 'error' });
          setIsLoading(false);
          return;
        }
      } else if (text) {
        // User typed equation or word problem
        const recRes = await fetch('/api/recognize-typed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text })
        });

        if (!recRes.ok) {
          throw new Error('Recognition request failed');
        }

        const recData = await recRes.json();
        if (!recData.candidates || recData.candidates.length === 0) {
          const question = recData.clarification?.question || 'Could not recognize the equation. Please check your input.';
          setNotice({ message: question, type: 'error' });
          setIsLoading(false);
          return;
        }

        candidates = recData.candidates;
        instruction = recData.instruction;
      } else {
        setNotice({
          message: 'Please draw an equation on the canvas or type it below to solve.',
          type: 'info'
        });
        setIsLoading(false);
        return;
      }

      // Interpret into structured problem
      const intRes = await fetch('/api/interpret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidates,
          instruction
        })
      });

      if (!intRes.ok) {
        throw new Error('Interpretation request failed');
      }

      const problem = await intRes.json();
      const solveRes = await fetch('/api/solve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ problem, grade: 7 })
      });

      if (!solveRes.ok) {
        const errJson = await solveRes.json().catch(() => ({}));
        throw new Error(errJson.detail || 'Solver failed to find a verified solution');
      }

      const solveData = await solveRes.json();
      if (solveData.steps && solveData.steps.length > 0) {
        setSolutionSteps(solveData.steps);
        setCurrentStep(1); // Reveal first step
        setActiveTab('solution'); // Automatically show solution on the screen!
      } else {
        setNotice({ message: 'No solution steps generated for this problem.', type: 'error' });
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
  }, [typedInput, strokes]);

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
        const response = await fetch('/api/health');
        if (response.ok) {
          console.log('Backend connected');
        }
      } catch {
        console.log('Backend not available - running in offline mode');
      }
    };
    checkHealth();
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <div className="header-titles">
            <h1 className="app-title">AI Math Notebook</h1>
            <p className="app-subtitle">Step-by-step verified math solutions</p>
          </div>
          <ModeToggle mode={mode} onChange={setMode} />
        </div>
      </header>

      <main className="app-main">
        {/* ONE Central Screen Card */}
        <section className="single-screen-card" aria-label="Math Notebook Screen">
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
            </div>

            <div className="screen-actions">
              {activeTab === 'canvas' && (
                <button
                  className="action-btn"
                  onClick={handleClear}
                  disabled={strokes.length === 0 && solutionSteps.length === 0}
                  title="Clear canvas and reset"
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                  Clear
                </button>
              )}
              {activeTab === 'solution' && solutionSteps.length > 0 && (
                <button
                  className="action-btn"
                  onClick={handleBackToCanvas}
                  title="Switch to canvas drawing"
                >
                  ✏️ View Canvas
                </button>
              )}
            </div>
          </div>

          {/* Inline Guidance Notice if user needs help or error occurred */}
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

          {/* Screen Body: Displays either MathCanvas or MathDisplay on the same screen */}
          <div className="screen-body">
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
            </div>
          </div>
        </section>

        {/* ONE Place to Input Equations or Word Problems */}
        <section className="problem-input-row" aria-label="Problem Input">
          <TypedInput
            value={typedInput}
            onChange={(val) => {
              setTypedInput(val);
              setLastActiveSource('typed');
            }}
            onSubmit={handleSolve}
            placeholder="Type an equation or word problem (e.g., 2x + 4 = 10, or x + y = 30)..."
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

      <footer className="app-footer">
        <p>AI Math Notebook — Powered by SymPy formal verification &amp; KaTeX</p>
      </footer>
    </div>
  );
}

export default App;
