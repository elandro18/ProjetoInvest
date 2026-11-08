import type { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { Capacidade, ProvedorDados } from "../../modules/pesquisa/provedor";
import {
  ProvedorRegistry,
  createPrismaProvedorFonte,
  createProvedorRegistry,
  normalizarCapacidades,
  type ProvedorFonte,
  type ProvedorRegistro,
} from "./registry";

function adapter(nome: string, capacidades: readonly Capacidade[]): ProvedorDados {
  const set = new Set(capacidades);
  return {
    nome,
    capacidades: set,
    suporta: (capacidade: Capacidade) => set.has(capacidade),
  };
}

function registro(overrides: Partial<ProvedorRegistro> & Pick<ProvedorRegistro, "id" | "nome">): ProvedorRegistro {
  return {
    capacidades: ["cotacao"],
    prioridade: 1,
    ativo: true,
    ...overrides,
  };
}

function fonte(registros: readonly ProvedorRegistro[]): ProvedorFonte {
  return { listar: async () => registros };
}

describe("normalizarCapacidades", () => {
  it("mantém apenas capacidades válidas, sem duplicatas", () => {
    expect(normalizarCapacidades(["cotacao", "cotacao", "invalida", 10, "dividendos"])).toEqual([
      "cotacao",
      "dividendos",
    ]);
  });

  it("devolve lista vazia para valor que não é array", () => {
    expect(normalizarCapacidades(null)).toEqual([]);
    expect(normalizarCapacidades("cotacao")).toEqual([]);
    expect(normalizarCapacidades({ 0: "cotacao" })).toEqual([]);
  });
});

describe("ProvedorRegistry.resolver", () => {
  it("escolhe o provedor de menor prioridade com a capacidade", async () => {
    const registry = createProvedorRegistry({
      fonte: fonte([
        registro({ id: "1", nome: "secundario", prioridade: 20 }),
        registro({ id: "2", nome: "principal", prioridade: 10 }),
      ]),
      adapters: {
        secundario: adapter("secundario", ["cotacao"]),
        principal: adapter("principal", ["cotacao"]),
      },
    });

    const resolvido = await registry.resolver("cotacao");

    expect(resolvido).toMatchObject({ id: "2", nome: "principal", prioridade: 10 });
    expect(resolvido.provedor).toBeInstanceOf(Object);
  });

  it("ignora provedor inativo", async () => {
    const registry = new ProvedorRegistry({
      fonte: fonte([
        registro({ id: "1", nome: "inativo", prioridade: 1, ativo: false }),
        registro({ id: "2", nome: "ativo", prioridade: 2 }),
      ]),
      adapters: {
        inativo: adapter("inativo", ["cotacao"]),
        ativo: adapter("ativo", ["cotacao"]),
      },
    });

    await expect(registry.resolver("cotacao")).resolves.toMatchObject({ nome: "ativo" });
  });

  it("ignora provedor sem adapter registrado", async () => {
    const registry = new ProvedorRegistry({
      fonte: fonte([
        registro({ id: "1", nome: "sem-adapter", prioridade: 1 }),
        registro({ id: "2", nome: "com-adapter", prioridade: 2 }),
      ]),
      adapters: { "com-adapter": adapter("com-adapter", ["cotacao"]) },
    });

    await expect(registry.resolver("cotacao")).resolves.toMatchObject({ nome: "com-adapter" });
  });

  it("ignora adapter que não suporta a capacidade", async () => {
    const registry = new ProvedorRegistry({
      fonte: fonte([
        registro({ id: "1", nome: "parcial", prioridade: 1 }),
        registro({ id: "2", nome: "completo", prioridade: 2 }),
      ]),
      adapters: {
        parcial: adapter("parcial", ["dividendos"]),
        completo: adapter("completo", ["cotacao"]),
      },
    });

    await expect(registry.resolver("cotacao")).resolves.toMatchObject({ nome: "completo" });
  });

  it("ignora provedor ativo que não declara a capacidade", async () => {
    const registry = new ProvedorRegistry({
      fonte: fonte([
        registro({ id: "1", nome: "outra-capacidade", capacidades: ["dividendos"] }),
      ]),
      adapters: { "outra-capacidade": adapter("outra-capacidade", ["cotacao", "dividendos"]) },
    });

    await expect(registry.resolver("cotacao")).rejects.toMatchObject({
      code: "INT_OPERACAO_NAO_SUPORTADA",
    });
  });

  it("desempata prioridade pelo nome em pt-BR", async () => {
    const registry = new ProvedorRegistry({
      fonte: fonte([
        registro({ id: "1", nome: "beta", prioridade: 5 }),
        registro({ id: "2", nome: "alfa", prioridade: 5 }),
      ]),
      adapters: {
        beta: adapter("beta", ["cotacao"]),
        alfa: adapter("alfa", ["cotacao"]),
      },
    });

    await expect(registry.resolver("cotacao")).resolves.toMatchObject({ nome: "alfa" });
  });

  it("lança INT_OPERACAO_NAO_SUPORTADA quando não há candidato", async () => {
    const registry = new ProvedorRegistry({ fonte: fonte([]), adapters: {} });

    await expect(registry.resolver("cotacao")).rejects.toMatchObject({
      code: "INT_OPERACAO_NAO_SUPORTADA",
      status: 422,
      details: { capacidade: "cotacao" },
    });
  });

  it("createProvedorRegistry devolve instância do registry", () => {
    const registry = createProvedorRegistry({ fonte: fonte([]), adapters: {} });

    expect(registry).toBeInstanceOf(ProvedorRegistry);
  });
});

describe("createPrismaProvedorFonte", () => {
  it("lista provedores ativos normalizando capacidades", async () => {
    const findMany = vi.fn(async () => [
      {
        id: "1",
        nome: "cvm",
        capacidades: ["informes", "invalida", "informes"],
        prioridade: 1,
        ativo: true,
      },
    ]);
    const prisma = { provedorDados: { findMany } } as unknown as PrismaClient;

    const result = await createPrismaProvedorFonte(prisma).listar();

    expect(findMany).toHaveBeenCalledWith({
      where: { ativo: true },
      select: { id: true, nome: true, capacidades: true, prioridade: true, ativo: true },
      orderBy: { prioridade: "asc" },
    });
    expect(result).toEqual([
      { id: "1", nome: "cvm", capacidades: ["informes"], prioridade: 1, ativo: true },
    ]);
  });
});
