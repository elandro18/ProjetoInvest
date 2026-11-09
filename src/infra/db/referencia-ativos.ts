import type { Prisma, PrismaClient } from "@prisma/client";

import { prisma } from "./client";

/**
 * Catálogo de referência de classes e segmentos (API_CONTRACTS.md §3.5).
 *
 * Alimenta os selects do formulário de ativo (RN-010) e, depois, a tela de
 * metas de alocação (RN-021), sem que a UI precise acessar o banco. Dados de
 * referência não são escopados por `usuarioId`; a sessão exigida na rota é
 * apenas controle de acesso.
 */

export interface SegmentoReferencia {
  readonly id: string;
  readonly codigo: string;
  readonly nome: string;
}

export interface ClasseReferencia {
  readonly id: string;
  readonly codigo: string;
  readonly nome: string;
  readonly segmentos: readonly SegmentoReferencia[];
}

export interface ReferenciaAtivos {
  readonly classes: readonly ClasseReferencia[];
}

const REFERENCIA_SELECT = {
  id: true,
  codigo: true,
  nome: true,
  segmentos: {
    where: { ativo: true },
    orderBy: { ordem: "asc" },
    select: { id: true, codigo: true, nome: true },
  },
} satisfies Prisma.ClasseAtivoSelect;

export async function listarReferenciaAtivos(
  cliente: PrismaClient = prisma,
): Promise<ReferenciaAtivos> {
  const classes = await cliente.classeAtivo.findMany({
    where: { ativo: true },
    orderBy: { ordem: "asc" },
    select: REFERENCIA_SELECT,
  });

  return { classes };
}
