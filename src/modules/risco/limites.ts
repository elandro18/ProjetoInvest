import { Decimal } from "../../lib/decimal";
import { errors, type AppError } from "../../lib/errors";
import { err, ok, type Result } from "../../lib/result";
import {
  ehDimensaoConcentracao,
  type DimensaoConcentracao,
  type NovoLimite,
} from "./repositorio";

/**
 * Validação dos limites de concentração recebidos pelo `PUT` (RN-049-2;
 * API_CONTRACTS.md §12).
 *
 * Regras:
 * - dimensão entre as suportadas (comparação sem diferenciar caixa);
 * - referência textual opcional (nula = default da dimensão), até 120
 *   caracteres, sem espaço nas pontas;
 * - percentual estritamente maior que 0 e até 100, normalizado com 6 casas;
 * - sem duplicidade de `(dimensao, referencia)`, comparando sem caixa e sem
 *   espaço nas pontas — `null` e `""` são a mesma referência.
 */

export const TAMANHO_MAXIMO_REFERENCIA = 120;
export const ESCALA_PERCENTUAL = 6;

/** Corpo de `PUT /api/configuracoes/limites` já validado na forma pela borda. */
export interface EntradaLimite {
  readonly dimensao: string;
  readonly referencia: string | null;
  readonly percentualMax: string;
}

/** Texto de referência normalizado (trim e espaços internos colapsados). */
export function normalizarReferencia(valor: string | null | undefined): string | null {
  if (valor === null || valor === undefined) {
    return null;
  }

  const normalizado = valor.trim().replace(/\s+/g, " ");
  return normalizado.length === 0 ? null : normalizado;
}

/**
 * Chave de comparação de limite: dimensão + referência sem caixa.
 * `null` e `""` colapsam para a mesma chave.
 */
export function chaveReferencia(
  dimensao: DimensaoConcentracao,
  referencia: string | null | undefined,
): string {
  return `${dimensao}|${(normalizarReferencia(referencia) ?? "").toLowerCase()}`;
}

function limiteInvalido(
  campo: string,
  dimensao?: string,
  referencia?: string | null,
): AppError {
  const details: Record<string, unknown> = { campo };
  if (dimensao !== undefined) {
    details.dimensao = dimensao;
  }
  if (referencia !== undefined) {
    details.referencia = referencia;
  }

  return errors.riscoLimiteInvalido(details);
}

/**
 * Valida e normaliza o conjunto recebido pelo `PUT`.
 *
 * Ordem: dimensão → tamanho da referência → faixa do percentual → duplicidade.
 * A lista vazia é válida: representa remover todos os limites vigentes.
 */
export function validarLimites(
  limites: readonly EntradaLimite[],
): Result<readonly NovoLimite[], AppError> {
  const vistos = new Set<string>();
  const normalizados: NovoLimite[] = [];

  for (const [indice, item] of limites.entries()) {
    const dimensao = item.dimensao.trim().toUpperCase();

    if (!ehDimensaoConcentracao(dimensao)) {
      return err(limiteInvalido(`limites[${indice}].dimensao`, item.dimensao));
    }

    const referencia = normalizarReferencia(item.referencia);
    if (referencia !== null && referencia.length > TAMANHO_MAXIMO_REFERENCIA) {
      return err(limiteInvalido(`limites[${indice}].referencia`, dimensao, referencia));
    }

    const percentual = Decimal.parse(item.percentualMax);
    if (!percentual.ok || percentual.value.lte("0") || percentual.value.gt("100")) {
      return err(limiteInvalido(`limites[${indice}].percentualMax`, dimensao, referencia));
    }

    const chave = chaveReferencia(dimensao, referencia);
    if (vistos.has(chave)) {
      return err(limiteInvalido(`limites[${indice}].referencia`, dimensao, referencia));
    }
    vistos.add(chave);

    normalizados.push({
      dimensao,
      referencia,
      percentualMax: percentual.value.toFixed(ESCALA_PERCENTUAL),
    });
  }

  return ok(normalizados);
}
