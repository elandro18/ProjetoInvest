/**
 * Logger estruturado (JSON puro, uma linha por evento) — ARCHITECTURE.md §11.
 *
 * Regras:
 * - todo evento carrega `requestId`; a borda HTTP registra rota, status e duração;
 * - campos sensíveis são mascarados (`senha`, `token`, `authorization`, `apiKey`…);
 * - payload financeiro completo nunca é logado (chaves financeiras são omitidas);
 * - stack trace não é serializada com dados da requisição.
 */

export type LogLevel = "info" | "warn" | "error";

export type LogFields = Record<string, unknown>;

const REDACTED = "[REDACTED]";
const OMITTED = "[OMITIDO]";
const MAX_DEPTH = 4;
const MAX_STRING_LENGTH = 300;
const MAX_ARRAY_ITEMS = 20;

/** Normaliza a chave para comparação: minúscula, sem acento e sem separador. */
function normalizeKey(key: string): string {
  return key
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

const SENSITIVE_KEYS: ReadonlySet<string> = new Set(
  [
    "senha",
    "senhaAtual",
    "novaSenha",
    "password",
    "confirmarSenha",
    "token",
    "accessToken",
    "refreshToken",
    "authorization",
    "apiKey",
    "apiSecret",
    "secret",
    "cookie",
    "set-cookie",
  ].map(normalizeKey),
);

/** Chaves que revelam payload financeiro completo — nunca logadas. */
const FINANCIAL_KEYS: ReadonlySet<string> = new Set(
  [
    "payload",
    "body",
    "requestBody",
    "valor",
    "valorTotal",
    "valorUnitario",
    "preco",
    "precoMedio",
    "quantidade",
    "saldo",
    "patrimonio",
  ].map(normalizeKey),
);

function truncate(text: string): string {
  return text.length > MAX_STRING_LENGTH ? `${text.slice(0, MAX_STRING_LENGTH)}…[truncado]` : text;
}

function sanitizeObject(value: object, depth: number): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, nested] of Object.entries(value)) {
    const normalized = normalizeKey(key);
    if (SENSITIVE_KEYS.has(normalized)) {
      sanitized[key] = REDACTED;
    } else if (FINANCIAL_KEYS.has(normalized)) {
      sanitized[key] = OMITTED;
    } else {
      sanitized[key] = sanitize(nested, depth + 1);
    }
  }

  return sanitized;
}

/** Remove segredos e dados financeiros de um valor arbitrário. */
export function sanitize(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "string") {
    return truncate(value);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "bigint" || typeof value === "symbol" || typeof value === "function") {
    return String(value);
  }

  if (value instanceof Error) {
    return { name: value.name };
  }

  if (depth >= MAX_DEPTH) {
    return "[TRUNCADO]";
  }

  if (Array.isArray(value)) {
    const items = value.slice(0, MAX_ARRAY_ITEMS).map((item) => sanitize(item, depth + 1));
    return value.length > MAX_ARRAY_ITEMS ? [...items, `[+${value.length - MAX_ARRAY_ITEMS} itens]`] : items;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return sanitizeObject(value, depth);
}

function emit(level: LogLevel, event: string, fields: LogFields): void {
  const record = {
    level,
    event,
    timestamp: new Date().toISOString(),
    ...sanitizeObject(fields, 0),
  };
  const line = JSON.stringify(record);

  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  console.info(line);
}

export const logger = {
  info(event: string, fields: LogFields = {}): void {
    emit("info", event, fields);
  },
  warn(event: string, fields: LogFields = {}): void {
    emit("warn", event, fields);
  },
  error(event: string, fields: LogFields = {}): void {
    emit("error", event, fields);
  },
} as const;

export interface HttpRequestLog {
  requestId: string;
  method: string;
  route: string;
  status: number;
  durationMs: number;
  errorCode?: string;
}

/** Log de borda HTTP: sem corpo, sem query e sem header além do requestId. */
export function logHttpRequest(entry: HttpRequestLog): void {
  const level: LogLevel = entry.status >= 500 ? "error" : entry.status >= 400 ? "warn" : "info";
  logger[level]("http.request", { ...entry });
}
