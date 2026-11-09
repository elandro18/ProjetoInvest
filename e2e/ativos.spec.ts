import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

import { lerRegistro, type UsuariosE2E, type UsuarioE2E } from "./usuario-e2e";

/**
 * E2E de ativos (RN-010 a RN-013, RN-010-6).
 *
 * Cobre o fluxo real do titular no navegador e o isolamento entre usuários:
 * - estado vazio com CTA;
 * - cadastro de FII (classe + segmento) e de CDB (segmento desabilitado);
 * - busca, filtros por classe/segmento/status e ordenação por ticker (aria-sort);
 * - ficha com visão geral e estados "Disponível em breve"/"Indisponível"/"Sem posição";
 * - edição persistida, inativação e reativação;
 * - validação de FII sem segmento com foco no select;
 * - layout de 360 px sem overflow;
 * - AC-070: o titular B não lê, não altera e não vê o ativo do titular A.
 *
 * O grupo é serial porque os testes compartilham a carteira do titular A
 * criada ao longo do fluxo (a criação de ativos via API do isolamento é a
 * última etapa). A conta é criada/limpa pelo globalSetup/globalTeardown.
 */

const FII_TICKER = "HGLG11";
const FII_NOME = "CSHG Logística FII";
const FII_SEGMENTO = "Logística";
const RF_TICKER = "CDB2028";
const RF_NOME = "CDB Banco Teste 2028";
const TICKER_ISOLADO = "ISOLA11";

interface DadosNovoAtivo {
  readonly ticker: string;
  readonly nome: string;
  readonly classe: string;
  readonly segmento?: string;
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

async function criarAtivo(page: Page, dados: DadosNovoAtivo): Promise<void> {
  await page.goto("/ativos/novo");
  await expect(page.getByLabel("Classe")).toBeEnabled();

  await page.getByLabel("Ticker").fill(dados.ticker);
  await page.getByLabel("Nome").fill(dados.nome);
  await page.getByLabel("Classe").selectOption({ label: dados.classe });

  if (dados.segmento !== undefined) {
    await page.getByLabel("Segmento").selectOption({ label: dados.segmento });
  }

  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page).toHaveURL(new RegExp(`/ativos\\?criado=${dados.ticker}$`));
}

async function entrarViaApi(request: APIRequestContext, usuario: UsuarioE2E): Promise<void> {
  const resposta = await request.post("/api/auth/login", {
    data: { email: usuario.email, senha: usuario.senha },
  });
  expect(resposta.status()).toBe(200);
}

function linhaDoAtivo(page: Page, ticker: string) {
  return page.getByRole("row").filter({ hasText: ticker });
}

async function semOverflowHorizontal(page: Page): Promise<number> {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

test.describe("ativos", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page }) => {
    await entrar(page, usuariosDisponiveis().a);
  });

  test("lista vazia exibe estado vazio com CTA para o primeiro ativo", async ({ page }) => {
    await page.goto("/ativos");

    await expect(page.getByRole("heading", { name: "Ativos", level: 1 })).toBeVisible();
    await expect(page.getByText("Nenhum ativo cadastrado")).toBeVisible();

    const cta = page.getByRole("link", { name: "Cadastrar primeiro ativo" });
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute("href", "/ativos/novo");
  });

  test("cadastra um FII com segmento e o exibe na listagem", async ({ page }) => {
    await criarAtivo(page, {
      ticker: FII_TICKER,
      nome: FII_NOME,
      classe: "Fundos Imobiliários",
      segmento: FII_SEGMENTO,
    });

    await expect(page.getByText("Ativo cadastrado")).toBeVisible();
    await expect(page.getByText(/HGLG11 foi cadastrado/)).toBeVisible();

    const linha = linhaDoAtivo(page, FII_TICKER);
    await expect(linha).toBeVisible();
    await expect(linha).toContainText(FII_NOME);
    await expect(linha).toContainText("Fundos Imobiliários");
    await expect(linha).toContainText(FII_SEGMENTO);
    await expect(linha).toContainText("Ativo");
  });

  test("cadastra um CDB de renda fixa com segmento desabilitado", async ({ page }) => {
    await page.goto("/ativos/novo");
    await expect(page.getByLabel("Classe")).toBeEnabled();

    await page.getByLabel("Ticker").fill(RF_TICKER);
    await page.getByLabel("Nome").fill(RF_NOME);
    await page.getByLabel("Classe").selectOption({ label: "Renda Fixa" });

    const segmento = page.getByLabel("Segmento");
    await expect(segmento).toBeDisabled();
    await expect(page.getByText("A classe selecionada não utiliza segmento.")).toBeVisible();

    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page).toHaveURL(new RegExp(`/ativos\\?criado=${RF_TICKER}$`));

    const linha = linhaDoAtivo(page, RF_TICKER);
    await expect(linha).toBeVisible();
    await expect(linha).toContainText(RF_NOME);
    await expect(linha).toContainText("Renda Fixa");
    await expect(linha).toContainText("—");
  });

  test("busca, filtra por classe/segmento/status e ordena por ticker", async ({ page }) => {
    await page.goto("/ativos");
    await expect(linhaDoAtivo(page, FII_TICKER)).toBeVisible();
    await expect(linhaDoAtivo(page, RF_TICKER)).toBeVisible();

    const busca = page.getByLabel("Buscar por ticker ou nome");

    await busca.fill("HGLG");
    await page.getByRole("button", { name: "Buscar" }).click();
    await expect(linhaDoAtivo(page, FII_TICKER)).toBeVisible();
    await expect(linhaDoAtivo(page, RF_TICKER)).toHaveCount(0);

    await busca.fill("Banco Teste");
    await page.getByRole("button", { name: "Buscar" }).click();
    await expect(linhaDoAtivo(page, RF_TICKER)).toBeVisible();
    await expect(linhaDoAtivo(page, FII_TICKER)).toHaveCount(0);

    await page.getByRole("button", { name: "Limpar filtros" }).click();
    await expect(linhaDoAtivo(page, FII_TICKER)).toBeVisible();

    await page.getByLabel("Classe").selectOption({ label: "Fundos Imobiliários" });
    await expect(linhaDoAtivo(page, FII_TICKER)).toBeVisible();
    await expect(linhaDoAtivo(page, RF_TICKER)).toHaveCount(0);

    await page.getByLabel("Segmento").selectOption({ label: FII_SEGMENTO });
    await expect(linhaDoAtivo(page, FII_TICKER)).toBeVisible();

    await page.getByLabel("Classe").selectOption({ label: "Todas as classes" });
    await page.getByLabel("Status").selectOption({ label: "Inativo" });
    await expect(page.getByText("Nenhum ativo encontrado")).toBeVisible();

    await page.getByLabel("Status").selectOption({ label: "Ativo" });
    await expect(linhaDoAtivo(page, FII_TICKER)).toBeVisible();

    const colunaTicker = page.getByRole("columnheader", { name: /Ticker/ });
    const tickers = page.locator("tbody tr td:first-child");

    await expect(colunaTicker).toHaveAttribute("aria-sort", "ascending");
    await expect(tickers).toHaveText([RF_TICKER, FII_TICKER]);

    await page.getByRole("button", { name: /Ordenar por Ticker/i }).click();
    await expect(colunaTicker).toHaveAttribute("aria-sort", "descending");
    await expect(tickers).toHaveText([FII_TICKER, RF_TICKER]);
  });

  test("abre a ficha com visão geral e abas indisponíveis", async ({ page }) => {
    await page.goto("/ativos");
    await page.getByRole("link", { name: `Abrir ficha de ${FII_TICKER}` }).first().click();

    await expect(page).toHaveURL(/\/ativos\/[0-9a-f-]+$/);
    await expect(page.getByRole("heading", { name: FII_TICKER, level: 1 })).toBeVisible();
    await expect(page.getByText("Preço atual")).toBeVisible();
    await expect(page.getByText("Indisponível")).toBeVisible();
    await expect(page.getByText("Sem posição")).toBeVisible();

    await page.getByRole("tab", { name: "Movimentações" }).click();
    await expect(page.getByRole("tabpanel")).toContainText("Disponível em breve");

    await page.getByRole("tab", { name: "Rendimentos" }).click();
    await expect(page.getByRole("tabpanel")).toContainText("Disponível em breve");

    await page.getByRole("tab", { name: "Histórico de preços" }).click();
    await expect(page.getByRole("tabpanel")).toContainText("Sem cotação na Fase 1");

    await page.getByRole("tab", { name: "Visão geral" }).click();
    await expect(page.getByRole("heading", { name: "Dados cadastrais" })).toBeVisible();
  });

  test("edita o nome com persistência e inativa/reativa o ativo", async ({ page }) => {
    await page.goto("/ativos");
    await page.getByRole("link", { name: `Abrir ficha de ${FII_TICKER}` }).first().click();
    await expect(page.getByRole("heading", { name: FII_TICKER, level: 1 })).toBeVisible();

    const novoNome = "CSHG Logística Editado";
    await page.getByRole("button", { name: "Editar" }).click();
    await page.getByLabel("Nome").fill(novoNome);
    await page.getByRole("button", { name: "Salvar alterações" }).click();

    await expect(page.getByText("Alterações salvas.")).toBeVisible();
    await expect(page.getByText(novoNome).first()).toBeVisible();

    await page.reload();
    await expect(page.getByRole("heading", { name: FII_TICKER, level: 1 })).toBeVisible();
    await expect(page.getByText(novoNome).first()).toBeVisible();

    await page.getByRole("button", { name: "Inativar", exact: true }).click();
    const dialogoInativar = page.getByRole("dialog");
    await expect(dialogoInativar.getByRole("heading", { name: "Inativar ativo" })).toBeVisible();
    await dialogoInativar.getByRole("button", { name: "Inativar ativo" }).click();

    await expect(page.getByText("Ativo inativado.")).toBeVisible();
    await expect(page.getByText("Inativo", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Reativar", exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Reativar", exact: true }).click();
    const dialogoReativar = page.getByRole("dialog");
    await expect(dialogoReativar.getByRole("heading", { name: "Reativar ativo" })).toBeVisible();
    await dialogoReativar.getByRole("button", { name: "Reativar ativo" }).click();

    await expect(page.getByText("Ativo reativado.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Inativar", exact: true })).toBeVisible();
  });

  test("FII sem segmento exibe erro no campo e foca o select", async ({ page }) => {
    await page.goto("/ativos/novo");
    await expect(page.getByLabel("Classe")).toBeEnabled();

    await page.getByLabel("Ticker").fill("XPML11");
    await page.getByLabel("Nome").fill("XP Malls");
    await page.getByLabel("Classe").selectOption({ label: "Fundos Imobiliários" });
    await expect(page.getByLabel("Segmento")).toBeEnabled();

    await page.getByRole("button", { name: "Salvar" }).click();

    await expect(page.getByText("Informe o segmento para um FII.")).toBeVisible();
    await expect(page.getByLabel("Segmento")).toBeFocused();
    await expect(page).toHaveURL(/\/ativos\/novo$/);
  });

  test("listagem e formulário não têm overflow horizontal em 360 px", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });

    await page.goto("/ativos");
    await expect(page.getByRole("link", { name: `Abrir ficha de ${FII_TICKER}` }).first()).toBeVisible();
    await expect.poll(() => semOverflowHorizontal(page)).toBeLessThanOrEqual(0);

    await page.goto("/ativos/novo");
    await expect(page.getByLabel("Classe")).toBeEnabled();
    await expect.poll(() => semOverflowHorizontal(page)).toBeLessThanOrEqual(0);
  });

  test("isolamento entre titulares: B não acessa o ativo de A (AC-070)", async ({
    page,
    playwright,
  }, testInfo) => {
    const baseURL = testInfo.project.use.baseURL;
    if (baseURL === undefined) {
      throw new Error("baseURL ausente na configuração do Playwright");
    }

    // `page.request` compartilha os cookies do titular A autenticado no beforeEach.
    const referencia = await page.request.get("/api/referencia/ativos");
    expect(referencia.status()).toBe(200);

    const { classes } = (await referencia.json()) as {
      classes: Array<{
        id: string;
        codigo: string;
        segmentos: Array<{ id: string; codigo: string }>;
      }>;
    };
    const fii = classes.find((classe) => classe.codigo === "FII");
    const logistica = fii?.segmentos.find((segmento) => segmento.codigo === "LOGISTICA");
    if (fii === undefined || logistica === undefined) {
      throw new Error("referência de FII/Logística ausente no catálogo");
    }

    const criado = await page.request.post("/api/ativos", {
      data: {
        ticker: TICKER_ISOLADO,
        nome: "Ativo isolado do titular A",
        classeId: fii.id,
        segmentoId: logistica.id,
      },
    });
    expect(criado.status()).toBe(201);
    const ativo = (await criado.json()) as { id: string };

    // A enxerga o próprio ativo (controle positivo do cenário).
    const detalheA = await page.request.get(`/api/ativos/${ativo.id}`);
    expect(detalheA.status()).toBe(200);

    const contextoB = await playwright.request.newContext({ baseURL });
    try {
      await entrarViaApi(contextoB, usuariosDisponiveis().b);

      const detalheB = await contextoB.get(`/api/ativos/${ativo.id}`);
      expect(detalheB.status()).toBe(404);
      expect(((await detalheB.json()) as { error: { code: string } }).error.code).toBe(
        "ATIVO_NAO_ENCONTRADO",
      );

      const patchB = await contextoB.patch(`/api/ativos/${ativo.id}`, {
        data: { nome: "tentativa de alteração do titular B" },
      });
      expect(patchB.status()).toBe(404);
      expect(((await patchB.json()) as { error: { code: string } }).error.code).toBe(
        "ATIVO_NAO_ENCONTRADO",
      );

      const listaB = await contextoB.get(`/api/ativos?q=${TICKER_ISOLADO}`);
      expect(listaB.status()).toBe(200);
      const corpoB = (await listaB.json()) as {
        data: unknown[];
        meta: { total: number };
      };
      expect(corpoB.meta.total).toBe(0);
      expect(corpoB.data).toHaveLength(0);
    } finally {
      await contextoB.dispose();
    }
  });
});
