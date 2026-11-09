import type { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { listarReferenciaAtivos } from "./referencia-ativos";

/**
 * Contrato do catálogo de referência (API_CONTRACTS.md §3.5; RN-010-7).
 *
 * O caso de uso é uma única consulta: classes ativas com os segmentos ativos
 * aninhados, ambos ordenados por `ordem`. Classe sem segmento devolve lista
 * vazia — nunca `null` — para a UI não precisar de ramo condicional.
 */

function clienteCom(
  classes: readonly {
    id: string;
    codigo: string;
    nome: string;
    segmentos: readonly { id: string; codigo: string; nome: string }[];
  }[],
) {
  const findMany = vi.fn().mockResolvedValue([...classes]);
  return {
    cliente: { classeAtivo: { findMany } } as unknown as PrismaClient,
    findMany,
  };
}

describe("listarReferenciaAtivos", () => {
  it("devolve as classes com os segmentos aninhados", async () => {
    const { cliente } = clienteCom([
      {
        id: "classe-fii",
        codigo: "FII",
        nome: "Fundos Imobiliários",
        segmentos: [
          { id: "seg-logistica", codigo: "LOGISTICA", nome: "Logística" },
          { id: "seg-shopping", codigo: "SHOPPING", nome: "Shopping Centers" },
        ],
      },
    ]);

    await expect(listarReferenciaAtivos(cliente)).resolves.toEqual({
      classes: [
        {
          id: "classe-fii",
          codigo: "FII",
          nome: "Fundos Imobiliários",
          segmentos: [
            { id: "seg-logistica", codigo: "LOGISTICA", nome: "Logística" },
            { id: "seg-shopping", codigo: "SHOPPING", nome: "Shopping Centers" },
          ],
        },
      ],
    });
  });

  it("filtra classes e segmentos ativos e ordena por ordem", async () => {
    const { cliente, findMany } = clienteCom([]);

    await listarReferenciaAtivos(cliente);

    expect(findMany).toHaveBeenCalledWith({
      where: { ativo: true },
      orderBy: { ordem: "asc" },
      select: {
        id: true,
        codigo: true,
        nome: true,
        segmentos: {
          where: { ativo: true },
          orderBy: { ordem: "asc" },
          select: { id: true, codigo: true, nome: true },
        },
      },
    });
  });

  it("devolve segmentos vazios para classe sem segmento", async () => {
    const { cliente } = clienteCom([
      { id: "classe-rf", codigo: "RENDA_FIXA", nome: "Renda Fixa", segmentos: [] },
    ]);

    const referencia = await listarReferenciaAtivos(cliente);

    expect(referencia.classes).toHaveLength(1);
    expect(referencia.classes[0]?.segmentos).toEqual([]);
  });

  it("nunca expõe as colunas de controle ativo/ordem", async () => {
    const { cliente } = clienteCom([
      { id: "classe-rf", codigo: "RENDA_FIXA", nome: "Renda Fixa", segmentos: [] },
    ]);

    const referencia = await listarReferenciaAtivos(cliente);

    expect(Object.keys(referencia.classes[0] ?? {}).sort()).toEqual([
      "codigo",
      "id",
      "nome",
      "segmentos",
    ]);
  });
});
