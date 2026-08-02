import 'reflect-metadata';

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { buildOpenApiDocument } from './swagger';

/**
 * Writes `openapi.json` without starting a server.
 *
 * Useful in CI: the spec can be diffed on every pull request, so a breaking
 * change to the contract is visible in review rather than discovered by a
 * client. Uses `NestFactory.create` with the HTTP adapter left uninitialised,
 * so it never binds a port and never needs a database.
 */
async function emit(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false, preview: true });
  const document = buildOpenApiDocument(app);
  const target = resolve(process.cwd(), 'openapi.json');

  writeFileSync(target, `${JSON.stringify(document, null, 2)}\n`);
  await app.close();

  console.log(`openapi: wrote ${target}`);
}

void emit();
