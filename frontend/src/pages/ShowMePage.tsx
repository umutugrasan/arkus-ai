import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Pen, Square, Circle, ArrowUpRight, Type, Eraser,
  MapPin, Maximize2, MousePointer2, Highlighter,
  ZoomIn, ZoomOut, Maximize, Undo2, Redo2, Trash2,
  Upload, Download, Plus, X, ChevronLeft, ChevronRight,
  Send, Image as ImageIcon, MessageSquare, Eye,
} from 'lucide-react';

// ─── Types ───
type DrawTool = 'pen' | 'rect' | 'circle' | 'arrow' | 'text' | 'eraser';
type AnnTool = 'pin' | 'area' | 'ann-arrow' | 'highlight';
type ActiveTool = { mode: 'draw'; tool: DrawTool } | { mode: 'annotate'; tool: AnnTool };

interface Annotation {
  id: number;
  type: AnnTool;
  x: number;
  y: number;
  x2?: number;
  y2?: number;
  w?: number;
  h?: number;
  feedback: string;
  pageIdx: number;
}

interface PageData {
  name: string;
  imageData: ImageData | null;
  annotations: Annotation[];
  undoStack: ImageData[];
  redoStack: ImageData[];
}

const DRAW_TOOLS: { id: DrawTool; icon: React.ReactNode; label: string; shortcut: string }[] = [
  { id: 'pen', icon: <Pen size={16} />, label: 'Kalem', shortcut: 'P' },
  { id: 'rect', icon: <Square size={16} />, label: 'Dikdortgen', shortcut: 'R' },
  { id: 'circle', icon: <Circle size={16} />, label: 'Daire', shortcut: 'C' },
  { id: 'arrow', icon: <ArrowUpRight size={16} />, label: 'Ok', shortcut: 'A' },
  { id: 'text', icon: <Type size={16} />, label: 'Metin', shortcut: 'T' },
  { id: 'eraser', icon: <Eraser size={16} />, label: 'Silgi', shortcut: 'E' },
];

const ANN_TOOLS: { id: AnnTool; icon: React.ReactNode; label: string }[] = [
  { id: 'pin', icon: <MapPin size={14} />, label: 'Pin' },
  { id: 'area', icon: <Maximize2 size={14} />, label: 'Alan' },
  { id: 'ann-arrow', icon: <MousePointer2 size={14} />, label: 'Ok' },
  { id: 'highlight', icon: <Highlighter size={14} />, label: 'Vurgu' },
];

const CANVAS_W = 1200;
const CANVAS_H = 800;
const MAX_UNDO = 30;

export default function ShowMePage() {
  // ─── State ───
  const [activeTool, setActiveTool] = useState<ActiveTool>({ mode: 'draw', tool: 'pen' });
  const [color, setColor] = useState('#e94560');
  const [brushSize, setBrushSize] = useState(3);
  const [zoom, setZoom] = useState(1);
  const [pages, setPages] = useState<PageData[]>([{
    name: 'Sayfa 1',
    imageData: null,
    annotations: [],
    undoStack: [],
    redoStack: [],
  }]);
  const [pageIdx, setPageIdx] = useState(0);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [nextAnnId, setNextAnnId] = useState(1);
  const [selectedAnn, setSelectedAnn] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [notes, setNotes] = useState('');
  const [textModal, setTextModal] = useState<{ x: number; y: number } | null>(null);
  const [textInput, setTextInput] = useState('');
  const [feedbackModal, setFeedbackModal] = useState<Annotation | null>(null);
  const [feedbackInput, setFeedbackInput] = useState('');
  const [exportPreview, setExportPreview] = useState<string | null>(null);

  // ─── Refs ───
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const annCanvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const startPos = useRef<{ x: number; y: number } | null>(null);
  const previewImageData = useRef<ImageData | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const page = pages[pageIdx];

  // ─── Canvas helpers ───
  const getCtx = useCallback(() => canvasRef.current?.getContext('2d') ?? null, []);
  const getAnnCtx = useCallback(() => annCanvasRef.current?.getContext('2d') ?? null, []);

  const saveUndo = useCallback(() => {
    const ctx = getCtx();
    if (!ctx) return;
    const img = ctx.getImageData(0, 0, CANVAS_W, CANVAS_H);
    setPages(prev => {
      const copy = [...prev];
      const p = { ...copy[pageIdx] };
      p.undoStack = [...p.undoStack.slice(-(MAX_UNDO - 1)), img];
      p.redoStack = [];
      copy[pageIdx] = p;
      return copy;
    });
  }, [getCtx, pageIdx]);

  const undo = useCallback(() => {
    const ctx = getCtx();
    if (!ctx) return;
    setPages(prev => {
      const copy = [...prev];
      const p = { ...copy[pageIdx] };
      if (p.undoStack.length === 0) return prev;
      const current = ctx.getImageData(0, 0, CANVAS_W, CANVAS_H);
      p.redoStack = [...p.redoStack, current];
      const restored = p.undoStack[p.undoStack.length - 1];
      p.undoStack = p.undoStack.slice(0, -1);
      ctx.putImageData(restored, 0, 0);
      p.imageData = ctx.getImageData(0, 0, CANVAS_W, CANVAS_H);
      copy[pageIdx] = p;
      return copy;
    });
  }, [getCtx, pageIdx]);

  const redo = useCallback(() => {
    const ctx = getCtx();
    if (!ctx) return;
    setPages(prev => {
      const copy = [...prev];
      const p = { ...copy[pageIdx] };
      if (p.redoStack.length === 0) return prev;
      const current = ctx.getImageData(0, 0, CANVAS_W, CANVAS_H);
      p.undoStack = [...p.undoStack, current];
      const restored = p.redoStack[p.redoStack.length - 1];
      p.redoStack = p.redoStack.slice(0, -1);
      ctx.putImageData(restored, 0, 0);
      p.imageData = ctx.getImageData(0, 0, CANVAS_W, CANVAS_H);
      copy[pageIdx] = p;
      return copy;
    });
  }, [getCtx, pageIdx]);

  const clearCanvas = useCallback(() => {
    const ctx = getCtx();
    if (!ctx) return;
    saveUndo();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    setPages(prev => {
      const copy = [...prev];
      copy[pageIdx] = { ...copy[pageIdx], imageData: ctx.getImageData(0, 0, CANVAS_W, CANVAS_H) };
      return copy;
    });
  }, [getCtx, saveUndo, pageIdx]);

  // ─── Render annotations overlay ───
  const renderAnnotations = useCallback(() => {
    const ctx = getAnnCtx();
    if (!ctx) return;
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    const pageAnns = annotations.filter(a => a.pageIdx === pageIdx);
    pageAnns.forEach((ann, i) => {
      const isSelected = selectedAnn === ann.id;
      ctx.save();
      if (ann.type === 'pin') {
        ctx.beginPath();
        ctx.arc(ann.x, ann.y, isSelected ? 14 : 12, 0, Math.PI * 2);
        ctx.fillStyle = isSelected ? '#00d4ff' : '#ff6b35';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(i + 1), ann.x, ann.y);
      } else if (ann.type === 'area') {
        const w = (ann.x2 ?? ann.x + 80) - ann.x;
        const h = (ann.y2 ?? ann.y + 60) - ann.y;
        ctx.strokeStyle = isSelected ? '#00d4ff' : '#ff6b35';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(ann.x, ann.y, w, h);
        ctx.setLineDash([]);
        ctx.fillStyle = (isSelected ? 'rgba(0,212,255,0.08)' : 'rgba(255,107,53,0.08)');
        ctx.fillRect(ann.x, ann.y, w, h);
        // badge
        ctx.fillStyle = isSelected ? '#00d4ff' : '#ff6b35';
        ctx.beginPath();
        ctx.arc(ann.x, ann.y, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(i + 1), ann.x, ann.y);
      } else if (ann.type === 'ann-arrow') {
        const x2 = ann.x2 ?? ann.x + 60;
        const y2 = ann.y2 ?? ann.y + 60;
        ctx.strokeStyle = isSelected ? '#00d4ff' : '#ff6b35';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(ann.x, ann.y);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        // arrowhead
        const angle = Math.atan2(y2 - ann.y, x2 - ann.x);
        const headLen = 14;
        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - headLen * Math.cos(angle - 0.4), y2 - headLen * Math.sin(angle - 0.4));
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - headLen * Math.cos(angle + 0.4), y2 - headLen * Math.sin(angle + 0.4));
        ctx.stroke();
        // badge at start
        ctx.fillStyle = isSelected ? '#00d4ff' : '#ff6b35';
        ctx.beginPath();
        ctx.arc(ann.x, ann.y, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(i + 1), ann.x, ann.y);
      } else if (ann.type === 'highlight') {
        const w = (ann.x2 ?? ann.x + 120) - ann.x;
        const h = (ann.y2 ?? ann.y + 24) - ann.y;
        ctx.fillStyle = isSelected ? 'rgba(0,212,255,0.25)' : 'rgba(255,235,59,0.35)';
        ctx.fillRect(ann.x, ann.y, w, h);
        ctx.fillStyle = isSelected ? '#00d4ff' : '#ff6b35';
        ctx.beginPath();
        ctx.arc(ann.x, ann.y, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(i + 1), ann.x, ann.y);
      }
      ctx.restore();
    });
  }, [annotations, pageIdx, selectedAnn, getAnnCtx]);

  useEffect(() => { renderAnnotations(); }, [renderAnnotations]);

  // ─── Initialize canvas ───
  useEffect(() => {
    const ctx = getCtx();
    if (!ctx) return;
    if (page.imageData) {
      ctx.putImageData(page.imageData, 0, 0);
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    }
  }, [pageIdx, getCtx, page.imageData]);

  // ─── Mouse coords ───
  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>): { x: number; y: number } => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / zoom,
      y: (e.clientY - rect.top) / zoom,
    };
  };

  // ─── Drawing handlers ───
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (activeTool.mode === 'annotate') return;
    const pos = getCanvasCoords(e);
    const ctx = getCtx();
    if (!ctx) return;

    if (activeTool.tool === 'text') {
      setTextModal(pos);
      return;
    }

    saveUndo();
    isDrawing.current = true;
    lastPos.current = pos;
    startPos.current = pos;

    if (activeTool.tool === 'pen' || activeTool.tool === 'eraser') {
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    }
    if (['rect', 'circle', 'arrow'].includes(activeTool.tool)) {
      previewImageData.current = ctx.getImageData(0, 0, CANVAS_W, CANVAS_H);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current || activeTool.mode === 'annotate') return;
    const ctx = getCtx();
    if (!ctx) return;
    const pos = getCanvasCoords(e);

    if (activeTool.tool === 'pen') {
      ctx.strokeStyle = color;
      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    } else if (activeTool.tool === 'eraser') {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = brushSize * 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    } else if (previewImageData.current && startPos.current) {
      ctx.putImageData(previewImageData.current, 0, 0);
      const s = startPos.current;
      ctx.strokeStyle = color;
      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';

      if (activeTool.tool === 'rect') {
        ctx.strokeRect(s.x, s.y, pos.x - s.x, pos.y - s.y);
      } else if (activeTool.tool === 'circle') {
        const rx = Math.abs(pos.x - s.x) / 2;
        const ry = Math.abs(pos.y - s.y) / 2;
        const cx = s.x + (pos.x - s.x) / 2;
        const cy = s.y + (pos.y - s.y) / 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (activeTool.tool === 'arrow') {
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
        const angle = Math.atan2(pos.y - s.y, pos.x - s.x);
        const headLen = 16;
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        ctx.lineTo(pos.x - headLen * Math.cos(angle - 0.4), pos.y - headLen * Math.sin(angle - 0.4));
        ctx.moveTo(pos.x, pos.y);
        ctx.lineTo(pos.x - headLen * Math.cos(angle + 0.4), pos.y - headLen * Math.sin(angle + 0.4));
        ctx.stroke();
      }
    }
    lastPos.current = pos;
  };

  const handleMouseUp = () => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    previewImageData.current = null;
    const ctx = getCtx();
    if (ctx) {
      setPages(prev => {
        const copy = [...prev];
        copy[pageIdx] = { ...copy[pageIdx], imageData: ctx.getImageData(0, 0, CANVAS_W, CANVAS_H) };
        return copy;
      });
    }
  };

  // ─── Annotation canvas handlers ───
  const annStartPos = useRef<{ x: number; y: number } | null>(null);
  const annDragging = useRef(false);

  const handleAnnMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (activeTool.mode !== 'annotate') return;
    const pos = getCanvasCoords(e);
    annStartPos.current = pos;
    annDragging.current = true;
    if (activeTool.tool === 'pin') {
      const ann: Annotation = {
        id: nextAnnId,
        type: 'pin',
        x: pos.x,
        y: pos.y,
        feedback: '',
        pageIdx,
      };
      setNextAnnId(n => n + 1);
      setAnnotations(prev => [...prev, ann]);
      setFeedbackModal(ann);
      setFeedbackInput('');
      annDragging.current = false;
    }
  };

  const handleAnnMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!annDragging.current || activeTool.mode !== 'annotate') return;
    annDragging.current = false;
    const pos = getCanvasCoords(e);
    const start = annStartPos.current;
    if (!start) return;
    const tool = activeTool.tool;

    if (tool === 'area' || tool === 'highlight') {
      const ann: Annotation = {
        id: nextAnnId,
        type: tool,
        x: Math.min(start.x, pos.x),
        y: Math.min(start.y, pos.y),
        x2: Math.max(start.x, pos.x),
        y2: Math.max(start.y, pos.y),
        feedback: '',
        pageIdx,
      };
      setNextAnnId(n => n + 1);
      setAnnotations(prev => [...prev, ann]);
      setFeedbackModal(ann);
      setFeedbackInput('');
    } else if (tool === 'ann-arrow') {
      const ann: Annotation = {
        id: nextAnnId,
        type: 'ann-arrow',
        x: start.x,
        y: start.y,
        x2: pos.x,
        y2: pos.y,
        feedback: '',
        pageIdx,
      };
      setNextAnnId(n => n + 1);
      setAnnotations(prev => [...prev, ann]);
      setFeedbackModal(ann);
      setFeedbackInput('');
    }
  };

  // ─── Text modal submit ───
  const handleTextSubmit = () => {
    if (!textModal || !textInput.trim()) { setTextModal(null); setTextInput(''); return; }
    const ctx = getCtx();
    if (!ctx) return;
    saveUndo();
    ctx.fillStyle = color;
    ctx.font = `${brushSize * 6}px sans-serif`;
    ctx.fillText(textInput, textModal.x, textModal.y);
    setPages(prev => {
      const copy = [...prev];
      copy[pageIdx] = { ...copy[pageIdx], imageData: ctx.getImageData(0, 0, CANVAS_W, CANVAS_H) };
      return copy;
    });
    setTextModal(null);
    setTextInput('');
  };

  // ─── Feedback modal ───
  const handleFeedbackSave = () => {
    if (!feedbackModal) return;
    setAnnotations(prev =>
      prev.map(a => a.id === feedbackModal.id ? { ...a, feedback: feedbackInput } : a),
    );
    setFeedbackModal(null);
    setFeedbackInput('');
  };

  // ─── Delete annotation ───
  const deleteAnnotation = (id: number) => {
    setAnnotations(prev => prev.filter(a => a.id !== id));
    if (selectedAnn === id) setSelectedAnn(null);
  };

  // ─── Page management ───
  const addPage = () => {
    const newPage: PageData = {
      name: `Sayfa ${pages.length + 1}`,
      imageData: null,
      annotations: [],
      undoStack: [],
      redoStack: [],
    };
    setPages(prev => [...prev, newPage]);
    setPageIdx(pages.length);
  };

  const deletePage = (idx: number) => {
    if (pages.length <= 1) return;
    setPages(prev => prev.filter((_, i) => i !== idx));
    setAnnotations(prev => prev.filter(a => a.pageIdx !== idx).map(a => ({
      ...a,
      pageIdx: a.pageIdx > idx ? a.pageIdx - 1 : a.pageIdx,
    })));
    if (pageIdx >= idx && pageIdx > 0) setPageIdx(pageIdx - 1);
  };

  // ─── Import image ───
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      const ctx = getCtx();
      if (!ctx) return;
      saveUndo();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      const scale = Math.min(CANVAS_W / img.width, CANVAS_H / img.height, 1);
      const w = img.width * scale;
      const h = img.height * scale;
      const x = (CANVAS_W - w) / 2;
      const y = (CANVAS_H - h) / 2;
      ctx.drawImage(img, x, y, w, h);
      setPages(prev => {
        const copy = [...prev];
        copy[pageIdx] = { ...copy[pageIdx], imageData: ctx.getImageData(0, 0, CANVAS_W, CANVAS_H) };
        return copy;
      });
    };
    img.src = URL.createObjectURL(file);
    e.target.value = '';
  };

  // ─── Paste image ───
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (!file) continue;
          const img = new Image();
          img.onload = () => {
            const ctx = getCtx();
            if (!ctx) return;
            saveUndo();
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
            const scale = Math.min(CANVAS_W / img.width, CANVAS_H / img.height, 1);
            const w = img.width * scale;
            const h = img.height * scale;
            const x = (CANVAS_W - w) / 2;
            const y = (CANVAS_H - h) / 2;
            ctx.drawImage(img, x, y, w, h);
            setPages(prev => {
              const copy = [...prev];
              copy[pageIdx] = { ...copy[pageIdx], imageData: ctx.getImageData(0, 0, CANVAS_W, CANVAS_H) };
              return copy;
            });
          };
          img.src = URL.createObjectURL(file);
          break;
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [getCtx, saveUndo, pageIdx]);

  // ─── Keyboard shortcuts ───
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z') { e.preventDefault(); undo(); }
        if (e.key === 'y') { e.preventDefault(); redo(); }
        return;
      }
      const map: Record<string, DrawTool> = { p: 'pen', r: 'rect', c: 'circle', a: 'arrow', t: 'text', e: 'eraser' };
      if (map[e.key]) setActiveTool({ mode: 'draw', tool: map[e.key] });
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [undo, redo]);

  // ─── Export ───
  const handleExport = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = CANVAS_W;
    tempCanvas.height = CANVAS_H;
    const tempCtx = tempCanvas.getContext('2d')!;
    tempCtx.drawImage(canvas, 0, 0);
    const annCanvas = annCanvasRef.current;
    if (annCanvas) tempCtx.drawImage(annCanvas, 0, 0);
    const url = tempCanvas.toDataURL('image/png');
    setExportPreview(url);
  };

  const downloadExport = () => {
    if (!exportPreview) return;
    const a = document.createElement('a');
    a.href = exportPreview;
    a.download = `arkus-markup-${Date.now()}.png`;
    a.click();
    setExportPreview(null);
  };

  // ─── Build summary JSON ───
  const buildSummary = () => {
    const pageAnns = annotations.filter(a => a.pageIdx === pageIdx);
    return {
      notes,
      totalPages: pages.length,
      currentPage: pageIdx + 1,
      annotations: pageAnns.map((a, i) => ({
        number: i + 1,
        type: a.type,
        position: { x: Math.round(a.x), y: Math.round(a.y) },
        ...(a.x2 != null ? { end: { x: Math.round(a.x2), y: Math.round(a.y2!) } } : {}),
        feedback: a.feedback,
      })),
    };
  };

  const handleSend = () => {
    const summary = buildSummary();
    console.log('ShowMe submission:', summary);
    handleExport();
  };

  const pageAnns = annotations.filter(a => a.pageIdx === pageIdx);

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] animate-fade-in">
      {/* ─── Toolbar ─── */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 bg-white/60 backdrop-blur border-b border-gray-200/60">
        {/* Draw Tools */}
        <div className="flex items-center gap-1">
          {DRAW_TOOLS.map(t => (
            <button
              key={t.id}
              title={`${t.label} (${t.shortcut})`}
              onClick={() => setActiveTool({ mode: 'draw', tool: t.id })}
              className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                activeTool.mode === 'draw' && activeTool.tool === t.id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
              }`}
            >
              {t.icon}
            </button>
          ))}
        </div>

        <div className="w-px h-7 bg-gray-200" />

        {/* Annotation Tools */}
        <div className="flex items-center gap-1">
          {ANN_TOOLS.map(t => (
            <button
              key={t.id}
              title={t.label}
              onClick={() => setActiveTool({ mode: 'annotate', tool: t.id })}
              className={`h-8 px-2.5 rounded-md flex items-center gap-1 text-xs font-medium border transition-all ${
                activeTool.mode === 'annotate' && activeTool.tool === t.id
                  ? 'bg-orange-500 text-white border-orange-500'
                  : 'border-orange-400/50 text-orange-500 hover:bg-orange-50'
              }`}
            >
              {t.icon}
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>

        <div className="w-px h-7 bg-gray-200" />

        {/* Color & Size */}
        <input
          type="color"
          value={color}
          onChange={e => setColor(e.target.value)}
          className="w-9 h-9 rounded-lg cursor-pointer border-0"
          title="Renk"
        />
        <input
          type="range"
          min={1}
          max={20}
          value={brushSize}
          onChange={e => setBrushSize(Number(e.target.value))}
          className="w-20"
          title="Kalem boyutu"
        />
        <span className="text-xs text-gray-400 w-6">{brushSize}px</span>

        <div className="w-px h-7 bg-gray-200" />

        {/* Actions */}
        <button onClick={undo} title="Geri Al (Ctrl+Z)" className="w-9 h-9 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100"><Undo2 size={16} /></button>
        <button onClick={redo} title="Ileri Al (Ctrl+Y)" className="w-9 h-9 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100"><Redo2 size={16} /></button>
        <button onClick={clearCanvas} title="Temizle" className="w-9 h-9 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100"><Trash2 size={16} /></button>

        <div className="w-px h-7 bg-gray-200" />

        {/* Import */}
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImport} />
        <button onClick={() => fileInputRef.current?.click()} title="Gorsel Yukle" className="h-8 px-3 rounded-lg flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors">
          <Upload size={14} /> Yukle
        </button>
        <button onClick={handleExport} title="Disa Aktar" className="h-8 px-3 rounded-lg flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors">
          <Download size={14} /> Aktar
        </button>

        <div className="w-px h-7 bg-gray-200" />

        {/* Zoom */}
        <button onClick={() => setZoom(z => Math.min(z + 0.1, 3))} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100"><ZoomIn size={14} /></button>
        <span className="text-xs text-gray-500 font-medium bg-gray-100 px-2 py-1 rounded min-w-[48px] text-center">{Math.round(zoom * 100)}%</span>
        <button onClick={() => setZoom(z => Math.max(z - 0.1, 0.3))} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100"><ZoomOut size={14} /></button>
        <button onClick={() => setZoom(1)} title="Sifirla" className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100"><Maximize size={14} /></button>
      </div>

      {/* ─── Workspace ─── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar — Pages */}
        <div className="w-40 min-w-[160px] bg-white/40 border-r border-gray-200/60 flex flex-col">
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200/60">
            <span className="text-xs font-semibold text-gray-600">Sayfalar</span>
            <button onClick={addPage} className="w-7 h-7 rounded-md bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-700 transition-colors">
              <Plus size={14} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {pages.map((p, i) => (
              <div
                key={i}
                onClick={() => setPageIdx(i)}
                className={`rounded-lg border-2 cursor-pointer transition-all overflow-hidden ${
                  i === pageIdx ? 'border-indigo-500' : 'border-transparent hover:border-gray-300'
                }`}
              >
                <div className="bg-gray-50 h-20 flex items-center justify-center text-gray-300">
                  <ImageIcon size={20} />
                </div>
                <div className="flex items-center justify-between px-2 py-1.5">
                  <span className="text-[11px] text-gray-500 truncate">{p.name}</span>
                  {pages.length > 1 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); deletePage(i); }}
                      className="w-5 h-5 rounded flex items-center justify-center text-gray-400 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                    >
                      <X size={10} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Center — Canvas */}
        <div className="flex-1 flex items-center justify-center bg-gray-100/50 overflow-auto p-4">
          <div
            className="relative inline-block"
            style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
          >
            <canvas
              ref={canvasRef}
              width={CANVAS_W}
              height={CANVAS_H}
              className="bg-white rounded-xl shadow-lg block"
              style={{ cursor: activeTool.mode === 'draw' ? 'crosshair' : 'default' }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            />
            <canvas
              ref={annCanvasRef}
              width={CANVAS_W}
              height={CANVAS_H}
              className="absolute top-0 left-0 rounded-xl"
              style={{
                pointerEvents: activeTool.mode === 'annotate' ? 'auto' : 'none',
                cursor: activeTool.mode === 'annotate' ? 'crosshair' : 'default',
              }}
              onMouseDown={handleAnnMouseDown}
              onMouseUp={handleAnnMouseUp}
            />
          </div>
        </div>

        {/* Right sidebar — Annotations */}
        <div className={`bg-white/40 border-l border-gray-200/60 flex flex-col transition-all ${sidebarOpen ? 'w-72 min-w-[288px]' : 'w-0 min-w-0 overflow-hidden'}`}>
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200/60">
            <h3 className="text-xs font-semibold text-gray-600">Geri Bildirimler</h3>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:bg-gray-100"
            >
              <ChevronRight size={14} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {pageAnns.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 px-4">
                <MessageSquare size={28} className="mb-2 opacity-40 text-orange-400" />
                <p className="text-sm mb-1">Henuz isaretleme yok</p>
                <p className="text-xs">Pin, alan, ok veya vurgu araci ile isaretleme yapin</p>
              </div>
            ) : (
              <div className="space-y-2">
                {pageAnns.map((ann, i) => (
                  <div
                    key={ann.id}
                    onClick={() => setSelectedAnn(selectedAnn === ann.id ? null : ann.id)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      selectedAnn === ann.id
                        ? 'border-cyan-400 bg-cyan-50/50 shadow-sm'
                        : 'border-gray-200/60 bg-white/60 hover:border-orange-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-bold text-orange-500">#{i + 1}</span>
                      <span className="text-[11px] text-gray-400 flex-1 capitalize">
                        {ann.type === 'ann-arrow' ? 'ok' : ann.type}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteAnnotation(ann.id); }}
                        className="w-6 h-6 rounded flex items-center justify-center border border-rose-300 text-rose-400 hover:bg-rose-500 hover:text-white transition-all opacity-60 hover:opacity-100"
                      >
                        <X size={12} />
                      </button>
                    </div>
                    <textarea
                      value={ann.feedback}
                      onChange={e => {
                        const val = e.target.value;
                        setAnnotations(prev => prev.map(a => a.id === ann.id ? { ...a, feedback: val } : a));
                      }}
                      onClick={e => e.stopPropagation()}
                      placeholder="Geri bildirim ekle..."
                      className="w-full px-2.5 py-2 border border-gray-200/60 rounded-md bg-white/80 text-xs text-gray-700 resize-none focus:outline-none focus:border-cyan-400 min-h-[52px]"
                      rows={2}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar toggle (collapsed) */}
        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="absolute right-0 top-1/2 -translate-y-1/2 bg-white border border-gray-200 rounded-l-lg px-1 py-3 text-gray-400 hover:text-gray-600 shadow-sm"
          >
            <ChevronLeft size={14} />
          </button>
        )}
      </div>

      {/* ─── Bottom bar ─── */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white/60 backdrop-blur border-t border-gray-200/60">
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Genel notlar... (urun detaylari, istenen degisiklikler vb.)"
          className="flex-1 h-11 px-3 py-2 border border-gray-200/60 rounded-xl bg-white/80 text-sm text-gray-700 resize-none focus:outline-none focus:border-indigo-400"
        />
        <button
          onClick={handleSend}
          disabled={pageAnns.length === 0 && !notes.trim()}
          className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Send size={14} />
          Gonder
        </button>
      </div>

      {/* ─── Text Modal ─── */}
      {textModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setTextModal(null)}>
          <div className="bg-white rounded-xl shadow-2xl p-4 flex gap-2" onClick={e => e.stopPropagation()}>
            <input
              autoFocus
              value={textInput}
              onChange={e => setTextInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleTextSubmit()}
              placeholder="Metin girin..."
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm w-64 focus:outline-none focus:border-indigo-400"
            />
            <button onClick={handleTextSubmit} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">
              Ekle
            </button>
          </div>
        </div>
      )}

      {/* ─── Feedback Modal ─── */}
      {feedbackModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => { handleFeedbackSave(); }}>
          <div className="bg-white rounded-xl shadow-2xl p-5 w-80" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-indigo-600">Geri Bildirim</h4>
              <button onClick={() => { handleFeedbackSave(); }} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <textarea
              autoFocus
              value={feedbackInput}
              onChange={e => setFeedbackInput(e.target.value)}
              placeholder="Bu noktayla ilgili geri bildiriminiz..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none min-h-[80px] focus:outline-none focus:border-indigo-400 mb-3"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => { setFeedbackModal(null); setFeedbackInput(''); }} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Atla</button>
              <button onClick={handleFeedbackSave} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">Kaydet</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Export Preview Modal ─── */}
      {exportPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setExportPreview(null)}>
          <div className="bg-white rounded-xl shadow-2xl p-5 max-w-2xl w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2"><Eye size={16} /> Onizleme</h4>
              <button onClick={() => setExportPreview(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <img src={exportPreview} alt="Export preview" className="w-full rounded-lg border border-gray-200 mb-4" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setExportPreview(null)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Kapat</button>
              <button onClick={downloadExport} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 flex items-center gap-2">
                <Download size={14} /> PNG Indir
              </button>
            </div>
            {/* Summary */}
            {pageAnns.length > 0 && (
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-xs font-semibold text-gray-500 mb-2">Isaretleme Ozeti ({pageAnns.length} adet)</p>
                <div className="space-y-1">
                  {pageAnns.map((a, i) => (
                    <div key={a.id} className="flex items-start gap-2 text-xs">
                      <span className="font-bold text-orange-500">#{i + 1}</span>
                      <span className="text-gray-400 capitalize">{a.type === 'ann-arrow' ? 'ok' : a.type}</span>
                      {a.feedback && <span className="text-gray-600">— {a.feedback}</span>}
                    </div>
                  ))}
                </div>
                {notes && (
                  <p className="text-xs text-gray-500 mt-2 pt-2 border-t border-gray-200">Not: {notes}</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
