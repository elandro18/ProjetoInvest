import type { PrismaClient } from "@prisma/client";

/**
 * Garante o catálogo de referência (classes e segmentos) antes do E2E.
 *
 * O job de CI aplica as migrations mas não roda o seed; sem este catálogo o
 * formulário de ativo não consegue resolver classe/segmento. O upsert é
 * idempotente e repete exatamente o seed de desenvolvimento — dado de
 * referência não pertence a titular nenhum e não é limpo no teardown.
 */

const CLASSES = [
  { codigo: "RENDA_FIXA", nome: "Renda Fixa", ordem: 1 },
  { codigo: "FII", nome: "Fundos Imobiliários", ordem: 2 },
] as const;

const SEGMENTOS_FII = [
  { codigo: "LOGISTICA", nome: "Logística", ordem: 1 },
  { codigo: "SHOPPING", nome: "Shopping Centers", ordem: 2 },
  { codigo: "RECEBIVEIS", nome: "Recebíveis Imobiliários", ordem: 3 },
  { codigo: "LAJES", nome: "Lajes Corporativas", ordem: 4 },
  { codigo: "RENDA_URBANA", nome: "Renda Urbana", ordem: 5 },
  { codigo: "HIBRIDO", nome: "Híbridos", ordem: 6 },
  { codigo: "AGRO", nome: "Agronegócio", ordem: 7 },
  { codigo: "OUTROS", nome: "Outros", ordem: 8 },
  { codigo: "CAIXA_OPORTUNIDADES", nome: "Caixa e Oportunidades", ordem: 9 },
] as const;

export async function garantirReferencia(prisma: PrismaClient): Promise<void> {
  for (const classe of CLASSES) {
    await prisma.classeAtivo.upsert({
      where: { codigo: classe.codigo },
      update: { nome: classe.nome, ordem: classe.ordem },
      create: classe,
    });
  }

  const fii = await prisma.classeAtivo.findUniqueOrThrow({ where: { codigo: "FII" } });

  for (const segmento of SEGMENTOS_FII) {
    await prisma.segmentoAtivo.upsert({
      where: { classeId_codigo: { classeId: fii.id, codigo: segmento.codigo } },
      update: { nome: segmento.nome, ordem: segmento.ordem },
      create: { ...segmento, classeId: fii.id },
    });
  }
}
