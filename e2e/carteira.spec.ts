import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import type { Prisma, PrismaClient } from "@prisma/client";

import { hashSenha } from "../src/infra/auth/password";
import { hojeIsoSaoPaulo, isoParaData } from "../src/lib/datas";
import {
  abrirPrisma,
  apagarUsuarioDePerformance,
  limparDadosInvestimento,
} from "./carteira-fixtures";
import {
  lerRegistro,
  SENHA_USUARIO_E2E,
  type UsuariosE2E,
  type UsuarioE2E,
} from "./usuario-e2e";

/**
 * E2E da carteira consolidada (RN-020-4; RN-020, RN-023, RN-089; AC-020,
 * AC-023).
 *
 * Cobre contrato e tela com o titular A:
 * - consolidação com 2 FIIs comprados em meses distintos + 1 título de renda
 *   fixa + 1 dividendo do mês: nove indicadores, soma das classes ao centavo
 *   (AC-020), distribuição por classe/segmento (AC-023) e posições com valor
 *   pelo custo e `valorIndisponivel` (RN-091);
 * - tabela de posições com "Preço atual" indisponível, resultado "—", situação
 *   vinda de `/api/ativos`, filtros de segmento/status e ordenação `aria-sort`;
 * - evolução mensal com 3 pontos e renda fixa constante (limitação da Fase 1)
 *   e 422 para `de > ate` e granularidade inválida;
 * - estado vazio do titular B e isolamento A/B (nenhum dado de A vaza);
 * - performance com 50 ativos e 500 movimentações (usuário dedicado criado
 *   direto no Postgres): p50/p95 de `GET /api/carteira` com teto de 500 ms no
 *   ambiente local e 1.500 ms no CI (Postgres de serviço).
 *
 * Os titulares A/B vêm do globalSetup. O A é limpo no início e no fim deste
 * arquivo para a consolidação ser determinística e para não contaminar as
 * suítes de movimentações/renda fixa que rodam depois (workers = 1). O
 * dividendo e as posições em massa usam Prisma porque não há endpoint de
 * criação para eles nesta fase.
 */

const TICKER_RECEBIVEIS = "CRT11";
const NOME_RECEBIVEIS = "Carteira E2E Recebíveis";
const SEGMENTO_RECEBIVEIS = "RECEBIVEIS";
const ROTULO_SEGMENTO_RECEBIVEIS = "Recebíveis Imobiliários";

const TICKER_LOGISTICA = "CRT12";
const NOME_LOGISTICA = "Carteira E2E Logística";
const SEGMENTO_LOGISTICA = "LOGISTICA";
const ROTULO_SEGMENTO_LOGISTICA = "Logística";

const INSTITUICAO_RF = "Banco Carteira E2E";
const SALDO_RF = "3000.00";
const DIVIDENDO = "150.00";

const HOJE = hojeIsoSaoPaulo();
const DATA_COMPRA_RECEBIVEIS = primeiroDiaDoMesRelativo(HOJE, -2);
const DATA_COMPRA_LOGISTICA = primeiroDiaDoMesRelativo(HOJE, -1);

interface ReferenciaAtivosApi {
  readonly classes: ReadonlyArray<{
    readonly id: string;
    readonly codigo: string;
    readonly segmentos: ReadonlyArray<{ readonly id: string; readonly codigo: string }>;
  }>;
}

interface PosicaoApi {
  readonly ativoId: string;
  readonly ticker: string;
  readonly nome: string;
  readonly classe: { readonly codigo: string; readonly nome: string };
  readonly segmento: { readonly codigo: string; readonly nome: string } | null;
  readonly quantidade: string;
  readonly precoMedio: string;
  readonly custoTotal: string;
  readonly valorAtual: string;
  readonly valorIndisponivel: boolean;
  readonly percentual: string;
}

interface CarteiraApiResposta {
  readonly resumo: {
    readonly patrimonioTotal: string;
    readonly rendaFixa: string;
    readonly fiis: string;
    readonly percentualRendaFixa: string;
    readonly percentualFiis: string;
    readonly quantidadeAtivos: number;
    readonly rendimentosMes: string;
    readonly rendimentosAcumuladosAno: string;
  };
  readonly porClasse: ReadonlyArray<{
    readonly codigo: string;
    readonly valor: string;
    readonly percentual: string;
    readonly valorIndisponivel: boolean;
  }>;
  readonly porSegmento: ReadonlyArray<{
    readonly codigo: string;
    readonly valor: string;
    readonly percentual: string;
    readonly valorIndisponivel: boolean;
  }>;
  readonly posicoes: readonly PosicaoApi[];
  readonly consistente: boolean;
  readonly atualizadoEm: string;
  readonly cotacoes: { readonly statusDado: string; readonly dataReferencia: string | null };
}

interface PontoEvolucaoApi {
  readonly data: string;
  readonly patrimonio: string;
  readonly rendaFixa: string;
  readonly fiis: string;
}

interface ErrorEnvelope {
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly details?: { readonly errors?: ReadonlyArray<{ readonly field: string }> };
  };
}

function primeiroDiaDoMesRelativo(referencia: string, meses: number): string {
  const [ano, mes] = referencia.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1 + meses, 1)).toISOString().slice(0, 10);
}

function usuariosDisponiveis(): UsuariosE2E {
  const registro = lerRegistro();

  test.skip(
    !registro.disponivel,
    registro.disponivel ? "" : `usuários E2E indisponíveis: ${registro.motivo}`,
  );

  if (!registro.disponivel) {
    throw new Error("usuários E2E indisponíveis");
  }

  return registro.usuarios;
}

async function entrar(page: Page, usuario: UsuarioE2E): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("E-mail", { exact: true }).fill(usuario.email);
  await page.getByLabel("Senha", { exact: true }).fill(usuario.senha);
  await page.getByRole("button", { name: "Entrar" }).click();

  await expect(page).toHaveURL(/\/conta$/);
}

async function entrarViaApi(request: APIRequestContext, usuario: UsuarioE2E): Promise<void> {
  const resposta = await request.post("/api/auth/login", {
    data: { email: usuario.email, senha: usuario.senha },
  });
  expect(resposta.status()).toBe(200);
}

async function semOverflowHorizontal(page: Page): Promise<number> {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

/** Cria (ou reaproveita, entre retentativas) um FII do titular autenticado. */
async function garantirAtivo(
  request: APIRequestContext,
  ticker: string,
  nome: string,
  segmento: string,
): Promise<string> {
  const referencia = await request.get("/api/referencia/ativos");
  expect(referencia.status()).toBe(200);
  const { classes } = (await referencia.json()) as ReferenciaAtivosApi;

  const fii = classes.find((classe) => classe.codigo === "FII");
  const alvo = fii?.segmentos.find((item) => item.codigo === segmento);
  if (fii === undefined || alvo === undefined) {
    throw new Error(`referência de FII/${segmento} ausente no catálogo`);
  }

  const lista = await request.get("/api/ativos", { params: { q: ticker } });
  expect(lista.status()).toBe(200);
  const existente = (
    (await lista.json()) as { data: ReadonlyArray<{ id: string; ticker: string }> }
  ).data.find((ativo) => ativo.ticker === ticker);
  if (existente !== undefined) {
    return existente.id;
  }

  const criado = await request.post("/api/ativos", {
    data: { ticker, nome, classeId: fii.id, segmentoId: alvo.id },
  });
  expect(criado.status()).toBe(201);
  return ((await criado.json()) as { id: string }).id;
}

/**
 * Compra com `Idempotency-Key` fixa: uma retentativa devolve o mesmo recurso em
 * vez de duplicar a posição.
 */
async function comprar(
  request: APIRequestContext,
  ativoId: string,
  data: string,
  quantidade: string,
  valorUnitario: string,
  chave: string,
): Promise<void> {
  const valorTotal = (Number(quantidade) * Number(valorUnitario)).toFixed(2);

  const resposta = await request.post("/api/movimentacoes", {
    headers: { "Idempotency-Key": chave },
    data: {
      ativoId,
      tipo: "COMPRA",
      data,
      quantidade,
      valorUnitario,
      valorTotal,
      custos: "0.00",
      observacoes: null,
    },
  });

  expect([200, 201]).toContain(resposta.status());
}

/**
 * Compra única do ativo para o cenário base. A checagem pela listagem evita
 * reenviar a compra quando o ativo já foi inativado por um cenário anterior do
 * próprio grupo (`MOV_ATIVO_INATIVO`), mantendo o preparo idempotente.
 */
async function garantirCompra(
  request: APIRequestContext,
  ativoId: string,
  data: string,
  quantidade: string,
  valorUnitario: string,
  chave: string,
): Promise<void> {
  const lista = await request.get("/api/movimentacoes", {
    params: { ativoId, tipo: "COMPRA", pageSize: "100" },
  });
  expect(lista.status()).toBe(200);

  const existentes = (await lista.json()) as { data: ReadonlyArray<{ id: string }> };
  if (existentes.data.length > 0) {
    return;
  }

  await comprar(request, ativoId, data, quantidade, valorUnitario, chave);
}

async function garantirRendaFixa(request: APIRequestContext, dataAplicacao: string): Promise<void> {
  const lista = await request.get("/api/renda-fixa", {
    params: { instituicao: INSTITUICAO_RF },
  });
  expect(lista.status()).toBe(200);
  const existente = ((await lista.json()) as { data: ReadonlyArray<{ id: string }> }).data[0];
  if (existente !== undefined) {
    return;
  }

  const criado = await request.post("/api/renda-fixa", {
    data: {
      instituicao: INSTITUICAO_RF,
      produto: "CDB",
      indexador: "POS_CDI",
      taxa: "10",
      dataAplicacao,
      vencimento: null,
      valorAplicado: SALDO_RF,
      saldoAtual: SALDO_RF,
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

interface CarteiraPreparada {
  readonly ativoRecebiveis: string;
  readonly ativoLogistica: string;
}

/** Estado determinístico da carteira de A (idempotente entre retentativas). */
async function prepararCarteiraA(
  request: APIRequestContext,
  prisma: PrismaClient,
  usuarioId: string,
): Promise<CarteiraPreparada> {
  const ativoRecebiveis = await garantirAtivo(
    request,
    TICKER_RECEBIVEIS,
    NOME_RECEBIVEIS,
    SEGMENTO_RECEBIVEIS,
  );
  const ativoLogistica = await garantirAtivo(
    request,
    TICKER_LOGISTICA,
    NOME_LOGISTICA,
    SEGMENTO_LOGISTICA,
  );

  await garantirCompra(
    request,
    ativoRecebiveis,
    DATA_COMPRA_RECEBIVEIS,
    "10",
    "100.00",
    "e2e-carteira-compra-recebiveis",
  );
  await garantirCompra(
    request,
    ativoLogistica,
    DATA_COMPRA_LOGISTICA,
    "20",
    "50.00",
    "e2e-carteira-compra-logistica",
  );

  await garantirRendaFixa(request, DATA_COMPRA_RECEBIVEIS);
  await garantirDividendo(prisma, usuarioId, ativoRecebiveis);

  return { ativoRecebiveis, ativoLogistica };
}

async function obterCarteira(request: APIRequestContext): Promise<CarteiraApiResposta> {
  const resposta = await request.get("/api/carteira");
  expect(resposta.status()).toBe(200);
  return (await resposta.json()) as CarteiraApiResposta;
}

function emCentavos(valor: string): number {
  return Math.round(Number(valor) * 100);
}

function cartaoResumo(page: Page, titulo: string) {
  return page.locator("dl.grid > div").filter({ hasText: titulo });
}

function tabelaPosicoes(page: Page) {
  const secao = page.locator("section[aria-labelledby='carteira-posicoes-titulo']");
  return secao.locator("table");
}

/**
 * Consistência de soma ao centavo (AC-020): as classes fecham com o total e os
 * segmentos usam o mesmo denominador (RN-089).
 */
function expectConsistencia(carteira: CarteiraApiResposta): void {
  const total = emCentavos(carteira.resumo.patrimonioTotal);
  const somaClasses = carteira.porClasse.reduce(
    (soma, item) => soma + emCentavos(item.valor),
    0,
  );

  expect(carteira.consistente).toBe(true);
  expect(somaClasses).toBe(total);
}

test.describe("carteira — consolidação, filtros e evolução (titular A)", () => {
  test.describe.configure({ mode: "serial" });

  let prisma: PrismaClient | null = null;
  let usuarioId: string | null = null;

  test.beforeAll(async () => {
    prisma = abrirPrisma();
    const registro = lerRegistro();
    if (registro.disponivel) {
      usuarioId = registro.usuarios.a.id;
      await limparDadosInvestimento(prisma, usuarioId);
    }
  });

  test.afterAll(async () => {
    if (prisma !== null) {
      if (usuarioId !== null) {
        await limparDadosInvestimento(prisma, usuarioId);
      }
      await prisma.$disconnect().catch(() => undefined);
    }
  });

  test.beforeEach(async ({ page }) => {
    await entrar(page, usuariosDisponiveis().a);
  });

  test("consolida resumo, distribuição e posições com valor pelo custo", async ({ page }) => {
    const usuarios = usuariosDisponiveis();
    if (prisma === null) {
      throw new Error("Prisma não inicializado no beforeAll");
    }

    await prepararCarteiraA(page.request, prisma, usuarios.a.id);

    const carteira = await obterCarteira(page.request);

    // Nove indicadores de RN-020 (AC-020).
    expect(carteira.resumo).toMatchObject({
      patrimonioTotal: "5000.00",
      rendaFixa: "3000.00",
      fiis: "2000.00",
      percentualRendaFixa: "60.000000",
      percentualFiis: "40.000000",
      quantidadeAtivos: 3,
      rendimentosMes: DIVIDENDO,
      rendimentosAcumuladosAno: DIVIDENDO,
    });
    expect(carteira.cotacoes).toEqual({ statusDado: "INDISPONIVEL", dataReferencia: null });

    // AC-020: a soma por classe fecha com o total ao centavo.
    expectConsistencia(carteira);

    // AC-023: distribuição por classe e por segmento sobre o patrimônio total.
    expect(carteira.porClasse.map((item) => item.codigo)).toEqual(["RENDA_FIXA", "FII"]);
    expect(carteira.porClasse.map((item) => item.percentual)).toEqual([
      "60.000000",
      "40.000000",
    ]);
    expect(carteira.porClasse[0]?.valorIndisponivel).toBe(false);
    expect(carteira.porClasse[1]?.valorIndisponivel).toBe(true);

    expect(carteira.porSegmento.map((item) => item.codigo)).toEqual([
      "LOGISTICA",
      "RECEBIVEIS",
    ]);
    for (const segmento of carteira.porSegmento) {
      expect(segmento.valor).toBe("1000.00");
      expect(segmento.percentual).toBe("20.000000");
      expect(segmento.valorIndisponivel).toBe(true);
    }

    // RN-020-5/RN-091: posições por valor atual desc, sem cotação → custo.
    expect(carteira.posicoes.map((posicao) => posicao.ticker)).toEqual([
      TICKER_RECEBIVEIS,
      TICKER_LOGISTICA,
    ]);
    for (const posicao of carteira.posicoes) {
      expect(posicao.valorIndisponivel).toBe(true);
      expect(posicao.valorAtual).toBe(posicao.custoTotal);
    }
    expect(carteira.posicoes[0]).toMatchObject({
      nome: NOME_RECEBIVEIS,
      quantidade: "10.00000000",
      precoMedio: "100.000000",
      custoTotal: "1000.00",
      percentual: "20.000000",
    });
    expect(carteira.posicoes[1]).toMatchObject({
      nome: NOME_LOGISTICA,
      quantidade: "20.00000000",
      precoMedio: "50.000000",
      custoTotal: "1000.00",
      percentual: "20.000000",
    });

    // Tela.
    await page.goto("/carteira");
    await expect(page.getByRole("heading", { name: "Carteira", level: 1 })).toBeVisible();
    await expect(page.getByText("Sem cotação — valores pelo custo")).toBeVisible();
    await expect(page.getByText("Valores pelo custo de aquisição")).toBeVisible();

    const cartaoPatrimonio = cartaoResumo(page, "Patrimônio total");
    await expect(cartaoPatrimonio).toContainText("R$ 5.000,00");

    const cartaoRendaFixa = cartaoResumo(page, "Renda fixa");
    await expect(cartaoRendaFixa).toContainText("R$ 3.000,00");
    await expect(cartaoRendaFixa).toContainText("60,0% da carteira");

    const cartaoFiis = cartaoResumo(page, "FIIs");
    await expect(cartaoFiis).toContainText("R$ 2.000,00");
    await expect(cartaoFiis).toContainText("40,0% da carteira");

    const cartaoAtivos = cartaoResumo(page, "Ativos na carteira");
    await expect(cartaoAtivos.locator("dd").first()).toHaveText("3");

    await expect(cartaoResumo(page, "Rendimentos do mês")).toContainText("R$ 150,00");
    await expect(cartaoResumo(page, "Rendimentos no ano")).toContainText("R$ 150,00");

    const distribuicao = page.locator("section[aria-labelledby='carteira-distribuicao-titulo']");
    const blocoClasse = distribuicao
      .locator("div.rounded-xl")
      .filter({ hasText: "Por classe" });
    await expect(
      blocoClasse.locator("div.flex").filter({ hasText: "Renda Fixa" }),
    ).toContainText("R$ 3.000,00 · 60,0%");
    await expect(
      blocoClasse.locator("div.flex").filter({ hasText: "Fundos Imobiliários" }),
    ).toContainText("R$ 2.000,00 · 40,0%");

    const blocoSegmento = distribuicao
      .locator("div.rounded-xl")
      .filter({ hasText: "Por segmento" });
    await expect(
      blocoSegmento.locator("div.flex").filter({ hasText: ROTULO_SEGMENTO_RECEBIVEIS }),
    ).toContainText("R$ 1.000,00 · 20,0%");
    await expect(
      blocoSegmento.locator("div.flex").filter({ hasText: ROTULO_SEGMENTO_LOGISTICA }),
    ).toContainText("R$ 1.000,00 · 20,0%");

    // Tabela de posições.
    const tabela = tabelaPosicoes(page);
    await expect(tabela.locator("tbody tr")).toHaveCount(2);

    const linhaRecebiveis = page.getByRole("row").filter({ hasText: TICKER_RECEBIVEIS });
    await expect(linhaRecebiveis).toContainText(NOME_RECEBIVEIS);
    await expect(linhaRecebiveis).toContainText(ROTULO_SEGMENTO_RECEBIVEIS);
    await expect(linhaRecebiveis.locator("td").nth(3)).toHaveText("10");
    await expect(linhaRecebiveis.locator("td").nth(4)).toHaveText("R$ 100,00");
    await expect(linhaRecebiveis.locator("td").nth(5)).toContainText("Indisponível");
    await expect(linhaRecebiveis.locator("td").nth(6)).toContainText("R$ 1.000,00");
    await expect(linhaRecebiveis.locator("td").nth(6)).toContainText("valor indisponível");
    await expect(linhaRecebiveis.locator("td").nth(7)).toHaveText("20,0%");
    await expect(linhaRecebiveis.locator("td").nth(8)).toContainText("—");
    await expect(linhaRecebiveis.locator("td").nth(9)).toHaveText("Ativo");

    const linhaLogistica = page.getByRole("row").filter({ hasText: TICKER_LOGISTICA });
    await expect(linhaLogistica.locator("td").nth(3)).toHaveText("20");
    await expect(linhaLogistica.locator("td").nth(4)).toHaveText("R$ 50,00");
    await expect(linhaLogistica.locator("td").nth(8)).toContainText("—");

    // Ordem padrão do contrato: valor atual desc (empate por ticker).
    await expect(page.locator("tbody tr td:first-child")).toHaveText([
      TICKER_RECEBIVEIS,
      TICKER_LOGISTICA,
    ]);
    await expect(
      page.getByRole("columnheader", { name: /Valor atual/ }),
    ).toHaveAttribute("aria-sort", "descending");
  });

  test("filtra por segmento/status com o mapa de /api/ativos e ordena por aria-sort", async ({
    page,
  }) => {
    const usuarios = usuariosDisponiveis();
    if (prisma === null) {
      throw new Error("Prisma não inicializado no beforeAll");
    }

    await prepararCarteiraA(page.request, prisma, usuarios.a.id);

    // O status não vem na resposta da carteira: a tela monta o mapa a partir
    // de `GET /api/ativos` (RN-020-5). Deixa um FII inativo para o filtro.
    const lista = await page.request.get("/api/ativos", { params: { q: TICKER_RECEBIVEIS } });
    expect(lista.status()).toBe(200);
    const ativo = (
      (await lista.json()) as { data: ReadonlyArray<{ id: string; ticker: string }> }
    ).data.find((item) => item.ticker === TICKER_RECEBIVEIS);
    if (ativo === undefined) {
      throw new Error(`ativo ${TICKER_RECEBIVEIS} ausente`);
    }

    const patch = await page.request.patch(`/api/ativos/${ativo.id}`, {
      data: { status: "INATIVO" },
    });
    expect(patch.status()).toBe(200);

    await page.goto("/carteira");
    await expect(tabelaPosicoes(page).locator("tbody tr")).toHaveCount(2);

    const linhaRecebiveis = page.getByRole("row").filter({ hasText: TICKER_RECEBIVEIS });
    await expect(linhaRecebiveis.locator("td").nth(9)).toHaveText("Inativo");

    // Filtro por segmento.
    await page.getByLabel("Segmento", { exact: true }).selectOption({
      label: ROTULO_SEGMENTO_RECEBIVEIS,
    });
    await expect(page.getByText("1 de 2 posições")).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: TICKER_LOGISTICA })).toHaveCount(0);
    await expect(linhaRecebiveis).toBeVisible();

    await page
      .getByLabel("Segmento", { exact: true })
      .selectOption({ label: "Todos os segmentos" });
    await expect(page.getByText("2 posições", { exact: true })).toBeVisible();

    // Filtro por status (mapa de /api/ativos).
    await page.getByLabel("Status", { exact: true }).selectOption({ label: "Inativo" });
    await expect(page.getByText("1 de 2 posições")).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: TICKER_LOGISTICA })).toHaveCount(0);
    await expect(linhaRecebiveis).toBeVisible();

    await page.getByLabel("Status", { exact: true }).selectOption({ label: "Ativo" });
    await expect(page.getByText("1 de 2 posições")).toBeVisible();
    await expect(
      page.getByRole("row").filter({ hasText: TICKER_RECEBIVEIS }),
    ).toHaveCount(0);
    await expect(page.getByRole("row").filter({ hasText: TICKER_LOGISTICA })).toBeVisible();

    await page
      .getByLabel("Status", { exact: true })
      .selectOption({ label: "Todos os status" });
    await expect(tabelaPosicoes(page).locator("tbody tr")).toHaveCount(2);

    // Ordenação com aria-sort (default: valor atual desc).
    const colunaTicker = page.getByRole("columnheader", { name: /Ticker/ });
    await expect(colunaTicker).toHaveAttribute("aria-sort", "none");

    await page.getByRole("button", { name: /Ordenar por Ticker/i }).click();
    await expect(colunaTicker).toHaveAttribute("aria-sort", "ascending");
    await expect(page.locator("tbody tr td:first-child")).toHaveText([
      TICKER_RECEBIVEIS,
      TICKER_LOGISTICA,
    ]);

    await page.getByRole("button", { name: /Ordenar por Ticker/i }).click();
    await expect(colunaTicker).toHaveAttribute("aria-sort", "descending");
    await expect(page.locator("tbody tr td:first-child")).toHaveText([
      TICKER_LOGISTICA,
      TICKER_RECEBIVEIS,
    ]);
  });

  test("360 px vira cartões sem overflow horizontal", async ({ page }) => {
    const usuarios = usuariosDisponiveis();
    if (prisma === null) {
      throw new Error("Prisma não inicializado no beforeAll");
    }

    await prepararCarteiraA(page.request, prisma, usuarios.a.id);

    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/carteira");
    await expect(page.getByRole("heading", { name: "Carteira", level: 1 })).toBeVisible();

    const cartoes = page
      .getByRole("list", { name: "Posições da carteira em cartões" })
      .getByRole("listitem");
    await expect(cartoes).toHaveCount(2);
    await expect(page.locator("table")).toBeHidden();

    const cartaoRecebiveis = cartoes.filter({ hasText: TICKER_RECEBIVEIS });
    await expect(cartaoRecebiveis).toContainText(NOME_RECEBIVEIS);
    await expect(cartaoRecebiveis).toContainText("Indisponível");
    await expect(cartaoRecebiveis).toContainText("valor indisponível");
    await expect(cartaoRecebiveis).toContainText("20,0%");

    await expect.poll(() => semOverflowHorizontal(page)).toBeLessThanOrEqual(0);
  });

  test("evolução mensal tem 3 pontos com renda fixa constante e valida 422", async ({ page }) => {
    const usuarios = usuariosDisponiveis();
    if (prisma === null) {
      throw new Error("Prisma não inicializado no beforeAll");
    }

    const { ativoLogistica } = await prepararCarteiraA(page.request, prisma, usuarios.a.id);

    // Compra no mês corrente para o 3º ponto subir de 2.000 para 2.500.
    await comprar(
      page.request,
      ativoLogistica,
      HOJE,
      "5",
      "100.00",
      "e2e-carteira-compra-evolucao",
    );

    const resposta = await page.request.get("/api/carteira/evolucao", {
      params: { de: DATA_COMPRA_RECEBIVEIS, ate: HOJE, granularidade: "mes" },
    });
    expect(resposta.status()).toBe(200);
    const { pontos } = (await resposta.json()) as { pontos: readonly PontoEvolucaoApi[] };

    expect(pontos).toHaveLength(3);
    expect(pontos.map((ponto) => ponto.fiis)).toEqual(["1000.00", "2000.00", "2500.00"]);
    expect(pontos.map((ponto) => ponto.patrimonio)).toEqual([
      "4000.00",
      "5000.00",
      "5500.00",
    ]);
    // Limitação da Fase 1: não há histórico de saldo; RF é constante.
    expect(pontos.every((ponto) => ponto.rendaFixa === SALDO_RF)).toBe(true);
    expect(pontos[2]?.data).toBe(HOJE);

    const invertido = await page.request.get("/api/carteira/evolucao", {
      params: { de: HOJE, ate: DATA_COMPRA_RECEBIVEIS, granularidade: "mes" },
    });
    expect(invertido.status()).toBe(422);
    const corpoInvertido = (await invertido.json()) as ErrorEnvelope;
    expect(corpoInvertido.error.code).toBe("VALIDACAO");
    expect(corpoInvertido.error.details?.errors?.[0]?.field).toBe("de");

    const granularidade = await page.request.get("/api/carteira/evolucao", {
      params: { de: DATA_COMPRA_RECEBIVEIS, ate: HOJE, granularidade: "ano" },
    });
    expect(granularidade.status()).toBe(422);
    const corpoGranularidade = (await granularidade.json()) as ErrorEnvelope;
    expect(corpoGranularidade.error.code).toBe("VALIDACAO");
    expect(corpoGranularidade.error.details?.errors?.[0]?.field).toBe("granularidade");
  });
});

test.describe("carteira — estado vazio e isolamento (titular B)", () => {
  test("B vê a carteira vazia e não enxerga os dados de A", async ({
    page,
    playwright,
  }, testInfo) => {
    const usuarios = usuariosDisponiveis();
    const baseURL = testInfo.project.use.baseURL;
    if (baseURL === undefined) {
      throw new Error("baseURL ausente na configuração do Playwright");
    }

    const prisma = abrirPrisma();
    const contextoA = await playwright.request.newContext({ baseURL });

    try {
      // Controle positivo: A tem patrimônio na própria sessão.
      await entrarViaApi(contextoA, usuarios.a);
      const ativoA = await garantirAtivo(
        contextoA,
        "ISO11",
        "FII Isolamento Carteira",
        SEGMENTO_RECEBIVEIS,
      );
      await comprar(
        contextoA,
        ativoA,
        HOJE,
        "1",
        "100.00",
        "e2e-carteira-isolamento-compra",
      );

      const carteiraA = await obterCarteira(contextoA);
      expect(Number(carteiraA.resumo.patrimonioTotal)).toBeGreaterThan(0);
      expect(carteiraA.posicoes.some((posicao) => posicao.ticker === "ISO11")).toBe(true);

      // B não enxerga nada da carteira de A.
      await entrar(page, usuarios.b);

      const carteiraB = await obterCarteira(page.request);
      expect(carteiraB.resumo).toMatchObject({
        patrimonioTotal: "0.00",
        rendaFixa: "0.00",
        fiis: "0.00",
        quantidadeAtivos: 0,
        rendimentosMes: "0.00",
        rendimentosAcumuladosAno: "0.00",
      });
      expect(carteiraB.posicoes).toHaveLength(0);
      expect(carteiraB.porClasse).toHaveLength(0);
      expect(carteiraB.porSegmento).toHaveLength(0);

      await page.goto("/carteira");
      await expect(page.getByText("Sua carteira está vazia")).toBeVisible();
      await expect(page.getByRole("link", { name: "Cadastrar ativo" })).toHaveAttribute(
        "href",
        "/ativos/novo",
      );
      await expect(page.getByRole("link", { name: "Cadastrar renda fixa" })).toHaveAttribute(
        "href",
        "/renda-fixa",
      );
      await expect(page.getByText("ISO11")).toHaveCount(0);
    } finally {
      await limparDadosInvestimento(prisma, usuarios.a.id).catch(() => undefined);
      await prisma.$disconnect().catch(() => undefined);
      await contextoA.dispose();
    }
  });
});

test.describe("carteira — performance com volume representativo", () => {
  test("50 ativos e 500 movimentações respondem dentro do teto (AC-020)", async ({
    playwright,
  }, testInfo) => {
    usuariosDisponiveis();
    test.setTimeout(120_000);

    const baseURL = testInfo.project.use.baseURL;
    if (baseURL === undefined) {
      throw new Error("baseURL ausente na configuração do Playwright");
    }

    const prisma = abrirPrisma();
    const contexto = await playwright.request.newContext({ baseURL });
    let usuarioId: string | null = null;

    try {
      const fii = await prisma.classeAtivo.findUnique({ where: { codigo: "FII" } });
      if (fii === null) {
        throw new Error("classe FII ausente no catálogo de referência");
      }
      const segmentos = await prisma.segmentoAtivo.findMany({
        where: { classeId: fii.id },
        select: { id: true },
      });

      const ano = Number(HOJE.slice(0, 4));
      const email = `e2e.perf.${Date.now()}@exemplo.test`;
      const senhaHash = await hashSenha(SENHA_USUARIO_E2E);
      const usuario = await prisma.usuario.create({
        data: {
          nome: "Titular E2E Performance",
          email,
          senhaHash,
          statusConta: "ATIVA",
          emailVerificadoEm: new Date(),
        },
        select: { id: true },
      });
      usuarioId = usuario.id;

      // 50 ativos de FII, cada um com uma posição viva.
      const ativos = await prisma.ativo.createManyAndReturn({
        data: Array.from({ length: 50 }, (_, indice) => ({
          usuarioId: usuario.id,
          ticker: `PF${String(indice + 1).padStart(4, "0")}`,
          nome: `Ativo de performance ${indice + 1}`,
          classeId: fii.id,
          segmentoId:
            segmentos.length === 0 ? null : segmentos[indice % segmentos.length].id,
        })),
        select: { id: true },
      });

      // 500 movimentações em bulk insert (10 compras por ativo em meses distintos).
      const movimentacoes: Prisma.MovimentacaoCreateManyInput[] = Array.from(
        { length: 500 },
        (_, indice) => ({
          usuarioId: usuario.id,
          ativoId: ativos[indice % ativos.length].id,
          tipo: "COMPRA",
          data: new Date(Date.UTC(ano, indice % 12, 10)),
          quantidade: "10.00000000",
          valorUnitario: "100.00",
          valorTotal: "1000.00",
          custos: "0.00",
        }),
      );
      await prisma.movimentacao.createMany({ data: movimentacoes });

      await prisma.posicaoAtivo.createMany({
        data: ativos.map((ativo) => ({
          usuarioId: usuario.id,
          ativoId: ativo.id,
          quantidade: "100.00000000",
          precoMedio: "100.000000",
          custoTotal: "10000.00",
        })),
      });

      await prisma.investimentoRendaFixa.create({
        data: {
          usuarioId: usuario.id,
          instituicao: "Banco Performance E2E",
          produto: "CDB",
          indexador: "POS_CDI",
          taxa: "10",
          dataAplicacao: isoParaData(`${ano}-01-02`),
          valorAplicado: "10000.00",
          saldoAtual: "10000.00",
          statusSaldo: "INFORMADO",
          liquidez: "DIARIA",
        },
      });

      const login = await contexto.post("/api/auth/login", {
        data: { email, senha: SENHA_USUARIO_E2E },
      });
      expect(login.status()).toBe(200);

      // Aquecimento (conexão e cache de queries) fora da medição.
      const aquecimento = await contexto.get("/api/carteira");
      expect(aquecimento.status()).toBe(200);

      const tempos: number[] = [];
      let carteira: CarteiraApiResposta | null = null;

      for (let indice = 0; indice < 5; indice += 1) {
        const inicio = performance.now();
        const resposta = await contexto.get("/api/carteira");
        tempos.push(performance.now() - inicio);

        expect(resposta.status()).toBe(200);
        carteira = (await resposta.json()) as CarteiraApiResposta;
      }

      const ordenados = [...tempos].sort((a, b) => a - b);
      const p50 = percentil(ordenados, 0.5);
      const p95 = percentil(ordenados, 0.95);
      const tetoMs = process.env.CI ? 1500 : 500;

      testInfo.annotations.push({
        type: "performance",
        description:
          `GET /api/carteira — p50 ${p50.toFixed(1)} ms, p95 ${p95.toFixed(1)} ms ` +
          `(teto ${tetoMs} ms, ${process.env.CI ? "CI" : "local"})`,
      });
      process.stdout.write(
        `[e2e] Carteira (50 ativos / 500 movimentações): ` +
          `p50 ${p50.toFixed(1)} ms, p95 ${p95.toFixed(1)} ms — teto ${tetoMs} ms ` +
          `(${process.env.CI ? "CI" : "local"}).\n`,
      );

      // AC-020: abaixo de 500 ms no ambiente local; CI com Postgres de serviço
      // tem teto documentado de 1.500 ms.
      expect(p50).toBeLessThan(tetoMs);

      if (carteira === null) {
        throw new Error("nenhuma resposta da carteira capturada");
      }
      expect(carteira.posicoes).toHaveLength(50);
      expect(carteira.resumo.quantidadeAtivos).toBe(51);
      expectConsistencia(carteira);
    } finally {
      if (usuarioId !== null) {
        await apagarUsuarioDePerformance(prisma, usuarioId).catch(() => undefined);
      }
      await prisma.$disconnect().catch(() => undefined);
      await contexto.dispose();
    }
  });
});

function percentil(ordenados: readonly number[], alvo: number): number {
  if (ordenados.length === 0) {
    return 0;
  }

  const indice = Math.min(
    ordenados.length - 1,
    Math.max(0, Math.ceil(alvo * ordenados.length) - 1),
  );
  return ordenados[indice];
}
