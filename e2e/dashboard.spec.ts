import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import type { PrismaClient } from "@prisma/client";

import { hojeIsoSaoPaulo, isoParaData } from "../src/lib/datas";
import { abrirPrisma, limparDadosInvestimento } from "./carteira-fixtures";
import {
  lerRegistro,
  type UsuariosE2E,
  type UsuarioE2E,
} from "./usuario-e2e";

/**
 * E2E do dashboard (RN-061-5; RN-061 a RN-063; UI_SPEC §4).
 *
 * Cobre o fluxo real no navegador:
 * - login sem `callbackUrl` cai em `/dashboard` (mudança da navegação padrão);
 * - titular C com FII + renda fixa + dividendo: cards, comparação com a meta
 *   50/50, quatro gráficos com tabela equivalente, histórico de dividendos,
 *   blocos "disponível em breve" e oportunidades com valor para a meta;
 * - 360 px sem overflow horizontal;
 * - titular B (primeiro acesso) vê o convite ao cadastro, sem cards zerados.
 *
 * O dividendo é criado por Prisma porque a Fase 1 não tem endpoint de
 * rendimento. O titular C é limpo no início e no fim; A/B pertencem às outras
 * suítes (workers = 1).
 */

const TICKER = "DSH11";
const NOME = "FII Dashboard E2E";
const SEGMENTO = "RECEBIVEIS";
const INSTITUICAO_RF = "Banco Dashboard E2E";
const VALOR_RF = "1000.00";
const CUSTO_FII = "2000.00";
const DIVIDENDO = "150.00";
const HOJE = hojeIsoSaoPaulo();

interface ReferenciaAtivosApi {
  readonly classes: ReadonlyArray<{
    readonly id: string;
    readonly codigo: string;
    readonly segmentos: ReadonlyArray<{ readonly id: string; readonly codigo: string }>;
  }>;
}

interface MetasVigentesApi {
  readonly vigente: {
    readonly classe: ReadonlyArray<{
      readonly classeId: string;
      readonly codigo: string;
      readonly percentual: string;
    }>;
    readonly segmento: ReadonlyArray<{
      readonly segmentoId: string;
      readonly codigo: string;
      readonly percentual: string;
    }>;
  };
}

async function entrar(page: Page, usuario: UsuarioE2E): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("E-mail", { exact: true }).fill(usuario.email);
  await page.getByLabel("Senha", { exact: true }).fill(usuario.senha);
  await page.getByRole("button", { name: "Entrar" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Dashboard", level: 1 })).toBeVisible();
}

async function garantirAtivo(request: APIRequestContext): Promise<string> {
  const referencia = await request.get("/api/referencia/ativos");
  expect(referencia.status()).toBe(200);
  const { classes } = (await referencia.json()) as ReferenciaAtivosApi;

  const fii = classes.find((classe) => classe.codigo === "FII");
  const alvo = fii?.segmentos.find((segmento) => segmento.codigo === SEGMENTO);
  if (fii === undefined || alvo === undefined) {
    throw new Error(`referência de FII/${SEGMENTO} ausente no catálogo`);
  }

  const lista = await request.get("/api/ativos", { params: { q: TICKER } });
  expect(lista.status()).toBe(200);
  const existente = (
    (await lista.json()) as { data: ReadonlyArray<{ id: string; ticker: string }> }
  ).data.find((ativo) => ativo.ticker === TICKER);
  if (existente !== undefined) {
    return existente.id;
  }

  const criado = await request.post("/api/ativos", {
    data: { ticker: TICKER, nome: NOME, classeId: fii.id, segmentoId: alvo.id },
  });
  expect(criado.status()).toBe(201);
  return ((await criado.json()) as { id: string }).id;
}

async function comprar(request: APIRequestContext, ativoId: string): Promise<void> {
  const lista = await request.get("/api/movimentacoes", {
    params: { ativoId, tipo: "COMPRA", pageSize: "100" },
  });
  expect(lista.status()).toBe(200);
  if (((await lista.json()) as { data: unknown[] }).data.length > 0) {
    return;
  }

  const resposta = await request.post("/api/movimentacoes", {
    headers: { "Idempotency-Key": `dashboard-${TICKER}-compra` },
    data: {
      ativoId,
      tipo: "COMPRA",
      data: HOJE,
      quantidade: "200",
      valorUnitario: "10.00",
      valorTotal: CUSTO_FII,
      custos: "0.00",
      observacoes: null,
    },
  });
  expect([200, 201]).toContain(resposta.status());
}

async function garantirRendaFixa(request: APIRequestContext): Promise<void> {
  const lista = await request.get("/api/renda-fixa", {
    params: { instituicao: INSTITUICAO_RF },
  });
  expect(lista.status()).toBe(200);
  if (((await lista.json()) as { data: unknown[] }).data.length > 0) {
    return;
  }

  const criado = await request.post("/api/renda-fixa", {
    data: {
      instituicao: INSTITUICAO_RF,
      produto: "CDB",
      indexador: "POS_CDI",
      taxa: "10",
      dataAplicacao: HOJE,
      vencimento: null,
      valorAplicado: VALOR_RF,
      saldoAtual: VALOR_RF,
      statusSaldo: "INFORMADO",
      liquidez: "DIARIA",
      carenciaAte: null,
      coberturaFgc: false,
      observacoes: null,
    },
  });
  expect(criado.status()).toBe(201);
}

async function garantirDividendo(
  prisma: PrismaClient,
  usuarioId: string,
  ativoId: string,
): Promise<void> {
  const dataPagamento = isoParaData(HOJE);
  const existente = await prisma.rendimento.findFirst({
    where: { usuarioId, ativoId, tipo: "DIVIDENDO", dataPagamento },
    select: { id: true },
  });
  if (existente !== null) {
    return;
  }

  await prisma.rendimento.create({
    data: {
      usuarioId,
      ativoId,
      tipo: "DIVIDENDO",
      dataPagamento,
      competencia: HOJE.slice(0, 7),
      valor: DIVIDENDO,
      origem: "MANUAL",
    },
  });
}

/** Estado determinístico do titular C: FII de R$ 2.000 + RF de R$ 1.000. */
async function prepararC(
  request: APIRequestContext,
  prisma: PrismaClient,
  usuarioId: string,
): Promise<void> {
  const ativoId = await garantirAtivo(request);
  await comprar(request, ativoId);
  await garantirRendaFixa(request);
  await garantirDividendo(prisma, usuarioId, ativoId);

  // Fixa a meta 50/50 por classe para o cenário ser determinístico mesmo se
  // outra suíte tiver editado as metas de C antes. Os segmentos são
  // preservados; o objetivo aqui é a comparação com a meta da UI_SPEC §4.
  const metas = await request.get("/api/alocacao/metas");
  expect(metas.status()).toBe(200);
  const vigente = ((await metas.json()) as MetasVigentesApi).vigente;

  const atualizadas = await request.put("/api/alocacao/metas", {
    data: {
      classe: vigente.classe.map((meta) => ({
        referenciaId: meta.classeId,
        percentual:
          meta.codigo === "RENDA_FIXA" || meta.codigo === "FII"
            ? "50.000000"
            : meta.percentual,
      })),
      segmento: vigente.segmento.map((meta) => ({
        referenciaId: meta.segmentoId,
        percentual: meta.percentual,
      })),
    },
  });
  expect(atualizadas.status()).toBe(200);
}

async function semOverflowHorizontal(page: Page): Promise<number> {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

test.describe.serial("dashboard", () => {
  let prisma: PrismaClient | undefined;
  let usuarios: UsuariosE2E | undefined;
  let disponivel = false;

  test.beforeAll(async () => {
    const registro = lerRegistro();
    if (!registro.disponivel) {
      return;
    }

    usuarios = registro.usuarios;
    disponivel = true;
    prisma = abrirPrisma();
    await limparDadosInvestimento(prisma, usuarios.c.id);
  });

  test.afterAll(async () => {
    if (prisma !== undefined && usuarios !== undefined) {
      await limparDadosInvestimento(prisma, usuarios.c.id);
      await prisma.$disconnect();
    }
  });

  test.beforeEach(() => {
    test.skip(!disponivel, "usuários E2E indisponíveis");
  });

  test("login sem callbackUrl cai no dashboard", async ({ page }) => {
    await entrar(page, usuarios!.c);
    await expect(page.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("mostra cards, gráficos, dividendos e oportunidades com dados", async ({ page }) => {
    await entrar(page, usuarios!.c);
    await prepararC(page.request, prisma!, usuarios!.c.id);

    await page.goto("/dashboard");

    const cardPatrimonio = page.getByText("Patrimônio total", { exact: true }).locator("..");
    await expect(cardPatrimonio).toContainText("R$ 3.000,00");

    await expect(
      page.getByText("Renda fixa 33,3% · meta 50,0% · −16,7 p.p."),
    ).toBeVisible();

    for (const titulo of [
      "Distribuição por classe",
      "Distribuição por segmento",
      "Evolução patrimonial",
      "Evolução dos rendimentos",
      "Histórico de dividendos",
    ]) {
      await expect(page.getByRole("heading", { name: titulo })).toBeVisible();
    }

    await expect(page.getByText("Ver dados em tabela")).toHaveCount(4);
    await expect(page.getByText(TICKER)).toBeVisible();
    await expect(page.getByText("Disponível em breve")).toHaveCount(4);
    await expect(page.getByRole("heading", { name: "Classes abaixo da meta" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Segmentos abaixo da meta" }),
    ).toBeVisible();
    await expect(page.getByText("Faltam R$ 500,00 para atingir a meta")).toBeVisible();
  });

  test("não tem overflow horizontal em 360 px", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await entrar(page, usuarios!.c);
    await page.goto("/dashboard");

    await expect(page.getByRole("heading", { name: "Resumo da carteira" })).toBeVisible();
    expect(await semOverflowHorizontal(page)).toBeLessThanOrEqual(0);
  });

  test("primeiro acesso orienta o cadastro sem zeros enganosos", async ({ page }) => {
    await entrar(page, usuarios!.b);
    await page.goto("/dashboard");

    await expect(page.getByRole("heading", { name: "Comece pela sua carteira" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Cadastrar primeiro ativo" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Cadastrar renda fixa" })).toBeVisible();
    await expect(page.getByText("Patrimônio total", { exact: true })).toHaveCount(0);
  });
});
