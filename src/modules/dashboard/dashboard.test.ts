import { describe, expect, it } from "vitest";

import { errors, type AppError } from "../../lib/errors";
import { isErr, type Result } from "../../lib/result";
import type {
  AlocacaoMetaRepositorio,
  MetaRegistro,
  ReferenciasAlocacao,
} from "../alocacao/repositorio";
import type {
  CarteiraRepositorio,
  DadosCarteira,
  MovimentacaoCarteira,
  ReferenciaCarteira,
} from "../carteira/repositorio";
import type { ValorCarteira, ValoresCarteira } from "../carteira/valor-carteira";
import { montarIndicadores } from "./indicadores";
import { obterDashboard, type ObterDashboardDeps } from "./obter-dashboard";
import { janelaMeses, mesesDaJanela } from "./periodos";
import type {
  DashboardRepositorio,
  DividendoBrutoDashboard,
  RendimentoPeriodoDashboard,
} from "./repositorio";
import {
  montarEvolucaoRendimentos,
  montarOportunidades,
  selecionarDividendos,
} from "./series";
import type { DashboardResultado } from "./tipos";

const USUARIO_A = "usuario-a";
const USUARIO_B = "usuario-b";
const AGORA = new Date("2026-11-09T12:00:00.000Z");

const CLASSES_CARTEIRA: readonly ReferenciaCarteira[] = [
  { id: "c-rf", codigo: "RENDA_FIXA", nome: "Renda Fixa", ordem: 1 },
  { id: "c-fii", codigo: "FII", nome: "Fundos Imobiliários", ordem: 2 },
];

const SEGMENTOS_CARTEIRA: readonly ReferenciaCarteira[] = [
  { id: "s-log", codigo: "LOGISTICA", nome: "Logística", ordem: 1 },
];

const REFERENCIAS_ALOCACAO: ReferenciasAlocacao = {
  classes: [
    { id: "c-rf", codigo: "RENDA_FIXA", nome: "Renda Fixa", ordem: 1, ativo: true },
    { id: "c-fii", codigo: "FII", nome: "Fundos Imobiliários", ordem: 2, ativo: true },
  ],
  segmentos: [
    {
      id: "s-log",
      codigo: "LOGISTICA",
      nome: "Logística",
      classeId: "c-fii",
      ordem: 1,
      ativo: true,
    },
    {
      id: "s-shop",
      codigo: "SHOPPING",
      nome: "Shopping Centers",
      classeId: "c-fii",
      ordem: 2,
      ativo: true,
    },
  ],
};

function meta(
  escopo: MetaRegistro["escopo"],
  referenciaId: string,
  codigo: string,
  ordem: number,
  percentual: string,
): MetaRegistro {
  return {
    id: `${escopo}-${codigo}`,
    escopo,
    referenciaId,
    codigo,
    nome: codigo,
    ordem,
    percentual,
    vigenciaInicio: "2026-01-01",
    vigenciaFim: null,
    criadoEm: new Date("2026-01-01T00:00:00.000Z"),
  };
}

const METAS_A: readonly MetaRegistro[] = [
  meta("CLASSE", "c-rf", "RENDA_FIXA", 1, "50.000000"),
  meta("CLASSE", "c-fii", "FII", 2, "50.000000"),
  meta("SEGMENTO", "s-log", "LOGISTICA", 1, "25.000000"),
  meta("SEGMENTO", "s-shop", "SHOPPING", 2, "25.000000"),
];

const DADOS_A: DadosCarteira = {
  posicoes: [
    {
      ativoId: "ativo-a",
      ticker: "HGLG11",
      nome: "CSHG Logística",
      quantidade: "100.00000000",
      precoMedio: "10.000000",
      custoTotal: "1000.00",
      classeId: "c-fii",
      segmentoId: "s-log",
    },
  ],
  rendaFixa: { saldoTotal: "500.00", quantidadeTitulos: 1 },
  rendimentos: [
    { dataPagamento: "2026-11-05", valor: "80.00" },
    { dataPagamento: "2026-10-15", valor: "70.00" },
    { dataPagamento: "2026-01-10", valor: "20.00" },
  ],
  classes: CLASSES_CARTEIRA,
  segmentos: SEGMENTOS_CARTEIRA,
};

const VALORES_A: ValoresCarteira = {
  total: "1500.00",
  classes: [
    { id: "c-rf", valor: "500.00", valorIndisponivel: false },
    { id: "c-fii", valor: "1000.00", valorIndisponivel: true },
  ],
  segmentos: [{ id: "s-log", valor: "1000.00", valorIndisponivel: true }],
};

const RENDIMENTOS_A: readonly RendimentoPeriodoDashboard[] = [
  { dataPagamento: "2025-12-10", valor: "30.00" },
  { dataPagamento: "2026-01-10", valor: "20.00" },
  { dataPagamento: "2026-10-15", valor: "70.00" },
  { dataPagamento: "2026-11-05", valor: "80.00" },
];

const DIVIDENDOS_A: readonly DividendoBrutoDashboard[] = [
  { dataPagamento: "2026-11-05", ticker: "HGLG11", valor: "80.00" },
  { dataPagamento: "2026-10-15", ticker: "HGLG11", valor: "70.00" },
  { dataPagamento: "2026-01-10", ticker: "MXRF11", valor: "20.00" },
  { dataPagamento: "2025-12-10", ticker: "HGLG11", valor: "30.00" },
];

function dadosVazios(): DadosCarteira {
  return {
    posicoes: [],
    rendaFixa: { saldoTotal: "0.00", quantidadeTitulos: 0 },
    rendimentos: [],
    classes: CLASSES_CARTEIRA,
    segmentos: SEGMENTOS_CARTEIRA,
  };
}

class CarteiraRepositorioFake implements CarteiraRepositorio {
  readonly dados = new Map<string, DadosCarteira>();
  readonly saldosRendaFixa = new Map<string, string>();
  readonly movimentacoes = new Map<string, readonly MovimentacaoCarteira[]>();
  erroCarregar: unknown = null;

  async carregarDados(usuarioId: string): Promise<DadosCarteira> {
    if (this.erroCarregar !== null) {
      throw this.erroCarregar;
    }

    return this.dados.get(usuarioId) ?? dadosVazios();
  }

  async carregarSaldoRendaFixa(usuarioId: string): Promise<string> {
    return this.saldosRendaFixa.get(usuarioId) ?? "0.00";
  }

  async listarMovimentacoes(
    usuarioId: string,
  ): Promise<readonly MovimentacaoCarteira[]> {
    return this.movimentacoes.get(usuarioId) ?? [];
  }
}

class AlocacaoMetaRepositorioFake implements AlocacaoMetaRepositorio {
  readonly metas = new Map<string, readonly MetaRegistro[]>();
  erroListar: unknown = null;

  async listarVigentes(usuarioId: string): Promise<readonly MetaRegistro[]> {
    return (this.metas.get(usuarioId) ?? []).filter(
      (meta) => meta.vigenciaFim === null,
    );
  }

  async listarTodas(usuarioId: string): Promise<readonly MetaRegistro[]> {
    if (this.erroListar !== null) {
      throw this.erroListar;
    }

    return this.metas.get(usuarioId) ?? [];
  }

  async listarReferencias(): Promise<ReferenciasAlocacao> {
    return REFERENCIAS_ALOCACAO;
  }

  async garantirVigencia(): Promise<void> {
    return;
  }

  async substituirVigencia(): Promise<void> {
    return;
  }
}

class ValorCarteiraFake implements ValorCarteira {
  readonly valores = new Map<string, ValoresCarteira>();
  erroAgregar: unknown = null;

  async agregar(usuarioId: string): Promise<ValoresCarteira> {
    if (this.erroAgregar !== null) {
      throw this.erroAgregar;
    }

    return (
      this.valores.get(usuarioId) ?? {
        total: "0.00",
        classes: [],
        segmentos: [],
      }
    );
  }
}

class DashboardRepositorioFake implements DashboardRepositorio {
  readonly valorAplicado = new Map<string, string>();
  readonly rendimentosTotais = new Map<string, string>();
  readonly rendimentos = new Map<string, readonly RendimentoPeriodoDashboard[]>();
  readonly dividendos = new Map<string, readonly DividendoBrutoDashboard[]>();
  readonly janelas: { usuarioId: string; de: string; ate: string }[] = [];
  readonly limites: number[] = [];
  erroValorAplicado: unknown = null;
  erroRendimentosTotais: unknown = null;
  erroRendimentos: unknown = null;
  erroDividendos: unknown = null;

  async somarValorAplicadoRendaFixa(usuarioId: string): Promise<string> {
    if (this.erroValorAplicado !== null) {
      throw this.erroValorAplicado;
    }

    return this.valorAplicado.get(usuarioId) ?? "0.00";
  }

  async somarRendimentosTotais(usuarioId: string): Promise<string> {
    if (this.erroRendimentosTotais !== null) {
      throw this.erroRendimentosTotais;
    }

    return this.rendimentosTotais.get(usuarioId) ?? "0.00";
  }

  async listarRendimentos(
    usuarioId: string,
    de: string,
    ate: string,
  ): Promise<readonly RendimentoPeriodoDashboard[]> {
    this.janelas.push({ usuarioId, de, ate });

    if (this.erroRendimentos !== null) {
      throw this.erroRendimentos;
    }

    return this.rendimentos.get(usuarioId) ?? [];
  }

  async listarDividendos(
    usuarioId: string,
    limite: number,
  ): Promise<readonly DividendoBrutoDashboard[]> {
    this.limites.push(limite);

    if (this.erroDividendos !== null) {
      throw this.erroDividendos;
    }

    return this.dividendos.get(usuarioId) ?? [];
  }
}

interface Cenario {
  readonly carteira: CarteiraRepositorioFake;
  readonly alocacao: AlocacaoMetaRepositorioFake;
  readonly valorCarteira: ValorCarteiraFake;
  readonly dashboard: DashboardRepositorioFake;
  readonly deps: ObterDashboardDeps;
}

function criarCenario(): Cenario {
  const carteira = new CarteiraRepositorioFake();
  const alocacao = new AlocacaoMetaRepositorioFake();
  const valorCarteira = new ValorCarteiraFake();
  const dashboard = new DashboardRepositorioFake();

  return {
    carteira,
    alocacao,
    valorCarteira,
    dashboard,
    deps: {
      carteira: { repositorio: carteira },
      alocacao: { repositorio: alocacao, valorCarteira },
      dashboard,
      agora: AGORA,
    },
  };
}

function configurarUsuarioA(cenario: Cenario): void {
  cenario.carteira.dados.set(USUARIO_A, DADOS_A);
  cenario.carteira.saldosRendaFixa.set(USUARIO_A, "500.00");
  cenario.valorCarteira.valores.set(USUARIO_A, VALORES_A);
  cenario.alocacao.metas.set(USUARIO_A, METAS_A);
  cenario.dashboard.valorAplicado.set(USUARIO_A, "450.00");
  // 170 do ano corrente + 30 de dez/2025: o total histórico é 200.
  cenario.dashboard.rendimentosTotais.set(USUARIO_A, "200.00");
  cenario.dashboard.rendimentos.set(USUARIO_A, RENDIMENTOS_A);
  cenario.dashboard.dividendos.set(USUARIO_A, DIVIDENDOS_A);
}

function unwrap(resultado: Result<DashboardResultado, AppError>): DashboardResultado {
  if (isErr(resultado)) {
    throw new Error(`Esperava sucesso, veio ${resultado.error.code}.`);
  }

  return resultado.value;
}

describe("dashboard — janela de meses", () => {
  it("gera os últimos 12 meses em ordem crescente incluindo o corrente", () => {
    expect(mesesDaJanela("2026-11-09", 12)).toEqual([
      "2025-12",
      "2026-01",
      "2026-02",
      "2026-03",
      "2026-04",
      "2026-05",
      "2026-06",
      "2026-07",
      "2026-08",
      "2026-09",
      "2026-10",
      "2026-11",
    ]);
  });

  it("posiciona o início da janela no primeiro dia do mês mais antigo", () => {
    expect(janelaMeses("2026-11-09")).toEqual({
      de: "2025-12-01",
      ate: "2026-11-09",
      meses: mesesDaJanela("2026-11-09", 12),
    });
  });

  it("devolve janela degenerada quando a quantidade é zero", () => {
    expect(mesesDaJanela("2026-11-09", 0)).toEqual([]);
    expect(janelaMeses("2026-11-09", 0)).toEqual({
      de: "2026-11-09",
      ate: "2026-11-09",
      meses: [],
    });
  });
});

describe("dashboard — séries", () => {
  it("soma rendimentos por mês e preenche meses sem provento com zero", () => {
    const serie = montarEvolucaoRendimentos(RENDIMENTOS_A, [
      "2025-12",
      "2026-01",
      "2026-02",
      "2026-10",
      "2026-11",
    ]);

    expect(serie).toEqual([
      { mes: "2025-12", valor: "30.00" },
      { mes: "2026-01", valor: "20.00" },
      { mes: "2026-02", valor: "0.00" },
      { mes: "2026-10", valor: "70.00" },
      { mes: "2026-11", valor: "80.00" },
    ]);
  });

  it("ignora rendimento fora da janela de meses", () => {
    const serie = montarEvolucaoRendimentos(
      [{ dataPagamento: "2025-11-30", valor: "99.00" }],
      ["2025-12", "2026-01"],
    );

    expect(serie).toEqual([
      { mes: "2025-12", valor: "0.00" },
      { mes: "2026-01", valor: "0.00" },
    ]);
  });

  it("ordena dividendos por data decrescente e limita a 12", () => {
    const proventos: DividendoBrutoDashboard[] = Array.from(
      { length: 14 },
      (_, indice) => ({
        dataPagamento: `2026-${String(12 - (indice % 12)).padStart(2, "0")}-10`,
        ticker: indice % 2 === 0 ? "HGLG11" : "MXRF11",
        valor: `${indice + 1}.00`,
      }),
    );

    const selecionados = selecionarDividendos(proventos);

    expect(selecionados).toHaveLength(12);
    expect(selecionados[0]?.data).toBe("2026-12-10");
    expect(selecionados[0]?.ativo).toBe("HGLG11");
  });

  it("desempata dividendos da mesma data por ticker", () => {
    const selecionados = selecionarDividendos([
      { dataPagamento: "2026-11-05", ticker: "MXRF11", valor: "10.00" },
      { dataPagamento: "2026-11-05", ticker: "HGLG11", valor: "20.00" },
    ]);

    expect(selecionados.map((item) => item.ativo)).toEqual(["HGLG11", "MXRF11"]);
  });

  it("lista classes e segmentos abaixo da meta, deixando Fases 2/4 vazias", () => {
    const oportunidades = montarOportunidades([
      {
        escopo: "CLASSE",
        codigo: "RENDA_FIXA",
        percentualAtual: "33.333333",
        percentualMeta: "50.000000",
        desvioPontos: "-16.666667",
        valorParaMeta: "250.00",
        situacao: "ABAIXO",
        valorIndisponivel: false,
      },
      {
        escopo: "CLASSE",
        codigo: "FII",
        percentualAtual: "66.666667",
        percentualMeta: "50.000000",
        desvioPontos: "16.666667",
        valorParaMeta: "0.00",
        situacao: "ACIMA",
        valorIndisponivel: true,
      },
      {
        escopo: "SEGMENTO",
        codigo: "SHOPPING",
        percentualAtual: "0.000000",
        percentualMeta: "25.000000",
        desvioPontos: "-25.000000",
        valorParaMeta: "375.00",
        situacao: "ABAIXO",
        valorIndisponivel: true,
      },
    ]);

    expect(oportunidades).toEqual({
      classesAbaixo: [
        {
          escopo: "CLASSE",
          codigo: "RENDA_FIXA",
          percentualAtual: "33.333333",
          percentualMeta: "50.000000",
          desvioPontos: "-16.666667",
          valorParaMeta: "250.00",
        },
      ],
      segmentosAbaixo: [
        {
          escopo: "SEGMENTO",
          codigo: "SHOPPING",
          percentualAtual: "0.000000",
          percentualMeta: "25.000000",
          desvioPontos: "-25.000000",
          valorParaMeta: "375.00",
        },
      ],
      watchlist: [],
      comAlerta: [],
      sugestaoAporte: null,
    });
  });
});

describe("dashboard — indicadores (RN-061)", () => {
  it("monta os nove indicadores com rendimentos totais de todo o histórico", async () => {
    const cenario = criarCenario();
    configurarUsuarioA(cenario);

    const resultado = unwrap(
      await obterDashboard({ usuarioId: USUARIO_A }, cenario.deps),
    );

    expect(resultado.erros).toEqual([]);
    expect(resultado.indicadores).toMatchObject({
      vazio: false,
      patrimonioTotal: "1500.00",
      totalInvestido: "1450.00",
      valorAtual: "1500.00",
      // (1500 − 1450) + 200 (170 do ano + 30 de dez/2025) = 250.
      resultadoAcumulado: "250.00",
      rendaMensal: "80.00",
      rendimentosAno: "170.00",
      percentualRendaFixa: "33.333333",
      percentualFiis: "66.666667",
    });
    expect(resultado.indicadores?.meta).toEqual([
      {
        codigo: "RENDA_FIXA",
        atual: "33.333333",
        meta: "50.000000",
        desvio: "-16.666667",
        situacao: "ABAIXO",
      },
      {
        codigo: "FII",
        atual: "66.666667",
        meta: "50.000000",
        desvio: "16.666667",
        situacao: "ACIMA",
      },
    ]);
  });

  it("usa valorAplicado da renda fixa no total investido, não o saldo", () => {
    const cenario = criarCenario();
    configurarUsuarioA(cenario);

    const indicadores = montarIndicadores({
      carteira: {
        resumo: {
          patrimonioTotal: "1500.00",
          rendaFixa: "500.00",
          fiis: "1000.00",
          percentualRendaFixa: "33.333333",
          percentualFiis: "66.666667",
          quantidadeAtivos: 2,
          rendimentosMes: "80.00",
          rendimentosAcumuladosAno: "170.00",
        },
        porClasse: [],
        porSegmento: [],
        posicoes: [],
        consistente: true,
        diagnostico: { somaClasses: "1500.00", divergencia: "0.00", tolerancia: "0.01" },
        atualizadoEm: AGORA.toISOString(),
        cotacoes: { statusDado: "INDISPONIVEL", dataReferencia: null },
      },
      desvios: null,
      valorAplicadoRendaFixa: "450.00",
      rendimentosTotais: "200.00",
    });

    expect(indicadores.totalInvestido).toBe("1450.00");
    expect(indicadores).toMatchObject({
      resultadoAcumulado: "250.00",
      meta: [],
    });
  });

  it("inclui rendimento de ano anterior no total, mas não no ano", () => {
    const indicadores = montarIndicadores({
      carteira: {
        resumo: {
          patrimonioTotal: "1500.00",
          rendaFixa: "500.00",
          fiis: "1000.00",
          percentualRendaFixa: "33.333333",
          percentualFiis: "66.666667",
          quantidadeAtivos: 2,
          rendimentosMes: "80.00",
          rendimentosAcumuladosAno: "170.00",
        },
        porClasse: [],
        porSegmento: [],
        posicoes: [],
        consistente: true,
        diagnostico: { somaClasses: "1500.00", divergencia: "0.00", tolerancia: "0.01" },
        atualizadoEm: AGORA.toISOString(),
        cotacoes: { statusDado: "INDISPONIVEL", dataReferencia: null },
      },
      desvios: null,
      valorAplicadoRendaFixa: "450.00",
      // 170 do ano corrente + 30 de dez/2025.
      rendimentosTotais: "200.00",
    });

    expect(indicadores.rendimentosAno).toBe("170.00");
    expect(indicadores.resultadoAcumulado).toBe("250.00");
  });

  it("sinaliza carteira vazia e não divide por zero", async () => {
    const cenario = criarCenario();
    cenario.carteira.dados.set(USUARIO_B, dadosVazios());
    cenario.alocacao.metas.set(USUARIO_B, METAS_A);

    const resultado = unwrap(
      await obterDashboard({ usuarioId: USUARIO_B }, cenario.deps),
    );

    expect(resultado.indicadores).toMatchObject({
      vazio: true,
      patrimonioTotal: "0.00",
      totalInvestido: "0.00",
      valorAtual: "0.00",
      resultadoAcumulado: "0.00",
      rendaMensal: "0.00",
      rendimentosAno: "0.00",
      percentualRendaFixa: "0.000000",
      percentualFiis: "0.000000",
    });
    expect(resultado.indicadores?.meta).toEqual([
      {
        codigo: "RENDA_FIXA",
        atual: "0.000000",
        meta: "50.000000",
        desvio: "-50.000000",
        situacao: "ABAIXO",
      },
      {
        codigo: "FII",
        atual: "0.000000",
        meta: "50.000000",
        desvio: "-50.000000",
        situacao: "ABAIXO",
      },
    ]);
    expect(resultado.erros).toEqual([]);
  });

  it("não marca vazio quando há proventos históricos mesmo sem patrimônio", async () => {
    const cenario = criarCenario();
    cenario.carteira.dados.set(USUARIO_B, dadosVazios());
    cenario.alocacao.metas.set(USUARIO_B, METAS_A);
    // Provento de ano anterior: entra no total, mas não no ano corrente.
    cenario.dashboard.rendimentosTotais.set(USUARIO_B, "10.00");

    const resultado = unwrap(
      await obterDashboard({ usuarioId: USUARIO_B }, cenario.deps),
    );

    expect(resultado.indicadores).toMatchObject({
      vazio: false,
      patrimonioTotal: "0.00",
      resultadoAcumulado: "10.00",
      rendimentosAno: "0.00",
    });
    expect(resultado.erros).toEqual([]);
  });
});

describe("dashboard — gráficos (RN-062)", () => {
  it("entrega 12 meses de rendimentos e os últimos dividendos ordenados", async () => {
    const cenario = criarCenario();
    configurarUsuarioA(cenario);

    const resultado = unwrap(
      await obterDashboard({ usuarioId: USUARIO_A }, cenario.deps),
    );

    const graficos = resultado.graficos;
    expect(graficos).toBeDefined();
    expect(graficos?.evolucaoRendimentos).toHaveLength(12);
    expect(graficos?.evolucaoRendimentos[0]).toEqual({
      mes: "2025-12",
      valor: "30.00",
    });
    expect(
      graficos?.evolucaoRendimentos.find((ponto) => ponto.mes === "2026-02"),
    ).toEqual({ mes: "2026-02", valor: "0.00" });
    expect(graficos?.evolucaoRendimentos.at(-1)).toEqual({
      mes: "2026-11",
      valor: "80.00",
    });
    expect(graficos?.dividendos).toEqual([
      { data: "2026-11-05", ativo: "HGLG11", valor: "80.00" },
      { data: "2026-10-15", ativo: "HGLG11", valor: "70.00" },
      { data: "2026-01-10", ativo: "MXRF11", valor: "20.00" },
      { data: "2025-12-10", ativo: "HGLG11", valor: "30.00" },
    ]);
    expect(graficos?.evolucaoPatrimonial).toHaveLength(12);
    expect(graficos?.aportes).toEqual([]);
    expect(cenario.dashboard.limites).toContain(12);
    expect(cenario.dashboard.janelas).toContainEqual({
      usuarioId: USUARIO_A,
      de: "2025-12-01",
      ate: "2026-11-09",
    });
  });

  it("não vaza dados entre titulares", async () => {
    const cenario = criarCenario();
    configurarUsuarioA(cenario);
    cenario.carteira.dados.set(USUARIO_B, dadosVazios());
    cenario.alocacao.metas.set(USUARIO_B, METAS_A);

    const resultadoA = unwrap(
      await obterDashboard({ usuarioId: USUARIO_A }, cenario.deps),
    );
    const resultadoB = unwrap(
      await obterDashboard({ usuarioId: USUARIO_B }, cenario.deps),
    );

    expect(resultadoA.indicadores?.patrimonioTotal).toBe("1500.00");
    expect(resultadoB.indicadores?.patrimonioTotal).toBe("0.00");
    expect(resultadoA.graficos?.dividendos).toHaveLength(4);
    expect(resultadoB.graficos?.dividendos).toEqual([]);
    expect(resultadoA.oportunidades?.classesAbaixo).toHaveLength(1);
    expect(resultadoB.oportunidades?.classesAbaixo).toHaveLength(2);
  });
});

describe("dashboard — degradação por bloco (RN-073)", () => {
  it("mantém indicadores e oportunidades quando o bloco de gráficos falha", async () => {
    const cenario = criarCenario();
    configurarUsuarioA(cenario);
    cenario.dashboard.erroDividendos = errors.bancoIndisponivel();

    const resultado = unwrap(
      await obterDashboard({ usuarioId: USUARIO_A }, cenario.deps),
    );

    expect(resultado.indicadores).toBeDefined();
    expect(resultado.graficos).toBeUndefined();
    expect(resultado.oportunidades).toBeDefined();
    expect(resultado.erros).toEqual([
      {
        bloco: "graficos",
        code: "BANCO_INDISPONIVEL",
        message: "Serviço temporariamente indisponível.",
      },
    ]);
  });

  it("mantém gráficos quando só o valor aplicado da renda fixa falha", async () => {
    const cenario = criarCenario();
    configurarUsuarioA(cenario);
    cenario.dashboard.erroValorAplicado = errors.bancoIndisponivel();

    const resultado = unwrap(
      await obterDashboard({ usuarioId: USUARIO_A }, cenario.deps),
    );

    expect(resultado.indicadores).toBeUndefined();
    expect(resultado.graficos).toBeDefined();
    expect(resultado.oportunidades).toBeDefined();
    expect(resultado.erros.map((erro) => erro.bloco)).toEqual(["indicadores"]);
  });

  it("mantém gráficos quando só a soma de rendimentos totais falha", async () => {
    const cenario = criarCenario();
    configurarUsuarioA(cenario);
    cenario.dashboard.erroRendimentosTotais = errors.bancoIndisponivel();

    const resultado = unwrap(
      await obterDashboard({ usuarioId: USUARIO_A }, cenario.deps),
    );

    expect(resultado.indicadores).toBeUndefined();
    expect(resultado.graficos).toBeDefined();
    expect(resultado.oportunidades).toBeDefined();
    expect(resultado.erros.map((erro) => erro.bloco)).toEqual(["indicadores"]);
  });

  it("mantém oportunidades quando a carteira falha", async () => {
    const cenario = criarCenario();
    configurarUsuarioA(cenario);
    cenario.carteira.erroCarregar = errors.bancoIndisponivel();

    const resultado = unwrap(
      await obterDashboard({ usuarioId: USUARIO_A }, cenario.deps),
    );

    expect(resultado.indicadores).toBeUndefined();
    expect(resultado.graficos).toBeUndefined();
    expect(resultado.oportunidades).toBeDefined();
    expect(resultado.erros.map((erro) => erro.bloco)).toEqual([
      "indicadores",
      "graficos",
    ]);
  });

  it("bloqueia indicadores e oportunidades quando a falha é dos desvios", async () => {
    const cenario = criarCenario();
    configurarUsuarioA(cenario);
    cenario.alocacao.erroListar = errors.bancoIndisponivel();

    const resultado = unwrap(
      await obterDashboard({ usuarioId: USUARIO_A }, cenario.deps),
    );

    expect(resultado.indicadores).toBeUndefined();
    expect(resultado.graficos).toBeDefined();
    expect(resultado.oportunidades).toBeUndefined();
    expect(resultado.erros).toEqual([
      {
        bloco: "indicadores",
        code: "BANCO_INDISPONIVEL",
        message: "Serviço temporariamente indisponível.",
      },
      {
        bloco: "oportunidades",
        code: "BANCO_INDISPONIVEL",
        message: "Serviço temporariamente indisponível.",
      },
    ]);
  });

  it("trata ausência de metas como estado vazio, não como erro", async () => {
    const cenario = criarCenario();
    configurarUsuarioA(cenario);
    cenario.alocacao.metas.set(USUARIO_A, []);

    const resultado = unwrap(
      await obterDashboard({ usuarioId: USUARIO_A }, cenario.deps),
    );

    expect(resultado.erros).toEqual([]);
    expect(resultado.indicadores?.meta).toEqual([]);
    expect(resultado.oportunidades).toEqual({
      classesAbaixo: [],
      segmentosAbaixo: [],
      watchlist: [],
      comAlerta: [],
      sugestaoAporte: null,
    });
  });

  it("normaliza erro desconhecido como ERRO_INTERNO sem vazar a causa", async () => {
    const cenario = criarCenario();
    configurarUsuarioA(cenario);
    cenario.dashboard.erroRendimentos = new Error("conexão caiu");

    const resultado = unwrap(
      await obterDashboard({ usuarioId: USUARIO_A }, cenario.deps),
    );

    expect(resultado.erros).toEqual([
      {
        bloco: "graficos",
        code: "ERRO_INTERNO",
        message: "Erro inesperado. Tente novamente.",
      },
    ]);
  });

  it("devolve 503 quando nenhum bloco pôde ser produzido", async () => {
    const cenario = criarCenario();
    configurarUsuarioA(cenario);
    cenario.carteira.erroCarregar = errors.bancoIndisponivel();
    cenario.valorCarteira.erroAgregar = errors.bancoIndisponivel();

    const resultado = await obterDashboard({ usuarioId: USUARIO_A }, cenario.deps);

    expect(isErr(resultado)).toBe(true);
    if (isErr(resultado)) {
      expect(resultado.error.code).toBe("BANCO_INDISPONIVEL");
      expect(resultado.error.status).toBe(503);
    }
  });
});
