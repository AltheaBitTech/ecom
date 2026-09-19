import 'reflect-metadata';
import express from 'express';
import { createApp } from '../src/create-app';

// Vercel serverless functions are re-invoked per-request but a warm container reuses this
// module's state — build the Nest app once and cache the promise so a warm invocation never
// re-bootstraps it. A cold start pays the bootstrap cost; every request after doesn't.
const server = express();
let ready: Promise<void> | null = null;

async function bootstrap() {
  const app = await createApp(server);
  await app.init();
}

export default async function handler(req: import('http').IncomingMessage, res: import('http').ServerResponse) {
  ready ??= bootstrap().catch((err) => {
    ready = null; // don't cache a failed boot — let the next request retry
    throw err;
  });
  await ready;
  server(req, res);
}
