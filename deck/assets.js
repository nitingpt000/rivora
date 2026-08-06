/* Rivora deck — blueprint-style diagram assets rendered SVG -> PNG via sharp */
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const React = require('react');
const ReactDOMServer = require('react-dom/server');
const fa = require('react-icons/fa');

const OUT = path.join(__dirname, 'assets');
fs.mkdirSync(OUT, { recursive: true });

// palette
const PAPER = '#F2F1EC';
const INK = '#33567F';
const DARK = '#152A47';
const MUTED = '#8A97A8';
const ACCENT = '#B5432E';

const MONO = 'Courier New';

// ---------- svg helpers ----------
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
function txt(x, y, s, { size = 22, fill = INK, weight = 'bold', anchor = 'start', spacing = 2, family = MONO } = {}) {
  return `<text x="${x}" y="${y}" font-family="${family}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" letter-spacing="${spacing}">${esc(s)}</text>`;
}
function line(x1, y1, x2, y2, { stroke = INK, w = 3, dash = null, opacity = 1 } = {}) {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${w}" ${dash ? `stroke-dasharray="${dash}"` : ''} opacity="${opacity}"/>`;
}
function pathEl(d, { stroke = INK, w = 3, dash = null, fill = 'none', opacity = 1 } = {}) {
  return `<path d="${d}" stroke="${stroke}" stroke-width="${w}" fill="${fill}" ${dash ? `stroke-dasharray="${dash}"` : ''} opacity="${opacity}"/>`;
}
function rect(x, y, w2, h2, { stroke = INK, w = 3, fill = 'none', dash = null } = {}) {
  return `<rect x="${x}" y="${y}" width="${w2}" height="${h2}" stroke="${stroke}" stroke-width="${w}" fill="${fill}" ${dash ? `stroke-dasharray="${dash}"` : ''}/>`;
}
function circ(cx, cy, r, { stroke = INK, w = 3, fill = PAPER } = {}) {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" stroke="${stroke}" stroke-width="${w}" fill="${fill}"/>`;
}
function arrowHead(x, y, dir, { stroke = INK, size = 12 } = {}) {
  // dir: 'r','l','d','u'
  const s = size;
  const pts = {
    r: `M ${x - s} ${y - s * 0.7} L ${x} ${y} L ${x - s} ${y + s * 0.7}`,
    l: `M ${x + s} ${y - s * 0.7} L ${x} ${y} L ${x + s} ${y + s * 0.7}`,
    d: `M ${x - s * 0.7} ${y - s} L ${x} ${y} L ${x + s * 0.7} ${y - s}`,
    u: `M ${x - s * 0.7} ${y + s} L ${x} ${y} L ${x + s * 0.7} ${y + s}`,
  }[dir];
  return pathEl(pts, { stroke, w: 3 });
}
function grid(W, H, color, opacity, step = 100) {
  let g = '';
  for (let x = step; x < W; x += step) g += line(x, 0, x, H, { stroke: color, w: 1, dash: '2 6', opacity });
  for (let y = step; y < H; y += step) g += line(0, y, W, y, { stroke: color, w: 1, dash: '2 6', opacity });
  return g;
}
function cornerMarks(W, H, color, m = 46, len = 60) {
  const w = 3;
  return [
    line(m, m, m + len, m, { stroke: color, w }), line(m, m, m, m + len, { stroke: color, w }),
    line(W - m, m, W - m - len, m, { stroke: color, w }), line(W - m, m, W - m, m + len, { stroke: color, w }),
    line(m, H - m, m + len, H - m, { stroke: color, w }), line(m, H - m, m, H - m - len, { stroke: color, w }),
    line(W - m, H - m, W - m - len, H - m, { stroke: color, w }), line(W - m, H - m, W - m, H - m - len, { stroke: color, w }),
    // small plus marks inset
    line(m + 24, m + 34, m + 40, m + 34, { stroke: color, w: 2 }), line(m + 32, m + 26, m + 32, m + 42, { stroke: color, w: 2 }),
    line(W - m - 40, H - m - 34, W - m - 24, H - m - 34, { stroke: color, w: 2 }), line(W - m - 32, H - m - 42, W - m - 32, H - m - 26, { stroke: color, w: 2 }),
  ].join('');
}
function svgDoc(W, H, body, bg = null) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${bg ? `<rect width="${W}" height="${H}" fill="${bg}"/>` : ''}${body}</svg>`;
}
async function render(name, svg) {
  await sharp(Buffer.from(svg)).png().toFile(path.join(OUT, name));
  console.log('wrote', name);
}

// ---------- backgrounds ----------
async function backgrounds() {
  const W = 2666, H = 1500;
  // dark title background
  await render('bg-dark.png', svgDoc(W, H, grid(W, H, PAPER, 0.07, 133) + cornerMarks(W, H, '#8FA6C4'), '#14263F'));
  // paper content background
  await render('bg-paper.png', svgDoc(W, H, grid(W, H, INK, 0.06, 133) + cornerMarks(W, H, '#A9B6C6'), PAPER));
}

// ---------- title-slide router schematic (paper ink on transparent, for dark bg) ----------
async function heroRouter() {
  const W = 1560, H = 1050;
  const ink = '#AFC4DE', bright = '#E8EDF4';
  let b = '';
  const bx = 430, by = 430, bw = 260, bh = 190;
  // input
  b += txt(40, 480, 'PAYMENT', { size: 30, fill: ink });
  b += txt(40, 522, 'STREAM', { size: 30, fill: ink });
  b += line(40, 552, 210, 552, { stroke: ink, w: 3 });
  b += line(40, 585, 330, 585, { stroke: ink, w: 3.5 });
  b += circ(345, 585, 12, { stroke: ink, fill: 'none' });
  b += line(357, 585, bx, 585, { stroke: ink, w: 3.5 });
  // router box
  b += rect(bx, by, bw, bh, { stroke: bright, w: 4 });
  b += txt(bx + bw / 2, by + 82, 'REVENUE', { size: 32, fill: bright, anchor: 'middle', spacing: 5 });
  b += txt(bx + bw / 2, by + 126, 'ROUTER', { size: 32, fill: bright, anchor: 'middle', spacing: 5 });
  // three outputs with elbow curves
  const outs = [
    { y: 200, num: '01', l1: 'REPAYMENT', l2: '20%' },
    { y: 545, num: '02', l1: 'RESERVE', l2: '2%' },
    { y: 880, num: '03', l1: 'OPERATING', l2: '78%' },
  ];
  const sx = bx + bw;
  outs.forEach((o, i) => {
    const startY = by + 40 + i * 55;
    const midX = sx + 120;
    if (Math.abs(o.y - startY) < 50) {
      b += line(sx, o.y, sx + 380, o.y, { stroke: ink, w: 3.5 });
    } else {
      b += pathEl(`M ${sx} ${startY} L ${midX - 60} ${startY} Q ${midX} ${startY} ${midX} ${startY + Math.sign(o.y - startY) * 40} L ${midX} ${o.y - Math.sign(o.y - startY) * 40} Q ${midX} ${o.y} ${midX + 60} ${o.y} L ${sx + 380} ${o.y}`, { stroke: ink, w: 3.5 });
    }
    b += circ(sx + 395, o.y, 12, { stroke: ink, fill: 'none' });
    b += txt(sx + 430, o.y - 26, o.num, { size: 28, fill: ink });
    b += txt(sx + 430, o.y + 12, o.l1, { size: 30, fill: bright });
    b += txt(sx + 430, o.y + 52, o.l2, { size: 34, fill: ink });
    b += line(sx + 430, o.y + 74, sx + 500, o.y + 74, { stroke: ink, w: 3 });
  });
  await render('hero-router.png', svgDoc(W, H, b));
}

// ---------- closed loop diagram ----------
async function loopDiagram() {
  const W = 1850, H = 1300, cy = 650;
  const cx = W / 2, R = 430;
  const steps = [
    ['MACHINE SELLS', 'A SERVICE'],
    ['CUSTOMER PAYS', 'VIA x402'],
    ['REVENUE BECOMES', 'VERIFIABLE'],
    ['RIVORA SCORES', 'THE BORROWER'],
    ['VAULT EXTENDS', 'USDC CREDIT'],
    ['AGENT SPENDS', 'WITHIN POLICY'],
    ['REVENUE AUTO-', 'REPAYS THE LOAN'],
    ['REPAYMENT LIFTS', 'THE LIMIT'],
  ];
  let b = '';
  // circle path with gaps at nodes: draw full faint circle then nodes on top
  b += `<circle cx="${cx}" cy="${cy}" r="${R}" stroke="${INK}" stroke-width="3" fill="none" stroke-dasharray="4 8" opacity="0.6"/>`;
  const n = steps.length;
  steps.forEach((s, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    const x = cx + R * Math.cos(a), y = cy + R * Math.sin(a);
    b += circ(x, y, 58, { stroke: INK, w: 4, fill: PAPER });
    b += txt(x, y + 12, String(i + 1).padStart(2, '0'), { size: 34, fill: INK, anchor: 'middle' });
    // label placement outside circle
    const lx = cx + (R + 118) * Math.cos(a), ly = cy + (R + 118) * Math.sin(a);
    const anchor = Math.abs(Math.cos(a)) < 0.35 ? 'middle' : (Math.cos(a) > 0 ? 'start' : 'end');
    const off = anchor === 'start' ? -40 : anchor === 'end' ? 40 : 0;
    b += txt(lx + off, ly - 6, s[0], { size: 25, fill: DARK, anchor });
    b += txt(lx + off, ly + 26, s[1], { size: 25, fill: DARK, anchor });
    // arrow between nodes
    const a2 = a + Math.PI / n;
    const ax = cx + R * Math.cos(a2), ay = cy + R * Math.sin(a2);
    const tangent = a2 + Math.PI / 2;
    b += pathEl(`M ${ax - 14 * Math.cos(tangent + 0.5)} ${ay - 14 * Math.sin(tangent + 0.5)} L ${ax} ${ay} L ${ax - 14 * Math.cos(tangent - 0.5)} ${ay - 14 * Math.sin(tangent - 0.5)}`, { stroke: INK, w: 3.5 });
  });
  b += txt(cx, cy - 30, 'THE', { size: 30, fill: MUTED, anchor: 'middle', spacing: 6 });
  b += txt(cx, cy + 14, 'CLOSED', { size: 44, fill: DARK, anchor: 'middle', spacing: 6 });
  b += txt(cx, cy + 66, 'LOOP', { size: 44, fill: DARK, anchor: 'middle', spacing: 6 });
  await render('loop.png', svgDoc(W, H, b));
}

// ---------- big revenue router waterfall ----------
async function routerBig() {
  const W = 1900, H = 950;
  let b = '';
  const midY = 470;
  // input
  b += txt(30, midY - 96, 'x402 + NANOPAYMENT', { size: 26, fill: MUTED });
  b += txt(30, midY - 62, 'SETTLED REVENUE', { size: 26, fill: MUTED });
  b += txt(30, midY + 6, '100.00 USDC', { size: 40, fill: DARK });
  b += line(30, midY + 34, 330, midY + 34, { stroke: INK, w: 3 });
  b += line(30, midY + 70, 360, midY + 70, { stroke: INK, w: 4 });
  b += circ(376, midY + 70, 13, { stroke: INK, fill: 'none' });
  b += line(390, midY + 70, 470, midY + 70, { stroke: INK, w: 4 });
  b += arrowHead(470, midY + 70, 'r');
  // router box
  const bx = 480, by = midY - 80, bw = 300, bh = 260;
  b += rect(bx, by, bw, bh, { stroke: DARK, w: 5 });
  b += rect(bx + 14, by + 14, bw - 28, bh - 28, { stroke: INK, w: 2, dash: '6 6' });
  b += txt(bx + bw / 2, by + 108, 'REVENUE', { size: 36, fill: DARK, anchor: 'middle', spacing: 6 });
  b += txt(bx + bw / 2, by + 156, 'ROUTER', { size: 36, fill: DARK, anchor: 'middle', spacing: 6 });
  b += txt(bx + bw / 2, by + 205, 'distributeRevenue()', { size: 22, fill: MUTED, anchor: 'middle', spacing: 0 });
  // outputs
  const sx = bx + bw;
  const outs = [
    { y: 170, pct: '20%', amt: '20.00 USDC', name: 'LOAN REPAYMENT', sub: 'interest first, then principal — to the credit vault' },
    { y: 500, pct: '2%', amt: '2.00 USDC', name: 'LOSS RESERVE', sub: 'borrower-specific buffer against missed repayment' },
    { y: 810, pct: '78%', amt: '78.00 USDC', name: 'OPERATING WALLET', sub: 'the borrower keeps the rest, immediately' },
  ];
  outs.forEach((o, i) => {
    const startY = by + 52 + i * 78;
    const midX = sx + 110;
    if (Math.abs(o.y - startY) < 50) {
      b += line(sx, o.y, sx + 330, o.y, { stroke: INK, w: 4 });
      b += arrowHead(sx + 332, o.y, 'r');
    } else {
      b += pathEl(`M ${sx} ${startY} L ${midX - 50} ${startY} Q ${midX} ${startY} ${midX} ${startY + Math.sign(o.y - startY) * 42} L ${midX} ${o.y - Math.sign(o.y - startY) * 42} Q ${midX} ${o.y} ${midX + 50} ${o.y} L ${sx + 330} ${o.y}`, { stroke: INK, w: 4 });
      b += arrowHead(sx + 332, o.y, 'r');
    }
    b += txt(sx + 365, o.y + 14, o.pct, { size: 56, fill: INK });
    b += txt(sx + 545, o.y - 16, o.name, { size: 30, fill: DARK });
    b += txt(sx + 545, o.y + 20, o.amt, { size: 26, fill: INK });
    b += txt(sx + 545, o.y + 54, o.sub, { size: 21, fill: MUTED, weight: 'normal', spacing: 0, family: 'Arial' });
    b += line(sx + 365, o.y + 40, sx + 500, o.y + 40, { stroke: INK, w: 3 });
  });
  await render('router-big.png', svgDoc(W, H, b));
}

// ---------- custody models ----------
async function custody() {
  const W = 1560, H = 1000;
  let b = '';
  const rows = [
    { y: 150, m: 'MODEL A', name: 'ROUTER IS THE SETTLEMENT DESTINATION', mid: null, kind: 'STRUCTURAL', rate: '100%', note: 'settled batches land in the router; the waterfall is atomic' },
    { y: 480, m: 'MODEL B', name: 'POLICY-CONSTRAINED AGENT WALLET', mid: 'AGENT WALLET', kind: 'POLICY-ENFORCED', rate: '50%', note: 'wallet policy pays the router first; Rivora holds a policy veto' },
    { y: 810, m: 'MODEL C', name: 'POST-SETTLEMENT SWEEP', mid: 'BORROWER ADDR', kind: 'BEHAVIOURAL', rate: '25%', note: 'borrower sweeps voluntarily; diversion is detectable, not preventable' },
  ];
  rows.forEach((r) => {
    const y = r.y;
    b += txt(30, y - 60, r.m, { size: 30, fill: INK });
    b += txt(190, y - 60, r.name, { size: 24, fill: DARK });
    b += txt(30, y + 78, r.note, { size: 22, fill: MUTED, weight: 'normal', spacing: 0, family: 'Arial' });
    // flow: SETTLEMENT --(mid?)--> ROUTER
    const fy = y + 18;
    b += rect(30, fy - 34, 250, 68, { stroke: INK, w: 3 });
    b += txt(155, fy + 9, 'SETTLEMENT', { size: 24, fill: DARK, anchor: 'middle' });
    let x = 280;
    const dash = r.m === 'MODEL C' ? '10 10' : null;
    if (r.mid) {
      b += line(x, fy, x + 90, fy, { stroke: INK, w: 3.5, dash });
      b += arrowHead(x + 90, fy, 'r');
      b += rect(x + 100, fy - 34, 300, 68, { stroke: INK, w: 3, dash: r.m === 'MODEL C' ? '8 8' : null });
      b += txt(x + 250, fy + 9, r.mid, { size: 24, fill: DARK, anchor: 'middle' });
      x = x + 400;
    }
    b += line(x, fy, x + 90, fy, { stroke: INK, w: 3.5, dash });
    b += arrowHead(x + 90, fy, 'r');
    b += rect(x + 100, fy - 34, 230, 68, { stroke: DARK, w: 4 });
    b += txt(x + 215, fy + 9, 'ROUTER', { size: 24, fill: DARK, anchor: 'middle' });
    // enforceability + advance rate on right
    b += txt(1130, y - 60, r.kind, { size: 22, fill: r.m === 'MODEL A' ? INK : (r.m === 'MODEL B' ? INK : ACCENT) });
    b += txt(1130, y + 34, r.rate, { size: 84, fill: r.m === 'MODEL A' ? DARK : (r.m === 'MODEL B' ? INK : ACCENT) });
    b += txt(1130, y + 76, 'MAX ADVANCE RATE', { size: 20, fill: MUTED });
    b += line(1130, y + 92, 1330, y + 92, { stroke: INK, w: 2 });
    if (r.y !== 810) b += line(30, y + 130, W - 30, y + 130, { stroke: INK, w: 1.5, dash: '3 8', opacity: 0.5 });
  });
  await render('custody.png', svgDoc(W, H, b));
}

// ---------- credit state machine ----------
async function stateMachine() {
  const W = 1560, H = 760;
  let b = '';
  const box = (x, y, label, opts = {}) => {
    const w = opts.w || 250, h = 70;
    b += rect(x, y, w, h, { stroke: opts.stroke || INK, w: opts.bold ? 4.5 : 3, dash: opts.dash });
    b += txt(x + w / 2, y + 44, label, { size: 26, fill: opts.fill || DARK, anchor: 'middle' });
    return { x, y, w, h };
  };
  const topY = 90;
  const A = box(40, topY, 'OBSERVATION');
  const B = box(390, topY, 'ELIGIBLE');
  const C = box(740, topY, 'ACTIVE', { bold: true });
  const D = box(1210, topY, 'REPAID', { dash: '8 6' });
  const h = (f, t) => { b += line(f.x + f.w, f.y + 35, t.x - 14, t.y + 35, { w: 3.5 }); b += arrowHead(t.x - 12, t.y + 35, 'r'); };
  h(A, B); h(B, C);
  // ACTIVE <-> REPAID double arrows
  b += line(C.x + C.w, topY + 22, D.x - 14, topY + 22, { w: 3 }); b += arrowHead(D.x - 12, topY + 22, 'r');
  b += line(D.x, topY + 50, C.x + C.w + 14, topY + 50, { w: 3 }); b += arrowHead(C.x + C.w + 12, topY + 50, 'l');
  b += txt((C.x + C.w + D.x) / 2, topY - 4, 'DEBT = 0', { size: 19, fill: MUTED, anchor: 'middle' });
  // downgrade chain
  const yh = 300;
  const Wt = box(560, yh, 'WATCH');
  const R = box(880, yh, 'RESTRICTED', { stroke: ACCENT, fill: ACCENT });
  const Dl = box(1200, yh, 'DELINQUENT', { stroke: ACCENT, fill: ACCENT });
  const Df = box(880, 540, 'DEFAULTED', { stroke: ACCENT, fill: ACCENT, bold: true });
  // ACTIVE -> WATCH
  b += pathEl(`M ${C.x + 100} ${topY + 70} L ${C.x + 100} ${yh - 60} Q ${C.x + 100} ${yh - 30} ${C.x + 70} ${yh - 30} L ${Wt.x + 125} ${yh - 30} Q ${Wt.x + 125} ${yh - 30} ${Wt.x + 125} ${yh - 14}`, { w: 3.5 });
  b += arrowHead(Wt.x + 125, yh - 6, 'd');
  h(Wt, R); h(R, Dl);
  // DELINQUENT -> DEFAULTED
  b += pathEl(`M ${Dl.x + 125} ${yh + 70} L ${Dl.x + 125} ${540 + 35} L ${Df.x + Df.w + 14} ${540 + 35}`, { w: 3.5, stroke: ACCENT });
  b += arrowHead(Df.x + Df.w + 12, 540 + 35, 'l', { stroke: ACCENT });
  // annotations
  b += txt(40, yh + 44, 'coverage < 3.0, growth < -25%,', { size: 20, fill: MUTED, weight: 'normal', spacing: 0, family: 'Arial' });
  b += txt(40, yh + 72, 'or coverage-ratio leakage', { size: 20, fill: MUTED, weight: 'normal', spacing: 0, family: 'Arial' });
  b += txt(40, 560, 'recovery: reserve -> restructure ->', { size: 20, fill: MUTED, weight: 'normal', spacing: 0, family: 'Arial' });
  b += txt(40, 588, 'registry entry -> cure path', { size: 20, fill: MUTED, weight: 'normal', spacing: 0, family: 'Arial' });
  b += txt(Wt.x + 20, yh + 108, 'no new draws above WATCH-tier limits; repayment share escalates', { size: 20, fill: MUTED, weight: 'normal', spacing: 0, family: 'Arial' });
  await render('states.png', svgDoc(W, H, b));
}

// ---------- architecture ----------
async function architecture() {
  const W = 1500, H = 1030;
  let b = '';
  const layer = (y, title, sub, items, opts = {}) => {
    b += rect(60, y, 1380, 190, { stroke: opts.stroke || INK, w: opts.bold ? 4.5 : 3 });
    b += txt(90, y + 50, title, { size: 27, fill: DARK });
    b += txt(90, y + 86, sub, { size: 20, fill: MUTED, weight: 'normal', spacing: 0, family: 'Arial' });
    const n = items.length;
    items.forEach((it, i) => {
      const bw2 = 305, gap = 16;
      const x0 = 90;
      const x = x0 + i * (bw2 + gap);
      b += rect(x, y + 108, bw2, 62, { stroke: INK, w: 2.5, dash: '6 5' });
      b += txt(x + bw2 / 2, y + 134, it[0], { size: 20, fill: INK, anchor: 'middle' });
      b += txt(x + bw2 / 2, y + 160, it[1], { size: 17, fill: MUTED, anchor: 'middle', weight: 'normal', spacing: 0, family: 'Arial' });
    });
  };
  layer(40, 'WEB — NEXT.JS 15', '41 screens · 4 surfaces · wallet + SIWE session', [['BORROWER', 'dashboard - credit'], ['LP', 'vault - portfolio'], ['RISK OPS', 'watchlist - anomaly'], ['PARTNER', 'score API console']]);
  layer(330, 'API — NESTJS + PRISMA', 'the ledger of record · checks live here, not in the client', [['SNAPSHOT', 'one consistent read'], ['DRAW / REPAY', '422 on breach'], ['SETTLEMENT TICK', 'keeper, not a click'], ['@RIVORA/CORE', 'all arithmetic']]);
  layer(620, 'CONTRACTS — SOLIDITY ON ARC', 'custody and the rules that survive the server being wrong', [['CREDIT VAULT', 'ERC-4626 style pool'], ['CREDIT MANAGER', 'draws - accrual'], ['REVENUE ROUTER', 'pull-based waterfall'], ['RISK REGISTRY', 'signed assessments']], { bold: true });
  // connectors
  [[760, 230, 330], [760, 520, 620]].forEach(([x, y1, y2]) => {
    b += line(x, y1, x, y2 - 14, { w: 3.5 });
    b += arrowHead(x, y2 - 8, 'd');
  });
  b += txt(790, 265, 'HTTP - typed api-client', { size: 20, fill: MUTED, weight: 'normal', spacing: 0, family: 'Arial' });
  b += txt(790, 555, 'CHAIN_MODE=arc - viem adapter', { size: 20, fill: MUTED, weight: 'normal', spacing: 0, family: 'Arial' });
  // differential test note
  b += pathEl(`M 190 520 L 190 606`, { w: 3, dash: '8 6', stroke: ACCENT });
  b += arrowHead(190, 612, 'd', { stroke: ACCENT });
  b += txt(60, 850, 'DIFFERENTIAL TESTS PIN SOLIDITY TO @RIVORA/CORE', { size: 24, fill: ACCENT });
  b += txt(60, 888, 'the number the borrower consents to must equal the number that runs onchain -', { size: 21, fill: MUTED, weight: 'normal', spacing: 0, family: 'Arial' });
  b += txt(60, 916, 'the fuzz + differential suite caught three genuine divergences on its first run', { size: 21, fill: MUTED, weight: 'normal', spacing: 0, family: 'Arial' });
  b += txt(60, 985, '48 FOUNDRY TESTS - 54 CORE TESTS - 85 APP TESTS', { size: 22, fill: INK });
  await render('arch.png', svgDoc(W, H, b));
}

// ---------- borrower lifecycle ----------
async function lifecycle() {
  const W = 2400, H = 420;
  let b = '';
  const steps = [
    ['REGISTER', 'wallet, endpoint,', 'router binding'],
    ['OBSERVE', '30 days, 100 requests,', '10 customers'],
    ['APPROVE', 'signed assessment,', 'bounded by contract'],
    ['BORROW', 'draw checked against', 'coverage >= 3.0'],
    ['AUTO-REPAY', 'router waterfall on', 'every settlement'],
    ['ADJUST', 'reassessed every 24h', 'and on triggers'],
    ['CLOSE', 'zero debt, reserve', 'released'],
  ];
  const n = steps.length, gap = (W - 160) / (n - 1);
  b += line(80, 120, W - 80, 120, { w: 3.5 });
  steps.forEach((s, i) => {
    const x = 80 + i * gap;
    b += circ(x, 120, 46, { stroke: i === 4 ? DARK : INK, w: i === 4 ? 5 : 3.5, fill: PAPER });
    b += txt(x, 132, String(i + 1).padStart(2, '0'), { size: 30, fill: DARK, anchor: 'middle' });
    b += txt(x, 226, s[0], { size: 27, fill: DARK, anchor: 'middle' });
    b += txt(x, 262, s[1], { size: 20, fill: MUTED, anchor: 'middle', weight: 'normal', spacing: 0, family: 'Arial' });
    b += txt(x, 290, s[2], { size: 20, fill: MUTED, anchor: 'middle', weight: 'normal', spacing: 0, family: 'Arial' });
    if (i < n - 1) b += arrowHead(x + gap - 52, 120, 'r');
  });
  await render('lifecycle.png', svgDoc(W, H, b));
}

// ---------- constraint ladder ----------
async function ladder() {
  const W = 1660, H = 980;
  let b = '';
  const rows = [
    { name: 'L_QUALITY', sub: '10,000 x 0.30 x 0.8675 x 1.05', v: 2733, binding: true },
    { name: 'L_GROWTH CAP', sub: 'previous 2,100 x 1.50', v: 3150 },
    { name: 'L_HORIZON', sub: '20% routing x 60-day horizon', v: 4000 },
    { name: 'L_STRESSED', sub: 'repays in 90d at -30% revenue', v: 4200 },
    { name: 'L_EXPOSURE', sub: '5% of vault assets', v: 5000 },
  ];
  const max = 5000, x0 = 470, xw = 870;
  rows.forEach((r, i) => {
    const y = 60 + i * 150;
    const w2 = (r.v / max) * xw;
    b += txt(30, y + 52, r.name, { size: 27, fill: r.binding ? ACCENT : DARK });
    b += txt(30, y + 86, r.sub, { size: 20, fill: MUTED, weight: 'normal', spacing: 0, family: 'Arial' });
    b += rect(x0, y + 20, w2, 62, { stroke: r.binding ? ACCENT : INK, w: r.binding ? 4.5 : 3, fill: r.binding ? '#F4E3DF' : 'none', dash: r.binding ? null : null });
    // hatching for non-binding
    if (!r.binding) for (let hx = x0 + 18; hx < x0 + w2 - 6; hx += 26) b += line(hx, y + 76, hx + 14, y + 26, { w: 1.5, opacity: 0.5 });
    b += txt(x0 + w2 + 24, y + 60, r.v.toLocaleString('en-US') + ' USDC', { size: 26, fill: r.binding ? ACCENT : INK });
    if (r.binding) b += txt(x0 + w2 + 24, y + 92, 'BINDING', { size: 20, fill: ACCENT });
  });
  // min() line
  const yb = 60 + 5 * 150 + 10;
  b += line(30, yb, W - 30, yb, { w: 2.5, dash: '10 8' });
  b += txt(30, yb + 62, 'L = MIN( ALL CANDIDATES )', { size: 26, fill: DARK });
  b += txt(30, yb + 100, 'every constraint that binds is named in the borrower-facing explanation', { size: 21, fill: MUTED, weight: 'normal', spacing: 0, family: 'Arial' });
  b += txt(W - 30, yb + 75, '= 2,730 USDC', { size: 44, fill: ACCENT, anchor: 'end' });
  await render('ladder.png', svgDoc(W, H, b));
}

// ---------- icons ----------
async function icons() {
  const sets = {
    bolt: fa.FaBolt, cubes: fa.FaCubes, wallet: fa.FaWallet, robot: fa.FaRobot,
    server: fa.FaServer, plug: fa.FaPlug, coins: fa.FaCoins, shield: fa.FaShieldAlt,
    tachometer: fa.FaTachometerAlt, chartpie: fa.FaChartPie, university: fa.FaUniversity,
    balance: fa.FaBalanceScale, chartline: fa.FaChartLine, sync: fa.FaSyncAlt,
    percent: fa.FaPercent, invoice: fa.FaFileInvoiceDollar, cloud: fa.FaCloud,
    code: fa.FaCode, building: fa.FaBuilding, exclamation: fa.FaExclamationTriangle,
    search: fa.FaSearch, link: fa.FaLink, eye: fa.FaEye, ban: fa.FaBan,
    userslash: fa.FaUserSlash, network: fa.FaProjectDiagram, water: fa.FaWater,
    lock: fa.FaLock, seedling: fa.FaSeedling, rocket: fa.FaRocket, globe: fa.FaGlobe, key: fa.FaKey,
  };
  for (const [name, Icon] of Object.entries(sets)) {
    for (const [suffix, color] of [['ink', INK], ['paper', '#DCE5F0'], ['dark', DARK], ['accent', ACCENT]]) {
      const svg = ReactDOMServer.renderToStaticMarkup(React.createElement(Icon, { color, size: 256 }));
      await sharp(Buffer.from(svg)).resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(path.join(OUT, `ic-${name}-${suffix}.png`));
    }
  }
  console.log('icons done');
}

(async () => {
  await backgrounds();
  await heroRouter();
  await loopDiagram();
  await routerBig();
  await custody();
  await stateMachine();
  await architecture();
  await lifecycle();
  await ladder();
  await icons();
  console.log('ALL ASSETS DONE');
})().catch(e => { console.error(e); process.exit(1); });
