import { hojeIsoSaoPaulo, isoParaData } from "../../lib/datas";
import { Decimal } from "../../lib/decimal";
import { errors, type AppError } from "../../lib/errors";
import { err, ok, type Result } from "../../lib/result";
import { calcularItensDesvio } from "../alocacao/calcular-desvios";
import { obterMetas } from "../alocacao/obter-metas";
import type { AlocacaoMetaRepositorio } from "../alocacao/repositorio";
import type { ValorCarteira } from "../carteira/valor-carteira";
import type { LimiteConcentracaoRepositorio } from "../risco/repositorio";
import { avaliarCandidato } from "./checklist";
import { calcularDistribuicao, formatarMoeda } from "./motor";
import type { AporteRepositorio, CandidatoAporte } from "./repositorio";
import type {
  AtivoAvaliado,
  DistribuicaoAtual,
  DistribuicaoSugerida,
  LinhaDistribuicaoAtual,
  SugestaoAporteRegistro,
} from "./tipos";

/**
 * Criação e persistência da sugestão de aporte (RN-025, RN-027, RN-052;
 * RN-025-4; API_CONTRACTS.md §8.1).
 *
 * Composição: carteira + metas (lazy por RN-021) → desvios → motor de
 * priorização → checklist dos candidatos → snapshot completo. O domínio não
 * conhece Prisma: as leituras e a gravação vêm dos ports injetados.
 *
 * Metas ausentes criam os defaults (RN-021); o 409 `APORTE_DADOS_INSUFICIENTES`
 * fica restrito ao catálogo vazio — sem classes/segmentos não há distribuição.
 */

const ESCALA_PERCENTUAL = 6;

export interface CriarSugestaoComando {
  readonly usuarioId: string;
  /** Valor disponível como string decimal (`"1000.00"`). */
  readonly valorDisponivel: string;
  /** Data de negócio `YYYY-MM-DD`; default = hoje em São Paulo. */
  readonly data?: string;
}

export interface CriarSugestaoDeps {
  readonly valorCarteira: ValorCarteira;
  readonly metas: AlocacaoMetaRepositorio;
  readonly limites: LimiteConcentracaoRepositorio;
  readonly repositorio: AporteRepositorio;
  /** Injetável nos testes; default = agora. */
  readonly agora?: Date;
}

function percentualAtual(valor: Decimal, total: Decimal): string {
  const percentual = total.isZero()
    ? Decimal.zero(ESCALA_PERCENTUAL)
    : valor.mul("100").div(total, ESCALA_PERCENTUAL);
  return percentual.toFixed(ESCALA_PERCENTUAL);
}

function montarDistribuicaoAtual(
  classes: readonly { readonly codigo: string; readonly valor: Decimal }[],
  segmentos: readonly { readonly codigo: string; readonly valor: Decimal }[],
  total: Decimal,
): DistribuicaoAtual {
  const linha = (item: { codigo: string; valor: Decimal }): LinhaDistribuicaoAtual => ({
    codigo: item.codigo,
    percentual: percentualAtual(item.valor, total),
  });

  return {
    classe: classes.map(linha),
    segmento: segmentos.map(linha),
  };
}

function montarAlertas(
  candidatos: readonly CandidatoAporte[],
  segmentosSugeridos: readonly { readonly codigo: string; readonly valor: string }[],
  quantidadeLimites: number,
): string[] {
  const alertas: string[] = [];

  for (const segmento of segmentosSugeridos) {
    if (!Decimal.from(segmento.valor).gt("0")) {
      continue;
    }

    const temAtivo = candidatos.some(
      (candidato) =>
        candidato.status === "ATIVO" && candidato.segmentoCodigo === segmento.codigo,
    );
    if (!temAtivo) {
      alertas.push(
        `Segmento ${segmento.codigo} recebe ${formatarMoeda(Decimal.from(segmento.valor))} e não tem ativo cadastrado para estudo.`,
      );
    }
  }

  if (candidatos.length === 0) {
    alertas.push(
      "Nenhum ativo cadastrado: a sugestão traz apenas a distribuição por classe e segmento.",
    );
  }

  if (quantidadeLimites === 0) {
    alertas.push(
      "Nenhum limite de concentração configurado: a verificação de concentração fica indisponível.",
    );
  }

  return alertas;
}

export async function criarSugestaoAporte(
  comando: CriarSugestaoComando,
  deps: CriarSugestaoDeps,
): Promise<Result<SugestaoAporteRegistro, AppError>> {
  const valor = Decimal.parse(comando.valorDisponivel);
  if (!valor.ok || !valor.value.gt("0")) {
    return err(errors.aporteValorInvalido({ campo: "valorDisponivel" }));
  }

  const valorAporte = valor.value.round(2);
  const agora = deps.agora ?? new Date();
  const hoje = comando.data ?? hojeIsoSaoPaulo(agora);

  const referencias = await deps.metas.listarReferencias();
  if (referencias.classes.length === 0 && referencias.segmentos.length === 0) {
    return err(errors.aporteDadosInsuficientes({ motivo: "catalogo_vazio" }));
  }

  const consultaMetas = await obterMetas(
    { usuarioId: comando.usuarioId, hoje },
    { repositorio: deps.metas },
  );
  if (!consultaMetas.ok) {
    return err(
      errors.aporteDadosInsuficientes({ motivo: consultaMetas.error.code }),
    );
  }

  const { vigente } = consultaMetas.value;
  if (vigente.classe.length === 0) {
    return err(errors.aporteDadosInsuficientes({ motivo: "sem_classes" }));
  }

  const [valores, limites, candidatos] = await Promise.all([
    deps.valorCarteira.agregar(comando.usuarioId),
    deps.limites.listarVigentes(comando.usuarioId),
    deps.repositorio.listarCandidatos(comando.usuarioId),
  ]);

  const totalAtual = Decimal.from(valores.total);
  const classeValorPorId = new Map(
    valores.classes.map((classe) => [classe.id, Decimal.from(classe.valor)]),
  );
  const segmentoValorPorId = new Map(
    valores.segmentos.map((segmento) => [segmento.id, Decimal.from(segmento.valor)]),
  );

  const classesMotor = vigente.classe.map((meta) => ({
    codigo: meta.codigo,
    nome: meta.nome,
    valorAtual: (classeValorPorId.get(meta.referenciaId) ?? Decimal.zero(2)).toFixed(2),
    percentualMeta: meta.percentual,
  }));
  const segmentosMotor = vigente.segmento.map((meta) => ({
    codigo: meta.codigo,
    nome: meta.nome,
    valorAtual: (segmentoValorPorId.get(meta.referenciaId) ?? Decimal.zero(2)).toFixed(2),
    percentualMeta: meta.percentual,
  }));

  const distribuicao = calcularDistribuicao({
    totalAtual: valores.total,
    valorAporte: valorAporte.toFixed(2),
    classes: classesMotor,
    segmentos: segmentosMotor,
  });

  const desvios = calcularItensDesvio(
    [...vigente.classe, ...vigente.segmento],
    valores,
  );
  const desvioClasse = new Map(
    desvios
      .filter((item) => item.escopo === "CLASSE")
      .map((item) => [item.codigo, item.desvioPontos]),
  );
  const desvioSegmento = new Map(
    desvios
      .filter((item) => item.escopo === "SEGMENTO")
      .map((item) => [item.codigo, item.desvioPontos]),
  );

  const valorSegmentoAtual = new Map(
    vigente.segmento.map((meta) => [
      meta.referenciaId,
      (segmentoValorPorId.get(meta.referenciaId) ?? Decimal.zero(2)).toFixed(2),
    ]),
  );
  const aporteSegmento = new Map(
    distribuicao.segmentos.map((segmento) => [segmento.codigo, segmento.valor]),
  );

  const ativosAvaliados: AtivoAvaliado[] = candidatos.map((candidato) => {
    const avaliacao = avaliarCandidato(candidato, {
      totalAtual: valores.total,
      totalPosAporte: distribuicao.totalPosAporte,
      desvioClasse,
      desvioSegmento,
      valorSegmentoAtual,
      aporteSegmento,
      limites,
    });

    return {
      ativoId: candidato.ativoId,
      ticker: candidato.ticker,
      nome: candidato.nome,
      classe: candidato.classeCodigo,
      segmento: candidato.segmentoCodigo,
      classificacao: avaliacao.classificacao,
      checklist: avaliacao.checklist,
      motivos: avaliacao.motivos,
    };
  });

  const distribuicaoAtual = montarDistribuicaoAtual(
    vigente.classe.map((meta) => ({
      codigo: meta.codigo,
      valor: classeValorPorId.get(meta.referenciaId) ?? Decimal.zero(2),
    })),
    vigente.segmento.map((meta) => ({
      codigo: meta.codigo,
      valor: segmentoValorPorId.get(meta.referenciaId) ?? Decimal.zero(2),
    })),
    totalAtual,
  );

  const distribuicaoSugerida: DistribuicaoSugerida = {
    classe: distribuicao.classes,
    segmento: distribuicao.segmentos,
  };

  const justificativas = [
    ...distribuicao.classes
      .filter((linha) => Decimal.from(linha.valor).gt("0"))
      .map((linha) => linha.justificativa),
    ...distribuicao.segmentos
      .filter((linha) => Decimal.from(linha.valor).gt("0"))
      .map((linha) => linha.justificativa),
  ];

  const registro = await deps.repositorio.criar({
    usuarioId: comando.usuarioId,
    data: comando.data === undefined ? agora : isoParaData(comando.data),
    valorDisponivel: valorAporte.toFixed(2),
    distribuicaoAtual,
    distribuicaoSugerida,
    ativosAvaliados,
    justificativas,
    alertas: montarAlertas(candidatos, distribuicao.segmentos, limites.length),
  });

  return ok(registro);
}
