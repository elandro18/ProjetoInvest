import { Decimal } from "../../lib/decimal";
import { errors, type AppError } from "../../lib/errors";
import { err, ok, type Result } from "../../lib/result";
import { dataIsoValida } from "./datas";
import { PRODUTOS_COM_FGC, type ProdutoRendaFixa } from "./repositorio";

/**
 * Validadores puros do cadastro de renda fixa (RN-057, RN-059).
 *
 * Cada regra devolve `Result` com o valor normalizado na escala do contrato:
 * taxa com 6 casas e valores monetários com 2. Erros de domínio usam os
 * códigos de `ERROR_CATALOG.md` §6; falhas de forma usam `VALIDACAO` por campo.
 */

const ESCALA_TAXA = 6;
const ESCALA_MONETARIA = 2;
const TAXA_MINIMA = "0";
const TAXA_MAXIMA = "100";

function campoInvalido(field: string, message: string): AppError {
  return errors.validacao([{ field, message }]);
}

/** Cobertura do FGC derivada do produto (RN-057; API_CONTRACTS.md §6.2). */
export function derivarCoberturaFgc(produto: ProdutoRendaFixa): boolean {
  return PRODUTOS_COM_FGC.includes(produto);
}

/** Texto opcional: `trim`; vazio vira `null` para não persistir string vazia. */
export function normalizarTextoOpcional(valor: string | null): string | null {
  if (valor === null) {
    return null;
  }
  const normalizado = valor.trim();
  return normalizado.length === 0 ? null : normalizado;
}

export function validarInstituicao(valor: string): Result<string, AppError> {
  const normalizado = valor.trim();
  if (normalizado.length < 2 || normalizado.length > 120) {
    return err(campoInvalido("instituicao", "A instituição deve ter entre 2 e 120 caracteres."));
  }
  return ok(normalizado);
}

/** Taxa em % a.a. entre 0 e 100; normalizada com 6 casas. */
export function validarTaxa(valor: string): Result<string, AppError> {
  const parsed = Decimal.parse(valor);
  if (!parsed.ok) {
    return err(errors.rfTaxaInvalida());
  }

  const taxa = parsed.value;
  if (taxa.lt(TAXA_MINIMA) || taxa.gt(TAXA_MAXIMA)) {
    return err(errors.rfTaxaInvalida());
  }

  return ok(taxa.toFixed(ESCALA_TAXA));
}

/** Valor aplicado > 0; normalizado com 2 casas. */
export function validarValorAplicado(valor: string): Result<string, AppError> {
  const parsed = Decimal.parse(valor);
  if (!parsed.ok) {
    return err(campoInvalido("valorAplicado", "Valor aplicado inválido."));
  }

  const aplicado = parsed.value;
  if (!aplicado.isPositive() || aplicado.isZero()) {
    return err(campoInvalido("valorAplicado", "O valor aplicado deve ser maior que zero."));
  }

  return ok(aplicado.toFixed(ESCALA_MONETARIA));
}

/** Saldo atual >= 0; normalizado com 2 casas. */
export function validarSaldo(valor: string): Result<string, AppError> {
  const parsed = Decimal.parse(valor);
  if (!parsed.ok) {
    return err(errors.rfSaldoInvalido());
  }

  const saldo = parsed.value;
  if (saldo.isNegative()) {
    return err(errors.rfSaldoInvalido());
  }

  return ok(saldo.toFixed(ESCALA_MONETARIA));
}

/** Data obrigatória, existente no calendário e não futura. */
export function validarDataAplicacao(
  valor: string,
  hoje: string,
): Result<string, AppError> {
  if (!dataIsoValida(valor)) {
    return err(campoInvalido("dataAplicacao", "Data de aplicação inválida."));
  }

  // Comparação lexicográfica é segura para `YYYY-MM-DD`.
  if (valor > hoje) {
    return err(campoInvalido("dataAplicacao", "A data de aplicação não pode ser futura."));
  }

  return ok(valor);
}

/** Vencimento opcional, sempre posterior à aplicação (RN-057). */
export function validarVencimento(
  valor: string | null,
  dataAplicacao: string,
): Result<string | null, AppError> {
  if (valor === null) {
    return ok(null);
  }

  if (!dataIsoValida(valor)) {
    return err(campoInvalido("vencimento", "Data de vencimento inválida."));
  }

  if (valor <= dataAplicacao) {
    return err(errors.rfVencimentoInvalido());
  }

  return ok(valor);
}

/** Carência opcional, nunca anterior à aplicação (API_CONTRACTS.md §6.2). */
export function validarCarencia(
  valor: string | null,
  dataAplicacao: string,
): Result<string | null, AppError> {
  if (valor === null) {
    return ok(null);
  }

  if (!dataIsoValida(valor)) {
    return err(campoInvalido("carenciaAte", "Data de carência inválida."));
  }

  if (valor < dataAplicacao) {
    return err(campoInvalido("carenciaAte", "A carência não pode ser anterior à aplicação."));
  }

  return ok(valor);
}
