import { Decimal } from "../../lib/decimal";
import { errors, type AppError } from "../../lib/errors";
import { err, ok, type Result } from "../../lib/result";
import {
  BASE_CALCULO_PATRIMONIO_TOTAL,
  type BaseCalculo,
  type ValorCarteira,
  type ValoresCarteira,
} from "../carteira/valor-carteira";
import { classificarDesvio, type SituacaoDesvio } from "./metas";
import { montarVigente } from "./obter-metas";
import type { AlocacaoMetaRepositorio, EscopoMeta, MetaRegistro } from "./repositorio";

/**
 * Cálculo de desvios de alocação (RN-021-3, RN-023, RN-024, RN-089, RN-090).
 *
 * Base de cálculo: patrimônio total para classes E segmentos (RN-089) —
 * "Caixa e Oportunidades" é um segmento como os demais. O valor agregado vem
 * do port `ValorCarteira` (reutilizado pela RN-020), não do Prisma diretamente.
 *
 * Sem cotação de mercado, FII entra pelo custo e é marcado `valorIndisponivel`
 * (RN-091); a renda fixa entra pelo saldo. Sem patrimônio, o percentual é 0 e a
 * situação é `ABAIXO` — nunca se divide por zero nem se inventa −100%.
 */

export interface ItemDesvio {
  readonly escopo: EscopoMeta;
  readonly codigo: string;
  /** Percentual atual com 6 casas. */
  readonly percentualAtual: string;
  /** Meta com 6 casas. */
  readonly percentualMeta: string;
  /** Atual − meta, em pontos percentuais, com 6 casas. */
  readonly desvioPontos: string;
  /** Valor que falta para a meta, com 2 casas; `"0.00"` quando não falta. */
  readonly valorParaMeta: string;
  readonly situacao: SituacaoDesvio;
  /** `true` quando o valor atual é custo/saldo, sem cotação (RN-091). */
  readonly valorIndisponivel: boolean;
}

export interface DesviosAlocacao {
  readonly baseCalculo: BaseCalculo;
  readonly itens: readonly ItemDesvio[];
}

export interface CalcularDesviosComando {
  readonly usuarioId: string;
}

export interface CalcularDesviosDeps {
  readonly repositorio: AlocacaoMetaRepositorio;
  readonly valorCarteira: ValorCarteira;
}

interface ValorResolvido {
  readonly valor: Decimal;
  readonly valorIndisponivel: boolean;
}

function indexar(
  valores: readonly { readonly id: string; readonly valor: string; readonly valorIndisponivel: boolean }[],
): Map<string, ValorResolvido> {
  return new Map(
    valores.map((item) => [
      item.id,
      { valor: Decimal.from(item.valor), valorIndisponivel: item.valorIndisponivel },
    ]),
  );
}

function calcularItem(
  meta: MetaRegistro,
  total: Decimal,
  valores: ReadonlyMap<string, ValorResolvido>,
): ItemDesvio {
  const percentualMeta = Decimal.from(meta.percentual);
  const resolvido = valores.get(meta.referenciaId);
  const valor = resolvido?.valor ?? Decimal.from("0.00");
  const valorIndisponivel =
    resolvido?.valorIndisponivel ?? (meta.escopo === "SEGMENTO" ? true : false);

  // Carteira vazia: não há denominador. Percentual 0, situação ABAIXO e nada a
  // sugerir — o valor para meta só faz sentido depois de existir patrimônio.
  if (total.isZero()) {
    return {
      escopo: meta.escopo,
      codigo: meta.codigo,
      percentualAtual: Decimal.zero(6).toFixed(6),
      percentualMeta: percentualMeta.toFixed(6),
      desvioPontos: Decimal.zero(6).sub(percentualMeta).toFixed(6),
      valorParaMeta: "0.00",
      situacao: "ABAIXO",
      valorIndisponivel,
    };
  }

  const percentualAtual = valor.mul("100").div(total, 6);
  const desvio = percentualAtual.sub(percentualMeta).round(6);
  const situacao = classificarDesvio(desvio);

  let valorParaMeta = "0.00";
  if (situacao === "ABAIXO") {
    const alvo = total.mul(percentualMeta).div("100", 6);
    const faltante = alvo.sub(valor);
    valorParaMeta = faltante.isPositive() ? faltante.round(2).toFixed(2) : "0.00";
  }

  return {
    escopo: meta.escopo,
    codigo: meta.codigo,
    percentualAtual: percentualAtual.toFixed(6),
    percentualMeta: percentualMeta.toFixed(6),
    desvioPontos: desvio.toFixed(6),
    valorParaMeta,
    situacao,
    valorIndisponivel,
  };
}

export function calcularItensDesvio(
  metas: readonly MetaRegistro[],
  carteira: ValoresCarteira,
): readonly ItemDesvio[] {
  const total = Decimal.from(carteira.total);
  const classes = indexar(carteira.classes);
  const segmentos = indexar(carteira.segmentos);
  const vigente = montarVigente(metas);

  return [...vigente.classe, ...vigente.segmento].map((meta) =>
    calcularItem(meta, total, meta.escopo === "CLASSE" ? classes : segmentos),
  );
}

export async function calcularDesvios(
  comando: CalcularDesviosComando,
  deps: CalcularDesviosDeps,
): Promise<Result<DesviosAlocacao, AppError>> {
  const metas = await deps.repositorio.listarTodas(comando.usuarioId);

  if (metas.every((meta) => meta.vigenciaFim !== null)) {
    return err(errors.aloMetasAusentes());
  }

  const carteira = await deps.valorCarteira.agregar(comando.usuarioId);

  return ok({
    baseCalculo: BASE_CALCULO_PATRIMONIO_TOTAL,
    itens: calcularItensDesvio(metas, carteira),
  });
}

