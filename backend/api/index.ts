import 'reflect-metadata';
import type { IncomingMessage, ServerResponse } from 'node:http';

import { createApp } from '../src/create-app';

type Handler = (req: IncomingMessage, res: ServerResponse) => void;

// A warm container reuses module state: boot Nest once and cache the promise.
// A failed boot is not cached, so the next request retries.
let server: Promise<Handler> | null = null;

async function boot(): Promise<Handler> {
  const app = await createApp();
  await app.init();
  return app.getHttpAdapter().getInstance() as Handler;
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  server ??= boot().catch((err: unknown) => {
    server = null;
    throw err;
  });
  (await server)(req, res);
}
