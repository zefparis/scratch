import { useEffect, useRef, useState, useCallback } from 'react';
import confetti from 'canvas-confetti';
import Header from '../components/Header';
import { api } from '../api';

type Sym = 'okapi' | 'diamond' | 'lightning' | 'star' | 'coin' | 'flame';

const BETS = [500, 1000, 2000, 5000] as const;

const SYMBOL_EMOJI: Record<Exclude<Sym, 'okapi'>, string> = {
  diamond: '💎',
  lightning: '⚡',
  star: '⭐',
  coin: '🪙',
  flame: '🔥',
};
const SYMBOL_VALUE_LABEL: Record<Sym, string> = {
  okapi: '×50',
  diamond: '×20',
  lightning: '×10',
  star: '×5',
  coin: '×3',
  flame: '×2',
};

// Geometry: 288×288 inner, 3×3 of 90×90 cells with 9px gaps.
const CANVAS = 288;
const CELL = 90;
const GAP = 9;
const PAD = (CANVAS - CELL * 3 - GAP * 2) / 2;

// Scratch settings (per spec: 25px radius, 55% reveal threshold).
const BRUSH = 25;
const REVEAL_THRESHOLD = 0.55;

const cellRect = (i: number) => {
  const col = i % 3;
  const row = Math.floor(i / 3);
  return {
    x: PAD + col * (CELL + GAP),
    y: PAD + row * (CELL + GAP),
    w: CELL,
    h: CELL,
  };
};

export default function ScratchScreen() {
  const [balance, setBalance] = useState(0);
  const [bet, setBet] = useState<number>(1000);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [grid, setGrid] = useState<Sym[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ win: number; bet: number } | null>(null);

  // Two stacked canvases: bottom = symbols, top = gold scratch overlay.
  const baseRef = useRef<HTMLCanvasElement | null>(null);
  const scratchRef = useRef<HTMLCanvasElement | null>(null);
  const okapiImg = useRef<HTMLImageElement | null>(null);

  const drawingRef = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const cellRevealedRef = useRef<boolean[]>(Array(9).fill(false));
  const cellStrokesRef = useRef<number[]>(Array(9).fill(0));
  const claimingRef = useRef(false);

  const refreshBalance = useCallback(async () => {
    try {
      const me = await api.me();
      setBalance(me.balance);
    } catch { /* ignore */ }
  }, []);
  useEffect(() => { refreshBalance(); }, [refreshBalance]);

  // Preload okapi image once.
  useEffect(() => {
    const img = new Image();
    img.onload = () => { okapiImg.current = img; };
    img.onerror = () => { okapiImg.current = null; };
    img.src = '/images/okapi/okapi-tip.png';
  }, []);

  // ----- BASE LAYER: 3×3 grid with symbols (drawn once per ticket) -----
  const drawBase = useCallback(() => {
    const canvas = baseRef.current;
    if (!canvas || !grid) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, CANVAS, CANVAS);

    // Card background (dark gold gradient + watermark)
    const bg = ctx.createLinearGradient(0, 0, CANVAS, CANVAS);
    bg.addColorStop(0, '#3a2a0a');
    bg.addColorStop(0.5, '#1a1308');
    bg.addColorStop(1, '#3a2a0a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, CANVAS, CANVAS);

    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = '#f5c542';
    ctx.font = 'bold 14px Arial';
    for (let y = 14; y < CANVAS; y += 28) {
      for (let x = -10 + ((y / 28) % 2) * 14; x < CANVAS; x += 38) {
        ctx.fillText('CG', x, y);
      }
    }
    ctx.restore();

    for (let i = 0; i < 9; i++) {
      const r = cellRect(i);
      ctx.fillStyle = '#0e0b06';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = 'rgba(245,197,66,0.5)';
      ctx.lineWidth = 1;
      ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);

      const sym = grid[i];
      const cx = r.x + r.w / 2;
      const cy = r.y + r.h / 2;

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (sym === 'okapi') {
        if (okapiImg.current) {
          ctx.drawImage(okapiImg.current, cx - 25, cy - 30, 50, 50);
        } else {
          ctx.fillStyle = '#f5c542';
          ctx.font = 'bold 32px Arial';
          ctx.fillText('🦓', cx, cy - 10);
        }
      } else {
        ctx.font = '40px Arial';
        ctx.fillText(SYMBOL_EMOJI[sym], cx, cy - 10);
      }
      ctx.fillStyle = '#f5c542';
      ctx.font = 'bold 12px Arial';
      ctx.fillText(SYMBOL_VALUE_LABEL[sym], cx, cy + 28);
    }
  }, [grid]);

  // ----- SCRATCH LAYER: opaque gold-grey surface user erases -----
  const drawScratchLayer = useCallback(() => {
    const canvas = scratchRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, CANVAS, CANVAS);

    // Gold-grey base
    const grad = ctx.createLinearGradient(0, 0, CANVAS, CANVAS);
    grad.addColorStop(0, '#8a7a55');
    grad.addColorStop(0.5, '#6b6256');
    grad.addColorStop(1, '#8a7a55');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CANVAS, CANVAS);

    // Sheen
    const sheen = ctx.createLinearGradient(0, 0, CANVAS, CANVAS);
    sheen.addColorStop(0, 'rgba(255,255,255,0.2)');
    sheen.addColorStop(0.5, 'rgba(255,255,255,0.02)');
    sheen.addColorStop(1, 'rgba(255,255,255,0.2)');
    ctx.fillStyle = sheen;
    ctx.fillRect(0, 0, CANVAS, CANVAS);

    // Hint text
    ctx.fillStyle = 'rgba(245,197,66,0.85)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 22px Arial';
    ctx.fillText('GRATTEZ', CANVAS / 2, CANVAS / 2 - 10);
    ctx.font = 'bold 12px Arial';
    ctx.fillStyle = 'rgba(245,197,66,0.65)';
    ctx.fillText('avec votre doigt', CANVAS / 2, CANVAS / 2 + 14);
  }, []);

  // (Re)init both layers when a new grid arrives.
  useEffect(() => {
    if (!grid) return;
    cellRevealedRef.current = Array(9).fill(false);
    cellStrokesRef.current = Array(9).fill(0);
    claimingRef.current = false;
    drawBase();
    drawScratchLayer();
  }, [grid, drawBase, drawScratchLayer]);

  // Sample-based scratched % for a single cell on the SCRATCH canvas.
  const measureCell = (ctx: CanvasRenderingContext2D, i: number) => {
    const r = cellRect(i);
    const data = ctx.getImageData(r.x, r.y, r.w, r.h).data;
    const step = 5;
    let cleared = 0;
    let total = 0;
    for (let py = 0; py < r.h; py += step) {
      for (let px = 0; px < r.w; px += step) {
        const idx = (py * r.w + px) * 4 + 3; // alpha
        if (data[idx] < 32) cleared++;
        total++;
      }
    }
    return cleared / total;
  };

  // Auto-claim trigger.
  const onAllRevealed = useCallback(async () => {
    if (claimingRef.current || !ticketId) return;
    if (!cellRevealedRef.current.every(Boolean)) return;
    claimingRef.current = true;

    // Fully wipe overlay for a clean reveal.
    const canvas = scratchRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d')!;
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillRect(0, 0, CANVAS, CANVAS);
      ctx.restore();
    }
    try {
      const r = await api.claim(ticketId);
      setBalance(r.new_balance);
      setResult({ win: r.win_amount_cdf, bet });
      if (r.win_amount_cdf > 0) {
        const fire = (opts: confetti.Options) =>
          confetti({ ...opts, colors: ['#f5c542', '#ffffff', '#d4a017'] });
        fire({ particleCount: 90, spread: 70, origin: { y: 0.6 } });
        setTimeout(() => fire({ particleCount: 60, spread: 100, origin: { y: 0.7 } }), 250);
      }
    } catch (e) {
      console.error(e);
      setResult({ win: 0, bet });
    }
  }, [ticketId, bet]);

  // Safety auto-reveal after 20s of inactivity.
  useEffect(() => {
    if (!ticketId) return;
    const t = setTimeout(() => {
      if (claimingRef.current) return;
      cellRevealedRef.current = Array(9).fill(true);
      onAllRevealed();
    }, 20000);
    return () => clearTimeout(t);
  }, [ticketId, onAllRevealed]);

  // Erase a stroke at (clientX, clientY) on the SCRATCH canvas.
  const scratchAt = useCallback((clientX: number, clientY: number) => {
    const canvas = scratchRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width;
    const sy = canvas.height / rect.height;
    const x = (clientX - rect.left) * sx;
    const y = (clientY - rect.top) * sy;

    const ctx = canvas.getContext('2d')!;
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineWidth = BRUSH * 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (lastPos.current) {
      ctx.beginPath();
      ctx.moveTo(lastPos.current.x, lastPos.current.y);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(x, y, BRUSH, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    lastPos.current = { x, y };

    // Check cells under the brush.
    for (let i = 0; i < 9; i++) {
      if (cellRevealedRef.current[i]) continue;
      const r = cellRect(i);
      if (x < r.x - BRUSH || x > r.x + r.w + BRUSH) continue;
      if (y < r.y - BRUSH || y > r.y + r.h + BRUSH) continue;
      cellStrokesRef.current[i]++;
      if (cellStrokesRef.current[i] % 4 !== 0) continue;
      const pct = measureCell(ctx, i);
      if (pct > REVEAL_THRESHOLD) {
        cellRevealedRef.current[i] = true;
        // Clean wipe of the cell rectangle.
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillRect(r.x, r.y, r.w, r.h);
        ctx.restore();
        onAllRevealed();
      }
    }
  }, [onAllRevealed]);

  // Native touch + mouse listeners on the scratch canvas only.
  // Touch listeners are attached with { passive: false } so we can
  // preventDefault() and stop page scroll on mobile.
  useEffect(() => {
    const canvas = scratchRef.current;
    if (!canvas) return;
    if (!grid || result) return;

    const start = (x: number, y: number) => {
      drawingRef.current = true;
      lastPos.current = null;
      scratchAt(x, y);
    };
    const move = (x: number, y: number) => {
      if (!drawingRef.current) return;
      scratchAt(x, y);
    };
    const end = () => {
      drawingRef.current = false;
      lastPos.current = null;
    };

    // Mouse
    const onMouseDown = (e: MouseEvent) => { e.preventDefault(); start(e.clientX, e.clientY); };
    const onMouseMove = (e: MouseEvent) => { if (drawingRef.current) move(e.clientX, e.clientY); };
    const onMouseUp = () => end();

    // Touch
    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      const t = e.touches[0];
      if (t) start(t.clientX, t.clientY);
    };
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const t = e.touches[0];
      if (t) move(t.clientX, t.clientY);
    };
    const onTouchEnd = (e: TouchEvent) => { e.preventDefault(); end(); };

    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: false });
    canvas.addEventListener('touchcancel', onTouchEnd, { passive: false });

    return () => {
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
      canvas.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [grid, result, scratchAt]);

  const buy = async () => {
    if (busy) return;
    setBusy(true);
    setResult(null);
    setGrid(null);
    setTicketId(null);
    try {
      const r = await api.buy(bet);
      const me = await api.me();
      setBalance(me.balance);
      setTicketId(r.ticket_id);
      setGrid(r.grid as Sym[]);
    } catch (e: any) {
      alert(e.message ?? 'Erreur');
    } finally {
      setBusy(false);
    }
  };

  const playAgain = () => {
    setResult(null);
    setGrid(null);
    setTicketId(null);
  };

  const canBuy = balance >= bet && !busy && !ticketId;

  return (
    <>
      <Header title="SCRATCH CARD" balance={balance} back />

      <div className="bet-chips" role="tablist" aria-label="Choisir mise">
        {BETS.map((b) => (
          <button
            key={b}
            className={`chip ${bet === b ? 'selected' : ''}`}
            onClick={() => !ticketId && setBet(b)}
            disabled={!!ticketId}
            aria-pressed={bet === b}
          >
            {b.toLocaleString('fr-FR')}
            <div style={{ fontSize: 10, opacity: 0.8, marginTop: 2 }}>CDF</div>
          </button>
        ))}
      </div>

      <div className="scratch-wrap">
        <div className="scratch-canvas-frame">
          {/* Bottom layer: symbols */}
          <canvas
            ref={baseRef}
            width={CANVAS}
            height={CANVAS}
            className="scratch-base"
          />
          {/* Top layer: gold scratch surface (touch target) */}
          <canvas
            ref={scratchRef}
            width={CANVAS}
            height={CANVAS}
            className="scratch-top"
            style={{ cursor: grid && !result ? 'crosshair' : 'default' }}
          />
        </div>
      </div>

      {!ticketId && (
        <button className="btn-gold" onClick={buy} disabled={!canBuy}>
          {balance < bet ? 'SOLDE INSUFFISANT' : `ACHETER — ${bet.toLocaleString('fr-FR')} CDF`}
        </button>
      )}
      {ticketId && !result && (
        <p className="muted" style={{ textAlign: 'center', marginTop: 12 }}>
          Grattez les 9 cases pour révéler votre résultat
        </p>
      )}

      {result && (
        <div className="overlay" onClick={playAgain}>
          <div className="panel" onClick={(e) => e.stopPropagation()}>
            {result.win > 0 ? (
              <>
                <div style={{ fontSize: 48, marginBottom: 8 }}>🎉</div>
                <div className="win-text">GAGNÉ {result.win.toLocaleString('fr-FR')} CDF !</div>
                <p className="muted" style={{ padding: 0, marginTop: 12 }}>
                  Mise : {result.bet.toLocaleString('fr-FR')} CDF
                </p>
              </>
            ) : (
              <>
                <div style={{ fontSize: 48, marginBottom: 8 }}>🥲</div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>Pas de chance...</div>
                <p className="muted" style={{ padding: 0, marginTop: 8 }}>
                  Retentez votre chance !
                </p>
              </>
            )}
            <button className="btn-gold" style={{ width: '100%', margin: '18px 0 0' }} onClick={playAgain}>
              REJOUER
            </button>
          </div>
        </div>
      )}
    </>
  );
}
