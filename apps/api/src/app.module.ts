import { Module, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './auth/roles.guard';
import { BorrowerModule } from './borrower/borrower.module';
import { ChainModule } from './chain/chain.module';
import { ApiUsageInterceptor } from './common/api-usage.interceptor';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { RequestContextMiddleware } from './common/request-context.middleware';
import { loadConfig } from './config/configuration';
import { CreditModule } from './credit/credit.module';
import { HealthModule } from './health/health.module';
import { IngestModule } from './ingest/ingest.module';
import { X402Module } from './x402/x402.module';
import { LedgerModule } from './ledger/ledger.module';
import { PartnerModule } from './partner/partner.module';
import { PrismaModule } from './prisma/prisma.module';
import { PublicModule } from './public/public.module';
import { RiskModule } from './risk/risk.module';
import { SettlementModule } from './settlement/settlement.module';
import { SnapshotModule } from './snapshot/snapshot.module';
import { VaultModule } from './vault/vault.module';
import { WebhookModule } from './webhook/webhook.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      load: [loadConfig],
    }),

    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            name: 'default',
            limit: config.get<number>('throttleLimit') ?? 120,
            ttl: config.get<number>('throttleTtlMs') ?? 60_000,
          },
        ],
      }),
    }),

    PrismaModule,
    AuthModule,
    AuditModule,
    ChainModule,
    LedgerModule,
    SnapshotModule,
    PublicModule,
    BorrowerModule,
    CreditModule,
    VaultModule,
    RiskModule,
    PartnerModule,
    SettlementModule,
    HealthModule,
    IngestModule,
    X402Module,
    WebhookModule,
  ],
  providers: [
    /**
     * Order matters and is the security posture.
     *
     * Throttling first, so a flood is rejected before it costs a database
     * round-trip. Then authentication, then authorization — "who are you"
     * has to be settled before "may you do this".
     *
     * All three are global so a new route is protected by default. Opting out
     * is the deliberate act (`@Public()`), which means a forgotten decorator
     * fails closed rather than exposing an endpoint silently.
     */
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },

    /**
     * Usage metering runs after the guards, so it sees the key they resolved.
     * Global for the same reason they are: a new partner endpoint is counted
     * the day it ships rather than the day someone remembers to add it.
     */
    { provide: APP_INTERCEPTOR, useClass: ApiUsageInterceptor },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
