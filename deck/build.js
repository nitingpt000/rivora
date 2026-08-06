/* Rivora — investor/overview deck. Blueprint aesthetic, 20 slides, 16:9 wide. */
const pptxgen = require('pptxgenjs');
const path = require('path');

const A = (f) => path.join(__dirname, 'assets', f);

// palette (no # — pptxgenjs)
const PAPER = 'F2F1EC';
const INK = '33567F';
const DARK = '152A47';
const BODY = '2E3B4E';
const MUTED = '6E7B8C';
const ACCENT = 'B5432E';
const CARD = 'FAFAF8';
const CARD_ACCENT = 'F6EAE6';
const LIGHT_ON_DARK = 'CADCFC';
const PALE = 'AFC4DE';

const MONO = 'Courier New';
const SANS = 'Arial';

const W = 13.33, H = 7.5, M = 0.65;
const TOTAL = 20;

const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE';
pres.author = 'Rivora';
pres.title = 'Rivora — Credit for Machine Businesses';

let slideNo = 0;

function newSlide({ dark = false } = {}) {
  slideNo++;
  const s = pres.addSlide();
  s.background = { path: A(dark ? 'bg-dark.png' : 'bg-paper.png') };
  return s;
}

function footer(s, label, { dark = false } = {}) {
  const c = dark ? '7E93AE' : MUTED;
  s.addText(`RIVORA — ${label}`, { x: M, y: 7.08, w: 5.5, h: 0.28, margin: 0, fontFace: MONO, fontSize: 8.5, color: c, charSpacing: 2 });
  s.addText(`RR-001 · ${String(slideNo).padStart(2, '0')} / ${TOTAL}`, { x: W - M - 3, y: 7.08, w: 3, h: 0.28, margin: 0, align: 'right', fontFace: MONO, fontSize: 8.5, color: c, charSpacing: 2 });
}

function header(s, eyebrow, title, { titleW = 12.0 } = {}) {
  s.addText(eyebrow, { x: M, y: 0.42, w: 11, h: 0.3, margin: 0, fontFace: MONO, fontSize: 11, bold: true, color: INK, charSpacing: 3 });
  s.addText(title, { x: M, y: 0.72, w: titleW, h: 0.62, margin: 0, fontFace: SANS, fontSize: 27, bold: true, color: DARK });
}

function card(s, x, y, w, h, { accent = false, fill = null, lineW = 1 } = {}) {
  s.addShape(pres.ShapeType.rect, {
    x, y, w, h,
    fill: { color: fill || (accent ? CARD_ACCENT : CARD) },
    line: { color: accent ? ACCENT : INK, width: accent ? 1.5 : lineW },
  });
}

function statRow(s, x, y, w, big, label, sub, { color = INK } = {}) {
  s.addText(big, { x, y, w: 2.1, h: 0.55, margin: 0, fontFace: MONO, fontSize: 24, bold: true, color });
  s.addText(label, { x: x + 2.15, y: y + 0.02, w: w - 2.15, h: 0.28, margin: 0, fontFace: MONO, fontSize: 11.5, bold: true, color: DARK, charSpacing: 1 });
  s.addText(sub, { x: x + 2.15, y: y + 0.29, w: w - 2.15, h: 0.3, margin: 0, fontFace: SANS, fontSize: 10, color: MUTED });
}

/* ============================== 01 · TITLE ============================== */
{
  const s = newSlide({ dark: true });
  s.addText('STABLECOIN-NATIVE CREDIT FOR MACHINE BUSINESSES', {
    x: 0.85, y: 1.62, w: 6.4, h: 0.32, margin: 0, fontFace: MONO, fontSize: 12.5, bold: true, color: PALE, charSpacing: 3,
  });
  s.addText('RIVORA', {
    x: 0.78, y: 1.95, w: 6.4, h: 1.55, margin: 0, fontFace: SANS, fontSize: 86, bold: true, color: 'F5F4F0', charSpacing: 14,
  });
  s.addShape(pres.ShapeType.line, { x: 0.85, y: 3.72, w: 5.6, h: 0, line: { color: PALE, width: 2 } });
  s.addText(
    'Working-capital credit lines for AI APIs, MCP servers and autonomous agents — underwritten from verifiable onchain revenue, disbursed in USDC, and repaid automatically by a routed share of future revenue.',
    { x: 0.85, y: 3.95, w: 5.9, h: 1.15, margin: 0, fontFace: SANS, fontSize: 13.5, color: LIGHT_ON_DARK, lineSpacing: 20 }
  );
  s.addText('RIVORA  ·  REVENUE-BASED CREDIT  ·  PRD v1.1  ·  ARC TESTNET  ·  RR-001', {
    x: 0.85, y: 5.25, w: 6.2, h: 0.3, margin: 0, fontFace: MONO, fontSize: 10, color: '8FA6C4', charSpacing: 2,
  });
  s.addImage({ path: A('hero-router.png'), x: 7.05, y: 1.55, w: 5.94, h: 4.0 });
  s.addText('SCHEMA RR-01 · SINGLE INPUT, THREE OUTPUTS', {
    x: 7.5, y: 6.0, w: 5.2, h: 0.3, margin: 0, align: 'center', fontFace: MONO, fontSize: 9.5, color: '8FA6C4', charSpacing: 2,
  });
  s.addNotes('Rivora: a stablecoin-native credit protocol on Arc. It underwrites AI APIs, MCP servers and autonomous agents from their verifiable x402/nanopayment revenue and repays credit automatically through a revenue router.');
}

/* ============================== 02 · PROBLEM ============================== */
{
  const s = newSlide();
  header(s, '01 · THE PROBLEM', "Machines earn revenue. They can't borrow against it.");
  s.addText(
    'Autonomous services generate real, recurring USDC revenue — thousands of small payments — but every instrument of traditional credit assumes a human business standing behind the wallet.',
    { x: M, y: 1.5, w: 5.8, h: 0.85, margin: 0, fontFace: SANS, fontSize: 13, color: BODY, lineSpacing: 18 }
  );
  // card 1
  card(s, M, 2.55, 5.8, 1.9);
  s.addText('WHAT LENDERS UNDERWRITE', { x: M + 0.25, y: 2.75, w: 5.3, h: 0.3, margin: 0, fontFace: MONO, fontSize: 11.5, bold: true, color: INK, charSpacing: 2 });
  s.addText('Financial statements  ·  bank records  ·  tax filings  ·  personal guarantees  ·  credit bureaus  ·  physical assets', {
    x: M + 0.25, y: 3.1, w: 5.3, h: 0.7, margin: 0, fontFace: SANS, fontSize: 12, color: BODY, lineSpacing: 17,
  });
  s.addText('None of it exists for a service operated by an agent.', { x: M + 0.25, y: 3.85, w: 5.3, h: 0.35, margin: 0, fontFace: SANS, fontSize: 11.5, italic: true, color: ACCENT });
  // card 2
  card(s, M, 4.7, 5.8, 1.9);
  s.addText('WHAT A MACHINE BUSINESS HAS', { x: M + 0.25, y: 4.9, w: 5.3, h: 0.3, margin: 0, fontFace: MONO, fontSize: 11.5, bold: true, color: INK, charSpacing: 2 });
  s.addText('Per-request USDC revenue  ·  global, pseudonymous customers  ·  machine expenses — GPU, inference, data  ·  no entity, no payroll, no credit file', {
    x: M + 0.25, y: 5.25, w: 5.3, h: 0.75, margin: 0, fontFace: SANS, fontSize: 12, color: BODY, lineSpacing: 17,
  });
  s.addText('Exactly the data an underwriter needs — if anyone could read it.', { x: M + 0.25, y: 6.05, w: 5.3, h: 0.35, margin: 0, fontFace: SANS, fontSize: 11.5, italic: true, color: INK });
  // right: working-capital math
  const rx = 6.85, rw = 5.85;
  card(s, rx, 1.5, rw, 3.35, { lineW: 1.5 });
  s.addText('A DAY IN THE LIFE OF AN AI API', { x: rx + 0.3, y: 1.72, w: rw - 0.6, h: 0.3, margin: 0, fontFace: MONO, fontSize: 11.5, bold: true, color: INK, charSpacing: 2 });
  const rows = [
    ['Daily revenue', '+400 USDC', DARK],
    ['Model API costs', '-180 USDC', MUTED],
    ['Cloud and GPU', '-120 USDC', MUTED],
    ['Data + agent services', '-40 USDC', MUTED],
  ];
  rows.forEach((r, i) => {
    const y = 2.12 + i * 0.44;
    s.addText(r[0], { x: rx + 0.3, y, w: 3.2, h: 0.36, margin: 0, fontFace: SANS, fontSize: 12.5, color: r[2] });
    s.addText(r[1], { x: rx + rw - 2.3, y, w: 2.0, h: 0.36, margin: 0, align: 'right', fontFace: MONO, fontSize: 12.5, bold: true, color: r[2] });
  });
  s.addShape(pres.ShapeType.line, { x: rx + 0.3, y: 3.95, w: rw - 0.6, h: 0, line: { color: INK, width: 1 } });
  s.addText('Operating margin', { x: rx + 0.3, y: 4.08, w: 3.2, h: 0.4, margin: 0, fontFace: SANS, fontSize: 13, bold: true, color: DARK });
  s.addText('60 USDC', { x: rx + rw - 2.3, y: 4.08, w: 2.0, h: 0.4, margin: 0, align: 'right', fontFace: MONO, fontSize: 14, bold: true, color: ACCENT });
  s.addText(
    'A demand spike must be paid for before the revenue it earns settles. Without working capital the service rejects profitable requests, goes down, loses customers — and the failure cascades through every agent workflow that depends on it.',
    { x: rx, y: 5.1, w: rw, h: 1.5, margin: 0, fontFace: SANS, fontSize: 12.5, color: BODY, lineSpacing: 18 }
  );
  footer(s, 'PROBLEM');
  s.addNotes('The working-capital mismatch: revenue is continuous but not yet settled when expenses arrive. Traditional underwriting inputs simply do not exist for these borrowers.');
}

/* ============================== 03 · WHY NOW ============================== */
{
  const s = newSlide();
  header(s, '02 · WHY NOW', 'Four enablers converged — none is sufficient alone');
  const cards = [
    { ic: 'ic-bolt-ink.png', n: '01', t: 'MICRO-PAYMENTS\nSETTLE', b: 'x402 revived HTTP 402 as a payment primitive; Circle Nanopayments batches signed authorizations. A 0.004 USDC API call is finally settleable — per-request revenue now exists as observable data.' },
    { ic: 'ic-cubes-ink.png', n: '02', t: 'A USDC-NATIVE\nCHAIN', b: 'Arc: an EVM Layer-1 with USDC as the gas asset and sub-second deterministic finality. Revenue, gas, repayment and reserves in one asset — no FX or volatility exposure.' },
    { ic: 'ic-wallet-ink.png', n: '03', t: 'AGENTS CAN\nHOLD FUNDS', b: 'Circle Agent Wallets enforce spending policy inside the wallet itself. A credit line is only useful if the borrower can deploy it — lending to an agent finally has a safe execution path.' },
    { ic: 'ic-robot-ink.png', n: '04', t: 'REAL BORROWERS\nEXIST', b: 'AI APIs, MCP servers and inference providers already bill per request in stablecoins — payer, outcome, timestamp and amount, produced natively and continuously.' },
  ];
  cards.forEach((c, i) => {
    const x = M + i * 3.055, y = 1.55, w = 2.85, h = 3.6;
    card(s, x, y, w, h);
    s.addImage({ path: A(c.ic), x: x + 0.25, y: y + 0.25, w: 0.42, h: 0.42 });
    s.addText(c.n, { x: x + w - 0.85, y: y + 0.25, w: 0.6, h: 0.35, margin: 0, align: 'right', fontFace: MONO, fontSize: 14, bold: true, color: MUTED });
    s.addText(c.t, { x: x + 0.25, y: y + 0.85, w: w - 0.5, h: 0.62, margin: 0, fontFace: MONO, fontSize: 13, bold: true, color: DARK, charSpacing: 1, lineSpacing: 16 });
    s.addText(c.b, { x: x + 0.25, y: y + 1.55, w: w - 0.5, h: 1.95, margin: 0, fontFace: SANS, fontSize: 10.5, color: BODY, lineSpacing: 14 });
  });
  // equation strip
  s.addShape(pres.ShapeType.rect, { x: M, y: 5.45, w: 12.03, h: 1.28, fill: { color: DARK }, line: { color: DARK, width: 1 } });
  s.addText('OBSERVABLE REVENUE  +  STABLECOIN SETTLEMENT  +  PROGRAMMABLE SPENDING  +  A BORROWER POPULATION', {
    x: M + 0.35, y: 5.68, w: 11.3, h: 0.32, margin: 0, fontFace: MONO, fontSize: 12, bold: true, color: LIGHT_ON_DARK, charSpacing: 1,
  });
  s.addText([
    { text: '=  UNDERWRITABLE MACHINE CASH FLOW.   ', options: { fontFace: MONO, fontSize: 13, bold: true, color: 'FFFFFF', charSpacing: 1 } },
    { text: 'Any three produce a demonstration. All four make a credit market.', options: { fontFace: SANS, fontSize: 11.5, italic: true, color: PALE } },
  ], { x: M + 0.35, y: 6.05, w: 11.3, h: 0.45, margin: 0 });
  footer(s, 'WHY NOW');
  s.addNotes('The four preconditions from PRD section 2. Emphasize timing: before batched settlement, sub-cent machine revenue could not exist as data.');
}

/* ============================== 04 · WHAT RIVORA IS ============================== */
{
  const s = newSlide();
  header(s, '03 · THE PRODUCT', 'A credit protocol that closes its own loop');
  s.addText(
    'Rivora underwrites machine businesses from verifiable onchain revenue, extends a dynamic USDC credit line from a liquidity-provider vault, and repays it automatically through a protocol-controlled revenue router.',
    { x: M, y: 1.5, w: 5.6, h: 1.05, margin: 0, fontFace: SANS, fontSize: 13, color: BODY, lineSpacing: 18 }
  );
  card(s, M, 2.75, 5.6, 1.45, { accent: true });
  s.addText('A NEW ASSET CLASS — MACHINE-GENERATED RECEIVABLES', { x: M + 0.25, y: 2.95, w: 5.1, h: 0.3, margin: 0, fontFace: MONO, fontSize: 11, bold: true, color: ACCENT, charSpacing: 1 });
  s.addText('Continuously observable per-request revenue, underwritable without financial statements, bank accounts or guarantees.', {
    x: M + 0.25, y: 3.3, w: 5.1, h: 0.75, margin: 0, fontFace: SANS, fontSize: 12, color: BODY, lineSpacing: 16,
  });
  s.addText('WHAT IT COMBINES', { x: M, y: 4.5, w: 5.5, h: 0.3, margin: 0, fontFace: MONO, fontSize: 11, bold: true, color: INK, charSpacing: 2 });
  s.addText([
    { text: 'Revenue-based financing with autonomous, explainable underwriting', options: { bullet: { code: '2022' }, breakLine: true } },
    { text: 'Programmable repayment embedded in revenue collection', options: { bullet: { code: '2022' }, breakLine: true } },
    { text: 'Machine identity, reputation and a permanent default registry', options: { bullet: { code: '2022' }, breakLine: true } },
    { text: 'DeFi liquidity — vault shares, utilization pricing, reserves', options: { bullet: { code: '2022' }, breakLine: true } },
    { text: 'AI analysis, deterministically bounded: policy controls funds, not the model', options: { bullet: { code: '2022' } } },
  ], { x: M, y: 4.85, w: 5.6, h: 1.95, margin: 0, fontFace: SANS, fontSize: 12, color: BODY, paraSpaceAfter: 8 });
  s.addImage({ path: A('loop.png'), x: 6.55, y: 1.65, w: 6.4, h: 4.5 });
  s.addText('Each turn of the loop improves the terms of the next.', { x: 6.55, y: 6.3, w: 6.4, h: 0.35, margin: 0, align: 'center', fontFace: SANS, fontSize: 11.5, italic: true, color: MUTED });
  footer(s, 'PRODUCT');
  s.addNotes('The defining innovation is the complete closed loop, not any single component: verifiable revenue, explainable underwriting, programmable credit, autonomous spending, automatic repayment.');
}

/* ============================== 05 · TARGET USERS ============================== */
{
  const s = newSlide();
  header(s, '04 · WHO IT SERVES', 'Four sides of one credit market');
  const cards = [
    { ic: 'ic-server-ink.png', t: 'AI API\nPROVIDER', b: 'Text, vision, speech, embeddings, extraction. Pays model providers and GPU bills before customer revenue settles; needs to scale compute through demand spikes without rejecting profitable requests.' },
    { ic: 'ic-plug-ink.png', t: 'MCP SERVER\nOPERATOR', b: 'Paid tools for agents — search, enrichment, document processing, compliance, code execution. Buys upstream data and third-party APIs; availability is the product.' },
    { ic: 'ic-robot-ink.png', t: 'AUTONOMOUS\nAGENT', b: 'Sells services and buys inputs on its own. Needs an operating budget it can draw and repay without human intervention — inside explicit, enforceable wallet policies.' },
    { ic: 'ic-coins-ink.png', t: 'LIQUIDITY\nPROVIDER', b: 'Deposits USDC into the credit vault for yield from economically productive lending — protected by reserves, exposure limits, a liquidity buffer and a FIFO exit queue.' },
  ];
  cards.forEach((c, i) => {
    const x = M + i * 3.055, y = 1.55, w = 2.85, h = 3.9;
    card(s, x, y, w, h);
    s.addImage({ path: A(c.ic), x: x + 0.25, y: y + 0.25, w: 0.42, h: 0.42 });
    s.addText(c.t, { x: x + 0.25, y: y + 0.85, w: w - 0.5, h: 0.62, margin: 0, fontFace: MONO, fontSize: 13, bold: true, color: DARK, charSpacing: 1, lineSpacing: 16 });
    s.addText(c.b, { x: x + 0.25, y: y + 1.55, w: w - 0.5, h: 2.25, margin: 0, fontFace: SANS, fontSize: 10.5, color: BODY, lineSpacing: 14 });
  });
  card(s, M, 5.75, 12.03, 0.95);
  s.addImage({ path: A('ic-shield-ink.png'), x: M + 0.3, y: 6.0, w: 0.42, h: 0.42 });
  s.addText([
    { text: 'And the risk operator: ', options: { bold: true, color: DARK } },
    { text: 'exposure limits, watchlist, anomaly review, parameter governance — every decision bounded by protocol rules and logged with an explanation.', options: { color: BODY } },
  ], { x: M + 0.95, y: 5.98, w: 10.8, h: 0.5, margin: 0, valign: 'middle', fontFace: SANS, fontSize: 12 });
  footer(s, 'USERS');
  s.addNotes('Borrower personas from PRD section 8, plus the LP and the risk operator. Circle Agent Wallets make the autonomous-agent persona actually bankable.');
}

/* ============================== 06 · REVENUE ROUTER ============================== */
{
  const s = newSlide();
  header(s, '05 · THE MECHANISM', 'One contract splits every settled batch');
  s.addImage({ path: A('router-big.png'), x: 1.32, y: 1.55, w: 10.7, h: 5.35 });
  s.addText(
    'No outstanding debt?  2% still fills the loss reserve until target, then 100% flows to the provider.  Excess repayment returns to the borrower and marks the line repaid.',
    { x: 1.32, y: 6.62, w: 10.7, h: 0.4, margin: 0, align: 'center', fontFace: SANS, fontSize: 11.5, italic: true, color: MUTED }
  );
  footer(s, 'REVENUE ROUTER');
  s.addNotes('The waterfall from PRD section 12: 20% repayment (interest before principal), 2% loss reserve, 78% operating. Percentages are configurable by risk tier and escalate on delinquency.');
}

/* ============================== 07 · UNDERWRITING ============================== */
{
  const s = newSlide();
  header(s, '06 · UNDERWRITING', 'Revenue is evaluated, not counted');
  // left: revenue base pipeline
  s.addText('NORMALIZING THE REVENUE BASE', { x: M, y: 1.5, w: 6, h: 0.3, margin: 0, fontFace: MONO, fontSize: 11, bold: true, color: INK, charSpacing: 2 });
  const steps = [
    ['01', 'TIME-WEIGHT', 'λ = 0.97 — a 23-day half-life. Recent revenue counts more; old spikes fade.'],
    ['02', 'SPIKE CLAMP', 'min( weighted, median × 30 × 1.5 ). Three manufactured hot days cannot move the limit — steady growth can.'],
    ['03', 'SEASONING', '3 days after settlement before revenue is eligible, so refunds and reversals resolve first.'],
  ];
  steps.forEach((st, i) => {
    const y = 1.95 + i * 1.02;
    card(s, M, y, 6.0, 0.9);
    s.addText(st[0], { x: M + 0.2, y: y + 0.13, w: 0.55, h: 0.4, margin: 0, fontFace: MONO, fontSize: 16, bold: true, color: MUTED });
    s.addText(st[1], { x: M + 0.8, y: y + 0.12, w: 2.3, h: 0.3, margin: 0, fontFace: MONO, fontSize: 12, bold: true, color: DARK, charSpacing: 1 });
    s.addText(st[2], { x: M + 0.8, y: y + 0.42, w: 5.0, h: 0.45, margin: 0, fontFace: SANS, fontSize: 10.5, color: BODY, lineSpacing: 13 });
  });
  s.addShape(pres.ShapeType.rect, { x: M, y: 5.15, w: 6.0, h: 1.15, fill: { color: DARK }, line: { color: DARK, width: 1 } });
  s.addText('L_quality  =  R₃₀ × A(tier) × Q × G', { x: M + 0.3, y: 5.38, w: 5.5, h: 0.4, margin: 0, fontFace: MONO, fontSize: 16, bold: true, color: 'FFFFFF' });
  s.addText('normalized revenue × tier advance rate × quality factor × growth', { x: M + 0.3, y: 5.82, w: 5.5, h: 0.3, margin: 0, fontFace: SANS, fontSize: 10.5, color: PALE });
  // right: quality factor
  const rx = 7.0, rw = 5.68;
  s.addText('Q — WEIGHTED PENALTIES, NOT A PRODUCT', { x: rx, y: 1.5, w: rw, h: 0.3, margin: 0, fontFace: MONO, fontSize: 11, bold: true, color: INK, charSpacing: 2 });
  const factors = [
    ['Service reliability', '0.30', 'protocol probes + settlement data — never self-reported'],
    ['Customer concentration', '0.25', 'HHI with no floor; hard ceilings above 40% single-payer'],
    ['Revenue volatility', '0.15', 'coefficient of variation of daily revenue'],
    ['Revenue diversity', '0.15', 'unique and repeat eligible payers'],
    ['Operating capacity', '0.15', 'protocol cost bands; verified expenses lift the cap'],
  ];
  factors.forEach((f, i) => {
    const y = 1.95 + i * 0.62;
    card(s, rx, y, rw, 0.54);
    s.addText(f[0], { x: rx + 0.2, y: y + 0.05, w: 2.7, h: 0.28, margin: 0, fontFace: SANS, fontSize: 11.5, bold: true, color: DARK });
    s.addText('w ' + f[1], { x: rx + rw - 1.0, y: y + 0.05, w: 0.8, h: 0.28, margin: 0, align: 'right', fontFace: MONO, fontSize: 11.5, bold: true, color: INK });
    s.addText(f[2], { x: rx + 0.2, y: y + 0.29, w: rw - 0.4, h: 0.24, margin: 0, fontFace: SANS, fontSize: 9, color: MUTED });
  });
  s.addText([
    { text: 'Q = 1 − Σ wᵢ(1 − fᵢ), floored at 0.35.  ', options: { fontFace: MONO, fontSize: 11.5, bold: true, color: DARK } },
    { text: 'The earlier multiplicative form turned a stated 30% advance into an effective 11% — the additive form keeps the stated rate honest and makes every haircut attributable to a named factor.', options: { fontFace: SANS, fontSize: 11, color: BODY } },
  ], { x: rx, y: 5.15, w: rw, h: 1.5, margin: 0, lineSpacing: 15 });
  footer(s, 'UNDERWRITING');
  s.addNotes('PRD section 13: time-weighted, spike-clamped, seasoned revenue base; weighted-penalty quality factor with provenance rules — the heaviest-weighted factor cannot be self-reported.');
}

/* ============================== 08 · WORKED EXAMPLE ============================== */
{
  const s = newSlide();
  header(s, '07 · THE CONSTRAINT LADDER', 'Every limit is a min() — and the binding constraint is named');
  s.addImage({ path: A('ladder.png'), x: M, y: 1.55, w: 9.0, h: 5.31 });
  const rx = 10.0, rw = 2.7;
  card(s, rx, 1.6, rw, 2.5);
  s.addText('INPUTS', { x: rx + 0.2, y: 1.78, w: rw - 0.4, h: 0.28, margin: 0, fontFace: MONO, fontSize: 10.5, bold: true, color: INK, charSpacing: 2 });
  s.addText('R₃₀        10,000\nTIER       Strong\nCUSTODY    Model A\nROUTING    20%\nPREV LIMIT 2,100\nVAULT      100,000', {
    x: rx + 0.2, y: 2.12, w: rw - 0.4, h: 1.9, margin: 0, fontFace: MONO, fontSize: 10.5, color: BODY, lineSpacing: 16,
  });
  card(s, rx, 4.35, rw, 2.25, { accent: true });
  s.addText('RESULT', { x: rx + 0.2, y: 4.53, w: rw - 0.4, h: 0.28, margin: 0, fontFace: MONO, fontSize: 10.5, bold: true, color: ACCENT, charSpacing: 2 });
  s.addText('ADVANCE    27.3%\nPAYBACK    41 days\nSTRESSED   58 days', {
    x: rx + 0.2, y: 4.87, w: rw - 0.4, h: 1.0, margin: 0, fontFace: MONO, fontSize: 10.5, color: BODY, lineSpacing: 16,
  });
  s.addText('stressed = −30% revenue', { x: rx + 0.2, y: 5.95, w: rw - 0.4, h: 0.5, margin: 0, fontFace: SANS, fontSize: 9, italic: true, color: MUTED });
  footer(s, 'WORKED EXAMPLE');
  s.addNotes('PRD 13.11 worked example: quality binds at 2,733; approved 2,730. A borrower capped by the growth cap is told to wait, not to optimise quality — that is why the binding constraint is always named.');
}

/* ============================== 09 · SCORE & TIERS ============================== */
{
  const s = newSlide();
  header(s, '08 · RISK SCORE & TIERS', 'One pipeline: score → tier → limit');
  // left pipeline
  const chain = ['OBSERVED SIGNALS', 'RISK SCORE 0–100', 'TIER', 'ADVANCE · PREMIUM · HORIZON · CAP'];
  chain.forEach((c, i) => {
    const y = 1.55 + i * 0.78;
    card(s, M, y, 4.6, 0.58, { fill: i === 3 ? CARD_ACCENT : CARD });
    s.addText(c, { x: M + 0.2, y, w: 4.2, h: 0.58, margin: 0, valign: 'middle', fontFace: MONO, fontSize: 11.5, bold: true, color: i === 3 ? ACCENT : DARK, charSpacing: 1 });
    if (i < 3) s.addText('↓', { x: M + 2.1, y: y + 0.52, w: 0.4, h: 0.28, margin: 0, fontFace: SANS, fontSize: 13, bold: true, color: INK });
  });
  s.addText('SCORE WEIGHTS', { x: M, y: 4.85, w: 4.6, h: 0.28, margin: 0, fontFace: MONO, fontSize: 10.5, bold: true, color: INK, charSpacing: 2 });
  s.addText(
    'Reliability 20 · consistency 18 · repayment history 15 · concentration 13 · diversity 10 · custody strength 8 · operating history 6 · growth 5 · reserve 5',
    { x: M, y: 5.18, w: 4.6, h: 0.85, margin: 0, fontFace: SANS, fontSize: 10.5, color: BODY, lineSpacing: 14 }
  );
  s.addText('Custody is scored, not assumed: revenue that provably cannot be diverted is a different credit from revenue that merely has not been diverted yet.', {
    x: M, y: 6.05, w: 4.6, h: 0.85, margin: 0, fontFace: SANS, fontSize: 10.5, italic: true, color: MUTED, lineSpacing: 14,
  });
  // right table
  const th = { fontFace: MONO, fontSize: 10.5, bold: true, color: 'FFFFFF', fill: { color: DARK }, align: 'center', valign: 'middle' };
  const td = (t, o = {}) => ({ text: t, options: { fontFace: SANS, fontSize: 11, color: BODY, align: 'center', valign: 'middle', fill: { color: CARD }, ...o } });
  const rows = [
    [{ text: 'TIER', options: { ...th, align: 'left' } }, { text: 'SCORE', options: th }, { text: 'ADVANCE', options: th }, { text: 'PREMIUM', options: th }, { text: 'HORIZON', options: th }, { text: 'CAP (USDC)', options: th }],
    [td('Prime', { bold: true, align: 'left', color: DARK }), td('90–100'), td('35%'), td('1%'), td('60 d'), td('100,000')],
    [td('Strong', { bold: true, align: 'left', color: DARK }), td('75–89'), td('30%'), td('3%'), td('60 d'), td('50,000')],
    [td('Standard', { bold: true, align: 'left', color: DARK }), td('60–74'), td('20%'), td('6%'), td('45 d'), td('25,000')],
    [td('Restricted', { bold: true, align: 'left', color: ACCENT }), td('40–59'), td('—'), td('12%'), td('—'), td('no new draws', { color: ACCENT })],
    [td('Ineligible', { bold: true, align: 'left', color: MUTED }), td('0–39'), td('—'), td('—'), td('—'), td('no borrowing', { color: MUTED })],
  ];
  s.addTable(rows, {
    x: 5.65, y: 1.55, w: 7.05, colW: [1.45, 1.05, 1.1, 1.1, 1.05, 1.3],
    border: { type: 'solid', color: 'C9CFD8', pt: 0.75 }, rowH: 0.52, margin: 0.06,
  });
  s.addText(
    'The advance rate is derived, not chosen:  A_max = repayment share × horizon / 30.  The stated 30% is exactly 20% routing over 45 days — change the routing share and every advance rate must be recomputed.',
    { x: 5.65, y: 5.15, w: 7.05, h: 0.95, margin: 0, fontFace: SANS, fontSize: 11.5, color: BODY, lineSpacing: 16 }
  );
  s.addText('A borrower repays ~20% of revenue until principal + interest clear; the horizon says how long the protocol will tolerate that taking.', {
    x: 5.65, y: 6.1, w: 7.05, h: 0.65, margin: 0, fontFace: SANS, fontSize: 10.5, italic: true, color: MUTED, lineSpacing: 14,
  });
  footer(s, 'SCORE & TIERS');
  s.addNotes('PRD section 14: the score answers what kind of borrower; the quality factor answers how much of the tier capacity is earned. Neither can silently contradict the other.');
}

/* ============================== 10 · INTEREST MODEL ============================== */
{
  const s = newSlide();
  header(s, '09 · INTEREST-RATE MODEL', 'Pricing liquidity — and preventing silent debt spirals');
  const U = [0, 10, 20, 30, 40, 50, 60, 70, 80, 85, 90, 95];
  const r = U.map(u => u <= 80 ? 5 + 0.08 * u : 11.4 + 0.8 * (u - 80));
  s.addChart(pres.ChartType.line, [{ name: 'Borrow rate r(U)', labels: U.map(String), values: r.map(v => +v.toFixed(1)) }], {
    x: M, y: 1.6, w: 6.3, h: 4.5,
    chartColors: [INK], lineSize: 2.5, lineSmooth: false,
    showLegend: false, showTitle: true, title: 'Annual borrow rate vs vault utilization (%)',
    titleFontFace: SANS, titleFontSize: 12, titleColor: DARK,
    catAxisLabelColor: MUTED, catAxisLabelFontFace: MONO, catAxisLabelFontSize: 9,
    valAxisLabelColor: MUTED, valAxisLabelFontFace: MONO, valAxisLabelFontSize: 9,
    valAxisTitle: 'r (%)', showValAxisTitle: true, valAxisTitleColor: MUTED, valAxisTitleFontSize: 10,
    catAxisTitle: 'utilization U (%)', showCatAxisTitle: true, catAxisTitleColor: MUTED, catAxisTitleFontSize: 10,
    valGridLine: { color: 'D8DCE2', size: 0.5 }, catGridLine: { style: 'none' },
    lineDataSymbol: 'circle', lineDataSymbolSize: 5,
  });
  s.addText('base 5%  ·  kink at 80%  ·  slope 8% below, 80% above  ·  borrower rate = r(U) + tier premium (1–12%)', {
    x: M, y: 6.2, w: 6.3, h: 0.55, margin: 0, fontFace: MONO, fontSize: 10, color: MUTED, lineSpacing: 14,
  });
  const rx = 7.35, rw = 5.33;
  card(s, rx, 1.6, rw, 1.5);
  s.addText('INDEX-BASED ACCRUAL', { x: rx + 0.25, y: 1.78, w: rw - 0.5, h: 0.28, margin: 0, fontFace: MONO, fontSize: 11, bold: true, color: INK, charSpacing: 2 });
  s.addText('One global borrow index (ray precision, 1e27), updated per vault interaction — no per-borrower loops. Rounding is stated and tested: against the borrower on debt, against the protocol on repayment credit.', {
    x: rx + 0.25, y: 2.12, w: rw - 0.5, h: 0.9, margin: 0, fontFace: SANS, fontSize: 11, color: BODY, lineSpacing: 15,
  });
  card(s, rx, 3.3, rw, 3.3, { accent: true });
  s.addText('THE NEGATIVE-AMORTIZATION GUARD', { x: rx + 0.25, y: 3.5, w: rw - 0.5, h: 0.28, margin: 0, fontFace: MONO, fontSize: 11, bold: true, color: ACCENT, charSpacing: 1 });
  s.addText('coverage = daily repayment capacity ÷ daily interest', { x: rx + 0.25, y: 3.85, w: rw - 0.5, h: 0.3, margin: 0, fontFace: MONO, fontSize: 11.5, bold: true, color: DARK });
  s.addText([
    { text: 'Coverage ≥ 3.0 is a hard precondition on every draw, enforced in the contract. ', options: { bold: true, color: DARK } },
    { text: 'At default parameters coverage ≈ 51 — rates alone can never spiral the debt. The real failure is a revenue collapse (~98% decline drives coverage under 1), which is precisely the state a percentage-of-revenue schedule hides: a borrower earning almost nothing is still "repaying on schedule". The coverage ratio is the tripwire that tells proportional repayment apart from no repayment.', options: { color: BODY } },
  ], { x: rx + 0.25, y: 4.25, w: rw - 0.5, h: 2.2, margin: 0, fontFace: SANS, fontSize: 11, lineSpacing: 15 });
  footer(s, 'INTEREST MODEL');
  s.addNotes('PRD section 15. Coverage uses settled revenue velocity, not authorized — using authorized would overstate capacity by exactly the settlement lag.');
}

/* ============================== 11 · CUSTODY ============================== */
{
  const s = newSlide();
  header(s, '10 · REVENUE CUSTODY', 'Custody determines the advance rate');
  s.addImage({ path: A('custody.png'), x: M, y: 1.55, w: 8.0, h: 5.13 });
  const rx = 9.0, rw = 3.7;
  card(s, rx, 1.55, rw, 3.6, { accent: true });
  s.addText('A FINDING, NOT A PREFERENCE', { x: rx + 0.22, y: 1.75, w: rw - 0.44, h: 0.3, margin: 0, fontFace: MONO, fontSize: 10.5, bold: true, color: ACCENT, charSpacing: 1 });
  s.addText(
    'Circle Nanopayments settles into the seller\'s Gateway balance; withdrawal reaches Arc as a plain ERC-20 transfer — which executes no code. The router is therefore pull-based. If the borrower holds the withdrawal right, that is Model C economics: a 25% advance, not Model A\'s 100%.',
    { x: rx + 0.22, y: 2.1, w: rw - 0.44, h: 1.9, margin: 0, fontFace: SANS, fontSize: 10.5, color: BODY, lineSpacing: 15 }
  );
  s.addText('Open with Circle: can Rivora hold the withdrawal right via a developer-controlled wallet?', {
    x: rx + 0.22, y: 4.1, w: rw - 0.44, h: 0.9, margin: 0, fontFace: SANS, fontSize: 10.5, italic: true, color: ACCENT, lineSpacing: 14,
  });
  card(s, rx, 5.35, rw, 1.35);
  s.addText('MVP POSITION', { x: rx + 0.22, y: 5.52, w: rw - 0.44, h: 0.28, margin: 0, fontFace: MONO, fontSize: 10.5, bold: true, color: INK, charSpacing: 2 });
  s.addText('Model A against simulated settlement — with the endpoint probe and coverage ratio both live, not mocked.', {
    x: rx + 0.22, y: 5.85, w: rw - 0.44, h: 0.8, margin: 0, fontFace: SANS, fontSize: 10.5, color: BODY, lineSpacing: 14,
  });
  footer(s, 'CUSTODY');
  s.addNotes('PRD section 11: the single assumption the protocol depends on. Unenforced repayment must not receive unsecured credit — Model C borrowers borrow roughly their own posted reserve.');
}

/* ============================== 12 · ANTI-DIVERSION ============================== */
{
  const s = newSlide();
  header(s, '11 · ANTI-DIVERSION & ANTI-MANIPULATION', 'Controls the borrower cannot talk their way around');
  const cols = [
    {
      ic: 'ic-link-ink.png', t: 'ENDPOINT BINDING', body: [
        ['Registration', 'Nonce challenge served from the endpoint domain; binding hash recorded onchain.'],
        ['Continuous probe', 'Randomized unpaid requests parse the live 402 challenge and compare its payTo with the bound router.'],
        ['On mismatch', 'Immediate RESTRICTED — draws blocked, repayment share escalated, operator alerted.'],
      ]
    },
    {
      ic: 'ic-eye-ink.png', t: 'COVERAGE RATIO', body: [
        ['Expected', 'observed paid requests × observed mean price.'],
        ['Ratio bands', '≥ 0.95 consistent · 0.80–0.95 logged · 0.50–0.80 WATCH · < 0.50 RESTRICTED; sustained < 0.50 is a default trigger.'],
        ['Why it matters', 'The probe catches a changed payTo; the ratio catches the second, unregistered endpoint it cannot see.'],
      ]
    },
    {
      ic: 'ic-ban-ink.png', t: 'ELIGIBILITY & CEILINGS', body: [
        ['Excluded revenue', 'Related payers, refunds, failed requests, borrower-funded wallets, detected wash activity.'],
        ['Concentration gates', 'One payer > 40% caps the limit · > 60% WATCH-tier only · > 80% no draws.'],
        ['Growth checks', 'New-payer contribution caps and funding-graph analysis before a growth spike raises any limit.'],
      ]
    },
  ];
  cols.forEach((c, i) => {
    const x = M + i * 4.11, w = 3.91, y = 1.55, h = 5.15;
    card(s, x, y, w, h);
    s.addImage({ path: A(c.ic), x: x + 0.25, y: y + 0.25, w: 0.4, h: 0.4 });
    s.addText(c.t, { x: x + 0.8, y: y + 0.28, w: w - 1.0, h: 0.35, margin: 0, fontFace: MONO, fontSize: 12, bold: true, color: DARK, charSpacing: 1 });
    let yy = y + 0.9;
    c.body.forEach(([h1, b1]) => {
      s.addText(h1.toUpperCase(), { x: x + 0.25, y: yy, w: w - 0.5, h: 0.26, margin: 0, fontFace: MONO, fontSize: 9.5, bold: true, color: INK, charSpacing: 1 });
      s.addText(b1, { x: x + 0.25, y: yy + 0.27, w: w - 0.5, h: 1.0, margin: 0, fontFace: SANS, fontSize: 10.5, color: BODY, lineSpacing: 14 });
      yy += 1.42;
    });
  });
  footer(s, 'CONTROLS');
  s.addNotes('PRD sections 11.4-11.5, 13.7, 20: the probe is cheap, deterministic and does not depend on borrower cooperation.');
}

/* ============================== 13 · LIFECYCLE & STATES ============================== */
{
  const s = newSlide();
  header(s, '12 · LIFECYCLE & CREDIT STATES', 'Registration to closure — and when things go wrong');
  s.addImage({ path: A('lifecycle.png'), x: 0.72, y: 1.5, w: 11.9, h: 2.08 });
  s.addImage({ path: A('states.png'), x: M, y: 3.75, w: 6.6, h: 3.22 });
  const rx = 7.7, rw = 5.0;
  s.addText('DEFAULT IS GOVERNED, NOT IMPROVISED', { x: rx, y: 3.8, w: rw, h: 0.3, margin: 0, fontFace: MONO, fontSize: 11, bold: true, color: INK, charSpacing: 1 });
  s.addText([
    { text: 'Declaration requires automatic contract triggers or a 2-of-N operator quorum with a published evidence hash — never one operator.', options: { bullet: { code: '2022' }, breakLine: true } },
    { text: 'Recovery waterfall: borrower reserve → restructure → permanent registry entry. A cure path exists — the default is recorded, not erased.', options: { bullet: { code: '2022' }, breakLine: true } },
    { text: 'The grace period exceeds the maximum observed settlement interval, so a borrower is never defaulted while repayment sits in the batch queue.', options: { bullet: { code: '2022' }, breakLine: true } },
    { text: 'Reputation is portable: signed attestations make repayment history an asset the borrower carries to any marketplace.', options: { bullet: { code: '2022' } } },
  ], { x: rx, y: 4.2, w: rw, h: 2.7, margin: 0, fontFace: SANS, fontSize: 11, color: BODY, paraSpaceAfter: 10, lineSpacing: 14 });
  footer(s, 'LIFECYCLE');
  s.addNotes('PRD sections 16-19. Enforcement against a pseudonymous borrower is reputational: the permanent registry and portable attestations are the mechanism, not an optional feature.');
}

/* ============================== 14 · COMPETITIVE LANDSCAPE ============================== */
{
  const s = newSlide();
  header(s, '13 · LANDSCAPE', 'Nobody else can underwrite this borrower');
  const th = { fontFace: MONO, fontSize: 10.5, bold: true, color: 'FFFFFF', fill: { color: DARK }, valign: 'middle' };
  const td = (t, o = {}) => ({ text: t, options: { fontFace: SANS, fontSize: 10.5, color: BODY, valign: 'middle', fill: { color: CARD }, ...o } });
  const rows = [
    [{ text: 'CATEGORY', options: th }, { text: 'WHO', options: th }, { text: 'WHY IT FAILS A MACHINE BUSINESS', options: th }],
    [td('Web2 revenue-based financing', { bold: true, color: DARK }), td('Stripe Capital, Pipe, Capchase'), td('Requires a legal entity, a bank account and a processor relationship; settles in days. Cannot underwrite a pseudonymous or agent-operated service.')],
    [td('Onchain receivables / PayFi', { bold: true, color: DARK }), td('Huma'), td('Closest structural comparable — but built for human and institutional payment flows, with no integration into agent spending policy.')],
    [td('Undercollateralized DeFi', { bold: true, color: DARK }), td('Goldfinch, Centrifuge, Maple'), td('Manual underwriting measured in weeks against borrowers whose revenue changes weekly; minimum tickets far above machine working capital.')],
    [td('Overcollateralized DeFi', { bold: true, color: DARK }), td('Aave, Morpho, Compound'), td('The borrower must already hold the capital it wants to borrow — structurally useless as working capital.')],
    [td('Vendor compute credit', { bold: true, color: DARK }), td('GPU marketplaces, clouds'), td('Single-vendor and non-portable: no cash liquidity, no credit-history accrual.')],
  ];
  s.addTable(rows, {
    x: M, y: 1.5, w: 12.03, colW: [2.9, 2.5, 6.63],
    border: { type: 'solid', color: 'C9CFD8', pt: 0.75 }, rowH: [0.42, 0.72, 0.72, 0.72, 0.62, 0.62], margin: 0.07,
  });
  s.addShape(pres.ShapeType.rect, { x: M, y: 5.85, w: 12.03, h: 1.0, fill: { color: DARK }, line: { color: DARK, width: 1 } });
  s.addText([
    { text: 'RIVORA — machine-native receivables credit. ', options: { fontFace: MONO, fontSize: 12, bold: true, color: 'FFFFFF' } },
    { text: 'The differentiator is not one component: the underwriting data, the disbursement rail, the spending controls and the repayment mechanism are the same programmable substrate.', options: { fontFace: SANS, fontSize: 11.5, color: LIGHT_ON_DARK } },
  ], { x: M + 0.3, y: 5.95, w: 11.4, h: 0.8, margin: 0, valign: 'middle', lineSpacing: 15 });
  footer(s, 'LANDSCAPE');
  s.addNotes('PRD section 5. Rivora does not compete on headline rate — it competes on availability, latency, and the absence of prerequisites.');
}

/* ============================== 15 · WHY BORROWERS CHOOSE IT ============================== */
{
  const s = newSlide();
  header(s, '14 · ADVERSE SELECTION, ANSWERED', 'Why a healthy borrower chooses Rivora');
  const items = [
    ['ic-tachometer-ink.png', 'SPEED', 'Underwriting completes in seconds from data the protocol already observes. No application, no data room, no diligence call.'],
    ['ic-chartpie-ink.png', 'NO DILUTION, NO GUARANTEE', 'A revenue share is not equity and not a directors\' guarantee. The operator keeps the upside.'],
    ['ic-university-ink.png', 'NO BANKING PREREQUISITE', 'A service earning USDC needs no corporate bank account, processor relationship or established jurisdiction.'],
    ['ic-robot-ink.png', 'WORKS FOR NON-HUMAN OPERATORS', 'An autonomous agent cannot sign a loan agreement or pass a consumer credit check. It can prove revenue.'],
    ['ic-balance-ink.png', 'PROPORTIONAL REPAYMENT', 'Debt service scales with revenue — a slow week is a slower repayment, not a missed fixed payment.'],
    ['ic-chartline-ink.png', 'A LIMIT THAT COMPOUNDS', 'Repayment performance is recorded and portable; capacity grows with operating history instead of resetting at each financing.'],
  ];
  items.forEach((it, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = M + col * 6.15, y = 1.55 + row * 1.45, w = 5.9;
    s.addShape(pres.ShapeType.ellipse, { x, y: y + 0.08, w: 0.62, h: 0.62, fill: { color: 'E4E9F0' }, line: { color: INK, width: 1 } });
    s.addImage({ path: A(it[0]), x: x + 0.145, y: y + 0.225, w: 0.33, h: 0.33 });
    s.addText(it[1], { x: x + 0.85, y: y + 0.02, w: w - 0.85, h: 0.3, margin: 0, fontFace: MONO, fontSize: 12, bold: true, color: DARK, charSpacing: 1 });
    s.addText(it[2], { x: x + 0.85, y: y + 0.34, w: w - 0.85, h: 0.95, margin: 0, fontFace: SANS, fontSize: 11, color: BODY, lineSpacing: 15 });
  });
  card(s, M, 6.0, 12.03, 0.8, { accent: true });
  s.addText([
    { text: 'Rivora does not compete on rate. ', options: { bold: true, color: ACCENT } },
    { text: 'It competes on availability, latency — and on being the only underwriter that serves this borrower at all.', options: { color: BODY } },
  ], { x: M + 0.3, y: 6.05, w: 11.4, h: 0.7, margin: 0, valign: 'middle', fontFace: SANS, fontSize: 12.5 });
  footer(s, 'WHY RIVORA');
  s.addNotes('PRD 5.3: if only borrowers rejected by cheaper capital apply, the loan book is structurally impaired. These six properties attract well-performing services, not just desperate ones.');
}

/* ============================== 16 · WHAT'S BUILT ============================== */
{
  const s = newSlide();
  header(s, '15 · WHAT EXISTS TODAY', 'A working protocol, honestly labelled');
  s.addImage({ path: A('arch.png'), x: 0.6, y: 1.55, w: 7.3, h: 5.01 });
  const rx = 8.3, rw = 4.4;
  statRow(s, rx, 1.55, rw, '4', 'SOLIDITY CONTRACTS', 'vault · credit manager · router · registry');
  statRow(s, rx, 2.25, rw, '48', 'FOUNDRY TESTS', 'fuzz, invariant and differential vs core');
  statRow(s, rx, 2.95, rw, '54', 'CORE DOMAIN TESTS', 'pinned to the PRD\'s own worked examples');
  statRow(s, rx, 3.65, rw, '41', 'SCREENS, 4 SURFACES', 'borrower · LP · risk ops · partner');
  card(s, rx, 4.5, rw, 2.15);
  s.addText('LABELLED GAPS, NOT PAPERED OVER', { x: rx + 0.22, y: 4.68, w: rw - 0.44, h: 0.28, margin: 0, fontFace: MONO, fontSize: 10.5, bold: true, color: INK, charSpacing: 1 });
  s.addText(
    'PostgreSQL is the ledger of record until CHAIN_MODE=arc flips money movement onchain. Still missing: a chain indexer, per-payer attribution through net batch settlement, an operator quorum for default declaration, and an audit.',
    { x: rx + 0.22, y: 5.0, w: rw - 0.44, h: 1.55, margin: 0, fontFace: SANS, fontSize: 10.5, color: BODY, lineSpacing: 15 }
  );
  footer(s, 'BUILD');
  s.addNotes('Monorepo: Next.js web app, NestJS+Prisma API, pure-TS core package, Foundry contracts. Wallet connection and SIWE are real; draws are still POSTs, not contract calls.');
}

/* ============================== 17 · BUSINESS MODEL ============================== */
{
  const s = newSlide();
  header(s, '16 · BUSINESS MODEL', 'Five ways the loop pays for itself');
  // spread card
  card(s, M, 1.55, 4.4, 3.5, { lineW: 1.5 });
  s.addText('INTEREST SPREAD', { x: M + 0.25, y: 1.75, w: 3.9, h: 0.3, margin: 0, fontFace: MONO, fontSize: 11.5, bold: true, color: INK, charSpacing: 2 });
  const spread = [['Borrower rate', '12%', DARK], ['LP yield', '9%', INK], ['Protocol spread', '3%', ACCENT]];
  spread.forEach((sp, i) => {
    const y = 2.2 + i * 0.78;
    s.addText(sp[0], { x: M + 0.25, y: y + 0.12, w: 2.3, h: 0.35, margin: 0, fontFace: SANS, fontSize: 12.5, color: BODY });
    s.addText(sp[1], { x: M + 2.6, y, w: 1.5, h: 0.6, margin: 0, align: 'right', fontFace: MONO, fontSize: 26, bold: true, color: sp[2] });
  });
  s.addShape(pres.ShapeType.line, { x: M + 0.25, y: 4.55, w: 3.9, h: 0, line: { color: INK, width: 1 } });
  s.addText('The core engine at every scale', { x: M + 0.25, y: 4.62, w: 3.9, h: 0.3, margin: 0, fontFace: SANS, fontSize: 10.5, italic: true, color: MUTED });
  // 2x2 grid
  const g = [
    ['ic-invoice-ink.png', 'ORIGINATION FEE', '0.10–0.50% on each draw — priced with the tier, not against it.'],
    ['ic-cloud-ink.png', 'OPERATOR SAAS', 'Analytics, multi-service management, credit simulation, policy tooling, accounting exports.'],
    ['ic-code-ink.png', 'UNDERWRITING API', 'Machine credit scores, revenue verification and recommended exposure — sold to marketplaces as infrastructure.'],
    ['ic-building-ink.png', 'ENTERPRISE POOLS', 'Private or permissioned credit pools for agent marketplaces, clouds and inference networks.'],
  ];
  g.forEach((c, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = 5.45 + col * 3.68, y = 1.55 + row * 1.8, w = 3.48, h = 1.65;
    card(s, x, y, w, h);
    s.addImage({ path: A(c[0]), x: x + 0.22, y: y + 0.22, w: 0.36, h: 0.36 });
    s.addText(c[1], { x: x + 0.7, y: y + 0.24, w: w - 0.9, h: 0.3, margin: 0, fontFace: MONO, fontSize: 11, bold: true, color: DARK, charSpacing: 1 });
    s.addText(c[2], { x: x + 0.22, y: y + 0.68, w: w - 0.44, h: 0.9, margin: 0, fontFace: SANS, fontSize: 10.5, color: BODY, lineSpacing: 14 });
  });
  // north star
  s.addShape(pres.ShapeType.rect, { x: M, y: 5.45, w: 12.03, h: 1.25, fill: { color: DARK }, line: { color: DARK, width: 1 } });
  s.addText('NORTH-STAR METRIC', { x: M + 0.35, y: 5.68, w: 11.3, h: 0.3, margin: 0, fontFace: MONO, fontSize: 10.5, bold: true, color: PALE, charSpacing: 3 });
  s.addText('Risk-adjusted USDC credit repaid from verified machine revenue.', {
    x: M + 0.35, y: 6.0, w: 11.3, h: 0.45, margin: 0, fontFace: SANS, fontSize: 15, bold: true, color: 'FFFFFF',
  });
  footer(s, 'BUSINESS MODEL');
  s.addNotes('PRD section 39. The long-term business is infrastructure: scoring and delegation are worth more than the spread on a single balance sheet.');
}

/* ============================== 18 · ROADMAP ============================== */
{
  const s = newSlide();
  header(s, '17 · ROADMAP', 'From one borrower to machine capital markets');
  const phases = [
    ['P0', 'HACKATHON', 'One borrower, one vault, Arc testnet. Deterministic underwriting with an AI explanation; automatic repayment.'],
    ['P1', 'PRIVATE BETA', 'Hand-picked cohort, real payment histories, KYB, borrower reserves, LP withdrawals, risk monitoring.'],
    ['P2', 'CREDIT NETWORK', 'Multiple pools and tiers, delegated underwriting, insurance pool, junior/senior tranches, crosschain revenue.'],
    ['P3', 'CAPITAL MARKETS', 'Tokenized machine receivables, revenue forwards, fixed-term pools, syndication, GPU financing.'],
    ['P4', 'AUTONOMOUS TREASURY', 'Agent treasury management, stablecoin FX, cash-flow forecasting, machine-to-machine procurement finance.'],
  ];
  s.addShape(pres.ShapeType.line, { x: M + 0.3, y: 1.98, w: 11.4, h: 0, line: { color: INK, width: 1.5 } });
  phases.forEach((p, i) => {
    const x = M + i * 2.44, w = 2.28;
    s.addShape(pres.ShapeType.ellipse, { x: x + 0.06, y: 1.82, w: 0.34, h: 0.34, fill: { color: i === 0 ? DARK : PAPER }, line: { color: DARK, width: 1.5 } });
    s.addText(p[0], { x, y: 2.28, w: 1.0, h: 0.35, margin: 0, fontFace: MONO, fontSize: 15, bold: true, color: INK });
    s.addText(p[1], { x, y: 2.62, w, h: 0.3, margin: 0, fontFace: MONO, fontSize: 10.5, bold: true, color: DARK, charSpacing: 1 });
    s.addText(p[2], { x, y: 2.95, w, h: 1.7, margin: 0, fontFace: SANS, fontSize: 9.5, color: BODY, lineSpacing: 13 });
  });
  // two expansions
  card(s, M, 4.9, 5.9, 1.85);
  s.addImage({ path: A('ic-sync-ink.png'), x: M + 0.25, y: 5.1, w: 0.36, h: 0.36 });
  s.addText('BUY-SIDE CREDIT — THE MIRROR IMAGE', { x: M + 0.75, y: 5.12, w: 5.0, h: 0.3, margin: 0, fontFace: MONO, fontSize: 10.5, bold: true, color: DARK, charSpacing: 1 });
  s.addText('A consuming agent must buy inference and data before the job it is working on pays out. Underwrite the escrowed job itself; reuse the router, policy engine and identity layer unchanged. Roughly doubles the addressable population.', {
    x: M + 0.25, y: 5.5, w: 5.4, h: 1.2, margin: 0, fontFace: SANS, fontSize: 10.5, color: BODY, lineSpacing: 14,
  });
  card(s, 6.78, 4.9, 5.9, 1.85, { accent: true });
  s.addImage({ path: A('ic-chartline-accent.png'), x: 7.03, y: 5.1, w: 0.36, h: 0.36 });
  s.addText('TOKENIZED RECEIVABLES — THE DESTINATION', { x: 7.53, y: 5.12, w: 5.0, h: 0.3, margin: 0, fontFace: MONO, fontSize: 10.5, bold: true, color: ACCENT, charSpacing: 1 });
  s.addText('A borrower sells 30 days of forward routed revenue as a transferable claim, priced off its tier and coverage. Rivora stops lending its own vault\'s money and starts originating, scoring and servicing an asset any allocator can hold.', {
    x: 7.03, y: 5.5, w: 5.4, h: 1.2, margin: 0, fontFace: SANS, fontSize: 10.5, color: BODY, lineSpacing: 14,
  });
  footer(s, 'ROADMAP');
  s.addNotes('PRD section 40. Buy-side credit is deliberately deferred until the sell-side loss model is validated; tokenized receivables are the structure that scales machine credit past a single balance sheet.');
}

/* ============================== 19 · RISKS ============================== */
{
  const s = newSlide();
  header(s, '18 · RISKS, STATED PLAINLY', 'Because they drive the strategy');
  s.addText('RISK', { x: M + 0.55, y: 1.5, w: 4.5, h: 0.28, margin: 0, fontFace: MONO, fontSize: 10, bold: true, color: MUTED, charSpacing: 2 });
  s.addText('HOW IT IS MANAGED', { x: 7.0, y: 1.5, w: 4.5, h: 0.28, margin: 0, fontFace: MONO, fontSize: 10, bold: true, color: MUTED, charSpacing: 2 });
  const risks = [
    ['ic-userslash-accent.png', 'ADVERSE SELECTION', 'The borrowers most eager for revenue-based credit may be those cheaper capital rejected.', 'Compete on availability, not rate; hand-pick cohort 1; price premiums by tier so weaker credits pay for the selection effect.'],
    ['ic-key-accent.png', 'CUSTODY & SETTLEMENT', 'If revenue can bypass the router, repayment is voluntary and every advance rate is too high.', 'Custody-graded advance rates, binding probes, coverage ratio — and five explicit questions to Circle before mainnet.'],
    ['ic-network-accent.png', 'CORRELATED SHOCK', 'Machine businesses share upstreams: one model provider\'s price change impairs many borrowers at once.', 'Upstream concentration measured at portfolio level on the risk console, not only per borrower.'],
    ['ic-search-accent.png', 'MANIPULATION', 'Borrowers may manufacture payment activity to inflate limits.', 'Eligibility exclusions, funding-graph analysis, new-payer caps, spike clamp, seasoning.'],
    ['ic-water-accent.png', 'LIQUIDITY', 'LPs may request withdrawals while most USDC is deployed.', 'Liquidity buffer floor, FIFO exit queue, utilization-linked exit fee, kinked rate curve.'],
  ];
  risks.forEach((r, i) => {
    const y = 1.85 + i * 1.0;
    card(s, M, y, 12.03, 0.9);
    s.addImage({ path: A(r[0]), x: M + 0.2, y: y + 0.27, w: 0.36, h: 0.36 });
    s.addText(r[1], { x: M + 0.7, y: y + 0.1, w: 2.4, h: 0.7, margin: 0, valign: 'middle', fontFace: MONO, fontSize: 10.5, bold: true, color: DARK, charSpacing: 0.5, lineSpacing: 13 });
    s.addText(r[2], { x: M + 3.2, y: y + 0.08, w: 3.5, h: 0.76, margin: 0, valign: 'middle', fontFace: SANS, fontSize: 10, color: BODY, lineSpacing: 13 });
    s.addShape(pres.ShapeType.line, { x: 6.85, y: y + 0.15, w: 0, h: 0.6, line: { color: 'C9CFD8', width: 1 } });
    s.addText(r[3], { x: 7.0, y: y + 0.08, w: 5.5, h: 0.76, margin: 0, valign: 'middle', fontFace: SANS, fontSize: 10, color: BODY, lineSpacing: 13 });
  });
  footer(s, 'RISKS');
  s.addNotes('PRD section 41. Custody is the single largest technical dependency; adverse selection is the reason the strategy begins permissioned.');
}

/* ============================== 20 · CLOSING ============================== */
{
  const s = newSlide({ dark: true });
  const chain = ['VERIFIABLE MACHINE REVENUE', 'EXPLAINABLE UNDERWRITING', 'PROGRAMMABLE USDC CREDIT', 'AUTONOMOUS SPENDING', 'AUTOMATIC REPAYMENT'];
  s.addText(chain.join('   →   '), {
    x: 0.85, y: 1.35, w: 11.6, h: 0.75, margin: 0, align: 'center', fontFace: MONO, fontSize: 12.5, bold: true, color: PALE, charSpacing: 1, lineSpacing: 20,
  });
  s.addText('The credit and financial-reputation layer\nfor autonomous digital businesses.', {
    x: 0.85, y: 2.55, w: 11.6, h: 1.6, margin: 0, align: 'center', fontFace: SANS, fontSize: 30, bold: true, color: 'F5F4F0', lineSpacing: 40,
  });
  s.addText(
    'Begin as a permissioned managed network with known operators — short-duration USDC working-capital advances for AI APIs and MCP servers — and earn the loss history that lets the network open.',
    { x: 2.4, y: 4.35, w: 8.5, h: 0.95, margin: 0, align: 'center', fontFace: SANS, fontSize: 13, color: LIGHT_ON_DARK, lineSpacing: 19 }
  );
  s.addShape(pres.ShapeType.line, { x: 5.42, y: 5.55, w: 2.5, h: 0, line: { color: PALE, width: 1.5 } });
  s.addText('RIVORA', { x: 4.67, y: 5.75, w: 4, h: 0.7, margin: 0, align: 'center', fontFace: SANS, fontSize: 34, bold: true, color: 'F5F4F0', charSpacing: 10 });
  s.addText('RIVORA · REVENUE ROUTER · v1.1 · ARC · RR-001', {
    x: 4.17, y: 6.5, w: 5, h: 0.3, margin: 0, align: 'center', fontFace: MONO, fontSize: 9.5, color: '8FA6C4', charSpacing: 2,
  });
  s.addNotes('Close on the loop and the strategy: permissioned first, infrastructure long-term. North star: risk-adjusted USDC credit repaid from verified machine revenue.');
}

pres.writeFile({ fileName: path.join(__dirname, 'Rivora-Deck.pptx') }).then((f) => console.log('WROTE', f));
