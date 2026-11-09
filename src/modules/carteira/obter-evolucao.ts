import { hojeIsoSaoPaulo } from "../../lib/datas";
import { isErr, ok, type Result } from "../../lib/result";
import type { AppError } from "../../lib/errors";
import {
  GRANULARIDADE_EVOLUCAO_PADRAO,
  inicioDoAno,
  montarEvolucaoCarteira,
  validarPeriodoEvolucao,
  type EvolucaoCarteira,
  type GranularidadeEvolucao,
} from "./evolucao-carteira";
import type { CarteiraRepositorio } from "./repositorio";

/**
 * Caso de uso da evolução patrimonial (RN-020, RN-062; API_CONTRACTS.md §5.2).
 *
 * Defaults: início do ano corrente até hoje, granularidade mensal — o "hoje" é
 * o do calendário de São Paulo. `de > ate` e granularidade inválida viram 422
 * com o campo correspondente.
 */

export interface ObterEvolucaoComando {
  readonly usuarioId: string;
  /** `YYYY-MM-DD`; default = início do ano corrente. */
  readonly de?: string;
  /** `YYYY-MM-DD`; default = hoje. */
  readonly ate?: string;
  readonly granularidade?: GranularidadeEvolucao;
}

export interface ObterEvolucaoDeps {
  readonly repositorio: CarteiraRepositorio;
  /** Injetável nos testes; default = agora. */
  readonly agora?: Date;
}

export async function obterEvolucao(
  comando: ObterEvolucaoComando,
  deps: ObterEvolucaoDeps,
): Promise<Result<EvolucaoCarteira, AppError>> {
  const agora = deps.agora ?? new Date();
  const hoje = hojeIsoSaoPaulo(agora);
  const de = comando.de ?? inicioDoAno(hoje);
  const ate = comando.ate ?? hoje;
  const granularidade = comando.granularidade ?? GRANULARIDADE_EVOLUCAO_PADRAO;

  const periodo = validarPeriodoEvolucao(de, ate, granularidade);
  if (isErr(periodo)) {
    return periodo;
  }

  const [saldoRendaFixa, movimentacoes] = await Promise.all([
    deps.repositorio.carregarSaldoRendaFixa(comando.usuarioId),
    deps.repositorio.listarMovimentacoes(comando.usuarioId, ate),
  ]);

  return ok(
    montarEvolucaoCarteira({
      de,
      ate,
      granularidade,
      movimentacoes,
      saldoRendaFixa,
    }),
  );
}
