import type { AppError } from "../../lib/errors";
import { ok, type Result } from "../../lib/result";
import type { ValorCarteira } from "../carteira/valor-carteira";
import { calcularConcentracao, type ConcentracaoCalculada } from "./concentracao";
import type {
  ConcentracaoRepositorio,
  LimiteConcentracaoRepositorio,
} from "./repositorio";

/**
 * Caso de uso da concentração atual (RN-049-3; API_CONTRACTS.md §12.1).
 *
 * A base de cálculo vem exclusivamente do port `ValorCarteira` (RN-089) — a
 * mesma fonte da carteira e da alocação. As três leituras são independentes e
 * partem do `usuarioId` da sessão: o repositório filtra por titular, então não
 * existe leitura cruzada entre contas.
 */

export interface ObterConcentracaoComando {
  readonly usuarioId: string;
}

export interface ConcentracaoDeps {
  readonly valorCarteira: ValorCarteira;
  readonly repositorio: ConcentracaoRepositorio;
  readonly limites: LimiteConcentracaoRepositorio;
}

export async function obterConcentracao(
  comando: ObterConcentracaoComando,
  deps: ConcentracaoDeps,
): Promise<Result<ConcentracaoCalculada, AppError>> {
  const [valores, dados, limites] = await Promise.all([
    deps.valorCarteira.agregar(comando.usuarioId),
    deps.repositorio.carregarDados(comando.usuarioId),
    deps.limites.listarVigentes(comando.usuarioId),
  ]);

  return ok(
    calcularConcentracao({
      total: valores.total,
      posicoes: dados.posicoes,
      titulos: dados.titulos,
      limites,
    }),
  );
}
