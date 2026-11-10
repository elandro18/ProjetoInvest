import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import type { PrismaClient } from "@prisma/client";

import {
  abrirPrisma,
  limparDadosInvestimento,
  limparLimitesConcentracao,
} from "./carteira-fixtures";
import { lerRegistro, type UsuariosE2E, type UsuarioE2E } from "./usuario-e2e";

/**
 * E2E do controle de concentração (RN-049-5; RN-049-1..RN-049-4).
 *
 * Cobre no navegador e no contrato, com o titular A:
 * - carteira com FII de 25% (custo) e renda fixa de 75% (saldo) sobre o
 *   patrimônio total — sem limite configurado, nada é alertado e o limite é
 *   `null`;
 * - limites de 20% por ativo e 30% por gestora configurados em `/configuracoes`:
 *   o ativo fica **Excedido** com 5 p.p. acima, a gestora fica **Dentro do
 *   limite**, o emissor aparece pela instituição da RF e o segmento fica sem
 *   limite;
 * - `IMOVEL` permanece indisponível até a Fase 3/4;
 * - remover todos os limites deixa os percentuais visíveis, sem badge e com
 *   "Sem limite configurado";
 * - layout de 360 px sem overflow horizontal;
 * - isolamento A/B: B não enxerga os limites nem a concentração de A (API e UI).
 *
 * As contas são criadas/limpas pelo globalSetup/globalTeardown. Os dados de
 * investimento de A são preparados/limpos neste arquivo para que a execução
 * isolada do spec não dependa dos outros fluxos. Os limites de concentração
 * continuam vivos ao fim do grupo de propósito: quem os remove é o
 * `globalTeardown`, que precisa provar a ordem das FKs `ON DELETE RESTRICT`
 * (`limite_concentracao` → `usuario`) com as contagens zeradas.
 */

const TICKER = "CONC11";
const NOME = "FII Concentração E2E";
const GESTOR = "Gestora Concentração E2E";
const SEGMENTO = "LOGISTICA";
const INSTITUICAO = "Banco Emissor E2E";
const CUSTO_FII = "2500.00";
const SALDO_RF = "7500.00";

interface ReferenciaAtivosApi {
  readonly classes: ReadonlyArray<{
    readonly id: string;
    readonly codigo: string;
    readonly segmentos: ReadonlyArray<{ readonly id: string; readonly codigo: string }>;
  }>;
}

interface ItemConcentracaoApi {
  readonly referencia: string;
  readonly nome: string;
  readonly valor: string;
  readonly percentual: string;
  readonly limite: string | null;
  readonly excedido: boolean;
  readonly excessoPontos: string;
}

interface DimensaoConcentracaoApi {
  readonly dimensao: "ATIVO" | "GESTORA" | "SEGMENTO" | "EMISSOR" | "IMOVEL";
  readonly disponivel: boolean;
  readonly itens: readonly ItemConcentracaoApi[];
}

interface ConcentracaoApi {
  readonly baseCalculo: string;
  readonly dimensoes: readonly DimensaoConcentracaoApi[];
}

interface LimiteApi {
  readonly dimensao: string;
  readonly referencia: string | null;
  readonly percentualMax: string;
  readonly vigenciaInicio: string;
}

interface LimitesApi {
  readonly vigente: readonly LimiteApi[];
  readonly historico: readonly LimiteApi[];
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

  await expect(page).toHaveURL(/\/dashboard$/);
}

async function entrarViaApi(request: APIRequestContext, usuario: UsuarioE2E): Promise<void> {
  const resposta = await request.post("/api/auth/login", {
    data: { email: usuario.email, senha: usuario.senha },
  });
  expect(resposta.status()).toBe(200);
}

function hojeIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function seisCasas(valor: string): string {
  return Number(valor).toFixed(6);
}

function dimensaoApi(
  concentracao: ConcentracaoApi,
  dimensao: DimensaoConcentracaoApi["dimensao"],
): DimensaoConcentracaoApi {
  const encontrada = concentracao.dimensoes.find((item) => item.dimensao === dimensao);
  if (encontrada === undefined) {
    throw new Error(`dimensão ${dimensao} ausente no contrato`);
  }
  return encontrada;
}

function secao(page: Page, dimensao: DimensaoConcentracaoApi["dimensao"]) {
  return page.locator(`section[aria-labelledby='concentracao-${dimensao}-titulo']`);
}

function tabelaDaSecao(page: Page, dimensao: DimensaoConcentracaoApi["dimensao"]) {
  return secao(page, dimensao).locator("table");
}

async function semOverflowHorizontal(page: Page): Promise<number> {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

async function obterConcentracao(request: APIRequestContext): Promise<ConcentracaoApi> {
  const resposta = await request.get("/api/risco/concentracao");
  expect(resposta.status()).toBe(200);
  return (await resposta.json()) as ConcentracaoApi;
}

async function obterLimites(request: APIRequestContext): Promise<LimitesApi> {
  const resposta = await request.get("/api/configuracoes/limites");
  expect(resposta.status()).toBe(200);
  return (await resposta.json()) as LimitesApi;
}

/**
 * Garante a carteira controlada do titular A (idempotente entre retentativas):
 * FII de 2.500 pelo custo + RF de 7.500 pelo saldo = patrimônio de 10.000, com
 * o FII em exatamente 25% e a RF em 75%.
 */
async function garantirCarteiraA(request: APIRequestContext): Promise<void> {
  const referencia = await request.get("/api/referencia/ativos");
  expect(referencia.status()).toBe(200);
  const { classes } = (await referencia.json()) as ReferenciaAtivosApi;

  const fii = classes.find((classe) => classe.codigo === "FII");
  const segmento =
    fii?.segmentos.find((item) => item.codigo === SEGMENTO) ?? fii?.segmentos[0];
  if (fii === undefined || segmento === undefined) {
    throw new Error("referência de FII/Logística ausente no catálogo");
  }

  const listaAtivos = await request.get("/api/ativos", { params: { q: TICKER } });
  expect(listaAtivos.status()).toBe(200);
  const ativoExistente = (
    (await listaAtivos.json()) as { data: ReadonlyArray<{ id: string }> }
  ).data[0];

  let ativoId = ativoExistente?.id;
  if (ativoId === undefined) {
    const criado = await request.post("/api/ativos", {
      data: {
        ticker: TICKER,
        nome: NOME,
        classeId: fii.id,
        segmentoId: segmento.id,
        gestor: GESTOR,
      },
    });
    expect(criado.status()).toBe(201);
    ativoId = ((await criado.json()) as { id: string }).id;
  }

  const movimentacoes = await request.get("/api/movimentacoes", {
    params: { ativoId, tipo: "COMPRA", pageSize: "100" },
  });
  expect(movimentacoes.status()).toBe(200);
  const compraExistente = (
    (await movimentacoes.json()) as { data: ReadonlyArray<{ id: string }> }
  ).data[0];

  if (compraExistente === undefined) {
    const compra = await request.post("/api/movimentacoes", {
      data: {
        ativoId,
        tipo: "COMPRA",
        data: hojeIso(),
        quantidade: "10",
        valorUnitario: "250.00",
        valorTotal: CUSTO_FII,
        custos: "0.00",
        observacoes: null,
      },
    });
    expect(compra.status()).toBe(201);
  }

  const titulos = await request.get("/api/renda-fixa", {
    params: { instituicao: INSTITUICAO },
  });
  expect(titulos.status()).toBe(200);
  const tituloExistente = (
    (await titulos.json()) as { data: ReadonlyArray<{ id: string }> }
  ).data[0];

  if (tituloExistente === undefined) {
    const titulo = await request.post("/api/renda-fixa", {
      data: {
        instituicao: INSTITUICAO,
        produto: "CDB",
        indexador: "POS_CDI",
        taxa: "10",
        dataAplicacao: hojeIso(),
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
    expect(titulo.status()).toBe(201);
  }
}

/**
 * Configura 20% por ativo (default da dimensão) e 30% por gestora pela tela.
 * O `PUT` substitui o conjunto inteiro — a tela começa vazia (limpeza do
 * `beforeAll`) e salva exatamente as duas linhas preenchidas aqui.
 */
async function configurarLimites(page: Page): Promise<void> {
  await page.goto("/configuracoes");
  await expect(page.getByRole("heading", { name: "Configurações", level: 1 })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Limites de concentração" }),
  ).toBeVisible();
  await expect(page.getByText("Nenhum limite configurado", { exact: false })).toBeVisible();

  await page.getByRole("button", { name: "Adicionar limite" }).click();
  await page.getByLabel("Dimensão do limite 1", { exact: true }).selectOption("ATIVO");
  await page.getByLabel("Percentual máximo do limite 1 (%)", { exact: true }).fill("20");

  await page.getByRole("button", { name: "Adicionar limite" }).click();
  await page.getByLabel("Dimensão do limite 2", { exact: true }).selectOption("GESTORA");
  await page.getByLabel("Percentual máximo do limite 2 (%)", { exact: true }).fill("30");

  await page.getByRole("button", { name: "Salvar limites" }).click();

  const dialogo = page.getByRole("dialog", { name: "Salvar limites de concentração" });
  await expect(dialogo).toBeVisible();
  await expect(dialogo).toContainText("passa para o histórico");
  await dialogo.getByRole("button", { name: "Confirmar salvamento" }).click();
  await expect(dialogo).toBeHidden();

  await expect(page.getByRole("status").filter({ hasText: "Limites salvos" })).toBeVisible();
}

async function removerTodosLimites(page: Page): Promise<void> {
  await page.goto("/configuracoes");
  await expect(page.getByLabel("Dimensão do limite 1", { exact: true })).toBeVisible();

  // Remover sempre a primeira linha: a linha restante vira "limite 1".
  await page.getByRole("button", { name: "Remover limite 1" }).click();
  await page.getByRole("button", { name: "Remover limite 1" }).click();
  await expect(page.getByText("Nenhum limite configurado", { exact: false })).toBeVisible();

  await page.getByRole("button", { name: "Salvar limites" }).click();

  const dialogo = page.getByRole("dialog", { name: "Salvar limites de concentração" });
  await expect(dialogo).toBeVisible();
  await expect(dialogo).toContainText("Nenhum limite ficará vigente");
  await dialogo.getByRole("button", { name: "Confirmar salvamento" }).click();
  await expect(dialogo).toBeHidden();
}

test.describe("concentração — limites e painel (titular A)", () => {
  test.describe.configure({ mode: "serial" });

  let prisma: PrismaClient | null = null;
  let usuarioAId: string | null = null;

  test.beforeAll(async () => {
    const registro = lerRegistro();
    if (!registro.disponivel) {
      return;
    }

    prisma = abrirPrisma();
    usuarioAId = registro.usuarios.a.id;
    await limparDadosInvestimento(prisma, usuarioAId);
    await limparLimitesConcentracao(prisma, usuarioAId);
  });

  test.afterAll(async () => {
    if (prisma !== null) {
      if (usuarioAId !== null) {
        // Só os dados de investimento saem aqui; os limites ficam para o
        // globalTeardown (ordem RESTRICT `limite_concentracao` → `usuario`).
        await limparDadosInvestimento(prisma, usuarioAId).catch(() => undefined);
      }
      await prisma.$disconnect().catch(() => undefined);
    }
  });

  test.beforeEach(async ({ page }) => {
    await entrar(page, usuariosDisponiveis().a);
  });

  test("com 25% em um FII e limites de 20%/30%, marca Excedido com 5 p.p. e a gestora dentro", async ({
    page,
  }) => {
    await garantirCarteiraA(page.request);

    // RN-049-3: sem limite configurado, o item aparece com `limite: null` e sem
    // alerta; a RF entra em EMISSOR pela instituição e IMOVEL está indisponível.
    const semLimite = await obterConcentracao(page.request);
    expect(semLimite.baseCalculo).toBe("PATRIMONIO_TOTAL");

    const ativoSemLimite = dimensaoApi(semLimite, "ATIVO").itens[0];
    expect(ativoSemLimite).toMatchObject({
      referencia: TICKER,
      percentual: "25.000000",
      limite: null,
      excedido: false,
      excessoPontos: "0.000000",
    });

    const emissorSemLimite = dimensaoApi(semLimite, "EMISSOR").itens[0];
    expect(emissorSemLimite).toMatchObject({
      referencia: INSTITUICAO,
      percentual: "75.000000",
      limite: null,
      excedido: false,
    });
    expect(dimensaoApi(semLimite, "GESTORA").itens[0]).toMatchObject({
      referencia: GESTOR,
      percentual: "25.000000",
    });
    expect(dimensaoApi(semLimite, "SEGMENTO").itens[0]).toMatchObject({
      referencia: SEGMENTO,
      percentual: "25.000000",
    });
    expect(dimensaoApi(semLimite, "IMOVEL")).toMatchObject({
      disponivel: false,
      itens: [],
    });

    // Configura 20% por ativo e 30% por gestora na tela.
    await configurarLimites(page);

    const limites = await obterLimites(page.request);
    expect(limites.vigente).toHaveLength(2);
    const limiteAtivo = limites.vigente.find((limite) => limite.dimensao === "ATIVO");
    const limiteGestora = limites.vigente.find((limite) => limite.dimensao === "GESTORA");
    expect(limiteAtivo).toMatchObject({
      referencia: null,
      percentualMax: "20.000000",
    });
    expect(limiteGestora).toMatchObject({
      referencia: null,
      percentualMax: "30.000000",
    });

    // Contrato: excedido com excesso de 5 p.p.; gestora dentro do limite.
    const comLimite = await obterConcentracao(page.request);
    const ativo = dimensaoApi(comLimite, "ATIVO").itens[0];
    expect(ativo).toMatchObject({
      referencia: TICKER,
      percentual: "25.000000",
      limite: "20.000000",
      excedido: true,
    });
    expect(seisCasas(ativo.excessoPontos)).toBe("5.000000");

    const gestora = dimensaoApi(comLimite, "GESTORA").itens[0];
    expect(gestora).toMatchObject({
      referencia: GESTOR,
      percentual: "25.000000",
      limite: "30.000000",
      excedido: false,
      excessoPontos: "0.000000",
    });

    // Painel: ativo Excedido com 5 p.p., gestora sem alerta.
    await page.goto("/configuracoes");
    await expect(page.getByRole("heading", { name: "Concentração atual" })).toBeVisible();

    const secaoAtivo = secao(page, "ATIVO");
    await expect(secaoAtivo).toContainText(TICKER);
    await expect(secaoAtivo).toContainText("25%");
    await expect(secaoAtivo).toContainText("20%");
    await expect(tabelaDaSecao(page, "ATIVO").getByText("Excedido")).toBeVisible();
    await expect(secaoAtivo).toContainText("5 p.p. acima do limite");

    const secaoGestora = secao(page, "GESTORA");
    await expect(secaoGestora).toContainText(GESTOR);
    await expect(secaoGestora).toContainText("25%");
    await expect(
      tabelaDaSecao(page, "GESTORA").getByText("Dentro do limite"),
    ).toBeVisible();
    await expect(tabelaDaSecao(page, "GESTORA").getByText("Excedido")).toHaveCount(0);

    // EMISSOR vem da instituição da RF; SEGMENTO fica sem limite configurado.
    const secaoEmissor = secao(page, "EMISSOR");
    await expect(secaoEmissor).toContainText(INSTITUICAO);
    await expect(secaoEmissor).toContainText("75%");
    await expect(
      tabelaDaSecao(page, "EMISSOR").getByText("Sem limite configurado"),
    ).toBeVisible();

    const secaoSegmento = secao(page, "SEGMENTO");
    await expect(secaoSegmento).toContainText("25%");
    await expect(
      tabelaDaSecao(page, "SEGMENTO").getByText("Sem limite configurado"),
    ).toBeVisible();

    // IMOVEL indisponível até a Fase 3/4.
    await expect(secao(page, "IMOVEL")).toContainText("Indisponível até a Fase 3/4");
  });

  test("B não enxerga os limites nem a concentração de A (API e UI)", async ({
    page,
    playwright,
  }, testInfo) => {
    const usuarios = usuariosDisponiveis();
    const baseURL = testInfo.project.use.baseURL;
    if (baseURL === undefined) {
      throw new Error("baseURL ausente na configuração do Playwright");
    }

    // Controle: A continua com os limites e a concentração gravados no teste
    // anterior.
    const contextoA = await playwright.request.newContext({ baseURL });
    try {
      await entrarViaApi(contextoA, usuarios.a);

      const limitesA = await obterLimites(contextoA);
      expect(limitesA.vigente).toHaveLength(2);

      const concentracaoA = await obterConcentracao(contextoA);
      expect(dimensaoApi(concentracaoA, "ATIVO").itens[0]).toMatchObject({
        referencia: TICKER,
        excedido: true,
      });

      // B via API: nenhum limite vigente/histórico e nenhuma posição de A.
      await entrarViaApi(page.request, usuarios.b);

      const limitesB = await obterLimites(page.request);
      expect(limitesB.vigente).toEqual([]);
      expect(limitesB.historico).toEqual([]);

      const concentracaoB = await obterConcentracao(page.request);
      for (const dimensao of concentracaoB.dimensoes) {
        expect(dimensao.itens).toEqual([]);
      }
      expect(dimensaoApi(concentracaoB, "IMOVEL").disponivel).toBe(false);

      // B na tela: formulário vazio e carteira vazia, sem rastro de A.
      await entrar(page, usuarios.b);
      await page.goto("/configuracoes");
      await expect(page.getByRole("heading", { name: "Configurações", level: 1 })).toBeVisible();
      await expect(page.getByText("Nenhum limite configurado", { exact: false })).toBeVisible();
      await expect(page.getByText("Carteira vazia")).toBeVisible();
      await expect(page.getByText(TICKER)).toHaveCount(0);
      await expect(page.getByText(GESTOR)).toHaveCount(0);
      await expect(page.getByText(INSTITUICAO)).toHaveCount(0);
      await expect(page.getByText("Excedido")).toHaveCount(0);
    } finally {
      await contextoA.dispose();
    }
  });

  test("remover todos os limites deixa os percentuais sem badge", async ({ page }) => {
    await removerTodosLimites(page);

    const limites = await obterLimites(page.request);
    expect(limites.vigente).toEqual([]);
    expect(limites.historico.length).toBeGreaterThanOrEqual(2);

    const concentracao = await obterConcentracao(page.request);
    for (const dimensao of concentracao.dimensoes) {
      for (const item of dimensao.itens) {
        expect(item.limite).toBeNull();
        expect(item.excedido).toBe(false);
        expect(item.excessoPontos).toBe("0.000000");
      }
    }

    await page.goto("/configuracoes");
    await expect(page.getByRole("heading", { name: "Concentração atual" })).toBeVisible();

    for (const dimensao of ["ATIVO", "GESTORA", "SEGMENTO", "EMISSOR"] as const) {
      const secaoAtual = secao(page, dimensao);
      await expect(secaoAtual).toContainText("Sem limite configurado");
      await expect(secaoAtual.getByText("Excedido")).toHaveCount(0);
      await expect(secaoAtual.getByText("Dentro do limite")).toHaveCount(0);
    }

    // Os percentuais continuam visíveis mesmo sem limite.
    await expect(secao(page, "ATIVO")).toContainText("25%");
    await expect(secao(page, "EMISSOR")).toContainText("75%");
  });

  test("em 360 px a tela não tem overflow horizontal", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/configuracoes");

    await expect(page.getByRole("heading", { name: "Configurações", level: 1 })).toBeVisible();

    const cartaoAtivo = secao(page, "ATIVO").locator("ul li").first();
    await expect(cartaoAtivo).toBeVisible();
    await expect(cartaoAtivo).toContainText(TICKER);
    await expect(cartaoAtivo).toContainText("Sem limite configurado");

    await expect.poll(() => semOverflowHorizontal(page)).toBeLessThanOrEqual(0);
  });
});
