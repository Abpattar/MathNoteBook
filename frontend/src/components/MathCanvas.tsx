import { useRef, useCallback, useEffect, useState } from 'react';
import { useTouchAction } from '../hooks/useTouchAction';
import type { Stroke } from '../types/canvas';
import '../styles/canvas.css';

interface MathCanvasProps {
  strokes: Stroke[];
  onStrokesChange: (strokes: Stroke[]) => void;
  tool: 'pen' | 'eraser';
  penColor: string;
  penWidth: number;
  eraserWidth: number;
  onToolChange: (tool: 'pen' | 'eraser') => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  canUndo: boolean;
  canRedo: boolean;
  disabled?: boolean;
  onExportCanvas?: (exportFn: () => string) => void;
}

export function MathCanvas({
  strokes,
  onStrokesChange,
  tool,
  penColor,
  penWidth,
  eraserWidth,
  onToolChange,
  onUndo,
  onRedo,
  onClear,
  canUndo,
  canRedo,
  disabled = false,
  onExportCanvas
}: MathCanvasProps) {
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [isDrawing, setIsDrawing] = useState(false);
  const currentStrokeRef = useRef<{ x: number; y: number; pressure?: number; timestamp: number }[]>([]);
  const strokeIdRef = useRef(0);

  useTouchAction(canvasRef, !disabled);

  useEffect(() => {
    if (onExportCanvas) {
      onExportCanvas(() => {
        const canvas = canvasRef.current;
        return canvas ? canvas.toDataURL('image/png') : '';
      });
    }
  }, [onExportCanvas]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctxRef.current = ctx;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const resize = () => {
      const container = canvas.parentElement;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      const scale = window.devicePixelRatio || 1;
      canvas.width = width * scale;
      canvas.height = height * scale;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx.scale(scale, scale);
      setContainerSize({ width, height });
      redraw();
    };

    const redraw = () => {
      if (!ctxRef.current) return;
      const ctx = ctxRef.current;
      const { width, height } = containerSize;

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = '#fefefe';
      ctx.fillRect(0, 0, width, height);

      for (const stroke of strokes) {
        if (stroke.points.length < 2) continue;
        drawStroke(ctx, stroke);
      }
    };

    const drawStroke = (ctx: CanvasRenderingContext2D, stroke: Stroke) => {
      ctx.beginPath();
      ctx.strokeStyle = stroke.tool === 'eraser' ? '#fefefe' : stroke.color;
      ctx.lineWidth = stroke.width;

      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
    };

    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [strokes, containerSize]);

  const getCanvasPoint = useCallback((event: React.PointerEvent | PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0, timestamp: Date.now() };

    const rect = canvas.getBoundingClientRect();
    const scale = window.devicePixelRatio || 1;

    return {
      x: (event.clientX - rect.left) * scale,
      y: (event.clientY - rect.top) * scale,
      pressure: event.pressure,
      timestamp: Date.now()
    };
  }, []);

  const handlePointerDown = useCallback((event: React.PointerEvent) => {
    if (disabled) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    setIsDrawing(true);

    const point = getCanvasPoint(event);
    currentStrokeRef.current = [point];
    strokeIdRef.current = Date.now();
  }, [disabled, getCanvasPoint]);

  const handlePointerMove = useCallback((event: React.PointerEvent) => {
    if (!isDrawing || disabled) return;

    const point = getCanvasPoint(event);
    currentStrokeRef.current.push(point);

    const ctx = ctxRef.current;
    if (!ctx) return;

    const prevPoint = currentStrokeRef.current[currentStrokeRef.current.length - 2];
    if (!prevPoint) return;

    ctx.beginPath();
    ctx.strokeStyle = tool === 'eraser' ? '#fefefe' : penColor;
    ctx.lineWidth = tool === 'eraser' ? eraserWidth : penWidth;
    ctx.moveTo(prevPoint.x, prevPoint.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
  }, [isDrawing, disabled, tool, penColor, penWidth, eraserWidth, getCanvasPoint]);

  const handlePointerUp = useCallback((event: React.PointerEvent) => {
    if (!isDrawing || disabled) return;

    const canvas = canvasRef.current;
    if (canvas) {
      canvas.releasePointerCapture(event.pointerId);
    }

    setIsDrawing(false);

    if (currentStrokeRef.current.length >= 2) {
      const stroke: Stroke = {
        id: `stroke-${strokeIdRef.current}`,
        points: [...currentStrokeRef.current],
        tool,
        color: tool === 'eraser' ? '#fefefe' : penColor,
        width: tool === 'eraser' ? eraserWidth : penWidth,
        timestamp: Date.now()
      };
      onStrokesChange([...strokes, stroke]);
    }

    currentStrokeRef.current = [];
    redraw();
  }, [isDrawing, disabled, tool, penColor, penWidth, eraserWidth, strokes, onStrokesChange]);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;

    const { width, height } = containerSize;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#fefefe';
    ctx.fillRect(0, 0, width, height);

    for (const stroke of strokes) {
      if (stroke.points.length < 2) continue;
      ctx.beginPath();
      ctx.strokeStyle = stroke.tool === 'eraser' ? '#fefefe' : stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
    }
  }, [strokes, containerSize]);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (disabled) return;

    if ((event.ctrlKey || event.metaKey) && event.key === 'z') {
      if (event.shiftKey) {
        onRedo();
      } else {
        onUndo();
      }
    }
  }, [disabled, onUndo, onRedo]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div
      ref={canvasContainerRef}
      className="canvas-container"
      tabIndex={0}
    >
      <div className="canvas-toolbar" role="toolbar" aria-label="Drawing tools">
        <button
          className={`toolbar-btn ${tool === 'pen' ? 'active' : ''}`}
          onClick={() => onToolChange('pen')}
          aria-pressed={tool === 'pen'}
          disabled={disabled}
          title="Pen (P)"
          aria-label="Pen tool"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 19l7-7 3 3-7 7-3-3z" />
            <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
            <path d="M2 2l7.586 7.586" />
            <circle cx="11" cy="11" r="2" />
          </svg>
        </button>
        <button
          className={`toolbar-btn ${tool === 'eraser' ? 'active' : ''}`}
          onClick={() => onToolChange('eraser')}
          aria-pressed={tool === 'eraser'}
          disabled={disabled}
          title="Eraser (E)"
          aria-label="Eraser tool"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 20H7" />
            <path d="M16 3.5a2.5 2.5 0 0 1 0 5" />
            <path d="M10 2.5 4 8.5" />
            <path d="M8 16.5 4 20.5" />
            <path d="M18 7 14 11" />
            <path d="M14 11 10 15" />
            <path d="M10 15 6 19" />
          </svg>
        </button>
        <div className="toolbar-divider" role="separator" />
        <button
          className="toolbar-btn"
          onClick={onUndo}
          disabled={disabled || !canUndo}
          title="Undo (Ctrl+Z)"
          aria-label="Undo"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 7v6h6" />
            <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
          </svg>
        </button>
        <button
          className="toolbar-btn"
          onClick={onRedo}
          disabled={disabled || !canRedo}
          title="Redo (Ctrl+Shift+Z)"
          aria-label="Redo"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 7v6h-6" />
            <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7" />
          </svg>
        </button>
        <div className="toolbar-divider" role="separator" />
        <button
          className="toolbar-btn"
          onClick={onClear}
          disabled={disabled || strokes.length === 0}
          title="Clear canvas"
          aria-label="Clear canvas"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </button>
        <div className="canvas-status">
          <span className="stroke-count">{strokes.length} stroke{strokes.length !== 1 ? 's' : ''}</span>
        </div>
      </div>
      <canvas
        ref={canvasRef}
        className="math-canvas"
        aria-label="Math writing canvas"
        role="application"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />
    </div>
  );
}

