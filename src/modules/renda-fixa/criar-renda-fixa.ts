import type { AppError } from "../../lib/errors";
import { ok, type Result } from "../../lib/result";
import { hojeIso } from "./datas";
import {
  type IndexadorRendaFixa,
  type InvestimentoRendaFixaRegistro,
  type LiquidezRendaFixa,
  type ProdutoRendaFixa,
  type RendaFixaRepositorio,
  type StatusSaldo,
} from "./repositorio";
import {
  derivarCoberturaFgc,
  normalizarTextoOpcional,
  validarCarencia,
  validarDataAplicacao,
  validarInstituicao,
  validarSaldo,
  validarTaxa,
  validarValorAplicado,
  validarVencimento,
} from "./validadores";

/**
 * Criação de título de renda fixa (RN-057-2; API_CONTRACTS.md §6.2).
 *
 * Ordem: instituição → data de aplicação (não futura) → taxa → vencimento →
 * valor aplicado → saldo → carência. `coberturaFgc` é derivada do produto
 * quando o cliente não a informa; a sobrescrita explícita é permitida porque a
 * regra do FGC muda por legislação (PEND-012).
 */

export interface CriarRendaFixaComando {
  readonly usuarioId: string;
  readonly instituicao: string;
  readonly produto: ProdutoRendaFixa;
  readonly indexador: IndexadorRendaFixa;
  readonly taxa: string;
  readonly dataAplicacao: string;
  readonly vencimento: string | null;
  readonly valorAplicado: string;
  readonly saldoAtual: string;
  readonly statusSaldo?: StatusSaldo;
  readonly liquidez: LiquidezRendaFixa;
  readonly carenciaAte: string | null;
  readonly coberturaFgc?: boolean;
  readonly observacoes: string | null;
  /** Injetável nos testes; default = hoje UTC. */
  readonly hoje?: string;
}

export interface CriarRendaFixaDeps {
  readonly repositorio: RendaFixaRepositorio;
}

export async function criarRendaFixa(
  comando: CriarRendaFixaComando,
  deps: CriarRendaFixaDeps,
): Promise<Result<InvestimentoRendaFixaRegistro, AppError>> {
  const instituicao = validarInstituicao(comando.instituicao);
  if (!instituicao.ok) {
    return instituicao;
  }

  const dataAplicacao = validarDataAplicacao(comando.dataAplicacao, comando.hoje ?? hojeIso());
  if (!dataAplicacao.ok) {
    return dataAplicacao;
  }

  const taxa = validarTaxa(comando.taxa);
  if (!taxa.ok) {
    return taxa;
  }

  const vencimento = validarVencimento(comando.vencimento, dataAplicacao.value);
  if (!vencimento.ok) {
    return vencimento;
  }

  const valorAplicado = validarValorAplicado(comando.valorAplicado);
  if (!valorAplicado.ok) {
    return valorAplicado;
  }

  const saldoAtual = validarSaldo(comando.saldoAtual);
  if (!saldoAtual.ok) {
    return saldoAtual;
  }

  const carenciaAte = validarCarencia(comando.carenciaAte, dataAplicacao.value);
  if (!carenciaAte.ok) {
    return carenciaAte;
  }

  const criado = await deps.repositorio.criar({
    usuarioId: comando.usuarioId,
    instituicao: instituicao.value,
    produto: comando.produto,
    indexador: comando.indexador,
    taxa: taxa.value,
    dataAplicacao: dataAplicacao.value,
    vencimento: vencimento.value,
    valorAplicado: valorAplicado.value,
    saldoAtual: saldoAtual.value,
    statusSaldo: comando.statusSaldo ?? "INFORMADO",
    liquidez: comando.liquidez,
    carenciaAte: carenciaAte.value,
    coberturaFgc: comando.coberturaFgc ?? derivarCoberturaFgc(comando.produto),
    observacoes: normalizarTextoOpcional(comando.observacoes),
  });

  return ok(criado);
}
