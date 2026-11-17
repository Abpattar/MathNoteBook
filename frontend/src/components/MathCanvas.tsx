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
  const [isShapeMenuOpen, setIsShapeMenuOpen] = useState(false);
  const shapeMenuRef = useRef<HTMLDivElement>(null);
  const currentStrokeRef = useRef<{ x: number; y: number; pressure?: number; timestamp: number }[]>([]);
  const strokeIdRef = useRef(0);

  useTouchAction(canvasRef, !disabled);

  const strokesRef = useRef(strokes);
  useEffect(() => {
    strokesRef.current = strokes;
  }, [strokes]);

  useEffect(() => {
    if (onExportCanvas) {
      onExportCanvas(() => {
        const canvas = canvasRef.current;
        if (!canvas) return '';
        const currentStrokes = strokesRef.current;
        if (!currentStrokes || currentStrokes.length === 0) {
          return canvas.toDataURL('image/png');
        }

        // Calculate tight bounding box across all drawn stroke points
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        for (const s of currentStrokes) {
          for (const pt of s.points) {
            if (pt.x < minX) minX = pt.x;
            if (pt.y < minY) minY = pt.y;
            if (pt.x > maxX) maxX = pt.x;
            if (pt.y > maxY) maxY = pt.y;
          }
        }

        if (!isFinite(minX) || !isFinite(minY)) {
          return canvas.toDataURL('image/png');
        }

        const scale = window.devicePixelRatio || 1;
        const padding = 28;
        const cropX = Math.max(0, (minX - padding) * scale);
        const cropY = Math.max(0, (minY - padding) * scale);
        const cropW = Math.min(canvas.width - cropX, (maxX - minX + padding * 2) * scale);
        const cropH = Math.min(canvas.height - cropY, (maxY - minY + padding * 2) * scale);

        if (cropW <= 0 || cropH <= 0) {
          return canvas.toDataURL('image/png');
        }

        // Cap dimensions to max 800px for efficient vision inference & low token usage
        const maxDim = 800;
        let destW = cropW;
        let destH = cropH;
        if (destW > maxDim || destH > maxDim) {
          const ratio = Math.min(maxDim / destW, maxDim / destH);
          destW = Math.round(destW * ratio);
          destH = Math.round(destH * ratio);
        }

        const offscreen = document.createElement('canvas');
        offscreen.width = destW;
        offscreen.height = destH;
        const offCtx = offscreen.getContext('2d');
        if (!offCtx) return canvas.toDataURL('image/png');

        offCtx.fillStyle = '#ffffff';
        offCtx.fillRect(0, 0, destW, destH);
        offCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, destW, destH);

        return offscreen.toDataURL('image/jpeg', 0.85);
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
      setContainerSize(prev => (prev.width === width && prev.height === height ? prev : { width, height }));
      redraw(width, height);
    };

    const redraw = (w?: number, h?: number) => {
      if (!ctxRef.current) return;
      const ctx = ctxRef.current;
      const width = w ?? (canvas ? canvas.width / (window.devicePixelRatio || 1) : 600);
      const height = h ?? (canvas ? canvas.height / (window.devicePixelRatio || 1) : 400);

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
  }, [strokes]);

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
    const handleClickOutside = (e: MouseEvent) => {
      if (shapeMenuRef.current && !shapeMenuRef.current.contains(e.target as Node)) {
        setIsShapeMenuOpen(false);
      }
    };
    if (isShapeMenuOpen) {
      document.addEventListener('pointerdown', handleClickOutside);
      return () => document.removeEventListener('pointerdown', handleClickOutside);
    }
  }, [isShapeMenuOpen]);

  const insertShape = useCallback((type: 'right_triangle' | 'triangle' | 'square' | 'rectangle' | 'circle') => {
    setIsShapeMenuOpen(false);
    const canvas = canvasRef.current;
    const cw = containerSize.width || (canvas ? canvas.width / (window.devicePixelRatio || 1) : 600);
    const ch = containerSize.height || (canvas ? canvas.height / (window.devicePixelRatio || 1) : 400);
    const cx = Math.round(cw / 2);
    const cy = Math.round(ch / 2);
    const now = Date.now();

    const newStrokes: Stroke[] = [];

    if (type === 'right_triangle') {
      const x0 = cx - 90, y0 = cy + 60;
      const x1 = cx + 90, y1 = cy + 60;
      const x2 = cx - 90, y2 = cy - 65;
      newStrokes.push({
        id: `stroke-shape-${now}-1`,
        points: [
          { x: x0, y: y0, timestamp: now },
          { x: x1, y: y1, timestamp: now + 5 },
          { x: x2, y: y2, timestamp: now + 10 },
          { x: x0, y: y0, timestamp: now + 15 },
        ],
        tool: 'pen',
        color: penColor,
        width: penWidth,
        timestamp: now
      });
      const sq = 18;
      newStrokes.push({
        id: `stroke-shape-${now}-2`,
        points: [
          { x: x0, y: y0 - sq, timestamp: now + 20 },
          { x: x0 + sq, y: y0 - sq, timestamp: now + 25 },
          { x: x0 + sq, y: y0, timestamp: now + 30 },
        ],
        tool: 'pen',
        color: penColor,
        width: penWidth,
        timestamp: now + 20
      });
    } else if (type === 'triangle') {
      const topX = cx, topY = cy - 70;
      const brX = cx + 85, brY = cy + 70;
      const blX = cx - 85, blY = cy + 70;
      newStrokes.push({
        id: `stroke-shape-${now}-1`,
        points: [
          { x: topX, y: topY, timestamp: now },
          { x: brX, y: brY, timestamp: now + 5 },
          { x: blX, y: blY, timestamp: now + 10 },
          { x: topX, y: topY, timestamp: now + 15 },
        ],
        tool: 'pen',
        color: penColor,
        width: penWidth,
        timestamp: now
      });
    } else if (type === 'square') {
      const s = 130;
      const half = s / 2;
      newStrokes.push({
        id: `stroke-shape-${now}-1`,
        points: [
          { x: cx - half, y: cy - half, timestamp: now },
          { x: cx + half, y: cy - half, timestamp: now + 5 },
          { x: cx + half, y: cy + half, timestamp: now + 10 },
          { x: cx - half, y: cy + half, timestamp: now + 15 },
          { x: cx - half, y: cy - half, timestamp: now + 20 },
        ],
        tool: 'pen',
        color: penColor,
        width: penWidth,
        timestamp: now
      });
    } else if (type === 'rectangle') {
      const hw = 95, hh = 55;
      newStrokes.push({
        id: `stroke-shape-${now}-1`,
        points: [
          { x: cx - hw, y: cy - hh, timestamp: now },
          { x: cx + hw, y: cy - hh, timestamp: now + 5 },
          { x: cx + hw, y: cy + hh, timestamp: now + 10 },
          { x: cx - hw, y: cy + hh, timestamp: now + 15 },
          { x: cx - hw, y: cy - hh, timestamp: now + 20 },
        ],
        tool: 'pen',
        color: penColor,
        width: penWidth,
        timestamp: now
      });
    } else if (type === 'circle') {
      const r = 70;
      const count = 48;
      const pts = [];
      for (let i = 0; i <= count; i++) {
        const a = (i * 2 * Math.PI) / count;
        pts.push({
          x: Math.round(cx + r * Math.cos(a)),
          y: Math.round(cy + r * Math.sin(a)),
          timestamp: now + i * 2
        });
      }
      newStrokes.push({
        id: `stroke-shape-${now}-1`,
        points: pts,
        tool: 'pen',
        color: penColor,
        width: penWidth,
        timestamp: now
      });
    }

    onStrokesChange([...strokes, ...newStrokes]);
    onToolChange('pen');
  }, [containerSize, penColor, penWidth, strokes, onStrokesChange, onToolChange]);

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
        <div className="shape-picker-container" ref={shapeMenuRef}>
          <button
            type="button"
            className={`toolbar-btn shape-dropdown-btn ${isShapeMenuOpen ? 'active' : ''}`}
            onClick={() => setIsShapeMenuOpen(prev => !prev)}
            disabled={disabled}
            title="Insert Default Shape"
            aria-label="Insert default geometric shape"
            aria-haspopup="true"
            aria-expanded={isShapeMenuOpen}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 3 2 21 22 21" />
            </svg>
            <span className="shape-btn-text">Shapes ▾</span>
          </button>
          {isShapeMenuOpen && (
            <div className="shape-dropdown-menu" role="menu" aria-label="Available geometric shapes">
              <button
                type="button"
                className="shape-menu-item"
                role="menuitem"
                onClick={() => insertShape('right_triangle')}
              >
                <span className="shape-menu-icon">📐</span>
                <span className="shape-menu-text">Right Triangle (90°)</span>
              </button>
              <button
                type="button"
                className="shape-menu-item"
                role="menuitem"
                onClick={() => insertShape('triangle')}
              >
                <span className="shape-menu-icon">🔺</span>
                <span className="shape-menu-text">Triangle</span>
              </button>
              <button
                type="button"
                className="shape-menu-item"
                role="menuitem"
                onClick={() => insertShape('square')}
              >
                <span className="shape-menu-icon">⬛</span>
                <span className="shape-menu-text">Square</span>
              </button>
              <button
                type="button"
                className="shape-menu-item"
                role="menuitem"
                onClick={() => insertShape('rectangle')}
              >
                <span className="shape-menu-icon">▭</span>
                <span className="shape-menu-text">Rectangle</span>
              </button>
              <button
                type="button"
                className="shape-menu-item"
                role="menuitem"
                onClick={() => insertShape('circle')}
              >
                <span className="shape-menu-icon">⭕</span>
                <span className="shape-menu-text">Circle</span>
              </button>
            </div>
          )}
        </div>
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

