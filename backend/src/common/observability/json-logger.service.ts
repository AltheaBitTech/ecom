import { ConsoleLogger, LoggerService, LogLevel } from '@nestjs/common';

import { currentPrincipal, currentRequestId } from './request-context';

export type LogFormat = 'json' | 'pretty';

/** Order matters: an enabled level enables everything at or above it. */
const LEVEL_ORDER: LogLevel[] = ['verbose', 'debug', 'log', 'warn', 'error', 'fatal'];

/** Every level at or above `min` — what NestFactory expects from `logLevels`. */
export function enabledLevels(min: LogLevel): LogLevel[] {
  const from = LEVEL_ORDER.indexOf(min);
  return from === -1 ? LEVEL_ORDER : LEVEL_ORDER.slice(from);
}

/**
 * Structured logger: one JSON object per line, enriched with the ambient
 * `request_id` and (once resolved) the acting principal, so every line a request
 * emits can be grouped and attributed. Honours the configured minimum level, so
 * running the service at `debug` surfaces request payloads that `log` hides.
 */
export class JsonLogger implements LoggerService {
  private levels: LogLevel[];

  constructor(levels: LogLevel[]) {
    this.levels = levels;
  }

  private enabled(level: LogLevel): boolean {
    return this.levels.includes(level);
  }

  private write(level: LogLevel, message: unknown, context?: string, stack?: string): void {
    if (!this.enabled(level)) return;

    const principal = currentPrincipal();
    const line = {
      level,
      context: context ?? undefined,
      request_id: currentRequestId(),
      principal: principal ? `${principal.kind}:${principal.id}` : undefined,
      tenant_id: principal?.tenant_id,
      message: typeof message === 'string' ? message : safeStringify(message),
      ...(stack ? { stack } : {}),
    };
    const stream = level === 'error' || level === 'fatal' ? process.stderr : process.stdout;
    stream.write(`${JSON.stringify(line)}\n`);
  }

  log(message: unknown, context?: string): void {
    this.write('log', message, context);
  }
  error(message: unknown, stack?: string, context?: string): void {
    this.write('error', message, context, stack);
  }
  warn(message: unknown, context?: string): void {
    this.write('warn', message, context);
  }
  debug(message: unknown, context?: string): void {
    this.write('debug', message, context);
  }
  verbose(message: unknown, context?: string): void {
    this.write('verbose', message, context);
  }
  fatal(message: unknown, context?: string): void {
    this.write('fatal', message, context);
  }
  setLogLevels(levels: LogLevel[]): void {
    this.levels = levels;
  }
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/**
 * Build the app logger. `json` (production/staging) emits structured lines with
 * request correlation; `pretty` (local dev) uses Nest's coloured console. Both
 * are constrained to the configured minimum level.
 */
export function createLogger(format: LogFormat, levels: LogLevel[]): LoggerService {
  if (format === 'json') return new JsonLogger(levels);
  const console = new ConsoleLogger();
  console.setLogLevels(levels);
  return console;
}
