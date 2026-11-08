import { z, ZodError, type ZodType } from "zod";

import { AppError, errors, type FieldError } from "../../lib/errors";

/**
 * Validação de entrada (RN-069) na borda HTTP.
 *
 * `ZodError` vira `AppError VALIDACAO` (422) com `details.errors[]`:
 * um item por campo inválido, na ordem de aparição das issues.
 */

// Mensagens de validação em PT-BR — o envelope é voltado ao titular.
z.config(z.locales.ptBR());

export function toValidationError(error: ZodError): AppError {
  const byField = new Map<string, string>();

  for (const issue of error.issues) {
    const field = issue.path.length > 0 ? issue.path.join(".") : "_root";
    if (!byField.has(field)) {
      byField.set(field, issue.message);
    }
  }

  const fieldErrors: FieldError[] = [...byField].map(([field, message]) => ({ field, message }));
  return errors.validacao(fieldErrors);
}

/** Valida `input`; em falha lança `AppError VALIDACAO`. */
export function validate<T>(schema: ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw toValidationError(parsed.error);
  }
  return parsed.data;
}

/** Lê o corpo JSON; corpo ausente ou malformado vira `REQUISICAO_MALFORMADA` (400). */
export async function readJsonBody(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type");
  if (contentType !== null && !contentType.toLowerCase().includes("application/json")) {
    throw errors.requisicaoMalformada({ motivo: "content-type" });
  }

  try {
    return await request.json();
  } catch (cause) {
    throw new AppError("REQUISICAO_MALFORMADA", { cause });
  }
}

/** Lê e valida o corpo JSON em uma etapa. */
export async function parseJsonBody<T>(request: Request, schema: ZodType<T>): Promise<T> {
  return validate(schema, await readJsonBody(request));
}
