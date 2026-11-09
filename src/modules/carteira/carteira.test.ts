import { describe, expect, it, vi } from "vitest";

import { Decimal } from "../../lib/decimal";
import { AppError } from "../../lib/errors";
import { isErr, isOk } from "../../lib/result";
import { hojeIsoSaoPaulo } from "../../lib/datas";
import { apresentarCarteira, apresentarEvolucao } from "./apresentacao";
import {
  consolidarCarteira,
  type DadosConsolidacaoCarteira,
} from "./consolidar-carteira";
import {
  inicioDoAno,
  montarEvolucaoCarteira,
  pontosDoPeriodo,
  validarPeriodoEvolucao,
  type GranularidadeEvolucao,
} from "./evolucao-carteira";
import { obterCarteira } from "./obter-carteira";
import { obterEvolucao } from "./obter-evolucao";
import type {
  CarteiraRepositorio,
  DadosCarteira,
  MovimentacaoCarteira,
  PosicaoCarteira,
  ReferenciaCarteira,
} from "./repositorio";

const USUARIO_A = "usuario-a";
const USUARIO_B = "usuario-b";
const HOJE = "2026-11-09";
const AGORA = new Date("2026-11-09T12:00:00.000Z");

const CLASSES: readonly ReferenciaCarteira[] = [
  { id: "c-rf", codigo: "RENDA_FIXA", nome: "Renda Fixa", ordem: 1 },
  { id: "c-fii", codigo: "FII", nome: "Fundos Imobiliários", ordem: 2 },
];

const SEGMENTOS: readonly ReferenciaCarteira[] = [
  { id: "s-log", codigo: "LOGISTICA", nome: "Logística", ordem: 1 },
  { id: "s-shop", codigo: "SHOPPING", nome: "Shopping Centers", ordem: 2 },
];

function posicao(overrides: Partial<PosicaoCarteira> = {}): PosicaoCarteira {
  return {
    ativoId: "ativo-1",
    ticker: "HGLG11",
    nome: "CSHG Logística",
    quantidade: "100.00000000",
    precoMedio: "600.000000",
    custoTotal: "60000.00",
    classeId: "c-fii",
    segmentoId: "s-log",
    ...overrides,
  };
}

function dadosConsolidacao(
  overrides: Partial<DadosConsolidacaoCarteira> = {},
): DadosConsolidacaoCarteira {
  return {
    posicoes: [],
    rendaFixa: { saldoTotal: "0.00", quantidadeTitulos: 0 },
    rendimentos: [],
    classes: CLASSES,
    segmentos: SEGMENTOS,
    dataReferencia: HOJE,
    atualizadoEm: AGORA.toISOString(),
    ...overrides,
  };
}

function dadosCarteira(overrides: Partial<DadosCarteira> = {}): DadosCarteira {
  return {
    posicoes: [],
    rendaFixa: { saldoTotal: "0.00", quantidadeTitulos: 0 },
    rendimentos: [],
    classes: CLASSES,
    segmentos: SEGMENTOS,
    ...overrides,
  };
}

function movimentacao(
  overrides: Partial<MovimentacaoCarteira> = {},
): MovimentacaoCarteira {
  const data = overrides.data ?? "2026-01-10";
  return {
    id: "mov-1",
    ativoId: "ativo-1",
    tipo: "COMPRA",
    data,
    criadoEm: new Date(`${data}T12:00:00.000Z`),
    quantidade: "100.00000000",
    valorUnitario: "100.00",
    valorTotal: "10000.00",
    custos: "0.00",
    canceladaEm: null,
    ...overrides,
  };
}

function somarPercentuais(itens: readonly { readonly percentual: string }[]): string {
  return itens
    .reduce((soma, item) => soma.add(Decimal.from(item.percentual)), Decimal.zero(6))
    .toFixed(6);
}

class CarteiraRepositorioFake implements CarteiraRepositorio {
  readonly dados = new Map<string, DadosCarteira>();
  readonly movimentacoes = new Map<string, readonly MovimentacaoCarteira[]>();
  readonly saldos = new Map<string, string>();

  async carregarDados(usuarioId: string): Promise<DadosCarteira> {
    return this.dados.get(usuarioId) ?? dadosCarteira();
  }

  async carregarSaldoRendaFixa(usuarioId: string): Promise<string> {
    return (
      this.saldos.get(usuarioId) ??
      this.dados.get(usuarioId)?.rendaFixa.saldoTotal ??
      "0.00"
    );
  }

  async listarMovimentacoes(
    usuarioId: string,
  ): Promise<readonly MovimentacaoCarteira[]> {
    return this.movimentacoes.get(usuarioId) ?? [];
  }
}

describe("consolidarCarteira", () => {
  it("consolida FII pelo custo e renda fixa pelo saldo, com percentuais sobre o total", () => {
    const carteira = consolidarCarteira(
      dadosConsolidacao({
        posicoes: [posicao()],
        rendaFixa: { saldoTotal: "40000.00", quantidadeTitulos: 1 },
      }),
    );

    expect(carteira.resumo).toEqual({
      patrimonioTotal: "100000.00",
      rendaFixa: "40000.00",
      fiis: "60000.00",
      percentualRendaFixa: "40.000000",
      percentualFiis: "60.000000",
      quantidadeAtivos: 2,
      rendimentosMes: "0.00",
      rendimentosAcumuladosAno: "0.00",
    });

    expect(carteira.porClasse).toEqual([
      {
        codigo: "RENDA_FIXA",
        nome: "Renda Fixa",
        valor: "40000.00",
        percentual: "40.000000",
        valorIndisponivel: false,
      },
      {
        codigo: "FII",
        nome: "Fundos Imobiliários",
        valor: "60000.00",
        percentual: "60.000000",
        valorIndisponivel: true,
      },
    ]);

    expect(carteira.porSegmento).toEqual([
      {
        codigo: "LOGISTICA",
        nome: "Logística",
        valor: "60000.00",
        percentual: "60.000000",
        valorIndisponivel: true,
      },
    ]);

    expect(carteira.consistente).toBe(true);
    expect(carteira.diagnostico).toEqual({
      somaClasses: "100000.00",
      divergencia: "0.00",
      tolerancia: "0.01",
    });
    expect(carteira.cotacoes).toEqual({
      statusDado: "INDISPONIVEL",
      dataReferencia: null,
    });
    expect(carteira.atualizadoEm).toBe(AGORA.toISOString());
  });

  it("calcula o percentual de cada segmento sobre o patrimônio total (RN-089)", () => {
    const carteira = consolidarCarteira(
      dadosConsolidacao({
        posicoes: [
          posicao({ ativoId: "a-log", custoTotal: "30000.00" }),
          posicao({
            ativoId: "a-shop",
            custoTotal: "20000.00",
            segmentoId: "s-shop",
          }),
        ],
        rendaFixa: { saldoTotal: "50000.00", quantidadeTitulos: 2 },
      }),
    );

    expect(carteira.resumo.patrimonioTotal).toBe("100000.00");
    expect(carteira.porSegmento).toEqual([
      expect.objectContaining({ codigo: "LOGISTICA", valor: "30000.00", percentual: "30.000000" }),
      expect.objectContaining({ codigo: "SHOPPING", valor: "20000.00", percentual: "20.000000" }),
    ]);
    // O percentual do segmento não tem a renda fixa no denominador, mas usa o
    // patrimônio total — e por isso não soma 100.
    expect(somarPercentuais(carteira.porSegmento)).toBe("50.000000");
  });

  it("soma os rendimentos do mês e do ano pela data de pagamento", () => {
    const carteira = consolidarCarteira(
      dadosConsolidacao({
        rendimentos: [
          { dataPagamento: "2026-01-15", valor: "100.00" },
          { dataPagamento: "2026-03-10", valor: "50.00" },
          { dataPagamento: "2026-10-31", valor: "30.00" },
          { dataPagamento: "2026-11-01", valor: "20.00" },
          { dataPagamento: "2026-11-05", valor: "10.00" },
          { dataPagamento: "2025-12-31", valor: "999.00" },
        ],
      }),
    );

    expect(carteira.resumo.rendimentosMes).toBe("30.00");
    expect(carteira.resumo.rendimentosAcumuladosAno).toBe("210.00");
  });

  it("não divide por zero na carteira vazia", () => {
    const carteira = consolidarCarteira(dadosConsolidacao());

    expect(carteira.resumo).toEqual({
      patrimonioTotal: "0.00",
      rendaFixa: "0.00",
      fiis: "0.00",
      percentualRendaFixa: "0.000000",
      percentualFiis: "0.000000",
      quantidadeAtivos: 0,
      rendimentosMes: "0.00",
      rendimentosAcumuladosAno: "0.00",
    });
    expect(carteira.porClasse).toEqual([]);
    expect(carteira.porSegmento).toEqual([]);
    expect(carteira.consistente).toBe(true);
    expect(carteira.diagnostico.divergencia).toBe("0.00");
  });

  it("marca inconsistência quando a soma das classes não fecha com o total", () => {
    const carteira = consolidarCarteira(
      dadosConsolidacao({
        posicoes: [
          posicao({
            classeId: "c-inexistente",
            custoTotal: "1000.00",
            segmentoId: null,
          }),
        ],
      }),
    );

    expect(carteira.resumo.patrimonioTotal).toBe("1000.00");
    expect(carteira.porClasse).toEqual([]);
    expect(carteira.consistente).toBe(false);
    expect(carteira.diagnostico).toEqual({
      somaClasses: "0.00",
      divergencia: "1000.00",
      tolerancia: "0.01",
    });
  });

  it("não força 100% nas classes quando existe valor fora do catálogo", () => {
    const carteira = consolidarCarteira(
      dadosConsolidacao({
        posicoes: [
          posicao({ ativoId: "a-fii", custoTotal: "1000.00" }),
          posicao({
            ativoId: "a-sem-classe",
            classeId: "c-inexistente",
            custoTotal: "1000.00",
            segmentoId: null,
          }),
        ],
      }),
    );

    expect(carteira.resumo.patrimonioTotal).toBe("2000.00");
    expect(carteira.porClasse).toEqual([
      expect.objectContaining({ codigo: "FII", valor: "1000.00", percentual: "50.000000" }),
    ]);
    expect(carteira.consistente).toBe(false);
  });

  it("mantém a renda fixa fora das classes quando o catálogo não tem RENDA_FIXA", () => {
    const carteira = consolidarCarteira(
      dadosConsolidacao({
        classes: [CLASSES[1]],
        rendaFixa: { saldoTotal: "100.00", quantidadeTitulos: 1 },
      }),
    );

    expect(carteira.resumo.patrimonioTotal).toBe("100.00");
    expect(carteira.porClasse).toEqual([]);
    expect(carteira.consistente).toBe(false);
    expect(carteira.diagnostico.divergencia).toBe("100.00");
  });

  it("fecha a soma dos percentuais das classes em exatamente 100", () => {
    const classes: readonly ReferenciaCarteira[] = [
      ...CLASSES,
      { id: "c-outra", codigo: "OUTRA", nome: "Outra classe", ordem: 3 },
    ];
    const carteira = consolidarCarteira(
      dadosConsolidacao({
        classes,
        posicoes: [
          posicao({ ativoId: "a-1", classeId: "c-rf", custoTotal: "10000.00", segmentoId: null }),
          posicao({ ativoId: "a-2", classeId: "c-fii", custoTotal: "10000.00" }),
          posicao({ ativoId: "a-3", classeId: "c-outra", custoTotal: "10000.00", segmentoId: null }),
        ],
      }),
    );

    expect(carteira.resumo.patrimonioTotal).toBe("30000.00");
    expect(somarPercentuais(carteira.porClasse)).toBe("100.000000");
    expect(carteira.porClasse.at(-1)?.percentual).toBe("33.333334");
    expect(carteira.porClasse.map((item) => item.valorIndisponivel)).toEqual([
      false,
      true,
      true,
    ]);
  });

  it("conta apenas posições com quantidade positiva e todos os títulos de renda fixa", () => {
    const carteira = consolidarCarteira(
      dadosConsolidacao({
        posicoes: [
          posicao({ ativoId: "a-1", quantidade: "10.00000000", custoTotal: "1000.00" }),
          posicao({ ativoId: "a-2", quantidade: "0.00000000", custoTotal: "500.00" }),
          posicao({ ativoId: "a-3", quantidade: "-1.00000000", custoTotal: "100.00" }),
        ],
        rendaFixa: { saldoTotal: "1000.00", quantidadeTitulos: 3 },
      }),
    );

    expect(carteira.resumo.quantidadeAtivos).toBe(4);
    expect(carteira.resumo.patrimonioTotal).toBe("2000.00");
  });

  it("ignora segmento que não pertence ao catálogo", () => {
    const carteira = consolidarCarteira(
      dadosConsolidacao({
        posicoes: [posicao({ segmentoId: "s-inexistente", custoTotal: "10000.00" })],
      }),
    );

    expect(carteira.porSegmento).toEqual([]);
    expect(carteira.porClasse).toEqual([
      expect.objectContaining({ codigo: "FII", valor: "10000.00", percentual: "100.000000" }),
    ]);
    expect(carteira.posicoes[0]?.segmento).toBeNull();
  });

  it("expõe cada posição com classe, segmento e valor pelo custo (RN-020-5)", () => {
    const carteira = consolidarCarteira(
      dadosConsolidacao({
        posicoes: [posicao()],
        rendaFixa: { saldoTotal: "40000.00", quantidadeTitulos: 1 },
      }),
    );

    expect(carteira.posicoes).toEqual([
      {
        ativoId: "ativo-1",
        ticker: "HGLG11",
        nome: "CSHG Logística",
        classe: { codigo: "FII", nome: "Fundos Imobiliários" },
        segmento: { codigo: "LOGISTICA", nome: "Logística" },
        quantidade: "100.00000000",
        precoMedio: "600.000000",
        custoTotal: "60000.00",
        valorAtual: "60000.00",
        valorIndisponivel: true,
        percentual: "60.000000",
      },
    ]);
  });

  it("não lista posição com quantidade zero ou negativa (RN-020-5)", () => {
    const carteira = consolidarCarteira(
      dadosConsolidacao({
        posicoes: [
          posicao({ ativoId: "a-positiva", ticker: "POSI11" }),
          posicao({
            ativoId: "a-zerada",
            ticker: "ZERO11",
            quantidade: "0.00000000",
            custoTotal: "500.00",
          }),
          posicao({
            ativoId: "a-negativa",
            ticker: "NEGA11",
            quantidade: "-1.00000000",
            custoTotal: "100.00",
          }),
        ],
      }),
    );

    expect(carteira.posicoes.map((item) => item.ativoId)).toEqual(["a-positiva"]);
  });

  it("ordena por valor atual desc e calcula o percentual sobre o patrimônio total (RN-020-5)", () => {
    const carteira = consolidarCarteira(
      dadosConsolidacao({
        posicoes: [
          posicao({
            ativoId: "a-pequena",
            ticker: "PEQU11",
            precoMedio: "100.000000",
            custoTotal: "10000.00",
          }),
          posicao({
            ativoId: "a-grande",
            ticker: "GRAN11",
            precoMedio: "500.000000",
            custoTotal: "50000.00",
          }),
          posicao({
            ativoId: "a-media",
            ticker: "MEDI11",
            precoMedio: "300.000000",
            custoTotal: "30000.00",
            segmentoId: "s-shop",
          }),
        ],
        rendaFixa: { saldoTotal: "50000.00", quantidadeTitulos: 1 },
      }),
    );

    expect(carteira.resumo.patrimonioTotal).toBe("140000.00");
    expect(carteira.posicoes.map((item) => item.ativoId)).toEqual([
      "a-grande",
      "a-media",
      "a-pequena",
    ]);
    expect(carteira.posicoes.map((item) => item.percentual)).toEqual([
      "35.714286",
      "21.428571",
      "7.142857",
    ]);
    expect(carteira.posicoes[1]?.segmento).toEqual({
      codigo: "SHOPPING",
      nome: "Shopping Centers",
    });
  });

  it("desempata a ordem por ticker quando o valor atual é igual (RN-020-5)", () => {
    const carteira = consolidarCarteira(
      dadosConsolidacao({
        posicoes: [
          posicao({ ativoId: "a-z", ticker: "ZZZZ11", custoTotal: "1000.00" }),
          posicao({ ativoId: "a-a", ticker: "AAAA11", custoTotal: "1000.00" }),
        ],
      }),
    );

    expect(carteira.posicoes.map((item) => item.ticker)).toEqual([
      "AAAA11",
      "ZZZZ11",
    ]);
  });

  it("devolve posições vazias para a carteira sem posição (RN-020-5)", () => {
    const carteira = consolidarCarteira(
      dadosConsolidacao({
        rendaFixa: { saldoTotal: "10000.00", quantidadeTitulos: 1 },
      }),
    );

    expect(carteira.posicoes).toEqual([]);
  });

  it("aceita metadados de cotação quando houver mercado", () => {
    const carteira = consolidarCarteira(
      dadosConsolidacao({
        cotacoes: { statusDado: "MERCADO", dataReferencia: "2026-11-07" },
      }),
    );

    expect(carteira.cotacoes).toEqual({
      statusDado: "MERCADO",
      dataReferencia: "2026-11-07",
    });
  });

  it("remove o diagnóstico interno e preserva o contrato na apresentação", () => {
    const carteira = consolidarCarteira(
      dadosConsolidacao({
        posicoes: [posicao()],
        rendaFixa: { saldoTotal: "40000.00", quantidadeTitulos: 1 },
      }),
    );
    const api = apresentarCarteira(carteira);

    expect(api).not.toHaveProperty("diagnostico");
    expect(api.resumo.patrimonioTotal).toBe("100000.00");
    expect(api.consistente).toBe(true);
    expect(api.porClasse).toHaveLength(2);
    expect(api.posicoes).toEqual([
      {
        ativoId: "ativo-1",
        ticker: "HGLG11",
        nome: "CSHG Logística",
        classe: { codigo: "FII", nome: "Fundos Imobiliários" },
        segmento: { codigo: "LOGISTICA", nome: "Logística" },
        quantidade: "100.00000000",
        precoMedio: "600.000000",
        custoTotal: "60000.00",
        valorAtual: "60000.00",
        valorIndisponivel: true,
        percentual: "60.000000",
      },
    ]);
  });
});

describe("obterCarteira", () => {
  it("registra a inconsistência pelo callback injetado", async () => {
    const repositorio = new CarteiraRepositorioFake();
    repositorio.dados.set(
      USUARIO_A,
      dadosCarteira({
        posicoes: [posicao({ classeId: "c-inexistente", custoTotal: "1000.00" })],
      }),
    );
    const registrar = vi.fn();

    const resultado = await obterCarteira(
      { usuarioId: USUARIO_A },
      { repositorio, registrarInconsistencia: registrar, agora: AGORA },
    );

    expect(isOk(resultado)).toBe(true);
    if (isOk(resultado)) {
      expect(resultado.value.consistente).toBe(false);
      expect(resultado.value.atualizadoEm).toBe(AGORA.toISOString());
    }
    expect(registrar).toHaveBeenCalledWith({
      usuarioId: USUARIO_A,
      patrimonioTotal: "1000.00",
      somaClasses: "0.00",
      divergencia: "1000.00",
      tolerancia: "0.01",
    });
  });

  it("não chama o log quando a carteira é consistente e isola por usuário", async () => {
    const repositorio = new CarteiraRepositorioFake();
    repositorio.dados.set(
      USUARIO_A,
      dadosCarteira({
        posicoes: [posicao()],
        rendaFixa: { saldoTotal: "40000.00", quantidadeTitulos: 1 },
      }),
    );
    const registrar = vi.fn();

    const a = await obterCarteira(
      { usuarioId: USUARIO_A },
      { repositorio, registrarInconsistencia: registrar, agora: AGORA },
    );
    // Sem callback: a ausência do log não pode quebrar a leitura.
    const b = await obterCarteira(
      { usuarioId: USUARIO_B },
      { repositorio, agora: AGORA },
    );

    expect(registrar).not.toHaveBeenCalled();
    expect(isOk(a) && a.value.resumo.patrimonioTotal).toBe("100000.00");
    expect(isOk(b) && b.value.resumo.patrimonioTotal).toBe("0.00");
    expect(isOk(b) && b.value.porClasse).toEqual([]);
    expect(isOk(b) && b.value.porSegmento).toEqual([]);
  });
});

describe("pontosDoPeriodo", () => {
  it("gera um ponto por mês, limitando o mês corrente a `ate`", () => {
    expect(pontosDoPeriodo("2026-01-01", "2026-03-05", "mes")).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-05",
    ]);
  });

  it("atravessa a virada do ano", () => {
    expect(pontosDoPeriodo("2025-12-15", "2026-01-31", "mes")).toEqual([
      "2025-12-31",
      "2026-01-31",
    ]);
  });

  it("gera um ponto por dia, inclusive as pontas", () => {
    expect(pontosDoPeriodo("2026-01-09", "2026-01-11", "dia")).toEqual([
      "2026-01-09",
      "2026-01-10",
      "2026-01-11",
    ]);
  });

  it("rejeita data inválida na geração direta", () => {
    expect(() => pontosDoPeriodo("2026-02-30", "2026-03-01", "dia")).toThrow(
      "Período inválido",
    );
  });

  it("calcula o início do ano", () => {
    expect(inicioDoAno("2026-11-09")).toBe("2026-01-01");
  });
});

describe("validarPeriodoEvolucao", () => {
  it("aceita período e granularidade válidos", () => {
    expect(isOk(validarPeriodoEvolucao("2026-01-01", "2026-11-09", "mes"))).toBe(true);
  });

  it("rejeita `de` posterior a `ate` com 422", () => {
    const resultado = validarPeriodoEvolucao("2026-03-01", "2026-02-01", "mes");
    expect(isErr(resultado)).toBe(true);
    if (isErr(resultado)) {
      expect(resultado.error).toBeInstanceOf(AppError);
      expect(resultado.error.status).toBe(422);
      expect(resultado.error.details?.errors).toEqual([
        { field: "de", message: "A data inicial não pode ser posterior à data final." },
      ]);
    }
  });

  it("rejeita data e granularidade inválidas com o campo correto", () => {
    const dataInicial = validarPeriodoEvolucao("2026-02-30", "2026-03-01", "mes");
    const dataFinal = validarPeriodoEvolucao("2026-02-01", "2026-02-30", "mes");
    const granularidade = validarPeriodoEvolucao("2026-02-01", "2026-03-01", "ano");

    expect(isErr(dataInicial) && dataInicial.error.status).toBe(422);
    expect(isErr(dataInicial) && dataInicial.error.details?.errors).toEqual([
      { field: "de", message: "Data inicial inválida (use YYYY-MM-DD)." },
    ]);
    expect(isErr(dataFinal) && dataFinal.error.details?.errors).toEqual([
      { field: "ate", message: "Data final inválida (use YYYY-MM-DD)." },
    ]);
    expect(isErr(granularidade) && granularidade.error.details?.errors).toEqual([
      { field: "granularidade", message: "Granularidade inválida. Use dia ou mes." },
    ]);
  });
});

describe("montarEvolucaoCarteira", () => {
  const movimentacoesBase: readonly MovimentacaoCarteira[] = [
    movimentacao({ id: "m-jan", data: "2026-01-10", valorTotal: "10000.00" }),
    movimentacao({ id: "m-fev", data: "2026-02-10", valorTotal: "5000.00" }),
    movimentacao({
      id: "m-mar",
      ativoId: "ativo-2",
      data: "2026-03-05",
      valorTotal: "7000.00",
    }),
  ];

  it("reconstrói o custo dos FIIs mês a mês e mantém a renda fixa constante", () => {
    const evolucao = montarEvolucaoCarteira({
      de: "2026-01-01",
      ate: "2026-03-05",
      granularidade: "mes",
      movimentacoes: movimentacoesBase,
      saldoRendaFixa: "20000.00",
    });

    expect(evolucao.pontos).toEqual([
      { data: "2026-01-31", patrimonio: "30000.00", rendaFixa: "20000.00", fiis: "10000.00" },
      { data: "2026-02-28", patrimonio: "35000.00", rendaFixa: "20000.00", fiis: "15000.00" },
      { data: "2026-03-05", patrimonio: "42000.00", rendaFixa: "20000.00", fiis: "22000.00" },
    ]);
    expect(evolucao.pontos.map((ponto) => ponto.rendaFixa)).toEqual([
      "20000.00",
      "20000.00",
      "20000.00",
    ]);
  });

  it("gera série diária aplicando a movimentação somente a partir da data", () => {
    const evolucao = montarEvolucaoCarteira({
      de: "2026-01-09",
      ate: "2026-01-11",
      granularidade: "dia",
      movimentacoes: [movimentacao({ data: "2026-01-10", valorTotal: "10000.00" })],
      saldoRendaFixa: "0.00",
    });

    expect(evolucao.pontos).toEqual([
      { data: "2026-01-09", patrimonio: "0.00", rendaFixa: "0.00", fiis: "0.00" },
      { data: "2026-01-10", patrimonio: "10000.00", rendaFixa: "0.00", fiis: "10000.00" },
      { data: "2026-01-11", patrimonio: "10000.00", rendaFixa: "0.00", fiis: "10000.00" },
    ]);
  });

  it("ignora movimentações canceladas", () => {
    const evolucao = montarEvolucaoCarteira({
      de: "2026-01-01",
      ate: "2026-01-31",
      granularidade: "mes",
      movimentacoes: [
        movimentacao({
          data: "2026-01-10",
          valorTotal: "10000.00",
          canceladaEm: new Date("2026-01-15T12:00:00.000Z"),
        }),
      ],
      saldoRendaFixa: "0.00",
    });

    expect(evolucao.pontos).toEqual([
      { data: "2026-01-31", patrimonio: "0.00", rendaFixa: "0.00", fiis: "0.00" },
    ]);
  });

  it("aplica venda pelo custo médio sem quebrar a série", () => {
    const evolucao = montarEvolucaoCarteira({
      de: "2026-01-01",
      ate: "2026-02-28",
      granularidade: "mes",
      movimentacoes: [
        movimentacao({
          id: "compra",
          data: "2026-01-10",
          quantidade: "10.00000000",
          valorUnitario: "1000.00",
          valorTotal: "10000.00",
        }),
        movimentacao({
          id: "venda",
          data: "2026-02-10",
          tipo: "VENDA",
          quantidade: "4.00000000",
          valorUnitario: "1200.00",
          valorTotal: "4800.00",
        }),
      ],
      saldoRendaFixa: "0.00",
    });

    expect(evolucao.pontos.at(-1)).toEqual({
      data: "2026-02-28",
      patrimonio: "6000.00",
      rendaFixa: "0.00",
      fiis: "6000.00",
    });
  });

  it("falha de forma explícita diante de movimentação sem quantidade", () => {
    expect(() =>
      montarEvolucaoCarteira({
        de: "2026-01-01",
        ate: "2026-01-31",
        granularidade: "mes",
        movimentacoes: [movimentacao({ quantidade: null })],
        saldoRendaFixa: "0.00",
      }),
    ).toThrow(AppError);
  });

  it("apresenta a evolução no formato do contrato", () => {
    const evolucao = montarEvolucaoCarteira({
      de: "2026-01-01",
      ate: "2026-01-31",
      granularidade: "mes",
      movimentacoes: [],
      saldoRendaFixa: "100.00",
    });

    expect(apresentarEvolucao(evolucao)).toEqual({
      pontos: [{ data: "2026-01-31", patrimonio: "100.00", rendaFixa: "100.00", fiis: "0.00" }],
    });
  });
});

describe("obterEvolucao", () => {
  it("usa início do ano e hoje de São Paulo como defaults e granularidade mensal", async () => {
    const repositorio = new CarteiraRepositorioFake();

    const resultado = await obterEvolucao(
      { usuarioId: USUARIO_A },
      { repositorio, agora: AGORA },
    );

    expect(isOk(resultado)).toBe(true);
    if (isOk(resultado)) {
      expect(resultado.value.pontos).toHaveLength(11);
      expect(resultado.value.pontos[0]?.data).toBe("2026-01-31");
      expect(resultado.value.pontos.at(-1)?.data).toBe(HOJE);
    }
  });

  it("isola a série por usuário", async () => {
    const repositorio = new CarteiraRepositorioFake();
    repositorio.saldos.set(USUARIO_A, "0.00");
    repositorio.saldos.set(USUARIO_B, "0.00");
    repositorio.movimentacoes.set(USUARIO_A, [
      movimentacao({ data: "2026-01-10", valorTotal: "10000.00" }),
    ]);
    repositorio.movimentacoes.set(USUARIO_B, []);

    const a = await obterEvolucao(
      { usuarioId: USUARIO_A, de: "2026-01-01", ate: "2026-01-31", granularidade: "mes" },
      { repositorio, agora: AGORA },
    );
    const b = await obterEvolucao(
      { usuarioId: USUARIO_B, de: "2026-01-01", ate: "2026-01-31", granularidade: "mes" },
      { repositorio, agora: AGORA },
    );

    expect(isOk(a) && a.value.pontos[0]?.fiis).toBe("10000.00");
    expect(isOk(b) && b.value.pontos[0]?.fiis).toBe("0.00");
  });

  it("devolve 422 para período invertido e granularidade inválida", async () => {
    const repositorio = new CarteiraRepositorioFake();

    const invertido = await obterEvolucao(
      {
        usuarioId: USUARIO_A,
        de: "2026-03-01",
        ate: "2026-02-01",
        granularidade: "mes",
      },
      { repositorio, agora: AGORA },
    );
    const granularidade = await obterEvolucao(
      {
        usuarioId: USUARIO_A,
        de: "2026-01-01",
        ate: "2026-02-01",
        granularidade: "ano" as GranularidadeEvolucao,
      },
      { repositorio, agora: AGORA },
    );

    expect(isErr(invertido) && invertido.error.status).toBe(422);
    expect(isErr(invertido) && invertido.error.details?.errors).toEqual([
      { field: "de", message: "A data inicial não pode ser posterior à data final." },
    ]);
    expect(isErr(granularidade) && granularidade.error.status).toBe(422);
    expect(isErr(granularidade) && granularidade.error.details?.errors).toEqual([
      { field: "granularidade", message: "Granularidade inválida. Use dia ou mes." },
    ]);
  });
});

describe("hojeIsoSaoPaulo", () => {
  it("usa o calendário de São Paulo, não o UTC do processo", () => {
    expect(hojeIsoSaoPaulo(new Date("2026-01-01T02:30:00.000Z"))).toBe("2025-12-31");
    expect(hojeIsoSaoPaulo(AGORA)).toBe(HOJE);
  });
});
