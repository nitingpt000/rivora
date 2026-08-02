import { WalletProvider } from '@rivora/wallet';
import type { Metadata, Viewport } from 'next';
import { Barlow, Barlow_Condensed } from 'next/font/google';

import { AppChrome } from '@/components/app-chrome';
import { ModalHost } from '@/components/modal-host';

import './globals.css';

/**
 * The design system asks for Barlow Condensed headings over Barlow body text.
 * Loading them through next/font rather than the stylesheet's own @import keeps
 * the CSS non-render-blocking and self-hosts the files. The CSS variables are
 * then re-pointed at these, so `var(--font-heading)` keeps working everywhere.
 */
const barlow = Barlow({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-barlow',
  display: 'swap',
});

const barlowCondensed = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['400', '600'],
  variable: '--font-barlow-condensed',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Rivora — credit for autonomous commerce',
  description:
    'Rivora transforms verifiable API and agent revenue into programmable USDC working capital. Arc Testnet.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${barlow.variable} ${barlowCondensed.variable}`}>
      <body>
        <style>{`:root{
          --font-heading: var(--font-barlow-condensed), "Barlow Condensed", system-ui, sans-serif;
          --font-body: var(--font-barlow), "Barlow", system-ui, sans-serif;
        }`}</style>
        <WalletProvider>
          <AppChrome>{children}</AppChrome>
          <ModalHost />
        </WalletProvider>
      </body>
    </html>
  );
}
