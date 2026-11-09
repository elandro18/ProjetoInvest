import { Decimal } from "../../lib/decimal";
import { errors, type AppError } from "../../lib/errors";
import { dataIsoValida, diasEntre } from "../../lib/datas";
import { err, ok, type Result } from "../../lib/result";
import type { ErroPosicao, TipoMovimentacao } from "../posicao/tipos";
import { validarValorTotal } from "../posicao/validacoes";
import { TIPOS_COM_QUANTIDADE } from "./repositorio";

/**
 * Validações de entrada da movimentação (RN-014, RN-018, RN-019).
 *
 * A forma (UUID, enum, tamanho) é validada pela borda com Zod; aqui ficam as
 * regras de negócio que precisam rodar também nos testes de caso de uso.
 */

const MAX_CHAVE_IDEMPOTENCIA = 64;
const MAX_OBSERVACOES = 1000;

export function validarTipo(tipo: string): Result<TipoMovimentacao, AppError> {
  const tipos: readonly string[] = [
    "COMPRA",
    "VENDA",
    "DIVIDENDO",
    "JUROS",
    "APLICACAO_RF",
    "RESGATE_RF",
    "TAXA",
  ];

  if (!tipos.includes(tipo)) {
    return err(errors.movTipoInvalido({ tipo }));
  }

  return ok(tipo as TipoMovimentacao);
}

/** Data do fato não pode passar de hoje + 1 dia (RN-014). */
export function validarDataMovimentacao(
  data: string,
  hoje: string,
): Result<string, AppError> {
  if (!dataIsoValida(data)) {
    return err(
      errors.validacao([{ field: "data", message: "Data inválida (use YYYY-MM-DD)." }]),
    );
  }

  if (!dataIsoValida(hoje)) {
    return err(
      errors.validacao([{ field: "hoje", message: "Data de referência inválida." }]),
    );
  }

  if (diasEntre(hoje, data) > 1) {
    return err(errors.movDataFutura({ data, limite: "hoje + 1 dia" }));
  }

  return ok(data);
}

export interface QuantidadeValidada {
  readonly quantidade: string | null;
  readonly valorUnitario: string | null;
}

/**
 * `COMPRA`/`VENDA` exigem quantidade e valor unitário positivos
 * (`MOV_QTD_OBRIGATORIA`). Nos demais tipos os campos são opcionais, mas,
 * quando informados, também precisam ser positivos para respeitar o CHECK.
 */
export function validarQuantidade(
  tipo: TipoMovimentacao,
  quantidade: string | null,
  valorUnitario: string | null,
): Result<QuantidadeValidada, AppError> {
  const exige = TIPOS_COM_QUANTIDADE.includes(tipo);

  if (quantidade === null || valorUnitario === null) {
    return exige
      ? err(errors.movQtdObrigatoria({ tipo }))
      : ok({ quantidade, valorUnitario });
  }

  const qtd = Decimal.parse(quantidade);
  if (!qtd.ok) {
    return err(
      errors.validacao([{ field: "quantidade", message: "Quantidade inválida." }]),
    );
  }

  const unitario = Decimal.parse(valorUnitario);
  if (!unitario.ok) {
    return err(
      errors.validacao([
        { field: "valorUnitario", message: "Valor unitário inválido." },
      ]),
    );
  }

  if (!qtd.value.isPositive() || qtd.value.isZero()) {
    return err(errors.movQtdObrigatoria({ tipo }));
  }

  if (!unitario.value.isPositive() || unitario.value.isZero()) {
    return err(errors.movQtdObrigatoria({ tipo }));
  }

  return ok({ quantidade: qtd.value.toFixed(8), valorUnitario: unitario.value.toFixed(2) });
}

export interface ValoresValidados {
  readonly valorTotal: string;
  readonly custos: string;
  readonly observacoes: string | null;
}

/**
 * Confere `valor_total = quantidade × valor_unitário + custos` com tolerância de
 * R$ 0,01 (RN-019). Diferença acima da tolerância só é aceita com observação.
 */
export function validarValores(
  quantidade: string | null,
  valorUnitario: string | null,
  valorTotal: string,
  custos: string,
  observacoes: string | null,
): Result<ValoresValidados, AppError> {
  const total = Decimal.parse(valorTotal);
  if (!total.ok) {
    return err(
      errors.validacao([{ field: "valorTotal", message: "Valor total inválido." }]),
    );
  }

  if (!total.value.isPositive() || total.value.isZero()) {
    return err(
      errors.validacao([
        { field: "valorTotal", message: "O valor total deve ser maior que zero." },
      ]),
    );
  }

  const custosParse = Decimal.parse(custos.length === 0 ? "0" : custos);
  if (!custosParse.ok) {
    return err(errors.validacao([{ field: "custos", message: "Custos inválidos." }]));
  }

  if (custosParse.value.isNegative()) {
    return err(
      errors.validacao([{ field: "custos", message: "Custos não podem ser negativos." }]),
    );
  }

  const observacao = observacoes?.trim() ?? "";
  if (observacao.length > MAX_OBSERVACOES) {
    return err(
      errors.validacao([
        { field: "observacoes", message: "Observações devem ter no máximo 1000 caracteres." },
      ]),
    );
  }

  const consistencia = validarValorTotal({
    quantidade,
    valorUnitario,
    custos: custosParse.value.toFixed(2),
    valorTotal: total.value.toFixed(2),
  });

  if (!consistencia.ok && observacao.length === 0) {
    return err(mapearErroDeConsistencia(consistencia.error));
  }

  return ok({
    valorTotal: total.value.toFixed(2),
    custos: custosParse.value.toFixed(2),
    observacoes: observacao.length === 0 ? null : observacao,
  });
}

function mapearErroDeConsistencia(erro: ErroPosicao): AppError {
  return errors.movValorInconsistente(erro.detalhes);
}

/** Normaliza a chave de idempotência; vazia vira `null` (sem idempotência). */
export function normalizarChaveIdempotencia(
  chave: string | null | undefined,
): Result<string | null, AppError> {
  if (chave === null || chave === undefined) {
    return ok(null);
  }

  const normalizada = chave.trim();
  if (normalizada.length === 0) {
    return ok(null);
  }

  if (normalizada.length > MAX_CHAVE_IDEMPOTENCIA) {
    return err(
      errors.validacao([
        {
          field: "Idempotency-Key",
          message: "A chave de idempotência deve ter no máximo 64 caracteres.",
        },
      ]),
    );
  }

  return ok(normalizada);
}
