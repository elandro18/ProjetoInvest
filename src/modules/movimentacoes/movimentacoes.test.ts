import { describe, expect, it } from "vitest";

import { Decimal } from "../../lib/decimal";
import { AppError } from "../../lib/errors";
import { isErr, isOk } from "../../lib/result";
import type { MovimentacaoParaPosicao, TipoMovimentacao } from "../posicao/tipos";
import { apresentarMovimentacao, apresentarPosicao } from "./apresentacao";
import {
  cancelarMovimentacao,
  type CancelarMovimentacaoComando,
} from "./cancelar-movimentacao";
import {
  criarMovimentacao,
  type AuditoriaMovimentacao,
  type CriarMovimentacaoComando,
} from "./criar-movimentacao";
import { mapearErroPosicao } from "./erros";
import { listarMovimentacoes } from "./listar-movimentacoes";
import {
  MovimentacaoIdempotenteError,
  type AtivoMovimentacaoRef,
  type DadosCriacaoMovimentacao,
  type FiltroMovimentacoes,
  type MovimentacaoRegistro,
  type MovimentacaoRepositorio,
  type NovoRendimento,
  type PaginaMovimentacoes,
  type PosicaoPersistida,
} from "./repositorio";
import {
  normalizarChaveIdempotencia,
  validarDataMovimentacao,
  validarQuantidade,
  validarValores,
} from "./validadores";

/**
 * Casos de uso de movimentação (RN-014-3/RN-014-4) com repositório em memória.
 *
 * Nenhum teste toca o Postgres: o port é implementado por um fake que espelha
 * escopo por titular, filtros, ordenação e paginação do Prisma.
 */

const AGORA = new Date("2026-11-09T12:00:00.000Z");
const HOJE = "2026-11-09";
const AMANHA = "2026-11-10";
const DEPOIS_DE_AMANHA = "2026-11-11";
const USUARIO_A = "usuario-a";
const USUARIO_B = "usuario-b";
const ATIVO_A = "ativo-a";
const ATIVO_A2 = "ativo-a2";
const ATIVO_RF = "ativo-rf";

interface AtivoArmazenado extends AtivoMovimentacaoRef {
  readonly usuarioId: string;
}

interface MovArmazenada extends MovimentacaoRegistro {
  readonly usuarioId: string;
  readonly ativoId: string;
}

interface RendimentoArmazenado extends NovoRendimento {
  readonly movimentacaoId: string;
}

class RepositorioMemoria implements MovimentacaoRepositorio {
  readonly ativos = new Map<string, AtivoArmazenado>();
  readonly movimentacoes: MovArmazenada[] = [];
  readonly rendimentos: RendimentoArmazenado[] = [];
  readonly posicoes = new Map<string, PosicaoPersistida>();
  simularCorrida = false;
  simularCancelamentoPerdido = false;

  private sequencia = 0;
  private corridaConsumida = false;

  adicionarAtivo(ativo: AtivoArmazenado): void {
    this.ativos.set(ativo.id, ativo);
  }

  /** Pré-grava uma movimentação (usado para simular a corrida de idempotência). */
  semear(movimentacao: MovArmazenada): void {
    this.movimentacoes.push(movimentacao);
  }

  async buscarAtivo(usuarioId: string, ativoId: string): Promise<AtivoMovimentacaoRef | null> {
    const ativo = this.ativos.get(ativoId);
    return ativo !== undefined && ativo.usuarioId === usuarioId ? ativo : null;
  }

  async buscarPorIdempotencia(
    usuarioId: string,
    idempotencyKey: string,
  ): Promise<MovimentacaoRegistro | null> {
    if (this.simularCorrida && !this.corridaConsumida) {
      this.corridaConsumida = true;
      return null;
    }

    return (
      this.movimentacoes.find(
        (item) => item.usuarioId === usuarioId && item.idempotencyKey === idempotencyKey,
      ) ?? null
    );
  }

  async listarParaPosicao(
    usuarioId: string,
    ativoId: string,
  ): Promise<readonly MovimentacaoParaPosicao[]> {
    return this.movimentacoes
      .filter(
        (item) =>
          item.usuarioId === usuarioId && item.ativoId === ativoId && item.canceladaEm === null,
      )
      .map((item) => ({
        id: item.id,
        tipo: item.tipo,
        data: item.data,
        criadoEm: item.criadoEm,
        quantidade: item.quantidade,
        valorUnitario: item.valorUnitario,
        valorTotal: item.valorTotal,
        custos: item.custos,
        canceladaEm: item.canceladaEm,
      }));
  }

  async criar(dados: DadosCriacaoMovimentacao): Promise<MovimentacaoRegistro> {
    const { nova } = dados;
    const ativo = this.ativos.get(nova.ativoId);
    if (ativo === undefined) {
      throw new Error("ativo inexistente no fake");
    }

    if (
      nova.idempotencyKey !== null &&
      this.movimentacoes.some(
        (item) =>
          item.usuarioId === nova.usuarioId && item.idempotencyKey === nova.idempotencyKey,
      )
    ) {
      throw new MovimentacaoIdempotenteError();
    }

    const movimentacao: MovArmazenada = {
      id: `mov-${++this.sequencia}`,
      usuarioId: nova.usuarioId,
      ativoId: nova.ativoId,
      ativo: { id: ativo.id, ticker: ativo.ticker },
      tipo: nova.tipo,
      data: nova.data,
      quantidade: nova.quantidade,
      valorUnitario: nova.valorUnitario,
      valorTotal: nova.valorTotal,
      custos: nova.custos,
      observacoes: nova.observacoes,
      canceladaEm: null,
      cancelamentoMotivo: null,
      idempotencyKey: nova.idempotencyKey,
      criadoEm: nova.criadoEm,
    };

    this.movimentacoes.push(movimentacao);

    if (dados.rendimento !== null) {
      this.rendimentos.push({ ...dados.rendimento, movimentacaoId: movimentacao.id });
    }

    const chavePosicao = `${nova.usuarioId}:${nova.ativoId}`;
    if (dados.posicao === null) {
      this.posicoes.delete(chavePosicao);
    } else {
      this.posicoes.set(chavePosicao, dados.posicao);
    }

    return movimentacao;
  }

  async listar(filtro: FiltroMovimentacoes): Promise<PaginaMovimentacoes> {
    const filtradas = this.movimentacoes.filter((item) => {
      if (item.usuarioId !== filtro.usuarioId) return false;
      if (!filtro.incluirCanceladas && item.canceladaEm !== null) return false;
      if (filtro.ativoId !== undefined && item.ativoId !== filtro.ativoId) return false;
      if (filtro.tipo !== undefined && item.tipo !== filtro.tipo) return false;
      if (filtro.de !== undefined && item.data < filtro.de) return false;
      if (filtro.ate !== undefined && item.data > filtro.ate) return false;
      return true;
    });

    filtradas.sort((a, b) => {
      const comparacao =
        filtro.sort === "data"
          ? a.data.localeCompare(b.data)
          : filtro.sort === "criadoEm"
            ? a.criadoEm.getTime() - b.criadoEm.getTime()
            : Decimal.from(a.valorTotal).compare(b.valorTotal);

      return filtro.order === "asc" ? comparacao : -comparacao;
    });

    const inicio = (filtro.page - 1) * filtro.pageSize;
    return {
      itens: filtradas.slice(inicio, inicio + filtro.pageSize),
      total: filtradas.length,
    };
  }

  async buscarPorId(
    usuarioId: string,
    movimentacaoId: string,
  ): Promise<MovimentacaoRegistro | null> {
    return (
      this.movimentacoes.find(
        (item) => item.usuarioId === usuarioId && item.id === movimentacaoId,
      ) ?? null
    );
  }

  async cancelar(
    usuarioId: string,
    movimentacaoId: string,
    motivo: string,
    posicao: PosicaoPersistida | null,
    canceladaEm: Date,
  ): Promise<MovimentacaoRegistro | null> {
    if (this.simularCancelamentoPerdido) {
      return null;
    }

    const movimentacao = this.movimentacoes.find(
      (item) =>
        item.usuarioId === usuarioId &&
        item.id === movimentacaoId &&
        item.canceladaEm === null,
    );

    if (movimentacao === undefined) {
      return null;
    }

    const atualizada: MovArmazenada = {
      ...movimentacao,
      canceladaEm,
      cancelamentoMotivo: motivo,
    };
    const indice = this.movimentacoes.indexOf(movimentacao);
    this.movimentacoes[indice] = atualizada;

    const chavePosicao = `${usuarioId}:${movimentacao.ativoId}`;
    if (posicao === null) {
      this.posicoes.delete(chavePosicao);
    } else {
      this.posicoes.set(chavePosicao, posicao);
    }

    return atualizada;
  }
}

function repositorioComAtivos(): RepositorioMemoria {
  const repositorio = new RepositorioMemoria();
  repositorio.adicionarAtivo({
    id: ATIVO_A,
    usuarioId: USUARIO_A,
    ticker: "HGLG11",
    status: "ATIVO",
    classeCodigo: "FII",
  });
  repositorio.adicionarAtivo({
    id: ATIVO_A2,
    usuarioId: USUARIO_A,
    ticker: "KNRI11",
    status: "INATIVO",
    classeCodigo: "FII",
  });
  repositorio.adicionarAtivo({
    id: ATIVO_RF,
    usuarioId: USUARIO_A,
    ticker: "TESOURO",
    status: "ATIVO",
    classeCodigo: "RENDA_FIXA",
  });
  return repositorio;
}

interface AuditoriaFake {
  readonly chamadas: Parameters<
    AuditoriaMovimentacao["registrarPosicaoNegativaConfirmada"]
  >[0][];
  readonly auditoria: AuditoriaMovimentacao;
}

function auditoriaFake(): AuditoriaFake {
  const chamadas: AuditoriaFake["chamadas"] = [];
  return {
    chamadas,
    auditoria: {
      registrarPosicaoNegativaConfirmada(dados) {
        chamadas.push(dados);
      },
    },
  };
}

function deps(repositorio: RepositorioMemoria, auditoria: AuditoriaFake = auditoriaFake()) {
  return { repositorio, auditoria: auditoria.auditoria, agora: () => AGORA };
}

interface ComandoParcial {
  readonly usuarioId?: string;
  readonly ativoId?: string;
  readonly tipo?: TipoMovimentacao;
  readonly data?: string;
  readonly quantidade?: string | null;
  readonly valorUnitario?: string | null;
  readonly valorTotal?: string;
  readonly custos?: string;
  readonly observacoes?: string | null;
  readonly idempotencyKey?: string | null;
  readonly confirmarPosicaoNegativa?: boolean;
  readonly motivo?: string | null;
}

function comando(overrides: ComandoParcial = {}): CriarMovimentacaoComando {
  return {
    usuarioId: USUARIO_A,
    ativoId: ATIVO_A,
    tipo: "COMPRA",
    data: HOJE,
    quantidade: "10",
    valorUnitario: "100.00",
    valorTotal: "1000.00",
    custos: "0.00",
    observacoes: null,
    idempotencyKey: null,
    confirmarPosicaoNegativa: false,
    motivo: null,
    hoje: HOJE,
    ...overrides,
  };
}

async function compra(
  repositorio: RepositorioMemoria,
  overrides: ComandoParcial = {},
): Promise<MovimentacaoRegistro> {
  const resultado = await criarMovimentacao(comando(overrides), deps(repositorio));
  if (isErr(resultado)) {
    throw resultado.error;
  }
  return resultado.value.movimentacao;
}

function esperarCodigo(resultado: { ok: boolean; error?: AppError }, codigo: string): void {
  expect(resultado.ok).toBe(false);
  expect(resultado.error?.code).toBe(codigo);
}

describe("criação de movimentação (RN-014-3)", () => {
  it("G1 — duas compras calculam preço médio ponderado e persistem a posição", async () => {
    const repositorio = repositorioComAtivos();

    const primeira = await criarMovimentacao(comando(), deps(repositorio));
    expect(isOk(primeira)).toBe(true);
    if (primeira.ok) {
      expect(primeira.value.replay).toBe(false);
      expect(apresentarPosicao(primeira.value.posicao)).toEqual({
        quantidade: "10.00000000",
        precoMedio: "100.000000",
        custoTotal: "1000.00",
      });
    }

    const segunda = await criarMovimentacao(
      comando({ data: AMANHA, valorUnitario: "120.00", valorTotal: "1200.00" }),
      deps(repositorio),
    );
    expect(isOk(segunda)).toBe(true);
    if (segunda.ok) {
      expect(apresentarPosicao(segunda.value.posicao)).toEqual({
        quantidade: "20.00000000",
        precoMedio: "110.000000",
        custoTotal: "2200.00",
      });
    }

    expect(repositorio.posicoes.get(`${USUARIO_A}:${ATIVO_A}`)).toEqual({
      quantidade: "20.00000000",
      precoMedio: "110.000000",
      custoTotal: "2200.00",
    });
  });

  it("replay da mesma Idempotency-Key devolve o mesmo recurso sem duplicar", async () => {
    const repositorio = repositorioComAtivos();
    const chave = "8b5c0e3a-9e0b-4f25-9a7d-2f5a1b7c9d10";

    const primeira = await criarMovimentacao(comando({ idempotencyKey: chave }), deps(repositorio));
    const segunda = await criarMovimentacao(comando({ idempotencyKey: chave }), deps(repositorio));

    expect(isOk(primeira) && isOk(segunda)).toBe(true);
    if (primeira.ok && segunda.ok) {
      expect(primeira.value.replay).toBe(false);
      expect(segunda.value.replay).toBe(true);
      expect(segunda.value.movimentacao.id).toBe(primeira.value.movimentacao.id);
    }

    expect(repositorio.movimentacoes).toHaveLength(1);
  });

  it("corrida de idempotência: índice único vira replay do recurso já gravado", async () => {
    const repositorio = repositorioComAtivos();
    const chave = "corrida-1";

    repositorio.semear({
      id: "mov-existente",
      usuarioId: USUARIO_A,
      ativoId: ATIVO_A,
      ativo: { id: ATIVO_A, ticker: "HGLG11" },
      tipo: "COMPRA",
      data: HOJE,
      quantidade: "10.00000000",
      valorUnitario: "100.00",
      valorTotal: "1000.00",
      custos: "0.00",
      observacoes: null,
      canceladaEm: null,
      cancelamentoMotivo: null,
      idempotencyKey: chave,
      criadoEm: AGORA,
    });
    repositorio.simularCorrida = true;

    const resultado = await criarMovimentacao(
      comando({ idempotencyKey: chave }),
      deps(repositorio),
    );

    expect(isOk(resultado)).toBe(true);
    if (resultado.ok) {
      expect(resultado.value.replay).toBe(true);
      expect(resultado.value.movimentacao.id).toBe("mov-existente");
    }
    expect(repositorio.movimentacoes).toHaveLength(1);
  });

  it("dividendo grava rendimento MANUAL e não altera o preço médio", async () => {
    const repositorio = repositorioComAtivos();
    await compra(repositorio);

    const resultado = await criarMovimentacao(
      comando({
        tipo: "DIVIDENDO",
        data: AMANHA,
        quantidade: null,
        valorUnitario: null,
        valorTotal: "50.00",
      }),
      deps(repositorio),
    );

    expect(isOk(resultado)).toBe(true);
    if (resultado.ok) {
      expect(apresentarPosicao(resultado.value.posicao)).toEqual({
        quantidade: "10.00000000",
        precoMedio: "100.000000",
        custoTotal: "1000.00",
      });
    }

    expect(repositorio.rendimentos).toHaveLength(1);
    expect(repositorio.rendimentos[0]).toMatchObject({
      tipo: "DIVIDENDO",
      dataPagamento: AMANHA,
      competencia: "2026-11",
      valor: "50.00",
      origem: "MANUAL",
      movimentacaoId: resultado.ok ? resultado.value.movimentacao.id : "",
    });
  });

  it("juros grava rendimento do tipo JURO", async () => {
    const repositorio = repositorioComAtivos();
    await compra(repositorio);

    const resultado = await criarMovimentacao(
      comando({
        tipo: "JUROS",
        data: AMANHA,
        quantidade: null,
        valorUnitario: null,
        valorTotal: "12.34",
      }),
      deps(repositorio),
    );

    expect(isOk(resultado)).toBe(true);
    expect(repositorio.rendimentos).toHaveLength(1);
    expect(repositorio.rendimentos[0]?.tipo).toBe("JURO");
    expect(repositorio.rendimentos[0]?.valor).toBe("12.34");
  });

  it("taxa não altera a posição nem cria rendimento", async () => {
    const repositorio = repositorioComAtivos();
    await compra(repositorio);

    const resultado = await criarMovimentacao(
      comando({
        tipo: "TAXA",
        data: AMANHA,
        quantidade: null,
        valorUnitario: null,
        valorTotal: "3.00",
      }),
      deps(repositorio),
    );

    expect(isOk(resultado)).toBe(true);
    if (resultado.ok) {
      expect(apresentarPosicao(resultado.value.posicao)).toEqual({
        quantidade: "10.00000000",
        precoMedio: "100.000000",
        custoTotal: "1000.00",
      });
    }
    expect(repositorio.rendimentos).toHaveLength(0);
  });

  it("G5 — venda acima da posição sem confirmação retorna 409 e nada é gravado", async () => {
    const repositorio = repositorioComAtivos();
    await compra(repositorio);

    const resultado = await criarMovimentacao(
      comando({ tipo: "VENDA", data: AMANHA, quantidade: "15", valorTotal: "1500.00" }),
      deps(repositorio),
    );

    esperarCodigo(resultado, "MOV_POSICAO_NEGATIVA");
    if (isErr(resultado)) {
      expect(resultado.error.status).toBe(409);
      expect(resultado.error.details).toMatchObject({
        quantidadeAtual: "10.00000000",
        quantidadeSolicitada: "15.00000000",
        quantidadeResultante: "-5.00000000",
        requerConfirmacao: true,
      });
    }
    expect(repositorio.movimentacoes).toHaveLength(1);
  });

  it("exceção confirmada grava a venda, deixa a posição negativa fora do cache e audita", async () => {
    const repositorio = repositorioComAtivos();
    const auditoria = auditoriaFake();
    await compra(repositorio);

    const confirmada = await criarMovimentacao(
      comando({
        tipo: "VENDA",
        data: AMANHA,
        quantidade: "15",
        valorTotal: "1500.00",
        confirmarPosicaoNegativa: true,
        motivo: "Compra anterior não lançada",
      }),
      deps(repositorio, auditoria),
    );

    expect(isOk(confirmada)).toBe(true);
    if (confirmada.ok) {
      expect(apresentarPosicao(confirmada.value.posicao)).toEqual({
        quantidade: "-5.00000000",
        precoMedio: "0.000000",
        custoTotal: "0.00",
      });
    }

    expect(repositorio.movimentacoes).toHaveLength(2);
    expect(repositorio.posicoes.has(`${USUARIO_A}:${ATIVO_A}`)).toBe(false);
    expect(auditoria.chamadas).toHaveLength(1);
    expect(auditoria.chamadas[0]).toMatchObject({
      usuarioId: USUARIO_A,
      ativoId: ATIVO_A,
      motivo: "Compra anterior não lançada",
    });
    expect(auditoria.chamadas[0]?.instante).toBeTruthy();
  });

  it("confirmação sem motivo é recusada como VALIDACAO", async () => {
    const repositorio = repositorioComAtivos();
    await compra(repositorio);

    const resultado = await criarMovimentacao(
      comando({
        tipo: "VENDA",
        data: AMANHA,
        quantidade: "15",
        valorTotal: "1500.00",
        confirmarPosicaoNegativa: true,
        motivo: "   ",
      }),
      deps(repositorio),
    );

    esperarCodigo(resultado, "VALIDACAO");
    expect(repositorio.movimentacoes).toHaveLength(1);
  });

  it("ativo inativo ou de outro titular retorna MOV_ATIVO_INATIVO", async () => {
    const repositorio = repositorioComAtivos();

    const inativo = await criarMovimentacao(
      comando({ ativoId: ATIVO_A2 }),
      deps(repositorio),
    );
    esperarCodigo(inativo, "MOV_ATIVO_INATIVO");

    const deOutro = await criarMovimentacao(
      comando({ usuarioId: USUARIO_B }),
      deps(repositorio),
    );
    esperarCodigo(deOutro, "MOV_ATIVO_INATIVO");
  });

  it("G6 — total divergente sem observação retorna MOV_VALOR_INCONSISTENTE", async () => {
    const repositorio = repositorioComAtivos();

    const semObservacao = await criarMovimentacao(
      comando({ valorTotal: "1005.00" }),
      deps(repositorio),
    );
    esperarCodigo(semObservacao, "MOV_VALOR_INCONSISTENTE");
    expect(repositorio.movimentacoes).toHaveLength(0);

    const comObservacao = await criarMovimentacao(
      comando({ valorTotal: "1005.00", observacoes: "Corretagem não destacada" }),
      deps(repositorio),
    );
    expect(isOk(comObservacao)).toBe(true);
    expect(repositorio.movimentacoes).toHaveLength(1);
  });

  it("tolerância de R$ 0,01 aceita a diferença de arredondamento", async () => {
    const repositorio = repositorioComAtivos();

    const resultado = await criarMovimentacao(
      comando({ valorTotal: "1000.01" }),
      deps(repositorio),
    );

    expect(isOk(resultado)).toBe(true);
  });

  it("aplicação/resgate de renda fixa é recusado com VALIDACAO (PEND-017)", async () => {
    const repositorio = repositorioComAtivos();

    const aplicacao = await criarMovimentacao(
      comando({ tipo: "APLICACAO_RF", quantidade: null, valorUnitario: null }),
      deps(repositorio),
    );
    esperarCodigo(aplicacao, "VALIDACAO");
    if (isErr(aplicacao)) {
      expect(aplicacao.error.message).toBe("Use o cadastro de renda fixa.");
    }

    const resgate = await criarMovimentacao(
      comando({ tipo: "RESGATE_RF", quantidade: null, valorUnitario: null }),
      deps(repositorio),
    );
    esperarCodigo(resgate, "VALIDACAO");
    expect(repositorio.movimentacoes).toHaveLength(0);
  });

  it("ativo de classe renda fixa recusa tipos de renda variável", async () => {
    const repositorio = repositorioComAtivos();

    const resultado = await criarMovimentacao(
      comando({ ativoId: ATIVO_RF }),
      deps(repositorio),
    );

    esperarCodigo(resultado, "MOV_TIPO_INVALIDO");
  });

  it("data depois de amanhã retorna MOV_DATA_FUTURA; amanhã é aceito", async () => {
    const repositorio = repositorioComAtivos();

    const futura = await criarMovimentacao(
      comando({ data: DEPOIS_DE_AMANHA, valorTotal: "1000.00" }),
      deps(repositorio),
    );
    esperarCodigo(futura, "MOV_DATA_FUTURA");

    const amanha = await criarMovimentacao(
      comando({ data: AMANHA }),
      deps(repositorio),
    );
    expect(isOk(amanha)).toBe(true);
  });

  it("compra/venda sem quantidade ou valor unitário retorna MOV_QTD_OBRIGATORIA", async () => {
    const repositorio = repositorioComAtivos();

    const semQuantidade = await criarMovimentacao(
      comando({ quantidade: null }),
      deps(repositorio),
    );
    esperarCodigo(semQuantidade, "MOV_QTD_OBRIGATORIA");

    const semUnitario = await criarMovimentacao(
      comando({ valorUnitario: null }),
      deps(repositorio),
    );
    esperarCodigo(semUnitario, "MOV_QTD_OBRIGATORIA");

    const quantidadeZero = await criarMovimentacao(
      comando({ quantidade: "0", valorTotal: "0.00" }),
      deps(repositorio),
    );
    esperarCodigo(quantidadeZero, "MOV_QTD_OBRIGATORIA");
  });

  it("tipo fora do enum retorna MOV_TIPO_INVALIDO", async () => {
    const repositorio = repositorioComAtivos();

    const resultado = await criarMovimentacao(
      comando({ tipo: "TRANSFERENCIA" as unknown as TipoMovimentacao }),
      deps(repositorio),
    );

    esperarCodigo(resultado, "MOV_TIPO_INVALIDO");
  });

  it("chave de idempotência vazia equivale a ausente e acima de 64 é inválida", async () => {
    expect(normalizarChaveIdempotencia("  ")).toEqual({ ok: true, value: null });

    const longa = normalizarChaveIdempotencia("x".repeat(65));
    expect(longa.ok).toBe(false);
    if (!longa.ok) {
      expect(longa.error.code).toBe("VALIDACAO");
    }
  });
});

describe("listagem de movimentações (RN-014-4)", () => {
  it("filtra por ativo, tipo e período e devolve meta de paginação", async () => {
    const repositorio = repositorioComAtivos();
    await compra(repositorio, { data: "2026-11-01" });
    await compra(repositorio, {
      data: "2026-11-02",
      quantidade: "10",
      valorUnitario: "120.00",
      valorTotal: "1200.00",
    });
    await criarMovimentacao(
      comando({
        tipo: "DIVIDENDO",
        data: "2026-11-03",
        quantidade: null,
        valorUnitario: null,
        valorTotal: "50.00",
      }),
      deps(repositorio),
    );

    const todas = await listarMovimentacoes(
      { usuarioId: USUARIO_A, page: 1, pageSize: 2 },
      deps(repositorio),
    );
    expect(todas.ok).toBe(true);
    if (todas.ok) {
      expect(todas.value.itens).toHaveLength(2);
      expect(todas.value.meta).toEqual({ page: 1, pageSize: 2, total: 3, totalPages: 2 });
      expect(todas.value.itens[0]?.data).toBe("2026-11-03");
    }

    const compras = await listarMovimentacoes(
      { usuarioId: USUARIO_A, tipo: "COMPRA" },
      deps(repositorio),
    );
    expect(compras.ok && compras.value.meta.total).toBe(2);

    const periodo = await listarMovimentacoes(
      { usuarioId: USUARIO_A, de: "2026-11-02", ate: "2026-11-03" },
      deps(repositorio),
    );
    expect(periodo.ok && periodo.value.meta.total).toBe(2);
  });

  it("ordena por valorTotal e esconde canceladas por padrão", async () => {
    const repositorio = repositorioComAtivos();
    const primeira = await compra(repositorio, { data: "2026-11-01", valorTotal: "1000.00" });
    await compra(repositorio, {
      data: "2026-11-02",
      quantidade: "10",
      valorUnitario: "120.00",
      valorTotal: "1200.00",
    });

    const asc = await listarMovimentacoes(
      { usuarioId: USUARIO_A, sort: "valorTotal", order: "asc" },
      deps(repositorio),
    );
    expect(asc.ok && asc.value.itens.map((item) => item.valorTotal)).toEqual([
      "1000.00",
      "1200.00",
    ]);

    await cancelarMovimentacao(
      { usuarioId: USUARIO_A, movimentacaoId: primeira.id, motivo: "duplicada" },
      deps(repositorio),
    );

    const semCanceladas = await listarMovimentacoes(
      { usuarioId: USUARIO_A },
      deps(repositorio),
    );
    expect(semCanceladas.ok && semCanceladas.value.meta.total).toBe(1);

    const comCanceladas = await listarMovimentacoes(
      { usuarioId: USUARIO_A, incluirCanceladas: true },
      deps(repositorio),
    );
    expect(comCanceladas.ok && comCanceladas.value.meta.total).toBe(2);
  });

  it("data de filtro inválida retorna VALIDACAO", async () => {
    const repositorio = repositorioComAtivos();

    const resultado = await listarMovimentacoes(
      { usuarioId: USUARIO_A, de: "2026-13-40" },
      deps(repositorio),
    );

    esperarCodigo(resultado, "VALIDACAO");
  });

  it("não mistura movimentações de outro titular", async () => {
    const repositorio = repositorioComAtivos();
    await compra(repositorio);

    const resultado = await listarMovimentacoes(
      { usuarioId: USUARIO_B },
      deps(repositorio),
    );

    expect(resultado.ok && resultado.value.meta.total).toBe(0);
  });
});

describe("cancelamento de movimentação (RN-014-4)", () => {
  async function cenario(repositorio: RepositorioMemoria): Promise<{
    compra1: MovimentacaoRegistro;
    compra2: MovimentacaoRegistro;
    venda: MovimentacaoRegistro;
  }> {
    const compra1 = await compra(repositorio, { data: "2026-11-01", valorTotal: "1000.00" });
    const compra2 = await compra(repositorio, {
      data: "2026-11-02",
      quantidade: "10",
      valorUnitario: "120.00",
      valorTotal: "1200.00",
    });
    const vendaResultado = await criarMovimentacao(
      comando({
        tipo: "VENDA",
        data: "2026-11-03",
        quantidade: "5",
        valorUnitario: "130.00",
        valorTotal: "650.00",
      }),
      deps(repositorio),
    );
    if (isErr(vendaResultado)) {
      throw vendaResultado.error;
    }
    return { compra1, compra2, venda: vendaResultado.value.movimentacao };
  }

  function cancelarComando(overrides: Partial<CancelarMovimentacaoComando> = {}): CancelarMovimentacaoComando {
    return {
      usuarioId: USUARIO_A,
      movimentacaoId: "mov-1",
      motivo: "Lançamento duplicado",
      agora: AGORA,
      ...overrides,
    };
  }

  it("recalcula a posição a partir das movimentações não canceladas e mantém o registro", async () => {
    const repositorio = repositorioComAtivos();
    const { venda } = await cenario(repositorio);

    const resultado = await cancelarMovimentacao(
      cancelarComando({ movimentacaoId: venda.id }),
      deps(repositorio),
    );

    expect(isOk(resultado)).toBe(true);
    if (resultado.ok) {
      expect(apresentarPosicao(resultado.value.posicao)).toEqual({
        quantidade: "20.00000000",
        precoMedio: "110.000000",
        custoTotal: "2200.00",
      });
      expect(apresentarMovimentacao(resultado.value.movimentacao).canceladaEm).toBe(
        AGORA.toISOString(),
      );
      expect(resultado.value.movimentacao.cancelamentoMotivo).toBe("Lançamento duplicado");
    }

    expect(repositorio.movimentacoes).toHaveLength(3);
    expect(repositorio.posicoes.get(`${USUARIO_A}:${ATIVO_A}`)).toEqual({
      quantidade: "20.00000000",
      precoMedio: "110.000000",
      custoTotal: "2200.00",
    });
  });

  it("motivo vazio retorna MOV_CANCELAMENTO_SEM_MOTIVO e nada é cancelado", async () => {
    const repositorio = repositorioComAtivos();
    const { venda } = await cenario(repositorio);

    const resultado = await cancelarMovimentacao(
      cancelarComando({ movimentacaoId: venda.id, motivo: "   " }),
      deps(repositorio),
    );

    esperarCodigo(resultado, "MOV_CANCELAMENTO_SEM_MOTIVO");
    expect(repositorio.movimentacoes.filter((item) => item.canceladaEm !== null)).toHaveLength(0);
  });

  it("movimentação de outro titular retorna MOV_NAO_ENCONTRADA", async () => {
    const repositorio = repositorioComAtivos();
    const { venda } = await cenario(repositorio);

    const resultado = await cancelarMovimentacao(
      cancelarComando({ usuarioId: USUARIO_B, movimentacaoId: venda.id }),
      deps(repositorio),
    );

    esperarCodigo(resultado, "MOV_NAO_ENCONTRADA");
    if (isErr(resultado)) {
      expect(resultado.error.status).toBe(404);
    }
  });

  it("cancelamento repetido retorna MOV_JA_CANCELADA", async () => {
    const repositorio = repositorioComAtivos();
    const { venda } = await cenario(repositorio);
    const comandoCancelamento = cancelarComando({ movimentacaoId: venda.id });

    const primeira = await cancelarMovimentacao(comandoCancelamento, deps(repositorio));
    expect(isOk(primeira)).toBe(true);

    const segunda = await cancelarMovimentacao(comandoCancelamento, deps(repositorio));
    esperarCodigo(segunda, "MOV_JA_CANCELADA");
    if (isErr(segunda)) {
      expect(segunda.error.status).toBe(409);
    }
  });

  it("cancelar a primeira compra recalcula a posição restante", async () => {
    const repositorio = repositorioComAtivos();
    const { compra1 } = await cenario(repositorio);

    const resultado = await cancelarMovimentacao(
      cancelarComando({ movimentacaoId: compra1.id }),
      deps(repositorio),
    );

    expect(isOk(resultado)).toBe(true);
    if (resultado.ok) {
      expect(apresentarPosicao(resultado.value.posicao)).toEqual({
        quantidade: "5.00000000",
        precoMedio: "120.000000",
        custoTotal: "600.00",
      });
    }
    expect(repositorio.posicoes.get(`${USUARIO_A}:${ATIVO_A}`)).toEqual({
      quantidade: "5.00000000",
      precoMedio: "120.000000",
      custoTotal: "600.00",
    });
  });

  it("cancelar compra que sustentava uma venda deixa posição negativa fora do cache", async () => {
    const repositorio = repositorioComAtivos();
    const carregada = await compra(repositorio, { data: "2026-11-01" });
    const venda = await criarMovimentacao(
      comando({
        tipo: "VENDA",
        data: "2026-11-02",
        quantidade: "10",
        valorUnitario: "110.00",
        valorTotal: "1100.00",
      }),
      deps(repositorio),
    );
    expect(isOk(venda)).toBe(true);

    const resultado = await cancelarMovimentacao(
      cancelarComando({ movimentacaoId: carregada.id }),
      deps(repositorio),
    );

    expect(isOk(resultado)).toBe(true);
    if (resultado.ok) {
      expect(apresentarPosicao(resultado.value.posicao)).toEqual({
        quantidade: "-10.00000000",
        precoMedio: "0.000000",
        custoTotal: "0.00",
      });
    }
    expect(repositorio.posicoes.has(`${USUARIO_A}:${ATIVO_A}`)).toBe(false);
  });
  it("cancelamento perdido por corrida retorna MOV_JA_CANCELADA", async () => {
    const repositorio = repositorioComAtivos();
    const { venda } = await cenario(repositorio);
    repositorio.simularCancelamentoPerdido = true;

    const resultado = await cancelarMovimentacao(
      cancelarComando({ movimentacaoId: venda.id }),
      deps(repositorio),
    );

    esperarCodigo(resultado, "MOV_JA_CANCELADA");
  });

  it("registro remanescente corrompido impede o recálculo e a transação não cancela", async () => {
    const repositorio = repositorioComAtivos();
    const compraValida = await compra(repositorio, { data: "2026-11-01" });
    repositorio.semear({
      id: "mov-corrompida",
      usuarioId: USUARIO_A,
      ativoId: ATIVO_A,
      ativo: { id: ATIVO_A, ticker: "HGLG11" },
      tipo: "VENDA",
      data: "2026-11-02",
      quantidade: null,
      valorUnitario: null,
      valorTotal: "100.00",
      custos: "0.00",
      observacoes: null,
      canceladaEm: null,
      cancelamentoMotivo: null,
      idempotencyKey: null,
      criadoEm: AGORA,
    });

    const resultado = await cancelarMovimentacao(
      cancelarComando({ movimentacaoId: compraValida.id }),
      deps(repositorio),
    );

    esperarCodigo(resultado, "MOV_QTD_OBRIGATORIA");
    expect(
      repositorio.movimentacoes.find((item) => item.id === compraValida.id)?.canceladaEm,
    ).toBeNull();
  });
});

describe("apresentação", () => {
  it("normaliza escalas e datas da movimentação", () => {
    const api = apresentarMovimentacao({
      id: "mov-1",
      ativo: { id: ATIVO_A, ticker: "HGLG11" },
      tipo: "COMPRA",
      data: "2026-11-05",
      quantidade: "10.00000000",
      valorUnitario: "160.00",
      valorTotal: "1603.00",
      custos: "3.00",
      observacoes: null,
      canceladaEm: new Date("2026-11-06T10:00:00.000Z"),
      cancelamentoMotivo: "erro",
      idempotencyKey: null,
      criadoEm: AGORA,
    });

    expect(api).toEqual({
      id: "mov-1",
      ativo: { id: ATIVO_A, ticker: "HGLG11" },
      tipo: "COMPRA",
      data: "2026-11-05",
      quantidade: "10.00000000",
      valorUnitario: "160.00",
      valorTotal: "1603.00",
      custos: "3.00",
      observacoes: null,
      canceladaEm: "2026-11-06T10:00:00.000Z",
      cancelamentoMotivo: "erro",
      criadoEm: AGORA.toISOString(),
    });
  });

  it("posição sem quantidade sai zerada com escalas do contrato", () => {
    expect(
      apresentarPosicao({
        quantidade: Decimal.zero(8),
        precoMedio: Decimal.zero(6),
        custoTotal: Decimal.zero(2),
      }),
    ).toEqual({
      quantidade: "0.00000000",
      precoMedio: "0.000000",
      custoTotal: "0.00",
    });
  });

  it("movimentação ativa sai com canceladaEm nulo", () => {
    const api = apresentarMovimentacao({
      id: "mov-2",
      ativo: { id: ATIVO_A, ticker: "HGLG11" },
      tipo: "COMPRA",
      data: "2026-11-05",
      quantidade: "10.00000000",
      valorUnitario: "160.00",
      valorTotal: "1603.00",
      custos: "3.00",
      observacoes: null,
      canceladaEm: null,
      cancelamentoMotivo: null,
      idempotencyKey: null,
      criadoEm: AGORA,
    });

    expect(api.canceladaEm).toBeNull();
    expect(api.cancelamentoMotivo).toBeNull();
  });
});

describe("validadores de entrada", () => {
  it("data malformada ou referência inválida retornam VALIDACAO", () => {
    esperarCodigo(validarDataMovimentacao("2026-13-40", HOJE), "VALIDACAO");
    expect(validarDataMovimentacao(HOJE, "hoje-invalido").ok).toBe(false);
  });

  it("data futura além de amanhã é MOV_DATA_FUTURA; amanhã é aceito", () => {
    esperarCodigo(validarDataMovimentacao(DEPOIS_DE_AMANHA, HOJE), "MOV_DATA_FUTURA");
    expect(validarDataMovimentacao(AMANHA, HOJE).ok).toBe(true);
  });

  it("quantidade e valor unitário com formato inválido retornam VALIDACAO", () => {
    esperarCodigo(validarQuantidade("COMPRA", "abc", "100.00"), "VALIDACAO");
    esperarCodigo(validarQuantidade("COMPRA", "10", "abc"), "VALIDACAO");
    esperarCodigo(validarQuantidade("COMPRA", "10", "0"), "MOV_QTD_OBRIGATORIA");
  });

  it("dividendo aceita quantidade e valor unitário ausentes", () => {
    const resultado = validarQuantidade("DIVIDENDO", null, null);
    expect(resultado).toEqual({ ok: true, value: { quantidade: null, valorUnitario: null } });

    const parcial = validarQuantidade("DIVIDENDO", "10", null);
    expect(parcial).toEqual({ ok: true, value: { quantidade: "10", valorUnitario: null } });
  });

  it("valor total e custos inválidos retornam VALIDACAO", () => {
    esperarCodigo(validarValores(null, null, "abc", "0.00", null), "VALIDACAO");
    esperarCodigo(validarValores(null, null, "0", "0.00", null), "VALIDACAO");
    esperarCodigo(validarValores(null, null, "10.00", "abc", null), "VALIDACAO");
    esperarCodigo(validarValores(null, null, "10.00", "-1.00", null), "VALIDACAO");
  });

  it("observação acima de 1000 caracteres retorna VALIDACAO", () => {
    const resultado = validarValores(null, null, "10.00", "0.00", "x".repeat(1001));
    esperarCodigo(resultado, "VALIDACAO");
  });

  it("diferença acima da tolerância é aceita somente com observação", () => {
    const semObservacao = validarValores("10", "100.00", "1005.00", "0.00", null);
    esperarCodigo(semObservacao, "MOV_VALOR_INCONSISTENTE");

    const comObservacao = validarValores("10", "100.00", "1005.00", "0.00", "ajuste");
    expect(comObservacao.ok).toBe(true);
    if (comObservacao.ok) {
      expect(comObservacao.value).toEqual({
        valorTotal: "1005.00",
        custos: "0.00",
        observacoes: "ajuste",
      });
    }
  });

  it("mapeia os erros do domínio de posição para o catálogo", () => {
    expect(
      mapearErroPosicao({
        codigo: "MOV_VALOR_INCONSISTENTE",
        mensagem: "x",
        detalhes: { diferenca: "2.00" },
      }).code,
    ).toBe("MOV_VALOR_INCONSISTENTE");

    expect(
      mapearErroPosicao({
        codigo: "MOV_QTD_OBRIGATORIA",
        mensagem: "x",
        detalhes: { tipo: "COMPRA" },
      }).code,
    ).toBe("MOV_QTD_OBRIGATORIA");

    expect(
      mapearErroPosicao({
        codigo: "MOV_POSICAO_NEGATIVA",
        mensagem: "x",
        detalhes: { quantidadeAtual: "0.00000000" },
      }).details,
    ).toMatchObject({ requerConfirmacao: true });
  });
});
