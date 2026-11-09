import { describe, expect, it } from "vitest";

import { Decimal } from "../../lib/decimal";
import { isErr, isOk } from "../../lib/result";
import { agregarValoresCarteira } from "../carteira/agregar-valores-carteira";
import type { ValorCarteira, ValoresCarteira } from "../carteira/valor-carteira";
import {
  apresentarDesvios,
  apresentarMetas,
  apresentarVigente,
} from "./apresentacao";
import {
  calcularDesvios,
  calcularItensDesvio,
  type ItemDesvio,
} from "./calcular-desvios";
import {
  classificarDesvio,
  montarDefaults,
  validarEntradaMetas,
  METAS_CLASSE_PADRAO,
  METAS_SEGMENTO_PADRAO,
  type EntradaMeta,
  type EntradaMetas,
} from "./metas";
import {
  agruparHistorico,
  montarVigente,
  obterMetas,
  type ConsultaMetas,
} from "./obter-metas";
import type {
  AlocacaoMetaRepositorio,
  MetaRegistro,
  NovaMeta,
  ReferenciasAlocacao,
} from "./repositorio";
import { substituirMetas } from "./substituir-metas";

const USUARIO_A = "usuario-a";
const USUARIO_B = "usuario-b";
const HOJE = "2026-11-09";

const CLASSES = [
  { id: "c-rf", codigo: "RENDA_FIXA", nome: "Renda Fixa", ordem: 1, ativo: true },
  { id: "c-fii", codigo: "FII", nome: "Fundos Imobiliários", ordem: 2, ativo: true },
  { id: "c-inativa", codigo: "INATIVA", nome: "Classe Inativa", ordem: 3, ativo: false },
] as const;

const SEGMENTOS = [
  { id: "s-log", codigo: "LOGISTICA", nome: "Logística", ordem: 1 },
  { id: "s-shop", codigo: "SHOPPING", nome: "Shopping Centers", ordem: 2 },
  { id: "s-rec", codigo: "RECEBIVEIS", nome: "Recebíveis Imobiliários", ordem: 3 },
  { id: "s-laj", codigo: "LAJES", nome: "Lajes Corporativas", ordem: 4 },
  { id: "s-urb", codigo: "RENDA_URBANA", nome: "Renda Urbana", ordem: 5 },
  { id: "s-hib", codigo: "HIBRIDO", nome: "Híbridos", ordem: 6 },
  { id: "s-agro", codigo: "AGRO", nome: "Agronegócio", ordem: 7 },
  { id: "s-caixa", codigo: "CAIXA_OPORTUNIDADES", nome: "Caixa e Oportunidades", ordem: 9 },
] as const;

const REFERENCIAS: ReferenciasAlocacao = {
  classes: CLASSES,
  segmentos: SEGMENTOS.map((segmento) => ({ ...segmento, classeId: "c-fii", ativo: true })),
};

const ID_SEGMENTO = new Map<string, string>(SEGMENTOS.map((segmento) => [segmento.codigo, segmento.id]));

function entradaSegmentosPadrao(): EntradaMeta[] {
  return METAS_SEGMENTO_PADRAO.map((meta) => ({
    referenciaId: ID_SEGMENTO.get(meta.codigo) ?? meta.codigo,
    percentual: meta.percentual,
  }));
}

interface SobrescritasEntrada {
  readonly classe?: EntradaMetas["classe"];
  readonly segmento?: EntradaMetas["segmento"];
}

function entradaValida(overrides: SobrescritasEntrada = {}): EntradaMetas {
  return {
    classe: overrides.classe ?? [
      { referenciaId: "c-rf", percentual: "50.000000" },
      { referenciaId: "c-fii", percentual: "50.000000" },
    ],
    segmento: overrides.segmento ?? entradaSegmentosPadrao(),
  };
}

interface LinhaMeta {
  id: string;
  usuarioId: string;
  escopo: MetaRegistro["escopo"];
  referenciaId: string;
  codigo: string;
  nome: string;
  ordem: number;
  percentual: string;
  vigenciaInicio: string;
  vigenciaFim: string | null;
  criadoEm: Date;
}

const AGORA = new Date("2026-11-09T12:00:00.000Z");

/** Repositório em memória — espelha o contrato do port sem banco. */
class AlocacaoMetaRepositorioFake implements AlocacaoMetaRepositorio {
  readonly linhas: LinhaMeta[] = [];
  private sequencia = 0;

  constructor(private readonly referencias: ReferenciasAlocacao = REFERENCIAS) {}

  private clonar(linha: LinhaMeta): MetaRegistro {
    return {
      id: linha.id,
      escopo: linha.escopo,
      referenciaId: linha.referenciaId,
      codigo: linha.codigo,
      nome: linha.nome,
      ordem: linha.ordem,
      percentual: linha.percentual,
      vigenciaInicio: linha.vigenciaInicio,
      vigenciaFim: linha.vigenciaFim,
      criadoEm: linha.criadoEm,
    };
  }

  async listarVigentes(usuarioId: string): Promise<readonly MetaRegistro[]> {
    return this.linhas
      .filter((linha) => linha.usuarioId === usuarioId && linha.vigenciaFim === null)
      .map((linha) => this.clonar(linha));
  }

  async listarTodas(usuarioId: string): Promise<readonly MetaRegistro[]> {
    return this.linhas
      .filter((linha) => linha.usuarioId === usuarioId)
      .map((linha) => this.clonar(linha));
  }

  async listarReferencias(): Promise<ReferenciasAlocacao> {
    return this.referencias;
  }

  async garantirVigencia(
    usuarioId: string,
    metas: readonly NovaMeta[],
    vigenciaInicio: string,
  ): Promise<void> {
    if (this.linhas.some((linha) => linha.usuarioId === usuarioId && linha.vigenciaFim === null)) {
      return;
    }
    this.gravar(usuarioId, metas, vigenciaInicio);
  }

  async substituirVigencia(
    usuarioId: string,
    metas: readonly NovaMeta[],
    vigenciaInicio: string,
  ): Promise<void> {
    for (const linha of this.linhas) {
      if (linha.usuarioId === usuarioId && linha.vigenciaFim === null) {
        linha.vigenciaFim = vigenciaInicio;
      }
    }
    this.gravar(usuarioId, metas, vigenciaInicio);
  }

  private gravar(usuarioId: string, metas: readonly NovaMeta[], vigenciaInicio: string): void {
    for (const meta of metas) {
      this.sequencia += 1;
      const referencia =
        meta.escopo === "CLASSE"
          ? this.referencias.classes.find((classe) => classe.id === meta.referenciaId)
          : this.referencias.segmentos.find((segmento) => segmento.id === meta.referenciaId);

      if (referencia === undefined) {
        throw new Error(`Referência ${meta.referenciaId} não encontrada no fake.`);
      }

      this.linhas.push({
        id: `meta-${this.sequencia}`,
        usuarioId,
        escopo: meta.escopo,
        referenciaId: meta.referenciaId,
        codigo: referencia.codigo,
        nome: referencia.nome,
        ordem: referencia.ordem,
        percentual: meta.percentual,
        vigenciaInicio,
        vigenciaFim: null,
        criadoEm: AGORA,
      });
    }
  }
}

class ValorCarteiraFake implements ValorCarteira {
  constructor(private readonly valores: ValoresCarteira) {}

  async agregar(): Promise<ValoresCarteira> {
    return this.valores;
  }
}

function carteiraPadrao(overrides: Partial<ValoresCarteira> = {}): ValoresCarteira {
  return {
    total: "40000.00",
    classes: [
      { id: "c-rf", valor: "16000.00", valorIndisponivel: false },
      { id: "c-fii", valor: "24000.00", valorIndisponivel: true },
    ],
    segmentos: [{ id: "s-log", valor: "10000.00", valorIndisponivel: true }],
    ...overrides,
  };
}

async function prepararComDefaults(
  hoje = HOJE,
  usuarioId = USUARIO_A,
): Promise<{ repositorio: AlocacaoMetaRepositorioFake; consulta: ConsultaMetas }> {
  const repositorio = new AlocacaoMetaRepositorioFake();
  const resultado = await obterMetas({ usuarioId, hoje }, { repositorio });
  if (isErr(resultado)) {
    throw resultado.error;
  }
  return { repositorio, consulta: resultado.value };
}

function item(itens: readonly ItemDesvio[], escopo: string, codigo: string): ItemDesvio {
  const encontrado = itens.find((candidato) => candidato.escopo === escopo && candidato.codigo === codigo);
  if (encontrado === undefined) {
    throw new Error(`Item ${escopo}/${codigo} não encontrado.`);
  }
  return encontrado;
}

describe("RN-021-1 — defaults por usuário", () => {
  it("monta 50/50 nas classes e uma distribuição que soma 100 nos segmentos", () => {
    const resultado = montarDefaults(REFERENCIAS);
    expect(isOk(resultado)).toBe(true);
    if (!resultado.ok) return;

    const classe = resultado.value.filter((meta) => meta.escopo === "CLASSE");
    const segmento = resultado.value.filter((meta) => meta.escopo === "SEGMENTO");

    expect(classe.map((meta) => meta.referenciaId)).toEqual(["c-rf", "c-fii"]);
    expect(classe.map((meta) => meta.percentual)).toEqual(["50.000000", "50.000000"]);

    const somaClasse = classe.reduce(
      (soma, meta) => soma.add(Decimal.from(meta.percentual)),
      Decimal.zero(6),
    );
    const somaSegmento = segmento.reduce(
      (soma, meta) => soma.add(Decimal.from(meta.percentual)),
      Decimal.zero(6),
    );

    expect(somaClasse.toFixed(6)).toBe("100.000000");
    expect(somaSegmento.toFixed(6)).toBe("100.000000");
    expect(segmento).toHaveLength(METAS_SEGMENTO_PADRAO.length);
    expect(METAS_CLASSE_PADRAO).toHaveLength(2);

    const rendaUrbana = segmento.find((meta) => meta.referenciaId === "s-urb");
    const hibrido = segmento.find((meta) => meta.referenciaId === "s-hib");
    expect(rendaUrbana?.percentual).toBe("7.500000");
    expect(hibrido?.percentual).toBe("7.500000");
  });

  it("falha quando falta uma classe de referência ativa", () => {
    const referencias: ReferenciasAlocacao = {
      classes: CLASSES.filter((classe) => classe.codigo !== "FII"),
      segmentos: REFERENCIAS.segmentos,
    };

    const resultado = montarDefaults(referencias);
    expect(isErr(resultado)).toBe(true);
    if (resultado.ok) return;
    expect(resultado.error.code).toBe("ALO_REFERENCIA_INVALIDA");
    expect(resultado.error.details).toMatchObject({ escopo: "CLASSE", codigo: "FII" });
  });

  it("falha quando falta um segmento de referência ativa", () => {
    const referencias: ReferenciasAlocacao = {
      classes: REFERENCIAS.classes,
      segmentos: REFERENCIAS.segmentos.filter((segmento) => segmento.codigo !== "AGRO"),
    };

    const resultado = montarDefaults(referencias);
    expect(isErr(resultado)).toBe(true);
    if (resultado.ok) return;
    expect(resultado.error.code).toBe("ALO_REFERENCIA_INVALIDA");
    expect(resultado.error.details).toMatchObject({ escopo: "SEGMENTO", codigo: "AGRO" });
  });

  it("cria os defaults uma única vez na primeira leitura (idempotente)", async () => {
    const repositorio = new AlocacaoMetaRepositorioFake();

    const primeira = await obterMetas({ usuarioId: USUARIO_A, hoje: HOJE }, { repositorio });
    const segunda = await obterMetas({ usuarioId: USUARIO_A, hoje: HOJE }, { repositorio });

    expect(isOk(primeira) && isOk(segunda)).toBe(true);
    if (!primeira.ok || !segunda.ok) return;

    expect(primeira.value.vigente.classe).toHaveLength(2);
    expect(primeira.value.vigente.segmento).toHaveLength(8);
    expect(primeira.value.vigente.vigenciaInicio).toBe(HOJE);
    expect(primeira.value.historico).toEqual([]);
    expect(segunda.value.vigente.classe.map((meta) => meta.percentual)).toEqual([
      "50.000000",
      "50.000000",
    ]);
    expect(repositorio.linhas).toHaveLength(10);
  });

  it("mantém defaults isolados por usuário", async () => {
    const repositorio = new AlocacaoMetaRepositorioFake();

    await obterMetas({ usuarioId: USUARIO_A, hoje: HOJE }, { repositorio });
    await obterMetas({ usuarioId: USUARIO_B, hoje: HOJE }, { repositorio });

    expect(repositorio.linhas.filter((linha) => linha.usuarioId === USUARIO_A)).toHaveLength(10);
    expect(repositorio.linhas.filter((linha) => linha.usuarioId === USUARIO_B)).toHaveLength(10);
  });
});

describe("RN-021-2 — validação do conjunto", () => {
  it("aceita soma exata e normaliza os percentuais em 6 casas", () => {
    const resultado = validarEntradaMetas(
      entradaValida({
        classe: [
          { referenciaId: "c-rf", percentual: "60.5" },
          { referenciaId: "c-fii", percentual: "39.5" },
        ],
      }),
      REFERENCIAS,
    );

    expect(isOk(resultado)).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.value).toHaveLength(10);
    expect(resultado.value[0]).toEqual({
      escopo: "CLASSE",
      referenciaId: "c-rf",
      percentual: "60.500000",
    });
  });

  it.each([
    ["60% + 30%", "60.000000", "30.000000", "90.000000"],
    ["99,99%", "49.990000", "50.000000", "99.990000"],
    ["100,01%", "50.010000", "50.000000", "100.010000"],
  ])("rejeita soma %s com details.escopo e details.soma", (_nome, rf, fii, soma) => {
    const resultado = validarEntradaMetas(
      entradaValida({
        classe: [
          { referenciaId: "c-rf", percentual: rf },
          { referenciaId: "c-fii", percentual: fii },
        ],
      }),
      REFERENCIAS,
    );

    expect(isErr(resultado)).toBe(true);
    if (resultado.ok) return;
    expect(resultado.error.code).toBe("ALO_SOMA_METAS_INVALIDA");
    expect(resultado.error.status).toBe(422);
    expect(resultado.error.details).toEqual({ escopo: "CLASSE", soma });
  });

  it("rejeita soma inválida no escopo de segmento", () => {
    const segmentos = entradaSegmentosPadrao();
    segmentos[0] = { ...segmentos[0], percentual: "24.000000" };

    const resultado = validarEntradaMetas(entradaValida({ segmento: segmentos }), REFERENCIAS);

    expect(isErr(resultado)).toBe(true);
    if (resultado.ok) return;
    expect(resultado.error.code).toBe("ALO_SOMA_METAS_INVALIDA");
    expect(resultado.error.details).toMatchObject({ escopo: "SEGMENTO", soma: "99.000000" });
  });

  it("rejeita referência duplicada no mesmo escopo", () => {
    const resultado = validarEntradaMetas(
      entradaValida({
        classe: [
          { referenciaId: "c-rf", percentual: "50.000000" },
          { referenciaId: "c-rf", percentual: "50.000000" },
        ],
      }),
      REFERENCIAS,
    );

    expect(isErr(resultado)).toBe(true);
    if (resultado.ok) return;
    expect(resultado.error.code).toBe("ALO_META_DUPLICADA");
    expect(resultado.error.details).toMatchObject({ escopo: "CLASSE", referenciaId: "c-rf" });
  });

  it("rejeita referência inativa", () => {
    const resultado = validarEntradaMetas(
      entradaValida({
        classe: [
          { referenciaId: "c-inativa", percentual: "50.000000" },
          { referenciaId: "c-fii", percentual: "50.000000" },
        ],
      }),
      REFERENCIAS,
    );

    expect(isErr(resultado)).toBe(true);
    if (resultado.ok) return;
    expect(resultado.error.code).toBe("ALO_REFERENCIA_INVALIDA");
    expect(resultado.error.details).toMatchObject({ escopo: "CLASSE", referenciaId: "c-inativa" });
  });

  it("rejeita referência inexistente em segmento", () => {
    const segmentos = entradaSegmentosPadrao().map((meta) =>
      meta.referenciaId === "s-log" ? { ...meta, referenciaId: "s-inexistente" } : meta,
    );

    const resultado = validarEntradaMetas(entradaValida({ segmento: segmentos }), REFERENCIAS);

    expect(isErr(resultado)).toBe(true);
    if (resultado.ok) return;
    expect(resultado.error.code).toBe("ALO_REFERENCIA_INVALIDA");
    expect(resultado.error.details).toMatchObject({ escopo: "SEGMENTO" });
  });

  it.each([["abc"], ["101"], ["-1"]])("rejeita percentual inválido (%s)", (percentual) => {
    const resultado = validarEntradaMetas(
      entradaValida({
        classe: [
          { referenciaId: "c-rf", percentual },
          { referenciaId: "c-fii", percentual: "50.000000" },
        ],
      }),
      REFERENCIAS,
    );

    expect(isErr(resultado)).toBe(true);
    if (resultado.ok) return;
    expect(resultado.error.code).toBe("VALIDACAO");
  });
});

describe("RN-021-2 — vigência e histórico", () => {
  it("substitui o conjunto e preserva o anterior no histórico", async () => {
    const repositorio = new AlocacaoMetaRepositorioFake();
    await obterMetas({ usuarioId: USUARIO_A, hoje: "2026-11-08" }, { repositorio });

    const resultado = await substituirMetas(
      {
        usuarioId: USUARIO_A,
        hoje: "2026-11-09",
        classe: [
          { referenciaId: "c-rf", percentual: "60.000000" },
          { referenciaId: "c-fii", percentual: "40.000000" },
        ],
        segmento: entradaSegmentosPadrao(),
      },
      { repositorio },
    );

    expect(isOk(resultado)).toBe(true);
    if (!resultado.ok) return;

    expect(resultado.value.vigente.vigenciaInicio).toBe("2026-11-09");
    expect(
      resultado.value.vigente.classe.map((meta) => [meta.codigo, meta.percentual]),
    ).toEqual([
      ["RENDA_FIXA", "60.000000"],
      ["FII", "40.000000"],
    ]);
    expect(resultado.value.historico).toHaveLength(1);
    expect(resultado.value.historico[0].vigenciaInicio).toBe("2026-11-08");
    expect(resultado.value.historico[0].vigenciaFim).toBe("2026-11-09");
    expect(
      resultado.value.historico[0].classe.map((meta) => meta.percentual),
    ).toEqual(["50.000000", "50.000000"]);

    // Exatamente uma linha vigente por referência/escopo.
    const vigentes = repositorio.linhas.filter(
      (linha) => linha.usuarioId === USUARIO_A && linha.vigenciaFim === null,
    );
    expect(vigentes).toHaveLength(10);
    expect(new Set(vigentes.map((linha) => `${linha.escopo}:${linha.referenciaId}`)).size).toBe(10);
  });

  it("mantém dois períodos no histórico após duas substituições", async () => {
    const repositorio = new AlocacaoMetaRepositorioFake();
    await obterMetas({ usuarioId: USUARIO_A, hoje: "2026-11-07" }, { repositorio });

    const segunda = await substituirMetas(
      {
        usuarioId: USUARIO_A,
        hoje: "2026-11-08",
        classe: [
          { referenciaId: "c-rf", percentual: "55.000000" },
          { referenciaId: "c-fii", percentual: "45.000000" },
        ],
        segmento: entradaSegmentosPadrao(),
      },
      { repositorio },
    );
    expect(isOk(segunda)).toBe(true);

    const terceira = await substituirMetas(
      {
        usuarioId: USUARIO_A,
        hoje: "2026-11-09",
        classe: [
          { referenciaId: "c-rf", percentual: "60.000000" },
          { referenciaId: "c-fii", percentual: "40.000000" },
        ],
        segmento: entradaSegmentosPadrao(),
      },
      { repositorio },
    );

    expect(isOk(terceira)).toBe(true);
    if (!terceira.ok) return;
    expect(terceira.value.historico.map((periodo) => periodo.vigenciaInicio)).toEqual([
      "2026-11-08",
      "2026-11-07",
    ]);
    expect(terceira.value.historico).toHaveLength(2);
  });

  it("não grava nada quando a soma é inválida", async () => {
    const { repositorio } = await prepararComDefaults();
    const antes = repositorio.linhas.length;

    const resultado = await substituirMetas(
      {
        usuarioId: USUARIO_A,
        classe: [
          { referenciaId: "c-rf", percentual: "60.000000" },
          { referenciaId: "c-fii", percentual: "30.000000" },
        ],
        segmento: entradaSegmentosPadrao(),
      },
      { repositorio },
    );

    expect(isErr(resultado)).toBe(true);
    if (resultado.ok) return;
    expect(resultado.error.code).toBe("ALO_SOMA_METAS_INVALIDA");
    expect(repositorio.linhas).toHaveLength(antes);
  });

  it("GET seguinte não recria defaults depois de uma substituição", async () => {
    const { repositorio } = await prepararComDefaults();

    await substituirMetas(
      {
        usuarioId: USUARIO_A,
        hoje: "2026-11-10",
        classe: [
          { referenciaId: "c-rf", percentual: "70.000000" },
          { referenciaId: "c-fii", percentual: "30.000000" },
        ],
        segmento: entradaSegmentosPadrao(),
      },
      { repositorio },
    );
    const antes = repositorio.linhas.length;

    const consulta = await obterMetas({ usuarioId: USUARIO_A, hoje: "2026-11-11" }, { repositorio });
    expect(isOk(consulta)).toBe(true);
    expect(repositorio.linhas).toHaveLength(antes);
  });

  it("montarVigente e agruparHistorico tratam lista vazia", () => {
    expect(montarVigente([])).toEqual({ classe: [], segmento: [], vigenciaInicio: "" });
    expect(agruparHistorico([])).toEqual([]);
  });
});

describe("RN-021-3 — cálculo de desvios", () => {
  it("classifica com a tolerância de 0,5 p.p. (RN-090)", () => {
    expect(classificarDesvio(Decimal.from("0"))).toBe("DENTRO");
    expect(classificarDesvio(Decimal.from("0.500000"))).toBe("DENTRO");
    expect(classificarDesvio(Decimal.from("-0.500000"))).toBe("DENTRO");
    expect(classificarDesvio(Decimal.from("0.600000"))).toBe("ACIMA");
    expect(classificarDesvio(Decimal.from("-0.600000"))).toBe("ABAIXO");
  });

  it("calcula G8 com base no patrimônio total: RF abaixo e FII acima", async () => {
    const { repositorio } = await prepararComDefaults();
    const carteira = new ValorCarteiraFake(carteiraPadrao());

    const resultado = await calcularDesvios(
      { usuarioId: USUARIO_A },
      { repositorio, valorCarteira: carteira },
    );

    expect(isOk(resultado)).toBe(true);
    if (!resultado.ok) return;

    expect(resultado.value.baseCalculo).toBe("PATRIMONIO_TOTAL");

    const rendaFixa = item(resultado.value.itens, "CLASSE", "RENDA_FIXA");
    expect(rendaFixa.percentualAtual).toBe("40.000000");
    expect(rendaFixa.percentualMeta).toBe("50.000000");
    expect(rendaFixa.desvioPontos).toBe("-10.000000");
    expect(rendaFixa.situacao).toBe("ABAIXO");
    expect(rendaFixa.valorParaMeta).toBe("4000.00");
    expect(rendaFixa.valorIndisponivel).toBe(false);

    const fii = item(resultado.value.itens, "CLASSE", "FII");
    expect(fii.percentualAtual).toBe("60.000000");
    expect(fii.desvioPontos).toBe("10.000000");
    expect(fii.situacao).toBe("ACIMA");
    expect(fii.valorParaMeta).toBe("0.00");
    expect(fii.valorIndisponivel).toBe(true);
  });

  it("usa o patrimônio total também no denominador do segmento (RN-089)", async () => {
    const { repositorio } = await prepararComDefaults();
    const carteira = new ValorCarteiraFake(carteiraPadrao());

    const resultado = await calcularDesvios(
      { usuarioId: USUARIO_A },
      { repositorio, valorCarteira: carteira },
    );
    if (!resultado.ok) throw resultado.error;

    const logistica = item(resultado.value.itens, "SEGMENTO", "LOGISTICA");
    // 10.000 de 40.000 de patrimônio total = 25% (meta 25%).
    expect(logistica.percentualAtual).toBe("25.000000");
    expect(logistica.desvioPontos).toBe("0.000000");
    expect(logistica.situacao).toBe("DENTRO");
    expect(logistica.valorIndisponivel).toBe(true);
  });

  it.each([
    ["49.500000", "DENTRO", "0.00"],
    ["49.400000", "ABAIXO", "600.00"],
  ])("tolera 0,5 p.p. e trata 0,6 como abaixo (%s)", async (percentual, situacao, valorParaMeta) => {
    const { repositorio } = await prepararComDefaults();
    const valorRf = Decimal.from("100000.00").mul(percentual).div("100", 2);
    const valorFii = Decimal.from("100000.00").sub(valorRf);

    const carteira = new ValorCarteiraFake({
      total: "100000.00",
      classes: [
        { id: "c-rf", valor: valorRf.toFixed(2), valorIndisponivel: false },
        { id: "c-fii", valor: valorFii.toFixed(2), valorIndisponivel: true },
      ],
      segmentos: [],
    });

    const resultado = await calcularDesvios(
      { usuarioId: USUARIO_A },
      { repositorio, valorCarteira: carteira },
    );
    if (!resultado.ok) throw resultado.error;

    const rendaFixa = item(resultado.value.itens, "CLASSE", "RENDA_FIXA");
    expect(rendaFixa.situacao).toBe(situacao);
    expect(rendaFixa.valorParaMeta).toBe(valorParaMeta);
  });

  it("trata desvio de +0,6 como acima e zera o valor para meta", async () => {
    const { repositorio } = await prepararComDefaults();
    const carteira = new ValorCarteiraFake({
      total: "100000.00",
      classes: [
        { id: "c-rf", valor: "50600.00", valorIndisponivel: false },
        { id: "c-fii", valor: "49400.00", valorIndisponivel: true },
      ],
      segmentos: [],
    });

    const resultado = await calcularDesvios(
      { usuarioId: USUARIO_A },
      { repositorio, valorCarteira: carteira },
    );
    if (!resultado.ok) throw resultado.error;

    const rendaFixa = item(resultado.value.itens, "CLASSE", "RENDA_FIXA");
    expect(rendaFixa.desvioPontos).toBe("0.600000");
    expect(rendaFixa.situacao).toBe("ACIMA");
    expect(rendaFixa.valorParaMeta).toBe("0.00");
  });

  it("não divide por zero: carteira vazia gera percentual 0, ABAIXO e valor 0", async () => {
    const { repositorio } = await prepararComDefaults();
    const carteira = new ValorCarteiraFake({
      total: "0.00",
      classes: [
        { id: "c-rf", valor: "0.00", valorIndisponivel: false },
        { id: "c-fii", valor: "0.00", valorIndisponivel: true },
      ],
      segmentos: [],
    });

    const resultado = await calcularDesvios(
      { usuarioId: USUARIO_A },
      { repositorio, valorCarteira: carteira },
    );
    if (!resultado.ok) throw resultado.error;

    for (const desvio of resultado.value.itens) {
      expect(desvio.percentualAtual).toBe("0.000000");
      expect(desvio.situacao).toBe("ABAIXO");
      expect(desvio.valorParaMeta).toBe("0.00");
    }
  });

  it("usa zero quando a carteira não traz a referência da meta", async () => {
    const { repositorio } = await prepararComDefaults();
    const carteira = new ValorCarteiraFake({
      total: "40000.00",
      classes: [],
      segmentos: [],
    });

    const resultado = await calcularDesvios(
      { usuarioId: USUARIO_A },
      { repositorio, valorCarteira: carteira },
    );
    if (!resultado.ok) throw resultado.error;

    const rendaFixa = item(resultado.value.itens, "CLASSE", "RENDA_FIXA");
    expect(rendaFixa.percentualAtual).toBe("0.000000");
    expect(rendaFixa.valorParaMeta).toBe("20000.00");
    expect(rendaFixa.valorIndisponivel).toBe(false);

    const segmento = item(resultado.value.itens, "SEGMENTO", "LOGISTICA");
    expect(segmento.valorIndisponivel).toBe(true);
  });

  it("retorna ALO_METAS_AUSENTES quando o titular não configurou metas", async () => {
    const repositorio = new AlocacaoMetaRepositorioFake();
    const carteira = new ValorCarteiraFake(carteiraPadrao());

    const resultado = await calcularDesvios(
      { usuarioId: USUARIO_A },
      { repositorio, valorCarteira: carteira },
    );

    expect(isErr(resultado)).toBe(true);
    if (resultado.ok) return;
    expect(resultado.error.code).toBe("ALO_METAS_AUSENTES");
    expect(resultado.error.status).toBe(409);
  });

  it("calcula itens diretamente a partir das metas e da carteira", async () => {
    const { consulta } = await prepararComDefaults();
    const metas = [...consulta.vigente.classe, ...consulta.vigente.segmento];

    const itens = calcularItensDesvio(metas, carteiraPadrao());
    expect(itens).toHaveLength(10);
    expect(itens[0].escopo).toBe("CLASSE");
  });
});

describe("RN-021-3 — agregação da carteira", () => {
  it("soma FII pelo custo e renda fixa pelo saldo", () => {
    const valores = agregarValoresCarteira({
      posicoes: [
        { classeId: "c-fii", segmentoId: "s-log", custoTotal: "10000.00" },
        { classeId: "c-fii", segmentoId: "s-log", custoTotal: "5000.00" },
        { classeId: "c-fii", segmentoId: "s-shop", custoTotal: "8000.00" },
      ],
      saldoRendaFixa: "12000.00",
      classes: [
        { id: "c-rf", codigo: "RENDA_FIXA" },
        { id: "c-fii", codigo: "FII" },
      ],
    });

    expect(valores.total).toBe("35000.00");
    expect(valores.classes).toEqual([
      { id: "c-rf", valor: "12000.00", valorIndisponivel: false },
      { id: "c-fii", valor: "23000.00", valorIndisponivel: true },
    ]);
    expect(valores.segmentos).toEqual([
      { id: "s-log", valor: "15000.00", valorIndisponivel: true },
      { id: "s-shop", valor: "8000.00", valorIndisponivel: true },
    ]);
  });

  it("carteira vazia resulta em total 0 e classes zeradas", () => {
    const valores = agregarValoresCarteira({
      posicoes: [],
      saldoRendaFixa: "0.00",
      classes: [
        { id: "c-rf", codigo: "RENDA_FIXA" },
        { id: "c-fii", codigo: "FII" },
      ],
    });

    expect(valores.total).toBe("0.00");
    expect(valores.classes.map((classe) => classe.valor)).toEqual(["0.00", "0.00"]);
    expect(valores.segmentos).toEqual([]);
  });

  it("ignora posição sem segmento na lista de segmentos", () => {
    const valores = agregarValoresCarteira({
      posicoes: [{ classeId: "c-fii", segmentoId: null, custoTotal: "1000.00" }],
      saldoRendaFixa: "0.00",
      classes: [{ id: "c-fii", codigo: "FII" }],
    });

    expect(valores.segmentos).toEqual([]);
    expect(valores.classes[0].valor).toBe("1000.00");
  });
});

describe("apresentação", () => {
  it("apresenta metas vigentes e histórico no contrato §7.1", async () => {
    const { consulta } = await prepararComDefaults();
    const api = apresentarMetas(consulta);

    expect(api.vigente.classe[0]).toEqual({
      classeId: "c-rf",
      codigo: "RENDA_FIXA",
      percentual: "50.000000",
    });
    expect(api.vigente.segmento[0]).toEqual({
      segmentoId: "s-log",
      codigo: "LOGISTICA",
      percentual: "25.000000",
    });
    expect(api.vigente.vigenciaInicio).toBe(HOJE);
    expect(api.historico).toEqual([]);
    expect(apresentarVigente(consulta.vigente)).toEqual(api.vigente);
  });

  it("apresenta desvios no contrato §7.3", () => {
    const desvios = apresentarDesvios({
      baseCalculo: "PATRIMONIO_TOTAL",
      itens: [
        {
          escopo: "CLASSE",
          codigo: "RENDA_FIXA",
          percentualAtual: "40.000000",
          percentualMeta: "50.000000",
          desvioPontos: "-10.000000",
          valorParaMeta: "4000.00",
          situacao: "ABAIXO",
          valorIndisponivel: false,
        },
      ],
    });

    expect(desvios.baseCalculo).toBe("PATRIMONIO_TOTAL");
    expect(desvios.itens).toHaveLength(1);
  });
});

