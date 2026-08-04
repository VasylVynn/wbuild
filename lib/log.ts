/**
 * Structured logging, zero deps. Dev = readable single line, prod = JSON single
 * line (one object per line → greppable in Vercel/any log drain).
 *
 * Usage:
 *   const log = createLogger("payments");
 *   log.info("order created", { orderReference, host });
 *   log.error("webhook rejected", { reason: "bad signature" });
 *
 * Errors passed in fields are serialized to { message, stack } — never rely on
 * default Error JSON (it's `{}`).
 */

type Level = "info" | "warn" | "error";

export type LogFields = Record<string, unknown>;

export type Logger = {
  info: (msg: string, fields?: LogFields) => void;
  warn: (msg: string, fields?: LogFields) => void;
  error: (msg: string, fields?: LogFields) => void;
};

function serialize(value: unknown): unknown {
  if (value instanceof Error) {
    return { message: value.message, stack: value.stack };
  }
  return value;
}

function serializeFields(fields?: LogFields): LogFields | undefined {
  if (!fields) return undefined;
  const out: LogFields = {};
  for (const [k, v] of Object.entries(fields)) out[k] = serialize(v);
  return out;
}

function emit(level: Level, module: string, msg: string, fields?: LogFields) {
  const safe = serializeFields(fields);
  const sink =
    level === "error" ? console.error : level === "warn" ? console.warn : console.log;

  if (process.env.NODE_ENV === "production") {
    sink(
      JSON.stringify({
        ts: new Date().toISOString(),
        level,
        module,
        msg,
        ...safe,
      }),
    );
    return;
  }

  const suffix =
    safe && Object.keys(safe).length > 0 ? ` ${JSON.stringify(safe)}` : "";
  sink(`[${module}] ${msg}${suffix}`);
}

export function createLogger(module: string): Logger {
  return {
    info: (msg, fields) => emit("info", module, msg, fields),
    warn: (msg, fields) => emit("warn", module, msg, fields),
    error: (msg, fields) => emit("error", module, msg, fields),
  };
}
