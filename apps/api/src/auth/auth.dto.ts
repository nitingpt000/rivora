import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { Role } from '@rivora/api-client';
import { IsEthereumAddress, IsString, Length, Matches } from 'class-validator';

export class NonceRequestDto {
  @ApiProperty({
    example: '0x5d92a10f4c3b8e7d6a2f9c04e1b83750d6ab3ba6',
    description: 'The wallet that will sign. Checksummed or lowercase, both accepted.',
  })
  @IsEthereumAddress({ message: 'address must be a valid Ethereum address' })
  address: string;
}

export class NonceResponseDto {
  @ApiProperty({ example: 'k7Qm2Xp9Rt4Nw8Lz', description: 'Single-use. Embed in the SIWE message.' })
  nonce: string;

  @ApiProperty({ example: '2026-08-02T14:31:07.000Z', format: 'date-time' })
  issuedAt: string;

  @ApiProperty({
    example: '2026-08-02T14:36:07.000Z',
    format: 'date-time',
    description: 'Nonces expire quickly to bound the window for a stolen challenge.',
  })
  expiresAt: string;
}

export class VerifyRequestDto {
  @ApiProperty({
    description: 'The exact EIP-4361 message that was signed. Any edit invalidates the signature.',
    example:
      'localhost:3000 wants you to sign in with your Ethereum account:\n0x5d92…\n\nSign in to Rivora.\n\nURI: http://localhost:3000\nVersion: 1\nChain ID: 5042002\nNonce: k7Qm2Xp9Rt4Nw8Lz\nIssued At: 2026-08-02T14:31:07.000Z',
  })
  @IsString()
  @Length(1, 4_000)
  message: string;

  @ApiProperty({ example: '0x1b2c…', description: '65-byte secp256k1 signature, hex encoded.' })
  @IsString()
  @Matches(/^0x[0-9a-fA-F]{130}$/, { message: 'signature must be a 65-byte hex string' })
  signature: string;
}

export class SessionUserDto {
  @ApiProperty({ example: '0x5d92a10f4c3b8e7d6a2f9c04e1b83750d6ab3ba6' })
  address: string;

  @ApiProperty({
    enum: ['borrower', 'lp', 'ops', 'partner'],
    nullable: true,
    description: 'Null for a wallet that has registered nothing yet.',
  })
  role: Role | null;

  @ApiProperty({ example: '/dashboard', nullable: true })
  home: string | null;

  @ApiProperty({ example: true })
  known: boolean;

  @ApiPropertyOptional({
    example: 'clx8f2k9a0000',
    description: 'Set when the session is scoped to one borrower record.',
  })
  borrowerId?: string;
}

export class AuthTokenResponseDto {
  @ApiProperty({ description: 'JWT. Send as `Authorization: Bearer <token>`.' })
  accessToken: string;

  @ApiProperty({ example: 3600, description: 'Lifetime in seconds.' })
  expiresIn: number;

  @ApiProperty({ example: 'Bearer' })
  tokenType: string;

  @ApiProperty({ type: SessionUserDto })
  user: SessionUserDto;
}
