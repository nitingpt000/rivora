import { isIP } from 'node:net';

/**
 * Ranges a caller-supplied URL may never resolve to.
 *
 * Loopback, link-local, and the three private IPv4 blocks, plus IPv6
 * loopback and unique-local. Both the endpoint probe and webhook delivery
 * fetch addresses chosen by someone outside the process; without this,
 * `http://169.254.169.254/` is a cloud metadata endpoint and either becomes
 * a credential exfiltration tool.
 *
 * An address that does not parse is refused — unparseable is not public.
 */
export function isPrivateAddress(address: string): boolean {
  if (isIP(address) === 6) {
    const v6 = address.toLowerCase();
    return v6 === '::1' || v6.startsWith('fc') || v6.startsWith('fd') || v6.startsWith('fe80');
  }

  const [a, b] = address.split('.').map(Number);
  if (a === undefined || b === undefined) return true;

  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}
