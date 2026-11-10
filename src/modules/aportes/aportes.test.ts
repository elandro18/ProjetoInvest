import { describe, expect, it } from "vitest";

import { AppError } from "../../lib/errors";
import { isErr, isOk } from "../../lib/result";
import type { AlocacaoMetaRepositorio, MetaRegistro, NovaMeta, ReferenciasAlocacao } from "../alocacao/repositorio";
import type { ValorCarteira, ValoresCarteira } from "../carteira/valor-carteira";
import type {
  LimiteConcentracaoRepositorio,
  LimiteRegistro,
  NovoLimite,
} from "../risco/repositorio";
import { apresentarDecisao, apresentarSugestao } from "./apresentacao";
import { criarSugestaoAporte } from "./criar-sugestao";
import { registrarDecisaoAporte } from "./registrar-decisao";
import type { AporteRepositorio, CandidatoAporte } from "./repositorio";
import type {
  DecisaoUsuario,
  NovaSugestaoAporte,
  SugestaoAporteRegistro,
} from "./tipos";

/**
 * Testes de composição da sugestão de aporte (RN-025-4, RN-025-5, RN-052,
 * RN-053). Usam fakes em memória para carteira, metas, limites, candidatos e
 * persistência — nenhum banco é tocado.
 */

const USUARIO_A = "usuario-a";
const USUARIO_B = "usuario-b";
const AGORA = new Date("2026-11-10T12:00:00.000Z");
const AGORA_DECISAO = new Date("2026-11-10T12:05:00.000Z");

const REFERENCIAS: ReferenciasAlocacao = {
  classes: [
    { id: "classe-rf", codigo: "RENDA_FIXA", nome: "Renda Fixa", ordem: 1, ativo: true },
    { id: "classe-fii", codigo: "FII", nome: "Fundos Imobiliários", ordem: 2, ativo: true },
  ],
  segmentos: [
    { id: "seg-log", codigo: "LOGISTICA", nome: "Logística", classeId: "classe-fii", ordem: 1, ativo: true },
    { id: "seg-shop", codigo: "SHOPPING", nome: "Shopping Centers", classeId: "classe-fii", ordem: 2, ativo: true },
    { id: "seg-rec", codigo: "RECEBIVEIS", nome: "Recebíveis Imobiliários", classeId: "classe-fii", ordem: 3, ativo: true },
    { id: "seg-lajes", codigo: "LAJES", nome: "Lajes Corporativas", classeId: "classe-fii", ordem: 4, ativo: true },
    { id: "seg-agro", codigo: "AGRO", nome: "Agronegócio", classeId: "classe-fii", ordem: 5, ativo: true },
    { id: "seg-caixa", codigo: "CAIXA_OPORTUNIDADES", nome: "Caixa e Oportunidades", classeId: "classe-fii", ordem: 6, ativo: true },
    { id: "seg-urbana", codigo: "RENDA_URBANA", nome: "Renda Urbana", classeId: "classe-fii", ordem: 7, ativo: true },
    { id: "seg-hibrido", codigo: "HIBRIDO", nome: "Híbridos", classeId: "classe-fii", ordem: 8, ativo: true },
  ],
};

type LinhaMeta = MetaRegistro & { readonly usuarioId: string };

class MetasFake implements AlocacaoMetaRepositorio {
  private readonly linhas: LinhaMeta[] = [];
  private sequencia = 0;

  constructor(private readonly referencias: ReferenciasAlocacao = REFERENCIAS) {}

  adicionar(
    usuarioId: string,
    escopo: "CLASSE" | "SEGMENTO",
    codigo: string,
    percentual: string,
  ): void {
    const referencia =
      escopo === "CLASSE"
        ? this.referencias.classes.find((item) => item.codigo === codigo)
        : this.referencias.segmentos.find((item) => item.codigo === codigo);
    if (referencia === undefined) {
      throw new Error(`referência ${codigo} ausente no fake`);
    }

    this.sequencia += 1;
    this.linhas.push({
      id: `meta-${this.sequencia}`,
      usuarioId,
      escopo,
      referenciaId: referencia.id,
      codigo,
      nome: referencia.nome,
      ordem: referencia.ordem,
      percentual,
      vigenciaInicio: "2026-11-01",
      vigenciaFim: null,
      criadoEm: AGORA,
    });
  }

  async listarVigentes(usuarioId: string): Promise<readonly MetaRegistro[]> {
    return this.clonar(usuarioId, true);
  }

  async listarTodas(usuarioId: string): Promise<readonly MetaRegistro[]> {
    return this.clonar(usuarioId, false);
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

    for (const meta of metas) {
      const referencia =
        meta.escopo === "CLASSE"
          ? this.referencias.classes.find((item) => item.id === meta.referenciaId)
          : this.referencias.segmentos.find((item) => item.id === meta.referenciaId);
      if (referencia === undefined) {
        throw new Error("referência ausente ao criar defaults");
      }

      this.sequencia += 1;
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

  async substituirVigencia(): Promise<void> {
    throw new Error("não usado nos testes de aporte");
  }

  private clonar(usuarioId: string, somenteVigentes: boolean): MetaRegistro[] {
    return this.linhas
      .filter(
        (linha) => linha.usuarioId === usuarioId && (!somenteVigentes || linha.vigenciaFim === null),
      )
      .map((linha) => ({
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
      }));
  }
}

class ValorCarteiraFake implements ValorCarteira {
  private readonly porUsuario = new Map<string, ValoresCarteira>();

  definir(usuarioId: string, valores: ValoresCarteira): void {
    this.porUsuario.set(usuarioId, valores);
  }

  async agregar(usuarioId: string): Promise<ValoresCarteira> {
    return this.porUsuario.get(usuarioId) ?? { total: "0.00", classes: [], segmentos: [] };
  }
}

class LimitesFake implements LimiteConcentracaoRepositorio {
  private readonly porUsuario = new Map<string, LimiteRegistro[]>();

  definir(usuarioId: string, limites: readonly LimiteRegistro[]): void {
    this.porUsuario.set(usuarioId, [...limites]);
  }

  async listarVigentes(usuarioId: string): Promise<readonly LimiteRegistro[]> {
    return this.porUsuario.get(usuarioId) ?? [];
  }

  async listarTodas(usuarioId: string): Promise<readonly LimiteRegistro[]> {
    return this.listarVigentes(usuarioId);
  }

  async substituirVigencia(
    usuarioId: string,
    limites: readonly NovoLimite[],
    vigenciaInicio: string,
  ): Promise<void> {
    this.porUsuario.set(
      usuarioId,
      limites.map((limite, indice) => ({
        id: `limite-${indice}`,
        dimensao: limite.dimensao,
        referencia: limite.referencia,
        percentualMax: limite.percentualMax,
        vigenciaInicio,
        vigenciaFim: null,
        criadoEm: AGORA,
      })),
    );
  }
}

type RegistroInterno = {
  -readonly [K in keyof SugestaoAporteRegistro]: SugestaoAporteRegistro[K];
};

class AporteRepositorioFake implements AporteRepositorio {
  readonly registros: RegistroInterno[] = [];
  private readonly candidatos = new Map<string, readonly CandidatoAporte[]>();
  private sequencia = 0;

  definirCandidatos(usuarioId: string, candidatos: readonly CandidatoAporte[]): void {
    this.candidatos.set(usuarioId, candidatos);
  }

  async listarCandidatos(usuarioId: string): Promise<readonly CandidatoAporte[]> {
    return this.candidatos.get(usuarioId) ?? [];
  }

  async criar(novo: NovaSugestaoAporte): Promise<SugestaoAporteRegistro> {
    this.sequencia += 1;
    const registro: RegistroInterno = {
      id: `sugestao-${this.sequencia}`,
      usuarioId: novo.usuarioId,
      data: novo.data,
      valorDisponivel: novo.valorDisponivel,
      distribuicaoAtual: novo.distribuicaoAtual,
      distribuicaoSugerida: novo.distribuicaoSugerida,
      ativosAvaliados: novo.ativosAvaliados,
      justificativas: novo.justificativas,
      alertas: novo.alertas,
      decisaoUsuario: null,
      decisaoEm: null,
      observacoesDecisao: null,
    };
    this.registros.push(registro);
    return registro;
  }

  async buscarPorId(usuarioId: string, sugestaoId: string): Promise<SugestaoAporteRegistro | null> {
    return (
      this.registros.find(
        (registro) => registro.id === sugestaoId && registro.usuarioId === usuarioId,
      ) ?? null
    );
  }

  async atualizarDecisao(
    usuarioId: string,
    sugestaoId: string,
    decisao: DecisaoUsuario,
    decisaoEm: Date,
    observacoes: string | null,
  ): Promise<SugestaoAporteRegistro | null> {
    const registro = this.registros.find(
      (item) => item.id === sugestaoId && item.usuarioId === usuarioId,
    );
    if (registro === undefined) {
      return null;
    }

    registro.decisaoUsuario = decisao;
    registro.decisaoEm = decisaoEm;
    registro.observacoesDecisao = observacoes;
    return registro;
  }
}

function limite(
  dimensao: LimiteRegistro["dimensao"],
  referencia: string | null,
  percentualMax: string,
): LimiteRegistro {
  return {
    id: `limite-${dimensao}-${referencia ?? "default"}`,
    dimensao,
    referencia,
    percentualMax,
    vigenciaInicio: "2026-11-01",
    vigenciaFim: null,
    criadoEm: AGORA,
  };
}

function candidato(alteracoes: Partial<CandidatoAporte> = {}): CandidatoAporte {
  return {
    ativoId: "ativo-hglg",
    ticker: "HGLG11",
    nome: "CSHG Logística",
    status: "ATIVO",
    classeId: "classe-fii",
    classeCodigo: "FII",
    segmentoId: "seg-log",
    segmentoCodigo: "LOGISTICA",
    naCarteira: true,
    valorAtual: "6500.00",
    ...alteracoes,
  };
}

const CARTEIRA_RF_ABAIXO: ValoresCarteira = {
  total: "10000.00",
  classes: [
    { id: "classe-rf", valor: "3500.00", valorIndisponivel: false },
    { id: "classe-fii", valor: "6500.00", valorIndisponivel: true },
  ],
  segmentos: [{ id: "seg-log", valor: "6500.00", valorIndisponivel: true }],
};

interface Cenario {
  readonly metas: MetasFake;
  readonly carteira: ValorCarteiraFake;
  readonly limites: LimitesFake;
  readonly repositorio: AporteRepositorioFake;
}

function cenario(referencias: ReferenciasAlocacao = REFERENCIAS): Cenario {
  return {
    metas: new MetasFake(referencias),
    carteira: new ValorCarteiraFake(),
    limites: new LimitesFake(),
    repositorio: new AporteRepositorioFake(),
  };
}

function deps(c: Cenario, agora = AGORA) {
  return {
    valorCarteira: c.carteira,
    metas: c.metas,
    limites: c.limites,
    repositorio: c.repositorio,
    agora,
  };
}

async function criarParaA(
  c: Cenario,
  valorDisponivel = "1000.00",
  data?: string,
): Promise<ResultadoCriacao> {
  return criarSugestaoAporte(
    { usuarioId: USUARIO_A, valorDisponivel, ...(data === undefined ? {} : { data }) },
    deps(c),
  );
}

type ResultadoCriacao = Awaited<ReturnType<typeof criarSugestaoAporte>>;

function somaValores(linhas: readonly { readonly valor: string }[]): string {
  return linhas
    .reduce((total, linha) => total + Number(linha.valor), 0)
    .toFixed(2);
}

describe("criarSugestaoAporte", () => {
  it("cria as metas default quando não há configuração e persiste o snapshot completo", async () => {
    const c = cenario();
    c.carteira.definir(USUARIO_A, CARTEIRA_RF_ABAIXO);
    c.repositorio.definirCandidatos(USUARIO_A, [
      candidato(),
      candidato({
        ativoId: "ativo-knri",
        ticker: "KNRI11",
        nome: "Kinea Renda Imobiliária",
        status: "INATIVO",
        segmentoId: "seg-shop",
        segmentoCodigo: "SHOPPING",
        naCarteira: false,
        valorAtual: "0.00",
      }),
      candidato({
        ativoId: "ativo-sem-seg",
        ticker: "SEMSEG11",
        nome: "Sem Segmento",
        segmentoId: null,
        segmentoCodigo: null,
        naCarteira: false,
        valorAtual: "0.00",
      }),
    ]);

    const resultado = await criarParaA(c);

    expect(isOk(resultado)).toBe(true);
    if (!resultado.ok) {
      return;
    }

    const registro = resultado.value;
    expect(c.repositorio.registros).toHaveLength(1);
    expect(registro.usuarioId).toBe(USUARIO_A);
    expect(registro.valorDisponivel).toBe("1000.00");
    expect(registro.data.toISOString()).toBe(AGORA.toISOString());

    const rendaFixa = registro.distribuicaoSugerida.classe.find(
      (item) => item.codigo === "RENDA_FIXA",
    );
    expect(rendaFixa?.valor).toBe("1000.00");
    expect(rendaFixa?.justificativa).toContain("abaixo da meta");

    expect(somaValores(registro.distribuicaoSugerida.classe)).toBe("1000.00");
    expect(registro.justificativas.length).toBeGreaterThan(0);

    expect(registro.distribuicaoAtual.classe).toEqual([
      { codigo: "RENDA_FIXA", percentual: "35.000000" },
      { codigo: "FII", percentual: "65.000000" },
    ]);

    expect(registro.ativosAvaliados.map((ativo) => ativo.ticker)).toEqual([
      "HGLG11",
      "KNRI11",
      "SEMSEG11",
    ]);
    const hglg = registro.ativosAvaliados[0];
    expect(hglg?.checklist.aumentaConcentracao).toBe("INDISPONIVEL");
    expect(hglg?.checklist.dadosSuficientes).toBe("INDISPONIVEL");
    expect(hglg?.classificacao).toBe("ACIMA_META");
    expect(registro.ativosAvaliados[1]?.classificacao).toBe("SEM_DADOS_SUFICIENTES");
    expect(registro.ativosAvaliados[2]?.classificacao).toBe("SEM_DADOS_SUFICIENTES");

    expect(registro.alertas.join(" ")).toContain("Nenhum limite de concentração configurado");
  });

  it("usa a data recebida no comando e não grava senha/token na resposta", async () => {
    const c = cenario();
    c.carteira.definir(USUARIO_A, CARTEIRA_RF_ABAIXO);

    const resultado = await criarParaA(c, "1000.00", "2026-11-05");

    expect(isOk(resultado)).toBe(true);
    if (!resultado.ok) {
      return;
    }

    expect(resultado.value.data.toISOString()).toBe("2026-11-05T00:00:00.000Z");
    const json = JSON.stringify(apresentarSugestao(resultado.value));
    expect(json).not.toContain("senha");
    expect(json).not.toContain("token");
  });

  it("rejeita valor zero e não grava nada", async () => {
    const c = cenario();
    c.carteira.definir(USUARIO_A, CARTEIRA_RF_ABAIXO);

    const resultado = await criarParaA(c, "0.00");

    expect(isErr(resultado)).toBe(true);
    if (resultado.ok) {
      return;
    }

    expect(resultado.error).toBeInstanceOf(AppError);
    expect(resultado.error.code).toBe("APORTE_VALOR_INVALIDO");
    expect(resultado.error.status).toBe(422);
    expect(c.repositorio.registros).toHaveLength(0);
  });

  it.each(["-10.00", "abc"])("rejeita valor inválido %s", async (valor) => {
    const c = cenario();
    const resultado = await criarParaA(c, valor);
    expect(isErr(resultado)).toBe(true);
    if (!resultado.ok) {
      expect(resultado.error.code).toBe("APORTE_VALOR_INVALIDO");
    }
  });

  it("retorna APORTE_DADOS_INSUFICIENTES quando o catálogo está vazio", async () => {
    const c = cenario({ classes: [], segmentos: [] });

    const resultado = await criarParaA(c);

    expect(isErr(resultado)).toBe(true);
    if (!resultado.ok) {
      expect(resultado.error.code).toBe("APORTE_DADOS_INSUFICIENTES");
      expect(resultado.error.status).toBe(409);
    }
  });

  it("marca concentração SIM e classifica o ativo abaixo da meta como COM_RISCOS", async () => {
    const c = cenario();
    c.metas.adicionar(USUARIO_A, "CLASSE", "RENDA_FIXA", "40.000000");
    c.metas.adicionar(USUARIO_A, "CLASSE", "FII", "60.000000");
    c.metas.adicionar(USUARIO_A, "SEGMENTO", "LOGISTICA", "60.000000");
    c.metas.adicionar(USUARIO_A, "SEGMENTO", "SHOPPING", "40.000000");
    c.carteira.definir(USUARIO_A, {
      total: "10000.00",
      classes: [
        { id: "classe-rf", valor: "6000.00", valorIndisponivel: false },
        { id: "classe-fii", valor: "4000.00", valorIndisponivel: true },
      ],
      segmentos: [{ id: "seg-log", valor: "4000.00", valorIndisponivel: true }],
    });
    c.limites.definir(USUARIO_A, [limite("SEGMENTO", null, "30.000000")]);
    c.repositorio.definirCandidatos(USUARIO_A, [
      candidato({ ativoId: "ativo-2", ticker: "HGBS11", nome: "HGBS", naCarteira: false, valorAtual: "0.00" }),
    ]);

    const resultado = await criarParaA(c);

    expect(isOk(resultado)).toBe(true);
    if (!resultado.ok) {
      return;
    }

    const avaliado = resultado.value.ativosAvaliados[0];
    expect(avaliado?.checklist.aumentaConcentracao).toBe("SIM");
    expect(avaliado?.classificacao).toBe("ABAIXO_META_COM_RISCOS");
  });

  it("alerta quando um segmento recebe aporte e não tem ativo cadastrado", async () => {
    const c = cenario();
    c.metas.adicionar(USUARIO_A, "CLASSE", "RENDA_FIXA", "40.000000");
    c.metas.adicionar(USUARIO_A, "CLASSE", "FII", "60.000000");
    c.metas.adicionar(USUARIO_A, "SEGMENTO", "LOGISTICA", "100.000000");
    c.carteira.definir(USUARIO_A, {
      total: "10000.00",
      classes: [
        { id: "classe-rf", valor: "6000.00", valorIndisponivel: false },
        { id: "classe-fii", valor: "4000.00", valorIndisponivel: true },
      ],
      segmentos: [{ id: "seg-log", valor: "4000.00", valorIndisponivel: true }],
    });
    c.repositorio.definirCandidatos(USUARIO_A, [
      candidato({
        ativoId: "ativo-shop",
        ticker: "XPML11",
        segmentoId: "seg-shop",
        segmentoCodigo: "SHOPPING",
        naCarteira: false,
        valorAtual: "0.00",
      }),
    ]);

    const resultado = await criarParaA(c);

    expect(isOk(resultado)).toBe(true);
    if (!resultado.ok) {
      return;
    }

    expect(resultado.value.alertas.join(" ")).toContain(
      "Segmento LOGISTICA recebe R$ 1.000,00 e não tem ativo cadastrado",
    );
  });

  it("avisa quando não há nenhum ativo cadastrado", async () => {
    const c = cenario();
    c.carteira.definir(USUARIO_A, CARTEIRA_RF_ABAIXO);

    const resultado = await criarParaA(c);

    expect(isOk(resultado)).toBe(true);
    if (resultado.ok) {
      expect(resultado.value.ativosAvaliados).toEqual([]);
      expect(resultado.value.alertas.join(" ")).toContain("Nenhum ativo cadastrado");
    }
  });
});

describe("registrarDecisaoAporte", () => {
  async function sugestaoDeA(c: Cenario): Promise<SugestaoAporteRegistro> {
    c.carteira.definir(USUARIO_A, CARTEIRA_RF_ABAIXO);
    const resultado = await criarParaA(c);
    if (!resultado.ok) {
      throw new Error("não foi possível criar a sugestão de teste");
    }
    return resultado.value;
  }

  it("registra ACEITA com decisaoEm e mantém a sugestão original", async () => {
    const c = cenario();
    const sugestao = await sugestaoDeA(c);

    const resultado = await registrarDecisaoAporte(
      { usuarioId: USUARIO_A, sugestaoId: sugestao.id, decisao: "ACEITA" },
      { repositorio: c.repositorio, agora: AGORA_DECISAO },
    );

    expect(isOk(resultado)).toBe(true);
    if (!resultado.ok) {
      return;
    }

    expect(resultado.value.id).toBe(sugestao.id);
    expect(resultado.value.decisaoUsuario).toBe("ACEITA");
    expect(resultado.value.decisaoEm?.toISOString()).toBe(AGORA_DECISAO.toISOString());
    expect(resultado.value.observacoesDecisao).toBeNull();
    expect(resultado.value.distribuicaoSugerida).toEqual(sugestao.distribuicaoSugerida);
    expect(c.repositorio.registros).toHaveLength(1);
  });

  it("sobrescreve a decisão anterior atualizando decisaoEm", async () => {
    const c = cenario();
    const sugestao = await sugestaoDeA(c);

    await registrarDecisaoAporte(
      { usuarioId: USUARIO_A, sugestaoId: sugestao.id, decisao: "ACEITA" },
      { repositorio: c.repositorio, agora: AGORA_DECISAO },
    );

    const outraData = new Date("2026-11-11T08:00:00.000Z");
    const resultado = await registrarDecisaoAporte(
      {
        usuarioId: USUARIO_A,
        sugestaoId: sugestao.id,
        decisao: "ALTERADA",
        observacoes: "vou aportar metade",
      },
      { repositorio: c.repositorio, agora: outraData },
    );

    expect(isOk(resultado)).toBe(true);
    if (resultado.ok) {
      expect(resultado.value.decisaoUsuario).toBe("ALTERADA");
      expect(resultado.value.decisaoEm?.toISOString()).toBe(outraData.toISOString());
      expect(resultado.value.observacoesDecisao).toBe("vou aportar metade");
      expect(apresentarDecisao(resultado.value).observacoes).toBe("vou aportar metade");
    }
    expect(c.repositorio.registros).toHaveLength(1);
  });

  it("grava null quando a observação é ausente ou vazia", async () => {
    const c = cenario();
    const sugestao = await sugestaoDeA(c);

    const vazia = await registrarDecisaoAporte(
      { usuarioId: USUARIO_A, sugestaoId: sugestao.id, decisao: "IGNORADA", observacoes: "   " },
      { repositorio: c.repositorio, agora: AGORA_DECISAO },
    );
    expect(isOk(vazia)).toBe(true);
    if (vazia.ok) {
      expect(vazia.value.observacoesDecisao).toBeNull();
      expect(apresentarDecisao(vazia.value).observacoes).toBeNull();
    }

    const ausente = await registrarDecisaoAporte(
      { usuarioId: USUARIO_A, sugestaoId: sugestao.id, decisao: "ACEITA" },
      { repositorio: c.repositorio, agora: AGORA_DECISAO },
    );
    expect(isOk(ausente)).toBe(true);
    if (ausente.ok) {
      expect(ausente.value.observacoesDecisao).toBeNull();
    }
  });

  it("devolve APORTE_NAO_ENCONTRADO quando outro titular tenta decidir", async () => {
    const c = cenario();
    const sugestao = await sugestaoDeA(c);

    const resultado = await registrarDecisaoAporte(
      { usuarioId: USUARIO_B, sugestaoId: sugestao.id, decisao: "ACEITA" },
      { repositorio: c.repositorio },
    );

    expect(isErr(resultado)).toBe(true);
    if (!resultado.ok) {
      expect(resultado.error.code).toBe("APORTE_NAO_ENCONTRADO");
      expect(resultado.error.status).toBe(404);
    }
  });

  it("devolve APORTE_NAO_ENCONTRADO para id inexistente", async () => {
    const c = cenario();
    const resultado = await registrarDecisaoAporte(
      { usuarioId: USUARIO_A, sugestaoId: "sugestao-inexistente", decisao: "IGNORADA" },
      { repositorio: c.repositorio },
    );

    expect(isErr(resultado)).toBe(true);
    if (!resultado.ok) {
      expect(resultado.error.code).toBe("APORTE_NAO_ENCONTRADO");
    }
  });

  it("devolve APORTE_DECISAO_INVALIDA para valor fora do enum", async () => {
    const c = cenario();
    const sugestao = await sugestaoDeA(c);

    const resultado = await registrarDecisaoAporte(
      { usuarioId: USUARIO_A, sugestaoId: sugestao.id, decisao: "TALVEZ" },
      { repositorio: c.repositorio },
    );

    expect(isErr(resultado)).toBe(true);
    if (!resultado.ok) {
      expect(resultado.error.code).toBe("APORTE_DECISAO_INVALIDA");
      expect(resultado.error.status).toBe(422);
    }
  });
});

describe("apresentacao", () => {
  it("serializa a sugestão e a decisão no contrato da API", async () => {
    const c = cenario();
    c.carteira.definir(USUARIO_A, CARTEIRA_RF_ABAIXO);
    const criada = await criarParaA(c);
    expect(isOk(criada)).toBe(true);
    if (!criada.ok) {
      return;
    }

    const semDecisao = apresentarDecisao(criada.value);
    expect(semDecisao).toEqual({
      id: criada.value.id,
      decisaoUsuario: null,
      decisaoEm: null,
      observacoes: null,
    });

    const decidida = await registrarDecisaoAporte(
      { usuarioId: USUARIO_A, sugestaoId: criada.value.id, decisao: "IGNORADA" },
      { repositorio: c.repositorio, agora: AGORA_DECISAO },
    );
    expect(isOk(decidida)).toBe(true);
    if (!decidida.ok) {
      return;
    }

    expect(apresentarDecisao(decidida.value)).toEqual({
      id: criada.value.id,
      decisaoUsuario: "IGNORADA",
      decisaoEm: AGORA_DECISAO.toISOString(),
      observacoes: null,
    });

    const api = apresentarSugestao(decidida.value);
    expect(api.data).toBe(AGORA.toISOString());
    expect(api.valorDisponivel).toBe("1000.00");
    expect(api.ativosAvaliados).toBe(decidida.value.ativosAvaliados);
  });
});
