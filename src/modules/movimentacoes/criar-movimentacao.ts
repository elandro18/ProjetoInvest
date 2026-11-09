import { hojeIso } from "../../lib/datas";
import { errors, type AppError } from "../../lib/errors";
import { err, ok, type Result } from "../../lib/result";
import type { ErroPosicao, MovimentacaoParaPosicao, Posicao } from "../posicao/tipos";
import { erroConfirmacaoSemMotivo, erroRendaFixaSemVinculo, mapearErroPosicao } from "./erros";
import {
  aplicarSequenciaComNova,
  posicaoParaPersistida,
  reconstruirComExcecoes,
} from "./posicao";
import {
  CLASSE_RENDA_FIXA,
  MovimentacaoIdempotenteError,
  TIPOS_RENDA_FIXA,
  type MovimentacaoRegistro,
  type MovimentacaoRepositorio,
  type NovoRendimento,
} from "./repositorio";
import {
  normalizarChaveIdempotencia,
  validarDataMovimentacao,
  validarQuantidade,
  validarTipo,
  validarValores,
  type ValoresValidados,
} from "./validadores";

/**
 * Criação de movimentação (RN-014-3; API_CONTRACTS.md §4.2).
 *
 * Ordem das regras: tipo → renda fixa (PEND-017) → data → ativo do titular e
 * ativo → quantidade → consistência do total → aplicação no domínio →
 * transação de gravação. `Idempotency-Key` repetida devolve o mesmo recurso.
 */

export interface AuditoriaMovimentacao {
  /** AC-018b: motivo, usuário, instante e impacto da exceção confirmada. */
  registrarPosicaoNegativaConfirmada(dados: {
    readonly requestId?: string;
    readonly usuarioId: string;
    readonly ativoId: string;
    readonly movimentacaoId: string;
    readonly motivo: string;
    readonly impacto: string;
    readonly instante: string;
  }): void;
}

export interface CriarMovimentacaoComando {
  readonly usuarioId: string;
  readonly requestId?: string;
  readonly ativoId: string;
  readonly tipo: string;
  readonly data: string;
  readonly quantidade: string | null;
  readonly valorUnitario: string | null;
  readonly valorTotal: string;
  readonly custos: string;
  readonly observacoes: string | null;
  readonly idempotencyKey?: string | null;
  readonly confirmarPosicaoNegativa?: boolean;
  readonly motivo?: string | null;
  /** Injetável nos testes; default = hoje UTC. */
  readonly hoje?: string;
}

export interface CriarMovimentacaoDeps {
  readonly repositorio: MovimentacaoRepositorio;
  readonly auditoria: AuditoriaMovimentacao;
  /** Injetável nos testes para `criadoEm` determinístico. */
  readonly agora?: () => Date;
}

export interface ResultadoCriacaoMovimentacao {
  readonly movimentacao: MovimentacaoRegistro;
  readonly posicao: Posicao;
  /** `true` quando a chave já existia e o recurso foi devolvido sem duplicar. */
  readonly replay: boolean;
}

interface EntradaValidada {
  readonly valores: ValoresValidados;
  readonly chave: string | null;
  readonly nova: MovimentacaoParaPosicao;
}

export async function criarMovimentacao(
  comando: CriarMovimentacaoComando,
  deps: CriarMovimentacaoDeps,
): Promise<Result<ResultadoCriacaoMovimentacao, AppError>> {
  const agora = deps.agora?.() ?? new Date();
  const entrada = await validarEntrada(comando, deps, agora);
  if (!entrada.ok) {
    return entrada;
  }

  if (entrada.value.chave !== null) {
    const existente = await deps.repositorio.buscarPorIdempotencia(
      comando.usuarioId,
      entrada.value.chave,
    );
    if (existente !== null) {
      return replay(existente, comando, deps);
    }
  }

  const existentes = await deps.repositorio.listarParaPosicao(
    comando.usuarioId,
    comando.ativoId,
  );

  const aplicacao = resolverAplicacao(
    existentes,
    entrada.value.nova,
    comando.confirmarPosicaoNegativa === true,
    comando.motivo,
  );
  if (!aplicacao.ok) {
    return aplicacao;
  }

  const resultado = await persistir(entrada.value, aplicacao.value.posicao, comando, deps);
  if (resultado.ok && resultado.value.replay === false && aplicacao.value.excecao !== null) {
    auditarExcecao(resultado.value.movimentacao.id, aplicacao.value.excecao, comando, deps);
  }

  return resultado;
}

async function validarEntrada(
  comando: CriarMovimentacaoComando,
  deps: CriarMovimentacaoDeps,
  agora: Date,
): Promise<Result<EntradaValidada, AppError>> {
  const tipo = validarTipo(comando.tipo);
  if (!tipo.ok) {
    return tipo;
  }

  if (TIPOS_RENDA_FIXA.includes(tipo.value)) {
    return err(erroRendaFixaSemVinculo());
  }

  const data = validarDataMovimentacao(comando.data, comando.hoje ?? hojeIso(agora));
  if (!data.ok) {
    return data;
  }

  const chave = normalizarChaveIdempotencia(comando.idempotencyKey);
  if (!chave.ok) {
    return chave;
  }

  const ativo = await deps.repositorio.buscarAtivo(comando.usuarioId, comando.ativoId);
  if (ativo === null || ativo.status !== "ATIVO") {
    return err(errors.movAtivoInativo({ ativoId: comando.ativoId }));
  }

  if (ativo.classeCodigo === CLASSE_RENDA_FIXA) {
    return err(errors.movTipoInvalido({ tipo: tipo.value, classe: ativo.classeCodigo }));
  }

  const quantidade = validarQuantidade(
    tipo.value,
    comando.quantidade,
    comando.valorUnitario,
  );
  if (!quantidade.ok) {
    return quantidade;
  }

  const valores = validarValores(
    quantidade.value.quantidade,
    quantidade.value.valorUnitario,
    comando.valorTotal,
    comando.custos,
    comando.observacoes,
  );
  if (!valores.ok) {
    return valores;
  }

  return ok({
    valores: valores.value,
    chave: chave.value,
    nova: {
      id: `nova-${globalThis.crypto.randomUUID()}`,
      tipo: tipo.value,
      data: data.value,
      criadoEm: agora,
      quantidade: quantidade.value.quantidade,
      valorUnitario: quantidade.value.valorUnitario,
      valorTotal: valores.value.valorTotal,
      custos: valores.value.custos,
      canceladaEm: null,
    },
  });
}

interface AplicacaoValidada {
  readonly posicao: Posicao;
  /** Erro estrito da nova movimentação; `null` quando não houve exceção. */
  readonly excecao: ErroPosicao | null;
}

function resolverAplicacao(
  existentes: readonly MovimentacaoParaPosicao[],
  nova: MovimentacaoParaPosicao,
  confirmada: boolean,
  motivo: string | null | undefined,
): Result<AplicacaoValidada, AppError> {
  const estrito = aplicarSequenciaComNova(existentes, nova, false);
  if (estrito.ok) {
    return ok({ posicao: estrito.value.posicao, excecao: null });
  }

  if (!confirmada || estrito.error.codigo !== "MOV_POSICAO_NEGATIVA") {
    return err(mapearErroPosicao(estrito.error));
  }

  if ((motivo?.trim() ?? "").length === 0) {
    return err(erroConfirmacaoSemMotivo());
  }

  const permissivo = aplicarSequenciaComNova(existentes, nova, true);
  if (!permissivo.ok) {
    return err(mapearErroPosicao(permissivo.error));
  }

  return ok({ posicao: permissivo.value.posicao, excecao: estrito.error });
}

async function persistir(
  entrada: EntradaValidada,
  posicao: Posicao,
  comando: CriarMovimentacaoComando,
  deps: CriarMovimentacaoDeps,
): Promise<Result<ResultadoCriacaoMovimentacao, AppError>> {
  const { nova } = entrada;

  try {
    const criada = await deps.repositorio.criar({
      nova: {
        usuarioId: comando.usuarioId,
        ativoId: comando.ativoId,
        tipo: nova.tipo,
        data: nova.data,
        quantidade: nova.quantidade,
        valorUnitario: nova.valorUnitario,
        valorTotal: entrada.valores.valorTotal,
        custos: entrada.valores.custos,
        observacoes: entrada.valores.observacoes,
        idempotencyKey: entrada.chave,
        criadoEm: nova.criadoEm,
      },
      rendimento: montarRendimento(nova),
      posicao: posicaoParaPersistida(posicao),
    });

    return ok({ movimentacao: criada, posicao, replay: false });
  } catch (erro) {
    if (erro instanceof MovimentacaoIdempotenteError && entrada.chave !== null) {
      const existente = await deps.repositorio.buscarPorIdempotencia(
        comando.usuarioId,
        entrada.chave,
      );
      if (existente !== null) {
        return replay(existente, comando, deps);
      }
    }
    throw erro;
  }
}

function montarRendimento(nova: MovimentacaoParaPosicao): NovoRendimento | null {
  if (nova.tipo !== "DIVIDENDO" && nova.tipo !== "JUROS") {
    return null;
  }

  return {
    tipo: nova.tipo === "DIVIDENDO" ? "DIVIDENDO" : "JURO",
    dataPagamento: nova.data,
    competencia: nova.data.slice(0, 7),
    valor: nova.valorTotal,
    origem: "MANUAL",
  };
}

async function replay(
  existente: MovimentacaoRegistro,
  comando: CriarMovimentacaoComando,
  deps: CriarMovimentacaoDeps,
): Promise<Result<ResultadoCriacaoMovimentacao, AppError>> {
  const movimentacoes = await deps.repositorio.listarParaPosicao(
    comando.usuarioId,
    existente.ativo.id,
  );
  const posicao = reconstruirComExcecoes(movimentacoes);
  if (!posicao.ok) {
    return err(mapearErroPosicao(posicao.error));
  }

  return ok({ movimentacao: existente, posicao: posicao.value, replay: true });
}

function auditarExcecao(
  movimentacaoId: string,
  excecao: ErroPosicao,
  comando: CriarMovimentacaoComando,
  deps: CriarMovimentacaoDeps,
): void {
  const detalhes = excecao.detalhes;
  deps.auditoria.registrarPosicaoNegativaConfirmada({
    requestId: comando.requestId,
    usuarioId: comando.usuarioId,
    ativoId: comando.ativoId,
    movimentacaoId,
    motivo: comando.motivo?.trim() ?? "",
    impacto: `atual=${detalhes.quantidadeAtual ?? "?"} solicitada=${detalhes.quantidadeSolicitada ?? "?"} resultante=${detalhes.quantidadeResultante ?? "?"}`,
    instante: new Date().toISOString(),
  });
}
