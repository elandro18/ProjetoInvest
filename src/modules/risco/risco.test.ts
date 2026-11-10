import { describe, expect, it } from "vitest";

import { AppError } from "../../lib/errors";
import { isErr, isOk } from "../../lib/result";
import type { ValorCarteira, ValoresCarteira } from "../carteira/valor-carteira";
import {
  apresentarConcentracao,
  apresentarLimites,
  apresentarVigentes,
} from "./apresentacao";
import { calcularConcentracao } from "./concentracao";
import { chaveReferencia, normalizarReferencia, validarLimites } from "./limites";
import { montarConsulta, obterLimites } from "./obter-limites";
import { obterConcentracao } from "./obter-concentracao";
import type {
  ConcentracaoRepositorio,
  DadosConcentracao,
  DimensaoConcentracao,
  LimiteConcentracaoRepositorio,
  LimiteRegistro,
  NovoLimite,
  PosicaoConcentracao,
  TituloConcentracao,
} from "./repositorio";
import { substituirLimites } from "./substituir-limites";

/**
 * Testes do controle de concentração (RN-049-1..RN-049-3).
 *
 * Cobrem validação e normalização dos limites, substituição com histórico,
 * cálculo por dimensão, limite ausente, excedido/excesso, gestor ausente, renda
 * fixa por instituição, carteira vazia e isolamento entre titulares. Os ports
 * são substituídos por fakes em memória — nenhum banco é tocado.
 */

const USUARIO_A = "usuario-a";
const USUARIO_B = "usuario-b";
const HOJE = "2026-11-09";
const ONTEM = "2026-11-01";
const AGORA = new Date("2026-11-09T12:00:00.000Z");

interface LinhaLimite extends LimiteRegistro {
  readonly usuarioId: string;
}

class LimiteRepositorioFake implements LimiteConcentracaoRepositorio {
  readonly linhas: LinhaLimite[] = [];
  private sequencia = 0;

  async listarVigentes(usuarioId: string): Promise<readonly LimiteRegistro[]> {
    return this.clonar(usuarioId, true);
  }

  async listarTodas(usuarioId: string): Promise<readonly LimiteRegistro[]> {
    return this.clonar(usuarioId, false);
  }

  async substituirVigencia(
    usuarioId: string,
    limites: readonly NovoLimite[],
    vigenciaInicio: string,
  ): Promise<void> {
    for (const linha of this.linhas) {
      if (linha.usuarioId === usuarioId && linha.vigenciaFim === null) {
        Object.assign(linha, { vigenciaFim: vigenciaInicio });
      }
    }

    for (const limite of limites) {
      this.sequencia += 1;
      this.linhas.push({
        id: `limite-${this.sequencia}`,
        usuarioId,
        dimensao: limite.dimensao,
        referencia: limite.referencia,
        percentualMax: limite.percentualMax,
        vigenciaInicio,
        vigenciaFim: null,
        criadoEm: AGORA,
      });
    }
  }

  private clonar(usuarioId: string, somenteVigentes: boolean): LimiteRegistro[] {
    return this.linhas
      .filter(
        (linha) =>
          linha.usuarioId === usuarioId && (!somenteVigentes || linha.vigenciaFim === null),
      )
      .map((linha) => ({
        id: linha.id,
        dimensao: linha.dimensao,
        referencia: linha.referencia,
        percentualMax: linha.percentualMax,
        vigenciaInicio: linha.vigenciaInicio,
        vigenciaFim: linha.vigenciaFim,
        criadoEm: linha.criadoEm,
      }));
  }
}

class ConcentracaoRepositorioFake implements ConcentracaoRepositorio {
  private readonly porUsuario = new Map<string, DadosConcentracao>();

  definir(usuarioId: string, dados: DadosConcentracao): void {
    this.porUsuario.set(usuarioId, dados);
  }

  async carregarDados(usuarioId: string): Promise<DadosConcentracao> {
    return this.porUsuario.get(usuarioId) ?? { posicoes: [], titulos: [] };
  }
}

class ValorCarteiraFake implements ValorCarteira {
  private readonly totais = new Map<string, string>();

  definir(usuarioId: string, total: string): void {
    this.totais.set(usuarioId, total);
  }

  async agregar(usuarioId: string): Promise<ValoresCarteira> {
    return { total: this.totais.get(usuarioId) ?? "0.00", classes: [], segmentos: [] };
  }
}

const POSICOES: readonly PosicaoConcentracao[] = [
  {
    ticker: "HGLG11",
    nome: "CSHG Logística",
    gestor: "CSHG",
    segmentoCodigo: "LOGISTICA",
    segmentoNome: "Logística",
    valor: "16000.00",
  },
  {
    ticker: "KNRI11",
    nome: "Kinea Renda Imobiliária",
    gestor: "Kinea",
    segmentoCodigo: "LAJES",
    segmentoNome: "Lajes Corporativas",
    valor: "4000.00",
  },
];

const TITULOS: readonly TituloConcentracao[] = [
  { instituicao: "Banco Alfa", saldo: "12000.00" },
  { instituicao: "banco alfa ", saldo: "3000.00" },
  { instituicao: "Banco Beta", saldo: "5000.00" },
];

const TOTAL = "40000.00";

function dimensao(
  resultado: ReturnType<typeof calcularConcentracao>,
  nome: DimensaoConcentracao,
) {
  const encontrada = resultado.dimensoes.find((item) => item.dimensao === nome);
  if (encontrada === undefined) {
    throw new Error(`dimensão ${nome} ausente`);
  }
  return encontrada;
}

function limite(
  dimensaoLimite: DimensaoConcentracao,
  referencia: string | null,
  percentualMax: string,
): LimiteRegistro {
  return {
    id: `limite-${dimensaoLimite}-${referencia ?? "default"}`,
    dimensao: dimensaoLimite,
    referencia,
    percentualMax,
    vigenciaInicio: HOJE,
    vigenciaFim: null,
    criadoEm: AGORA,
  };
}

describe("validarLimites", () => {
  it("normaliza dimensão, referência e percentual", () => {
    const resultado = validarLimites([
      { dimensao: " gestora ", referencia: "  CSHG  ", percentualMax: "30" },
      { dimensao: "ativo", referencia: null, percentualMax: "20.5" },
    ]);

    expect(isOk(resultado)).toBe(true);
    if (!resultado.ok) {
      return;
    }

    expect(resultado.value).toEqual([
      { dimensao: "GESTORA", referencia: "CSHG", percentualMax: "30.000000" },
      { dimensao: "ATIVO", referencia: null, percentualMax: "20.500000" },
    ]);
  });

  it("aceita lista vazia (remoção de todos os limites)", () => {
    const resultado = validarLimites([]);

    expect(isOk(resultado)).toBe(true);
    if (resultado.ok) {
      expect(resultado.value).toEqual([]);
    }
  });

  it("rejeita dimensão desconhecida com RISCO_LIMITE_INVALIDO e o campo", () => {
    const resultado = validarLimites([
      { dimensao: "TICKER", referencia: null, percentualMax: "10" },
    ]);

    expect(isErr(resultado)).toBe(true);
    if (resultado.ok) {
      return;
    }

    expect(resultado.error).toBeInstanceOf(AppError);
    expect(resultado.error.code).toBe("RISCO_LIMITE_INVALIDO");
    expect(resultado.error.status).toBe(422);
    expect(resultado.error.details).toEqual({ campo: "limites[0].dimensao", dimensao: "TICKER" });
  });

  it.each(["0", "-5", "101", "abc"])("rejeita percentual %s", (percentualMax) => {
    const resultado = validarLimites([
      { dimensao: "ATIVO", referencia: null, percentualMax },
    ]);

    expect(isErr(resultado)).toBe(true);
    if (resultado.ok) {
      return;
    }

    expect(resultado.error.code).toBe("RISCO_LIMITE_INVALIDO");
    expect(resultado.error.details).toEqual({
      campo: "limites[0].percentualMax",
      dimensao: "ATIVO",
      referencia: null,
    });
  });

  it("rejeita referência acima de 120 caracteres", () => {
    const resultado = validarLimites([
      { dimensao: "GESTORA", referencia: "x".repeat(121), percentualMax: "10" },
    ]);

    expect(isErr(resultado)).toBe(true);
    if (resultado.ok) {
      return;
    }

    expect(resultado.error.code).toBe("RISCO_LIMITE_INVALIDO");
    expect(resultado.error.details).toMatchObject({ campo: "limites[0].referencia" });
  });

  it("rejeita duplicidade ignorando caixa e espaços", () => {
    const resultado = validarLimites([
      { dimensao: "GESTORA", referencia: "CSHG", percentualMax: "20" },
      { dimensao: "GESTORA", referencia: " cshg ", percentualMax: "30" },
    ]);

    expect(isErr(resultado)).toBe(true);
    if (resultado.ok) {
      return;
    }

    expect(resultado.error.code).toBe("RISCO_LIMITE_INVALIDO");
    expect(resultado.error.details).toMatchObject({ campo: "limites[1].referencia" });
  });

  it("trata referência nula e vazia como a mesma duplicidade", () => {
    const resultado = validarLimites([
      { dimensao: "ATIVO", referencia: null, percentualMax: "10" },
      { dimensao: "ATIVO", referencia: "   ", percentualMax: "20" },
    ]);

    expect(isErr(resultado)).toBe(true);
  });

  it("permite a mesma referência em dimensões diferentes", () => {
    const resultado = validarLimites([
      { dimensao: "GESTORA", referencia: "CSHG", percentualMax: "20" },
      { dimensao: "SEGMENTO", referencia: "CSHG", percentualMax: "20" },
    ]);

    expect(isOk(resultado)).toBe(true);
  });

  it("normaliza e compara referências sem caixa", () => {
    expect(normalizarReferencia("  Banco   Alfa ")).toBe("Banco Alfa");
    expect(normalizarReferencia("   ")).toBeNull();
    expect(chaveReferencia("EMISSOR", "Banco Alfa")).toBe(
      chaveReferencia("EMISSOR", " banco alfa "),
    );
    expect(chaveReferencia("EMISSOR", null)).toBe(chaveReferencia("EMISSOR", ""));
  });
});

describe("substituirLimites e obterLimites", () => {
  function deps(repositorio: LimiteRepositorioFake) {
    return { repositorio };
  }

  it("substitui o conjunto vigente e preserva o anterior no histórico", async () => {
    const repositorio = new LimiteRepositorioFake();

    const primeira = await substituirLimites(
      {
        usuarioId: USUARIO_A,
        hoje: ONTEM,
        limites: [{ dimensao: "ATIVO", referencia: null, percentualMax: "10" }],
      },
      deps(repositorio),
    );
    expect(isOk(primeira)).toBe(true);

    const segunda = await substituirLimites(
      {
        usuarioId: USUARIO_A,
        hoje: HOJE,
        limites: [{ dimensao: "ATIVO", referencia: null, percentualMax: "20" }],
      },
      deps(repositorio),
    );
    expect(isOk(segunda)).toBe(true);
    if (!segunda.ok) {
      return;
    }

    expect(segunda.value.vigente).toHaveLength(1);
    expect(segunda.value.vigente[0]).toMatchObject({
      dimensao: "ATIVO",
      referencia: null,
      percentualMax: "20.000000",
      vigenciaInicio: HOJE,
      vigenciaFim: null,
    });

    expect(segunda.value.historico).toHaveLength(1);
    expect(segunda.value.historico[0]).toMatchObject({
      dimensao: "ATIVO",
      percentualMax: "10.000000",
      vigenciaInicio: ONTEM,
      vigenciaFim: HOJE,
    });

    const leitura = await obterLimites({ usuarioId: USUARIO_A }, deps(repositorio));
    expect(isOk(leitura)).toBe(true);
    if (leitura.ok) {
      expect(leitura.value.vigente).toHaveLength(1);
      expect(leitura.value.historico).toHaveLength(1);
    }
  });

  it("remove todos os limites quando recebe lista vazia", async () => {
    const repositorio = new LimiteRepositorioFake();
    await substituirLimites(
      {
        usuarioId: USUARIO_A,
        hoje: ONTEM,
        limites: [
          { dimensao: "ATIVO", referencia: null, percentualMax: "20" },
          { dimensao: "GESTORA", referencia: "CSHG", percentualMax: "30" },
        ],
      },
      deps(repositorio),
    );

    const resultado = await substituirLimites(
      { usuarioId: USUARIO_A, hoje: HOJE, limites: [] },
      deps(repositorio),
    );

    expect(isOk(resultado)).toBe(true);
    if (!resultado.ok) {
      return;
    }

    expect(resultado.value.vigente).toEqual([]);
    expect(resultado.value.historico).toHaveLength(2);
    expect(resultado.value.historico.every((linha) => linha.vigenciaFim === HOJE)).toBe(true);
  });

  it("não grava nada quando a validação falha", async () => {
    const repositorio = new LimiteRepositorioFake();

    const resultado = await substituirLimites(
      {
        usuarioId: USUARIO_A,
        hoje: HOJE,
        limites: [{ dimensao: "ATIVO", referencia: null, percentualMax: "0" }],
      },
      deps(repositorio),
    );

    expect(isErr(resultado)).toBe(true);
    expect(repositorio.linhas).toHaveLength(0);
  });

  it("isola os limites por titular", async () => {
    const repositorio = new LimiteRepositorioFake();

    await substituirLimites(
      {
        usuarioId: USUARIO_A,
        hoje: HOJE,
        limites: [{ dimensao: "ATIVO", referencia: null, percentualMax: "20" }],
      },
      deps(repositorio),
    );

    const deB = await obterLimites({ usuarioId: USUARIO_B }, deps(repositorio));
    expect(isOk(deB)).toBe(true);
    if (deB.ok) {
      expect(deB.value.vigente).toEqual([]);
      expect(deB.value.historico).toEqual([]);
    }
  });

  it("ordena o vigente por dimensão e o histórico do mais recente ao mais antigo", () => {
    const consulta = montarConsulta([
      limite("SEGMENTO", "LOGISTICA", "10.000000"),
      limite("ATIVO", null, "20.000000"),
      limite("ATIVO", "HGLG11", "15.000000"),
      {
        ...limite("ATIVO", "HGLG11", "15.000000"),
        vigenciaInicio: ONTEM,
        vigenciaFim: HOJE,
      },
      {
        ...limite("GESTORA", "CSHG", "30.000000"),
        vigenciaInicio: "2026-10-01",
        vigenciaFim: HOJE,
      },
    ]);

    expect(consulta.vigente.map((linha) => linha.dimensao)).toEqual([
      "ATIVO",
      "ATIVO",
      "SEGMENTO",
    ]);
    expect(consulta.vigente[0]?.referencia).toBeNull();
    expect(consulta.vigente[1]?.referencia).toBe("HGLG11");
    expect(consulta.historico.map((linha) => linha.dimensao)).toEqual(["ATIVO", "GESTORA"]);
  });
});

describe("calcularConcentracao", () => {
  it("calcula as cinco dimensões com a base no patrimônio total", () => {
    const resultado = calcularConcentracao({
      total: TOTAL,
      posicoes: POSICOES,
      titulos: TITULOS,
      limites: [],
    });

    expect(resultado.baseCalculo).toBe("PATRIMONIO_TOTAL");
    expect(resultado.dimensoes.map((item) => item.dimensao)).toEqual([
      "ATIVO",
      "GESTORA",
      "SEGMENTO",
      "EMISSOR",
      "IMOVEL",
    ]);

    const ativos = dimensao(resultado, "ATIVO");
    expect(ativos.disponivel).toBe(true);
    expect(ativos.itens).toEqual([
      {
        referencia: "HGLG11",
        nome: "CSHG Logística",
        valor: "16000.00",
        percentual: "40.000000",
        limite: null,
        excedido: false,
        excessoPontos: "0.000000",
      },
      {
        referencia: "KNRI11",
        nome: "Kinea Renda Imobiliária",
        valor: "4000.00",
        percentual: "10.000000",
        limite: null,
        excedido: false,
        excessoPontos: "0.000000",
      },
    ]);

    expect(dimensao(resultado, "GESTORA").itens.map((item) => [item.referencia, item.percentual])).toEqual([
      ["CSHG", "40.000000"],
      ["Kinea", "10.000000"],
    ]);

    expect(
      dimensao(resultado, "SEGMENTO").itens.map((item) => [item.referencia, item.nome, item.percentual]),
    ).toEqual([
      ["LOGISTICA", "Logística", "40.000000"],
      ["LAJES", "Lajes Corporativas", "10.000000"],
    ]);

    expect(
      dimensao(resultado, "EMISSOR").itens.map((item) => [item.referencia, item.valor, item.percentual]),
    ).toEqual([
      ["Banco Alfa", "15000.00", "37.500000"],
      ["Banco Beta", "5000.00", "12.500000"],
    ]);

    const imovel = dimensao(resultado, "IMOVEL");
    expect(imovel.disponivel).toBe(false);
    expect(imovel.itens).toEqual([]);
  });

  it("marca excedido e calcula o excesso em pontos percentuais", () => {
    const resultado = calcularConcentracao({
      total: TOTAL,
      posicoes: POSICOES,
      titulos: TITULOS,
      limites: [limite("ATIVO", null, "20.000000")],
    });

    const hglg = dimensao(resultado, "ATIVO").itens.find((item) => item.referencia === "HGLG11");
    expect(hglg).toMatchObject({
      percentual: "40.000000",
      limite: "20.000000",
      excedido: true,
      excessoPontos: "20.000000",
    });

    const knri = dimensao(resultado, "ATIVO").itens.find((item) => item.referencia === "KNRI11");
    expect(knri).toMatchObject({
      percentual: "10.000000",
      limite: "20.000000",
      excedido: false,
      excessoPontos: "0.000000",
    });
  });

  it("usa o limite específico da referência antes do default da dimensão", () => {
    const resultado = calcularConcentracao({
      total: TOTAL,
      posicoes: POSICOES,
      titulos: TITULOS,
      limites: [
        limite("ATIVO", null, "20.000000"),
        limite("ATIVO", "hglg11", "15.000000"),
      ],
    });

    const ativos = dimensao(resultado, "ATIVO").itens;
    expect(ativos.find((item) => item.referencia === "HGLG11")).toMatchObject({
      limite: "15.000000",
      excedido: true,
      excessoPontos: "25.000000",
    });
    expect(ativos.find((item) => item.referencia === "KNRI11")).toMatchObject({
      limite: "20.000000",
      excedido: false,
    });
  });

  it("não alerta quando o limite da dimensão não está configurado", () => {
    const resultado = calcularConcentracao({
      total: TOTAL,
      posicoes: POSICOES,
      titulos: TITULOS,
      limites: [limite("GESTORA", "CSHG", "30.000000")],
    });

    for (const item of dimensao(resultado, "SEGMENTO").itens) {
      expect(item.limite).toBeNull();
      expect(item.excedido).toBe(false);
      expect(item.excessoPontos).toBe("0.000000");
    }
  });

  it("ignora ativo sem gestor na dimensão GESTORA", () => {
    const posicoes: readonly PosicaoConcentracao[] = [
      ...POSICOES,
      {
        ticker: "SEMG11",
        nome: "Fundo Sem Gestor",
        gestor: "   ",
        segmentoCodigo: "RECEBIVEIS",
        segmentoNome: "Recebíveis Imobiliários",
        valor: "2000.00",
      },
    ];

    const resultado = calcularConcentracao({
      total: "42000.00",
      posicoes,
      titulos: [],
      limites: [],
    });

    expect(dimensao(resultado, "GESTORA").itens.map((item) => item.referencia)).toEqual([
      "CSHG",
      "Kinea",
    ]);
    expect(dimensao(resultado, "ATIVO").itens.map((item) => item.referencia)).toContain("SEMG11");
  });

  it("soma renda fixa por instituição sem diferenciar caixa", () => {
    const resultado = calcularConcentracao({
      total: TOTAL,
      posicoes: [],
      titulos: TITULOS,
      limites: [],
    });

    expect(dimensao(resultado, "EMISSOR").itens).toEqual([
      {
        referencia: "Banco Alfa",
        nome: "Banco Alfa",
        valor: "15000.00",
        percentual: "37.500000",
        limite: null,
        excedido: false,
        excessoPontos: "0.000000",
      },
      {
        referencia: "Banco Beta",
        nome: "Banco Beta",
        valor: "5000.00",
        percentual: "12.500000",
        limite: null,
        excedido: false,
        excessoPontos: "0.000000",
      },
    ]);
  });

  it("devolve dimensões vazias sem divisão por zero na carteira vazia", () => {
    const resultado = calcularConcentracao({
      total: "0.00",
      posicoes: [],
      titulos: [],
      limites: [limite("ATIVO", null, "20.000000")],
    });

    expect(resultado.dimensoes).toHaveLength(5);
    for (const item of resultado.dimensoes) {
      expect(item.itens).toEqual([]);
    }
  });

  it("não divide por zero quando há item mas patrimônio total zerado", () => {
    const resultado = calcularConcentracao({
      total: "0.00",
      posicoes: [{ ...POSICOES[0], valor: "25000.00" }],
      titulos: [],
      limites: [limite("ATIVO", null, "20.000000")],
    });

    expect(dimensao(resultado, "ATIVO").itens[0]).toMatchObject({
      referencia: "HGLG11",
      valor: "25000.00",
      percentual: "0.000000",
      excedido: false,
      excessoPontos: "0.000000",
    });
  });

  it("ignora posição sem segmento e usa o código quando o nome do segmento falta", () => {
    const resultado = calcularConcentracao({
      total: "20000.00",
      posicoes: [
        { ...POSICOES[0], segmentoCodigo: null, segmentoNome: null },
        { ...POSICOES[1], segmentoCodigo: "OUTROS", segmentoNome: null },
      ],
      titulos: [{ instituicao: "   ", saldo: "1000.00" }],
      limites: [],
    });

    expect(dimensao(resultado, "SEGMENTO").itens).toEqual([
      {
        referencia: "OUTROS",
        nome: "OUTROS",
        valor: "4000.00",
        percentual: "20.000000",
        limite: null,
        excedido: false,
        excessoPontos: "0.000000",
      },
    ]);
    expect(dimensao(resultado, "EMISSOR").itens).toEqual([]);
  });

  it("desempata itens de mesmo valor pela referência", () => {
    const resultado = calcularConcentracao({
      total: "8000.00",
      posicoes: [
        { ...POSICOES[0], ticker: "ZZZZ11", valor: "4000.00" },
        { ...POSICOES[1], ticker: "AAAA11", valor: "4000.00" },
      ],
      titulos: [],
      limites: [],
    });

    expect(dimensao(resultado, "ATIVO").itens.map((item) => item.referencia)).toEqual([
      "AAAA11",
      "ZZZZ11",
    ]);
  });
});

describe("obterConcentracao", () => {
  function deps() {
    const valorCarteira = new ValorCarteiraFake();
    const repositorio = new ConcentracaoRepositorioFake();
    const limites = new LimiteRepositorioFake();
    return { valorCarteira, repositorio, limites };
  }

  it("usa o patrimônio total do port ValorCarteira como base", async () => {
    const servicos = deps();
    servicos.valorCarteira.definir("usuario-fii", "100000.00");
    servicos.repositorio.definir("usuario-fii", {
      posicoes: [
        {
          ticker: "HGLG11",
          nome: "CSHG Logística",
          gestor: "CSHG",
          segmentoCodigo: "LOGISTICA",
          segmentoNome: "Logística",
          valor: "25000.00",
        },
      ],
      titulos: [{ instituicao: "Banco Alfa", saldo: "75000.00" }],
    });

    await servicos.limites.substituirVigencia(
      "usuario-fii",
      [
        { dimensao: "ATIVO", referencia: null, percentualMax: "20.000000" },
        { dimensao: "GESTORA", referencia: null, percentualMax: "30.000000" },
      ],
      HOJE,
    );

    const resultado = await obterConcentracao(
      { usuarioId: "usuario-fii" },
      {
        valorCarteira: servicos.valorCarteira,
        repositorio: servicos.repositorio,
        limites: servicos.limites,
      },
    );

    expect(isOk(resultado)).toBe(true);
    if (!resultado.ok) {
      return;
    }

    expect(resultado.value.baseCalculo).toBe("PATRIMONIO_TOTAL");

    const ativo = dimensao(resultado.value, "ATIVO").itens[0];
    expect(ativo).toMatchObject({
      referencia: "HGLG11",
      percentual: "25.000000",
      limite: "20.000000",
      excedido: true,
      excessoPontos: "5.000000",
    });

    const gestora = dimensao(resultado.value, "GESTORA").itens[0];
    expect(gestora).toMatchObject({
      referencia: "CSHG",
      percentual: "25.000000",
      limite: "30.000000",
      excedido: false,
      excessoPontos: "0.000000",
    });

    expect(dimensao(resultado.value, "EMISSOR").itens[0]).toMatchObject({
      referencia: "Banco Alfa",
      percentual: "75.000000",
    });
    expect(dimensao(resultado.value, "IMOVEL")).toMatchObject({
      disponivel: false,
      itens: [],
    });
  });

  it("devolve carteira vazia para titular sem dados", async () => {
    const servicos = deps();

    const resultado = await obterConcentracao(
      { usuarioId: USUARIO_B },
      {
        valorCarteira: servicos.valorCarteira,
        repositorio: servicos.repositorio,
        limites: servicos.limites,
      },
    );

    expect(isOk(resultado)).toBe(true);
    if (!resultado.ok) {
      return;
    }

    expect(resultado.value.dimensoes.every((item) => item.itens.length === 0)).toBe(true);
  });

  it("mantém concentração e limites isolados entre titulares", async () => {
    const servicos = deps();
    servicos.valorCarteira.definir(USUARIO_A, TOTAL);
    servicos.repositorio.definir(USUARIO_A, { posicoes: POSICOES, titulos: TITULOS });
    await servicos.limites.substituirVigencia(
      USUARIO_A,
      [{ dimensao: "ATIVO", referencia: null, percentualMax: "20.000000" }],
      HOJE,
    );

    const deB = await obterConcentracao(
      { usuarioId: USUARIO_B },
      {
        valorCarteira: servicos.valorCarteira,
        repositorio: servicos.repositorio,
        limites: servicos.limites,
      },
    );

    expect(isOk(deB)).toBe(true);
    if (!deB.ok) {
      return;
    }

    expect(deB.value.dimensoes.every((item) => item.itens.length === 0)).toBe(true);

    const deA = await obterConcentracao(
      { usuarioId: USUARIO_A },
      {
        valorCarteira: servicos.valorCarteira,
        repositorio: servicos.repositorio,
        limites: servicos.limites,
      },
    );
    expect(isOk(deA)).toBe(true);
    if (deA.ok) {
      expect(dimensao(deA.value, "ATIVO").itens).toHaveLength(2);
      expect(dimensao(deA.value, "ATIVO").itens[0]?.limite).toBe("20.000000");
    }
  });
});

describe("apresentacao", () => {
  it("expõe os limites vigentes e o histórico com vigenciaFim", () => {
    const apresentado = apresentarLimites({
      vigente: [limite("ATIVO", null, "20.000000")],
      historico: [
        {
          ...limite("GESTORA", "CSHG", "30.000000"),
          vigenciaInicio: ONTEM,
          vigenciaFim: HOJE,
        },
      ],
    });

    expect(apresentado).toEqual({
      vigente: [
        {
          dimensao: "ATIVO",
          referencia: null,
          percentualMax: "20.000000",
          vigenciaInicio: HOJE,
        },
      ],
      historico: [
        {
          dimensao: "GESTORA",
          referencia: "CSHG",
          percentualMax: "30.000000",
          vigenciaInicio: ONTEM,
          vigenciaFim: HOJE,
        },
      ],
    });
    expect(apresentarVigentes([])).toEqual([]);
  });

  it("expõe a concentração no contrato da API", () => {
    const calculada = calcularConcentracao({
      total: TOTAL,
      posicoes: POSICOES,
      titulos: TITULOS,
      limites: [],
    });

    const apresentada = apresentarConcentracao(calculada);

    expect(apresentada.baseCalculo).toBe("PATRIMONIO_TOTAL");
    expect(apresentada.dimensoes).toHaveLength(5);
    expect(apresentada.dimensoes[4]).toEqual({
      dimensao: "IMOVEL",
      disponivel: false,
      itens: [],
    });
  });
});
