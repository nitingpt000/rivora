import { randomBytes } from 'node:crypto';

import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Role } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import type {
  AuthTokenResponseDto,
  NonceResponseDto,
  SessionUserDto,
} from './auth.dto';
import { verifySiweMessage } from './siwe';

/** Landing route per surface. Mirrors the web app's persona table. */
const HOME: Record<Role, string> = {
  borrower: '/dashboard',
  lp: '/vault',
  ops: '/risk',
  partner: '/partner',
};

/**
 * How long a challenge stays valid.
 *
 * Short on purpose. The nonce is the only thing standing between a captured
 * message and a replay, and a user who takes longer than this to approve a
 * wallet prompt can simply be asked again.
 */
const NONCE_TTL_MS = 5 * 60_000;

/** What a JWT carries. Deliberately small — it is a bearer credential. */
export interface JwtPayload {
  /** Subject: the wallet address, lowercased. */
  sub: string;
  role: Role | null;
  borrowerId?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  /**
   * Issues a single-use challenge.
   *
   * 16 bytes from the CSPRNG. `Math.random()` here would make challenges
   * predictable, which is the whole attack this defends against.
   */
  async issueNonce(address: string, now = new Date()): Promise<NonceResponseDto> {
    const nonce = randomBytes(16).toString('base64url');
    const expiresAt = new Date(now.getTime() + NONCE_TTL_MS);

    await this.prisma.authNonce.create({
      data: { nonce, address: address.toLowerCase(), issuedAt: now, expiresAt },
    });

    // Opportunistic sweep, rather than a scheduled job for a table this small.
    await this.prisma.authNonce.deleteMany({ where: { expiresAt: { lt: now } } });

    return { nonce, issuedAt: now.toISOString(), expiresAt: expiresAt.toISOString() };
  }

  /**
   * Verifies a signed message and issues a session token.
   *
   * The nonce is consumed with a conditional update, so two requests racing
   * with the same signature cannot both succeed: whichever loses updates zero
   * rows and is rejected as a replay.
   */
  async verify(
    message: string,
    signature: string,
    options: { domains: string[]; chainId: number; ttlSeconds: number },
    now = new Date(),
  ): Promise<AuthTokenResponseDto> {
    const result = await verifySiweMessage(message, signature as `0x${string}`, {
      domains: options.domains,
      chainId: options.chainId,
      now,
    });

    if (!result.ok || !result.address) {
      // Logged at debug, not warn: a failed signature is a normal outcome of a
      // user cancelling a wallet prompt, not evidence of an attack.
      this.logger.debug(`SIWE verification failed: ${result.reason}`);
      throw new UnauthorizedException({
        error: result.reason ?? 'Signature verification failed.',
        code: 'invalid_signature',
        statusCode: 401,
      });
    }

    const nonce = /^Nonce: (.+)$/m.exec(message)?.[1]?.trim();
    if (!nonce) {
      throw new UnauthorizedException({
        error: 'Message is missing a nonce.',
        code: 'missing_nonce',
        statusCode: 401,
      });
    }

    const consumed = await this.prisma.authNonce.updateMany({
      where: {
        nonce,
        address: result.address,
        consumedAt: null,
        expiresAt: { gt: now },
      },
      data: { consumedAt: now },
    });

    if (consumed.count !== 1) {
      throw new UnauthorizedException({
        error: 'Challenge is unknown, already used, or expired. Request a new nonce.',
        code: 'invalid_nonce',
        statusCode: 401,
      });
    }

    const user = await this.resolve(result.address);
    const payload: JwtPayload = {
      sub: user.address,
      role: user.role as Role | null,
      ...(user.borrowerId ? { borrowerId: user.borrowerId } : {}),
    };

    const accessToken = await this.jwt.signAsync(payload, { expiresIn: options.ttlSeconds });

    this.logger.log(`Session issued for ${user.address} as ${user.role ?? 'unregistered'}`);

    return { accessToken, expiresIn: options.ttlSeconds, tokenType: 'Bearer', user };
  }

  /**
   * Resolves an address to its surface.
   *
   * An unknown address is not an error — it is a wallet that has registered
   * nothing yet, and gets a valid session with a null role so the client can
   * offer registration.
   */
  async resolve(address: string): Promise<SessionUserDto> {
    // Addresses are compared lowercased: EIP-55 checksum casing is display
    // sugar, and the same wallet must not resolve differently depending on how
    // the client formatted it.
    const normalised = address.toLowerCase();
    const match = await this.prisma.addressRole.findUnique({ where: { address: normalised } });

    if (!match) {
      return { address: normalised, role: null, home: null, known: false };
    }

    return {
      address: normalised,
      role: match.role,
      home: HOME[match.role],
      known: true,
      ...(match.borrowerId ? { borrowerId: match.borrowerId } : {}),
    };
  }
}
