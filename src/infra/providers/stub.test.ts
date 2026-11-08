import { describe, expect, it } from "vitest";
import { z } from "zod";

import { CAPACIDADES } from "../../modules/pesquisa/provedor";
import { ProvedorStub } from "./stub";

const CLOCK_FIXO = () => new Date("2026-01-02T12:00:00.000Z");

function criarStub(overrides: Partial<ConstructorParameters<typeof ProvedorStub>[0]> = {}) {
  return new ProvedorStub({
    dados: { cotacao: { preco: "10.00" } },
    clock: CLOCK_FIXO,
    dataReferencia: "2026-01-01",
    ...overrides,
  });
}

describe("ProvedorStub", () => {
  it("usa padrões determinísticos", async () => {
    const stub = criarStub();

    expect(stub.nome).toBe("stub");
    expect([...stub.capacidades]).toEqual([...CAPACIDADES]);
    expect(stub.suporta("cotacao")).toBe(true);

    const dado = await stub.buscar("cotacao", "cotacao");

    expect(dado).toEqual({
      valor: { preco: "10.00" },
      fonte: "stub",
      provedorId: "stub",
      dataReferencia: "2026-01-01",
      coletadoEm: "2026-01-02T12:00:00.000Z",
      statusDado: "ESTIMADO",
    });
  });

  it("respeita nome, provedorId, status e capacidades informados", async () => {
    const stub = criarStub({
      nome: "fixture",
      provedorId: "fixture-id",
      statusDado: "OFICIAL",
      capacidades: ["cotacao"],
      dados: { cotacao: 42 },
    });

    expect(stub.suporta("cotacao")).toBe(true);
    expect(stub.suporta("dividendos")).toBe(false);

    const dado = await stub.buscar("cotacao", "cotacao");

    expect(dado.fonte).toBe("fixture");
    expect(dado.provedorId).toBe("fixture-id");
    expect(dado.statusDado).toBe("OFICIAL");
    expect(dado.valor).toBe(42);
  });

  it("deriva dataReferencia do clock quando não informada", async () => {
    const stub = new ProvedorStub({
      dados: { cotacao: 1 },
      clock: () => new Date("2026-03-04T23:10:00.000Z"),
    });

    const dado = await stub.buscar("cotacao", "cotacao");

    expect(dado.dataReferencia).toBe("2026-03-04");
    expect(dado.coletadoEm).toBe("2026-03-04T23:10:00.000Z");
  });

  it("valida o valor contra o schema informado", async () => {
    const stub = criarStub({ dados: { cotacao: { preco: "10.00" } } });
    const schema = z.object({ preco: z.string().regex(/^\d+\.\d{2}$/) });

    const dado = await stub.buscar("cotacao", "cotacao", schema);

    expect(dado.valor).toEqual({ preco: "10.00" });
  });

  it("rejeita valor fora do schema com INT_RESPOSTA_INVALIDA", async () => {
    const stub = criarStub({ dados: { cotacao: { preco: 10 } } });
    const schema = z.object({ preco: z.string() });

    await expect(stub.buscar("cotacao", "cotacao", schema)).rejects.toMatchObject({
      code: "INT_RESPOSTA_INVALIDA",
      details: { recurso: "cotacao", provedor: "stub" },
    });
  });

  it("devolve erro quando o recurso não existe", async () => {
    const stub = criarStub();

    await expect(stub.buscar("inexistente", "cotacao")).rejects.toMatchObject({
      code: "INT_ATIVO_NAO_ENCONTRADO",
      details: { recurso: "inexistente", provedor: "stub" },
    });
  });

  it("não confunde propriedades herdadas com recurso", async () => {
    const stub = criarStub();

    await expect(stub.buscar("toString", "cotacao")).rejects.toMatchObject({
      code: "INT_ATIVO_NAO_ENCONTRADO",
    });
  });

  it("rejeita capacidade não suportada", async () => {
    const stub = criarStub({ capacidades: ["cotacao"] });

    await expect(stub.buscar("cotacao", "dividendos")).rejects.toMatchObject({
      code: "INT_OPERACAO_NAO_SUPORTADA",
      details: { capacidade: "dividendos", provedor: "stub" },
    });
  });

  it("rejeita data de referência fora do formato ISO", async () => {
    const stub = criarStub({ dataReferencia: "01/01/2026" });

    await expect(stub.buscar("cotacao", "cotacao")).rejects.toMatchObject({
      code: "INT_RESPOSTA_INVALIDA",
      details: { provedor: "stub" },
    });
  });
});
