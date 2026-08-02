/**
 * The four entry points into the protocol.
 *
 * Each role has its own navigation set and landing route — the product is four
 * distinct surfaces (borrower, LP, operator, partner) sharing one design
 * system. Modelling them here keeps the chrome from hard-coding who is looking
 * at it. Which role a wallet holds is decided by the API from a verified
 * signature — never here.
 */

export type Persona = 'borrower' | 'lp' | 'ops' | 'partner';

export interface PersonaDefinition {
  id: Persona;
  glyph: string;
  title: string;
  subtitle: string;
  /** Route the persona lands on after connecting. */
  home: string;
  /** Suffix appended to the wordmark in the chrome. */
  chromeSuffix?: string;
  nav: Array<{ href: string; label: string }>;
}

export const PUBLIC_NAV = [
  { href: '/', label: 'Home' },
  { href: '/activity', label: 'Activity' },
  { href: '/reputation', label: 'Reputation' },
  { href: '/defaults', label: 'Defaults' },
];

export const PERSONAS: Record<Persona, PersonaDefinition> = {
  borrower: {
    id: 'borrower',
    glyph: 'B',
    title: 'QuoteStream Market Data API',
    subtitle: 'Borrower · Circle Wallet · custody Model A',
    home: '/dashboard',
    nav: [
      { href: '/dashboard', label: 'Dashboard' },
      { href: '/revenue', label: 'Revenue' },
      { href: '/credit', label: 'Credit' },
      { href: '/custody', label: 'Custody' },
      { href: '/policy', label: 'Policy' },
      { href: '/reserve', label: 'Reserve' },
      { href: '/notifications', label: 'Alerts' },
    ],
  },
  lp: {
    id: 'lp',
    glyph: 'LP',
    title: 'Liquidity provider',
    subtitle: 'Supplies USDC to the credit vault',
    home: '/vault',
    nav: [
      { href: '/vault', label: 'Vault' },
      { href: '/vault/portfolio', label: 'Portfolio' },
      { href: '/vault/performance', label: 'Performance' },
      { href: '/activity', label: 'Activity' },
    ],
  },
  ops: {
    id: 'ops',
    glyph: 'OPS',
    title: 'Risk operator',
    subtitle: 'Separate auth · access-logged · quorum 2 of 3',
    home: '/risk',
    chromeSuffix: 'RISK',
    nav: [
      { href: '/risk', label: 'Overview' },
      { href: '/risk/watchlist', label: 'Watchlist' },
      { href: '/risk/anomaly', label: 'Anomalies' },
      { href: '/risk/exposure', label: 'Exposure' },
      { href: '/risk/params', label: 'Params' },
    ],
  },
  partner: {
    id: 'partner',
    glyph: 'PA',
    title: 'AgentMarket Inc',
    subtitle: 'Partner · Score API · key pk_live_8f2…',
    home: '/partner',
    chromeSuffix: 'PARTNER',
    nav: [
      { href: '/partner', label: 'Console' },
      { href: '/partner/sandbox', label: 'Sandbox' },
    ],
  },
};

export const PERSONA_ORDER: Persona[] = ['borrower', 'lp', 'ops', 'partner'];

/**
 * Which surface a route belongs to, longest prefix first.
 *
 * Lets a deep link adopt the right surface: pasting `/vault/portfolio` into a
 * fresh session should show the LP chrome, not the public one. Without this
 * every visit would have to start at `/connect`.
 */
const ROUTE_OWNERS: ReadonlyArray<[prefix: string, persona: Persona]> = [
  ['/dashboard', 'borrower'],
  ['/revenue', 'borrower'],
  ['/credit', 'borrower'],
  ['/custody', 'borrower'],
  ['/policy', 'borrower'],
  ['/reserve', 'borrower'],
  ['/notifications', 'borrower'],
  ['/recovery', 'borrower'],
  ['/close-account', 'borrower'],
  ['/vault', 'lp'],
  ['/risk', 'ops'],
  ['/partner', 'partner'],
];

export function personaForPath(pathname: string): Persona | null {
  return ROUTE_OWNERS.find(([prefix]) => pathname.startsWith(prefix))?.[1] ?? null;
}

/**
 * Sub-routes that should light up a parent nav item.
 * Without this a borrower on `/revenue/excluded` sees no active tab.
 */
export const NAV_GROUPS: Record<string, string> = {
  '/revenue/excluded': '/revenue',
  '/revenue/customers': '/revenue',
  '/credit/assessment': '/credit',
  '/credit/history': '/credit',
  '/recovery': '/dashboard',
  '/close-account': '/dashboard',
  '/risk/borrower': '/risk/watchlist',
  '/risk/declare': '/risk/watchlist',
  '/vault/portfolio': '/vault/portfolio',
  '/vault/performance': '/vault/performance',
};
