import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CLASSES = [
  { codigo: "RENDA_FIXA", nome: "Renda Fixa", ordem: 1 },
  { codigo: "FII", nome: "Fundos Imobiliários", ordem: 2 },
];

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
];

const PROVEDORES = [
  {
    nome: "cvm",
    capacidades: ["cadastro", "informes", "composicao"],
    autenticacao: "NENHUMA",
    prioridade: 10,
    custo: "dados abertos",
  },
] as const;

async function main() {
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

  for (const provedor of PROVEDORES) {
    await prisma.provedorDados.upsert({
      where: { nome: provedor.nome },
      update: {
        capacidades: [...provedor.capacidades],
        autenticacao: provedor.autenticacao,
        prioridade: provedor.prioridade,
        custo: provedor.custo,
      },
      create: {
        ...provedor,
        capacidades: [...provedor.capacidades],
      },
    });
  }

  const [classes, segmentos, provedores] = await Promise.all([
    prisma.classeAtivo.count(),
    prisma.segmentoAtivo.count(),
    prisma.provedorDados.count(),
  ]);

  console.log(
    `Seed concluído: ${classes} classes, ${segmentos} segmentos, ${provedores} provedores.`,
  );
}

main()
  .catch((error) => {
    console.error("Falha no seed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
