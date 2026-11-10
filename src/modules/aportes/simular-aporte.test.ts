import { describe, expect, it, vi } from "vitest";

import { Decimal } from "../../lib/decimal";
import { isErr, isOk } from "../../lib/result";
import type {
  AlocacaoMetaRepositorio,
  MetaRegistro,
  NovaMeta,
  ReferenciasAlocacao,
} from "../alocacao/repositorio";
import type { ValorCarteira, ValoresCarteira } from "../carteira/valor-carteira";
import type { AporteRepositorio, CandidatoAporte } from "./repositorio";
import { simularAporte, type SimularAporteDeps } from "./simular-aporte";
import type { SugestaoAporteRegistro } from "./tipos";

/**
 * Testes da simulação de aporte (RN-028, RN-028-1; API_CONTRACTS.md §8.2).
 *
 * Cobrem o comparativo antes/depois/delta com o motor da RN-025, a soma exata
 * do patrimônio pós-aporte, a carteira vazia com metas lazy (RN-021), os
 * valores inválidos e a prova de que a simulação não persiste nada — o fake de
 * repositório de sugestão é injetado e nunca chamado. Nenhum banco é tocado.
 */

const USUARIO_A = "usuario-a";
const AGORA = new Date("2026-11-10T12:00:00.000Z");

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
    throw new Error("não usado na simulação");
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
  readonly chamadas: string[] = [];
  private readonly porUsuario = new Map<string, ValoresCarteira>();

  definir(usuarioId: string, valores: ValoresCarteira): void {
    this.porUsuario.set(usuarioId, valores);
  }

  async agregar(usuarioId: string): Promise<ValoresCarteira> {
    this.chamadas.push(usuarioId);
    return this.porUsuario.get(usuarioId) ?? { total: "0.00", classes: [], segmentos: [] };
  }
}

/** Repositório de sugestão com espiões: a simulação não pode chamar nada. */
function repositorioEspiao() {
  return {
    listarCandidatos: vi.fn(async (): Promise<readonly CandidatoAporte[]> => []),
    criar: vi.fn(async (): Promise<SugestaoAporteRegistro> => {
      throw new Error("a simulação não deve persistir sugestão");
    }),
    buscarPorId: vi.fn(async (): Promise<SugestaoAporteRegistro | null> => null),
    atualizarDecisao: vi.fn(async (): Promise<SugestaoAporteRegistro | null> => null),
  } satisfies AporteRepositorio;
}

interface Cenario {
  readonly metas: MetasFake;
  readonly carteira: ValorCarteiraFake;
  readonly repositorio: ReturnType<typeof repositorioEspiao>;
}

function cenario(referencias: ReferenciasAlocacao = REFERENCIAS): Cenario {
  return {
    metas: new MetasFake(referencias),
    carteira: new ValorCarteiraFake(),
    repositorio: repositorioEspiao(),
  };
}

function deps(c: Cenario): SimularAporteDeps & { readonly repositorio: AporteRepositorio } {
  // O mesmo shape que a borda passa (`servicosAportes()`): inclui o
  // repositório de escrita, que o caso de uso não deve tocar.
  return { valorCarteira: c.carteira, metas: c.metas, repositorio: c.repositorio };
}

function simular(c: Cenario, valorAporte = "1000.00") {
  return simularAporte({ usuarioId: USUARIO_A, valorAporte }, deps(c));
}

function soma(linhas: readonly { readonly valor: string }[]): string {
  return linhas
    .reduce((total, linha) => total.add(Decimal.from(linha.valor)), Decimal.zero(2))
    .toFixed(2);
}

function valorDe(
  linhas: readonly { readonly codigo: string; readonly valor: string }[],
  codigo: string,
): string {
  return linhas.find((linha) => linha.codigo === codigo)?.valor ?? "ausente";
}

describe("simularAporte", () => {
  it("compara antes/depois/delta aplicando 100% do aporte na classe abaixo da meta", async () => {
    const c = cenario();
    c.metas.adicionar(USUARIO_A, "CLASSE", "RENDA_FIXA", "35.000000");
    c.metas.adicionar(USUARIO_A, "CLASSE", "FII", "65.000000");
    c.metas.adicionar(USUARIO_A, "SEGMENTO", "LOGISTICA", "100.000000");
    c.carteira.definir(USUARIO_A, {
      total: "10000.00",
      classes: [{ id: "classe-fii", valor: "10000.00", valorIndisponivel: true }],
      segmentos: [{ id: "seg-log", valor: "10000.00", valorIndisponivel: true }],
    });

    const resultado = await simular(c);

    expect(isOk(resultado)).toBe(true);
    if (!resultado.ok) {
      return;
    }

    const { valorAporte, antes, depois, delta } = resultado.value;
    expect(valorAporte).toBe("1000.00");
    expect(antes.patrimonioTotal).toBe("10000.00");
    expect(depois.patrimonioTotal).toBe("11000.00");

    expect(antes.classe).toEqual([
      { codigo: "RENDA_FIXA", valor: "0.00", percentual: "0.000000" },
      { codigo: "FII", valor: "10000.00", percentual: "100.000000" },
    ]);
    expect(valorDe(depois.classe, "RENDA_FIXA")).toBe("1000.00");
    expect(valorDe(depois.classe, "FII")).toBe("10000.00");
    expect(depois.classe.find((linha) => linha.codigo === "RENDA_FIXA")?.percentual).toBe(
      "9.090909",
    );
    expect(depois.classe.find((linha) => linha.codigo === "FII")?.percentual).toBe("90.909091");

    expect(delta.classe).toEqual([
      { codigo: "RENDA_FIXA", pontosPercentuais: "9.090909" },
      { codigo: "FII", pontosPercentuais: "-9.090909" },
    ]);

    // Delta é exatamente depois − antes em todas as linhas.
    for (const [indice, linha] of delta.classe.entries()) {
      const esperado = Decimal.from(depois.classe[indice].percentual).sub(
        antes.classe[indice].percentual,
      );
      expect(linha.pontosPercentuais).toBe(esperado.toFixed(6));
    }

    // O valor do segmento não muda, mas sua participação cai porque o
    // denominador passa a incluir o aporte (10000/11000).
    expect(valorDe(depois.segmento, "LOGISTICA")).toBe("10000.00");
    expect(delta.segmento).toEqual([{ codigo: "LOGISTICA", pontosPercentuais: "-9.090909" }]);

    expect(soma(depois.classe)).toBe("11000.00");
    expect(soma(antes.classe)).toBe("10000.00");
  });

  it("com metas 50/50 e carteira 35/65 aplica todo o aporte em RF: 40,9% (+5,9 p.p.)", async () => {
    // Cenário do critério de aceitação da RN-028: RF 35% / FII 65%, metas
    // 50/50 e R$ 1.000,00 hipotéticos. O gap da RF (5.500 − 3.500 = 2.000)
    // absorve o aporte inteiro; o FII fica com o valor e perde participação.
    const c = cenario();
    c.metas.adicionar(USUARIO_A, "CLASSE", "RENDA_FIXA", "50.000000");
    c.metas.adicionar(USUARIO_A, "CLASSE", "FII", "50.000000");
    c.metas.adicionar(USUARIO_A, "SEGMENTO", "LOGISTICA", "100.000000");
    c.carteira.definir(USUARIO_A, {
      total: "10000.00",
      classes: [
        { id: "classe-rf", valor: "3500.00", valorIndisponivel: false },
        { id: "classe-fii", valor: "6500.00", valorIndisponivel: true },
      ],
      segmentos: [{ id: "seg-log", valor: "6500.00", valorIndisponivel: true }],
    });

    const resultado = await simular(c);

    expect(isOk(resultado)).toBe(true);
    if (!resultado.ok) {
      return;
    }

    const { antes, depois, delta } = resultado.value;
    expect(antes.patrimonioTotal).toBe("10000.00");
    expect(depois.patrimonioTotal).toBe("11000.00");

    // Antes 35/65; depois 4.500/11.000 = 40,909091% e 6.500/11.000 = 59,090909%.
    expect(valorDe(antes.classe, "RENDA_FIXA")).toBe("3500.00");
    expect(valorDe(antes.classe, "FII")).toBe("6500.00");
    expect(valorDe(depois.classe, "RENDA_FIXA")).toBe("4500.00");
    expect(valorDe(depois.classe, "FII")).toBe("6500.00");
    expect(depois.classe.find((linha) => linha.codigo === "RENDA_FIXA")?.percentual).toBe(
      "40.909091",
    );
    expect(depois.classe.find((linha) => linha.codigo === "FII")?.percentual).toBe("59.090909");
    expect(delta.classe).toEqual([
      { codigo: "RENDA_FIXA", pontosPercentuais: "5.909091" },
      { codigo: "FII", pontosPercentuais: "-5.909091" },
    ]);

    // Critério de aceitação: soma do depois = patrimônio + aporte.
    expect(soma(depois.classe)).toBe(
      Decimal.from(antes.patrimonioTotal).add("1000.00").toFixed(2),
    );

    // A simulação é somente leitura.
    expect(c.repositorio.criar).not.toHaveBeenCalled();
    expect(c.repositorio.listarCandidatos).not.toHaveBeenCalled();
  });

  it("mantém a soma de depois igual ao patrimônio + aporte com arredondamento", async () => {
    const c = cenario();
    c.metas.adicionar(USUARIO_A, "CLASSE", "RENDA_FIXA", "50.000000");
    c.metas.adicionar(USUARIO_A, "CLASSE", "FII", "50.000000");

    const resultado = await simular(c, "1000.01");

    expect(isOk(resultado)).toBe(true);
    if (!resultado.ok) {
      return;
    }

    expect(resultado.value.valorAporte).toBe("1000.01");
    expect(resultado.value.antes.patrimonioTotal).toBe("0.00");
    expect(resultado.value.depois.patrimonioTotal).toBe("1000.01");
    expect(soma(resultado.value.depois.classe)).toBe("1000.01");
    expect(valorDe(resultado.value.depois.classe, "RENDA_FIXA")).toBe("500.01");
    expect(valorDe(resultado.value.depois.classe, "FII")).toBe("500.00");
  });

  it("materializa as metas default na carteira vazia e distribui pela meta", async () => {
    const c = cenario();

    const resultado = await simular(c);

    expect(isOk(resultado)).toBe(true);
    if (!resultado.ok) {
      return;
    }

    const { antes, depois, delta } = resultado.value;
    expect(antes.patrimonioTotal).toBe("0.00");
    expect(antes.classe.every((linha) => linha.percentual === "0.000000")).toBe(true);
    expect(antes.segmento.every((linha) => linha.percentual === "0.000000")).toBe(true);

    // Defaults RN-021: RF 50 / FII 50.
    expect(valorDe(depois.classe, "RENDA_FIXA")).toBe("500.00");
    expect(valorDe(depois.classe, "FII")).toBe("500.00");
    expect(depois.classe.every((linha) => linha.percentual === "50.000000")).toBe(true);
    expect(soma(depois.classe)).toBe("1000.00");

    // Water-filling: os maiores gaps (LOGISTICA e RECEBIVEIS, 25% de 1.000)
    // consomem os R$ 500,00 da parcela de FII.
    expect(valorDe(depois.segmento, "LOGISTICA")).toBe("250.00");
    expect(valorDe(depois.segmento, "RECEBIVEIS")).toBe("250.00");
    expect(valorDe(depois.segmento, "SHOPPING")).toBe("0.00");
    expect(soma(depois.segmento)).toBe("500.00");

    expect(delta.classe.find((linha) => linha.codigo === "RENDA_FIXA")?.pontosPercentuais).toBe(
      "50.000000",
    );
    expect(delta.segmento.find((linha) => linha.codigo === "LOGISTICA")?.pontosPercentuais).toBe(
      "25.000000",
    );
  });

  it("não persiste nem lê candidatos: o repositório de escrita não é chamado", async () => {
    const c = cenario();
    c.metas.adicionar(USUARIO_A, "CLASSE", "RENDA_FIXA", "50.000000");
    c.metas.adicionar(USUARIO_A, "CLASSE", "FII", "50.000000");
    c.carteira.definir(USUARIO_A, {
      total: "1000.00",
      classes: [{ id: "classe-rf", valor: "1000.00", valorIndisponivel: false }],
      segmentos: [],
    });

    const resultado = await simular(c);

    expect(isOk(resultado)).toBe(true);
    expect(c.repositorio.criar).not.toHaveBeenCalled();
    expect(c.repositorio.listarCandidatos).not.toHaveBeenCalled();
    expect(c.repositorio.buscarPorId).not.toHaveBeenCalled();
    expect(c.repositorio.atualizarDecisao).not.toHaveBeenCalled();
  });

  it("rejeita valor zero com 422 antes de ler a carteira", async () => {
    const c = cenario();

    const resultado = await simular(c, "0.00");

    expect(isErr(resultado)).toBe(true);
    if (resultado.ok) {
      return;
    }
    expect(resultado.error.code).toBe("APORTE_VALOR_INVALIDO");
    expect(resultado.error.status).toBe(422);
    expect(c.carteira.chamadas).toEqual([]);
    expect(c.repositorio.criar).not.toHaveBeenCalled();
  });

  it.each(["abc", "-10.00", ""])("rejeita valor inválido %j", async (valor) => {
    const c = cenario();

    const resultado = await simular(c, valor);

    expect(isErr(resultado)).toBe(true);
    if (!resultado.ok) {
      expect(resultado.error.code).toBe("APORTE_VALOR_INVALIDO");
    }
    expect(c.carteira.chamadas).toEqual([]);
  });

  it("devolve APORTE_DADOS_INSUFICIENTES quando o catálogo está vazio", async () => {
    const c = cenario({ classes: [], segmentos: [] });

    const resultado = await simular(c);

    expect(isErr(resultado)).toBe(true);
    if (!resultado.ok) {
      expect(resultado.error.code).toBe("APORTE_DADOS_INSUFICIENTES");
      expect(resultado.error.status).toBe(409);
    }
    expect(c.carteira.chamadas).toEqual([]);
  });

  it("devolve APORTE_DADOS_INSUFICIENTES quando as metas default são impossíveis", async () => {
    const c = cenario({
      classes: [{ id: "classe-rf", codigo: "RENDA_FIXA", nome: "Renda Fixa", ordem: 1, ativo: true }],
      segmentos: REFERENCIAS.segmentos,
    });

    const resultado = await simular(c);

    expect(isErr(resultado)).toBe(true);
    if (!resultado.ok) {
      expect(resultado.error.code).toBe("APORTE_DADOS_INSUFICIENTES");
    }
    expect(c.carteira.chamadas).toEqual([]);
  });

  it("devolve APORTE_DADOS_INSUFICIENTES quando não há meta vigente de classe", async () => {
    const c = cenario();
    c.metas.adicionar(USUARIO_A, "SEGMENTO", "LOGISTICA", "100.000000");

    const resultado = await simular(c);

    expect(isErr(resultado)).toBe(true);
    if (!resultado.ok) {
      expect(resultado.error.code).toBe("APORTE_DADOS_INSUFICIENTES");
    }
    expect(c.carteira.chamadas).toEqual([]);
  });
});
