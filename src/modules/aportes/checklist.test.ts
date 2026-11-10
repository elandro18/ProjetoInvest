import { describe, expect, it } from "vitest";

import type { LimiteRegistro } from "../risco/repositorio";
import { avaliarCandidato, resolverLimite, type ContextoChecklist } from "./checklist";
import type { CandidatoAporte } from "./repositorio";

/**
 * Testes do checklist e da classificação (RN-050, RN-051, RN-055, RN-056;
 * RN-025-3). Cobrem os itens indisponíveis, a concentração por segmento e por
 * ativo, o ativo inativo e os cinco estados de classificação.
 */

const CANDIDATO: CandidatoAporte = {
  ativoId: "ativo-1",
  ticker: "HGLG11",
  nome: "CSHG Logística",
  status: "ATIVO",
  classeId: "classe-fii",
  classeCodigo: "FII",
  segmentoId: "seg-log",
  segmentoCodigo: "LOGISTICA",
  naCarteira: false,
  valorAtual: "0.00",
};

function contexto(alteracoes: Partial<ContextoChecklist> = {}): ContextoChecklist {
  return {
    totalAtual: "10000.00",
    totalPosAporte: "11000.00",
    desvioClasse: new Map([["FII", "-10.000000"]]),
    desvioSegmento: new Map([["LOGISTICA", "-8.000000"]]),
    valorSegmentoAtual: new Map([["seg-log", "500.00"]]),
    aporteSegmento: new Map([["LOGISTICA", "500.00"]]),
    limites: [],
    ...alteracoes,
  };
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
    vigenciaInicio: "2026-11-10",
    vigenciaFim: null,
    criadoEm: new Date("2026-11-10T12:00:00.000Z"),
  };
}

describe("resolverLimite", () => {
  it("prefere o limite específico da referência ao default da dimensão", () => {
    const resolvido = resolverLimite(
      [
        limite("SEGMENTO", null, "30.000000"),
        limite("SEGMENTO", "logistica", "10.000000"),
      ],
      "SEGMENTO",
      "LOGISTICA",
    );

    expect(resolvido?.toFixed(2)).toBe("10.00");
  });

  it("usa o default quando não há limite específico", () => {
    const resolvido = resolverLimite([limite("ATIVO", null, "20.000000")], "ATIVO", "HGLG11");
    expect(resolvido?.toFixed(2)).toBe("20.00");
  });

  it("devolve null quando a dimensão não tem limite", () => {
    expect(resolverLimite([limite("ATIVO", null, "20.000000")], "SEGMENTO", "LOGISTICA")).toBeNull();
  });
});

describe("avaliarCandidato — checklist", () => {
  it("marca os itens sem dado como INDISPONIVEL e classifica como apto para estudo", () => {
    const avaliacao = avaliarCandidato(CANDIDATO, contexto());

    expect(avaliacao.checklist).toEqual({
      classeAbaixoMeta: true,
      segmentoAbaixoMeta: true,
      ativoJaNaCarteira: false,
      aumentaConcentracao: "INDISPONIVEL",
      dadosSuficientes: "INDISPONIVEL",
      atendeQualidade: "INDISPONIVEL",
      alertaRelevante: false,
      precoDentroParametros: "INDISPONIVEL",
    });
    expect(avaliacao.classificacao).toBe("ABAIXO_META_APTO_PARA_ESTUDO");
    expect(avaliacao.motivos.join(" ")).toContain("abaixo da meta");
    expect(avaliacao.motivos.join(" ")).toContain("Fase 3");
  });

  it("marca aumentaConcentracao SIM quando o segmento ultrapassa o limite configurado", () => {
    const avaliacao = avaliarCandidato(
      CANDIDATO,
      contexto({
        valorSegmentoAtual: new Map([["seg-log", "500.00"]]),
        aporteSegmento: new Map([["LOGISTICA", "1000.00"]]),
        limites: [limite("SEGMENTO", null, "10.000000")],
      }),
    );

    // (500 + 1000) / 11000 = 13,63% > 10%.
    expect(avaliacao.checklist.aumentaConcentracao).toBe("SIM");
    expect(avaliacao.checklist.alertaRelevante).toBe(false);
    expect(avaliacao.classificacao).toBe("ABAIXO_META_COM_RISCOS");
    expect(avaliacao.motivos.join(" ")).toContain("Limite de concentração do segmento");
  });

  it("usa o limite do ativo, assumindo a parcela do segmento, quando não há limite de segmento", () => {
    const avaliacao = avaliarCandidato(
      { ...CANDIDATO, valorAtual: "1000.00" },
      contexto({
        aporteSegmento: new Map([["LOGISTICA", "2000.00"]]),
        limites: [limite("ATIVO", "hglg11", "20.000000")],
      }),
    );

    // (1000 + 2000) / 11000 = 27,27% > 20%.
    expect(avaliacao.checklist.aumentaConcentracao).toBe("SIM");
    expect(avaliacao.motivos.join(" ")).toContain("Limite de concentração do ativo HGLG11");
  });

  it("não aumenta a concentração quando a projeção fica dentro do limite", () => {
    const avaliacao = avaliarCandidato(
      CANDIDATO,
      contexto({
        valorSegmentoAtual: new Map([["seg-log", "100.00"]]),
        aporteSegmento: new Map([["LOGISTICA", "200.00"]]),
        limites: [limite("SEGMENTO", "LOGISTICA", "30.000000")],
      }),
    );

    expect(avaliacao.checklist.aumentaConcentracao).toBe("NAO");
    expect(avaliacao.classificacao).toBe("ABAIXO_META_APTO_PARA_ESTUDO");
  });

  it("sinaliza alertaRelevante quando o segmento já está acima do limite", () => {
    const avaliacao = avaliarCandidato(
      CANDIDATO,
      contexto({
        valorSegmentoAtual: new Map([["seg-log", "1500.00"]]),
        aporteSegmento: new Map([["LOGISTICA", "0.00"]]),
        limites: [limite("SEGMENTO", "LOGISTICA", "10.000000")],
      }),
    );

    expect(avaliacao.checklist.alertaRelevante).toBe(true);
    expect(avaliacao.classificacao).toBe("ABAIXO_META_COM_RISCOS");
  });

  it("marca ativoJaNaCarteira quando há posição", () => {
    const avaliacao = avaliarCandidato({ ...CANDIDATO, naCarteira: true }, contexto());
    expect(avaliacao.checklist.ativoJaNaCarteira).toBe(true);
    expect(avaliacao.motivos).toContain("Ativo já está na carteira.");
  });
});

describe("avaliarCandidato — classificação", () => {
  it("classifica ativo inativo como SEM_DADOS_SUFICIENTES", () => {
    const avaliacao = avaliarCandidato({ ...CANDIDATO, status: "INATIVO" }, contexto());

    expect(avaliacao.classificacao).toBe("SEM_DADOS_SUFICIENTES");
    expect(avaliacao.motivos.join(" ")).toContain("Ativo inativo");
  });

  it("classifica ativo sem segmento como SEM_DADOS_SUFICIENTES", () => {
    const avaliacao = avaliarCandidato(
      { ...CANDIDATO, segmentoId: null, segmentoCodigo: null },
      contexto(),
    );

    expect(avaliacao.classificacao).toBe("SEM_DADOS_SUFICIENTES");
    expect(avaliacao.checklist.segmentoAbaixoMeta).toBe(false);
  });

  it("classifica DENTRO_META dentro da tolerância de 0,5 p.p.", () => {
    const avaliacao = avaliarCandidato(
      CANDIDATO,
      contexto({
        desvioClasse: new Map([["FII", "0.400000"]]),
        desvioSegmento: new Map([["LOGISTICA", "-0.200000"]]),
      }),
    );

    expect(avaliacao.classificacao).toBe("DENTRO_META");
  });

  it("classifica ACIMA_META quando a classe está acima da tolerância", () => {
    const avaliacao = avaliarCandidato(
      CANDIDATO,
      contexto({
        desvioClasse: new Map([["FII", "5.000000"]]),
        desvioSegmento: new Map([["LOGISTICA", "3.000000"]]),
      }),
    );

    expect(avaliacao.classificacao).toBe("ACIMA_META");
  });

  it("classifica ABAIXO_META_COM_RISCOS quando o segmento não está abaixo da meta", () => {
    const avaliacao = avaliarCandidato(
      CANDIDATO,
      contexto({ desvioSegmento: new Map([["LOGISTICA", "6.000000"]]) }),
    );

    expect(avaliacao.checklist.classeAbaixoMeta).toBe(true);
    expect(avaliacao.checklist.segmentoAbaixoMeta).toBe(false);
    expect(avaliacao.classificacao).toBe("ABAIXO_META_COM_RISCOS");
  });

  it("classifica SEM_DADOS_SUFICIENTES quando a classe não tem meta", () => {
    const avaliacao = avaliarCandidato(CANDIDATO, contexto({ desvioClasse: new Map() }));
    expect(avaliacao.classificacao).toBe("SEM_DADOS_SUFICIENTES");
  });
});
