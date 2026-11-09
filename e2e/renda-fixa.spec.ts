import { expect, test, type APIRequestContext, type Locator, type Page } from "@playwright/test";

import { lerRegistro, type UsuariosE2E, type UsuarioE2E } from "./usuario-e2e";

/**
 * E2E de renda fixa (RN-057 a RN-059, RN-058).
 *
 * Cobre o fluxo real do titular no navegador e o isolamento entre usuários:
 * - estado vazio com CTA;
 * - cadastro de CDB (FGC derivado do produto) e Tesouro Selic (sem FGC);
 * - atualização de saldo/status (Informado → Confirmado) com persistência;
 * - alerta `VENCIMENTO_PROXIMO` na faixa e na linha;
 * - filtro "somente com alerta", ordenação (`aria-sort`) e paginação;
 * - layout de 360 px sem overflow nos cartões;
 * - o titular B não altera nem enxerga o título do titular A.
 *
 * O grupo é serial porque os testes compartilham a carteira do titular A
 * criada ao longo do fluxo. A conta é criada/limpa pelo
 * globalSetup/globalTeardown.
 */

const INSTITUICAO_CDB = "Banco Alfa";
const INSTITUICAO_TESOURO = "Tesouro Nacional";
const INSTITUICAO_VENCENDO = "Banco Beta";
const INSTITUICAO_ISOLADA = "Instituição Isolada A";
const TOTAL_MASSA = 21;

interface DadosTitulo {
  readonly instituicao: string;
  readonly produto: string;
  readonly indexador: string;
  readonly taxa: string;
  readonly dataAplicacao: string;
  readonly vencimento: string | null;
  readonly valorAplicado: string;
  readonly saldoAtual: string;
  readonly liquidez: string;
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

function linhaDoTitulo(page: Page, instituicao: string): Locator {
  return page.getByRole("row").filter({ hasText: instituicao });
}

function somarDias(dataIso: string, dias: number): string {
  const [ano, mes, dia] = dataIso.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia + dias)).toISOString().slice(0, 10);
}

function hojeIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function dadosDoTitulo(
  dados: Omit<DadosTitulo, "dataAplicacao"> & { readonly dataAplicacao?: string },
): DadosTitulo {
  return { ...dados, dataAplicacao: dados.dataAplicacao ?? hojeIso() };
}

/** Dinheiro digitado em PT-BR vira o decimal do contrato (`"1.000,00"` → `"1000.00"`). */
function moedaParaApi(valor: string): string {
  const bruto = valor.trim();
  return bruto.includes(",") ? bruto.replace(/\./g, "").replace(",", ".") : bruto;
}

/** Rótulos da UI → valores do contrato (a API só aceita os enums). */
const PRODUTO_API: Readonly<Record<string, string>> = {
  "Tesouro Selic": "TESOURO_SELIC",
  "Tesouro IPCA+": "TESOURO_IPCA",
  "Tesouro Prefixado": "TESOURO_PREFIXADO",
  CDB: "CDB",
  LCI: "LCI",
  LCA: "LCA",
  Debênture: "DEBENTURE",
  Outro: "OUTRO",
};

const INDEXADOR_API: Readonly<Record<string, string>> = {
  "Pré-fixado": "PRE",
  "Pós-CDI": "POS_CDI",
  IPCA: "IPCA",
  Selic: "SELIC",
  Outro: "OUTRO",
};

const LIQUIDEZ_API: Readonly<Record<string, string>> = {
  Diária: "DIARIA",
  "No vencimento": "NO_VENCIMENTO",
  "No prazo": "PRAZO",
};

async function abrirCadastro(page: Page): Promise<Locator> {
  await page.getByRole("button", { name: "Cadastrar título" }).first().click();
  const dialogo = page.getByRole("dialog", { name: "Cadastrar título" });
  await expect(dialogo).toBeVisible();
  return dialogo;
}

async function preencherTitulo(dialogo: Locator, dados: DadosTitulo): Promise<void> {
  await dialogo.getByLabel("Instituição", { exact: true }).fill(dados.instituicao);
  await dialogo.getByLabel("Produto", { exact: true }).selectOption({ label: dados.produto });
  await dialogo.getByLabel("Indexador", { exact: true }).selectOption({ label: dados.indexador });
  await dialogo.getByLabel("Taxa (% a.a.)", { exact: true }).fill(dados.taxa);
  await dialogo.getByLabel("Data de aplicação", { exact: true }).fill(dados.dataAplicacao);
  if (dados.vencimento !== null) {
    await dialogo.getByLabel("Vencimento", { exact: true }).fill(dados.vencimento);
  }
  await dialogo.getByLabel("Valor aplicado (R$)", { exact: true }).fill(dados.valorAplicado);
  await dialogo.getByLabel("Saldo atual (R$)", { exact: true }).fill(dados.saldoAtual);
  await dialogo.getByLabel("Liquidez", { exact: true }).selectOption({ label: dados.liquidez });
}

async function cadastrarTitulo(page: Page, dados: DadosTitulo): Promise<Locator> {
  const dialogo = await abrirCadastro(page);
  await preencherTitulo(dialogo, dados);
  await dialogo.getByRole("button", { name: "Salvar", exact: true }).click();

  await expect(dialogo).toBeHidden();
  await expect(
    page.getByText(new RegExp(`Título cadastrado: ${dados.produto} em ${dados.instituicao}`)),
  ).toBeVisible();
  return linhaDoTitulo(page, dados.instituicao);
}

interface RespostaCriacao {
  readonly status: number;
  readonly id?: string;
  readonly erro?: string;
}

async function criarTituloViaApi(page: Page, dados: DadosTitulo): Promise<RespostaCriacao> {
  const resposta = await page.request.post("/api/renda-fixa", {
    data: {
      instituicao: dados.instituicao,
      produto: PRODUTO_API[dados.produto] ?? dados.produto,
      indexador: INDEXADOR_API[dados.indexador] ?? dados.indexador,
      taxa: dados.taxa,
      dataAplicacao: dados.dataAplicacao,
      vencimento: dados.vencimento,
      valorAplicado: moedaParaApi(dados.valorAplicado),
      saldoAtual: moedaParaApi(dados.saldoAtual),
      statusSaldo: "INFORMADO",
      liquidez: LIQUIDEZ_API[dados.liquidez] ?? dados.liquidez,
      carenciaAte: null,
      coberturaFgc: false,
      observacoes: null,
    },
  });

  const corpo = (await resposta.json()) as { id?: string; error?: { code: string } };
  return { status: resposta.status(), id: corpo.id, erro: corpo.error?.code };
}

async function semOverflowHorizontal(page: Page): Promise<number> {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

test.describe("renda fixa", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page }) => {
    await entrar(page, usuariosDisponiveis().a);
  });

  test("lista vazia exibe estado vazio com CTA para o primeiro título", async ({ page }) => {
    await page.goto("/renda-fixa");

    await expect(page.getByRole("heading", { name: "Renda fixa", level: 1 })).toBeVisible();
    await expect(page.getByText("Nenhum título cadastrado")).toBeVisible();

    const vazio = page.locator("section", { hasText: "Nenhum título cadastrado" });
    const cta = vazio.getByRole("button", { name: "Cadastrar título" });
    await expect(cta).toBeVisible();

    await cta.click();
    const dialogo = page.getByRole("dialog", { name: "Cadastrar título" });
    await expect(dialogo).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialogo).toBeHidden();
  });

  test("cadastra CDB com FGC derivado e Tesouro Selic sem FGC", async ({ page }) => {
    await page.goto("/renda-fixa");

    const dialogoCdb = await abrirCadastro(page);
    await preencherTitulo(
      dialogoCdb,
      dadosDoTitulo({
        instituicao: INSTITUICAO_CDB,
        produto: "CDB",
        indexador: "Pós-CDI",
        taxa: "12,5",
        vencimento: somarDias(hojeIso(), 400),
        valorAplicado: "10.000,00",
        saldoAtual: "10.000,00",
        liquidez: "Diária",
      }),
    );

    const fgcCdb = dialogoCdb.getByRole("checkbox", { name: /Cobertura FGC/ });
    await expect(fgcCdb).toBeChecked();
    await expect(dialogoCdb.getByText("Cobertura FGC: sim")).toBeVisible();
    await dialogoCdb.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(dialogoCdb).toBeHidden();

    const linhaCdb = linhaDoTitulo(page, INSTITUICAO_CDB);
    await expect(linhaCdb).toBeVisible();
    await expect(linhaCdb).toContainText("CDB");
    await expect(linhaCdb).toContainText("Pós-CDI");
    await expect(linhaCdb).toContainText("R$ 10.000,00");
    await expect(linhaCdb).toContainText("Informado");
    await expect(linhaCdb).toContainText("Diária");

    const dialogoTesouro = await abrirCadastro(page);
    await preencherTitulo(
      dialogoTesouro,
      dadosDoTitulo({
        instituicao: INSTITUICAO_TESOURO,
        produto: "Tesouro Selic",
        indexador: "Selic",
        taxa: "0,1",
        vencimento: somarDias(hojeIso(), 800),
        valorAplicado: "5.000,00",
        saldoAtual: "5.000,00",
        liquidez: "Diária",
      }),
    );

    const fgcTesouro = dialogoTesouro.getByRole("checkbox", { name: /Cobertura FGC/ });
    await expect(fgcTesouro).not.toBeChecked();
    await expect(dialogoTesouro.getByText("Cobertura FGC: não")).toBeVisible();
    await dialogoTesouro.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(dialogoTesouro).toBeHidden();

    const linhaTesouro = linhaDoTitulo(page, INSTITUICAO_TESOURO);
    await expect(linhaTesouro).toBeVisible();
    await expect(linhaTesouro).toContainText("Tesouro Selic");
    await expect(linhaTesouro).toContainText("Selic");
    await expect(linhaTesouro).toContainText("R$ 5.000,00");

    // A derivação também é conferida na resposta do contrato (não só no checkbox).
    const respostaCdb = await page.request.get("/api/renda-fixa", { params: { produto: "CDB" } });
    expect(respostaCdb.status()).toBe(200);
    const corpoCdb = (await respostaCdb.json()) as {
      data: Array<{ instituicao: string; coberturaFgc: boolean }>;
    };
    expect(corpoCdb.data.find((item) => item.instituicao === INSTITUICAO_CDB)?.coberturaFgc).toBe(
      true,
    );

    const respostaTesouro = await page.request.get("/api/renda-fixa", {
      params: { produto: "TESOURO_SELIC" },
    });
    expect(respostaTesouro.status()).toBe(200);
    const corpoTesouro = (await respostaTesouro.json()) as {
      data: Array<{ instituicao: string; coberturaFgc: boolean }>;
    };
    expect(
      corpoTesouro.data.find((item) => item.instituicao === INSTITUICAO_TESOURO)?.coberturaFgc,
    ).toBe(false);
  });

  test("atualiza saldo e status com persistência após reload", async ({ page }) => {
    await page.goto("/renda-fixa");

    const linha = linhaDoTitulo(page, INSTITUICAO_CDB);
    await expect(linha).toBeVisible();
    await linha.getByRole("button", { name: `Atualizar saldo de ${INSTITUICAO_CDB}` }).click();

    const dialogo = page.getByRole("dialog", { name: "Atualizar saldo" });
    await expect(dialogo).toBeVisible();
    await dialogo.getByLabel("Saldo atual (R$)", { exact: true }).fill("12.345,67");
    await dialogo.getByLabel("Status do saldo", { exact: true }).selectOption({ label: "Confirmado" });
    await dialogo.getByRole("button", { name: "Salvar saldo", exact: true }).click();

    await expect(dialogo).toBeHidden();
    await expect(page.getByText("Saldo atualizado.")).toBeVisible();
    await expect(linha).toContainText("R$ 12.345,67");
    await expect(linha).toContainText("Confirmado");

    await page.reload();
    const linhaRecarregada = linhaDoTitulo(page, INSTITUICAO_CDB);
    await expect(linhaRecarregada).toBeVisible();
    await expect(linhaRecarregada).toContainText("R$ 12.345,67");
    await expect(linhaRecarregada).toContainText("Confirmado");
  });

  test("título vencendo em 20 dias gera alerta na faixa e na linha", async ({ page }) => {
    await page.goto("/renda-fixa");

    await cadastrarTitulo(
      page,
      dadosDoTitulo({
        instituicao: INSTITUICAO_VENCENDO,
        produto: "CDB",
        indexador: "Pré-fixado",
        taxa: "11,5",
        vencimento: somarDias(hojeIso(), 20),
        valorAplicado: "5.000,00",
        saldoAtual: "5.000,00",
        liquidez: "Diária",
      }),
    );

    const faixaAlertas = page.locator("section[aria-labelledby='rf-alertas-titulo']");
    await expect(faixaAlertas.getByText("Vence em 20 dia(s).")).toBeVisible();

    const linha = linhaDoTitulo(page, INSTITUICAO_VENCENDO);
    await expect(linha).toBeVisible();
    await expect(linha.getByText("Vencimento próximo")).toBeVisible();

    // O contrato confirma que o alerta é do tipo esperado e aponta para o título.
    const resposta = await page.request.get("/api/renda-fixa", {
      params: { instituicao: INSTITUICAO_VENCENDO },
    });
    expect(resposta.status()).toBe(200);
    const lista = (await resposta.json()) as { data: Array<{ id: string }> };
    const titulo = lista.data[0];
    expect(titulo).toBeDefined();

    const alertas = await page.request.get("/api/renda-fixa/alertas");
    expect(alertas.status()).toBe(200);
    const corpo = (await alertas.json()) as {
      alertas: Array<{ tipo: string; tituloFixoId: string; severidade: string }>;
    };
    const alerta = corpo.alertas.find((item) => item.tituloFixoId === titulo?.id);
    expect(alerta?.tipo).toBe("VENCIMENTO_PROXIMO");
    expect(alerta?.severidade).toBe("ATENCAO");
  });

  test("filtro somente com alerta mantém apenas o título com alerta", async ({ page }) => {
    await page.goto("/renda-fixa");
    await expect(linhaDoTitulo(page, INSTITUICAO_VENCENDO)).toBeVisible();

    await page.getByRole("checkbox", { name: "Somente com alerta" }).check();

    await expect(page.locator("tbody tr")).toHaveCount(1);
    await expect(linhaDoTitulo(page, INSTITUICAO_VENCENDO)).toBeVisible();
    await expect(linhaDoTitulo(page, INSTITUICAO_CDB)).toHaveCount(0);
    await expect(linhaDoTitulo(page, INSTITUICAO_TESOURO)).toHaveCount(0);
    // O contador mostra os itens visíveis (1) sobre o total da consulta (3).
    await expect(page.getByText("1 de 3 títulos com alerta")).toBeVisible();
  });

  test("ordena por colunas (aria-sort) e pagina a lista", async ({ page }) => {
    await page.goto("/renda-fixa");
    await expect(linhaDoTitulo(page, INSTITUICAO_CDB)).toBeVisible();

    const instituicoes = page.locator("tbody tr td:first-child");
    const colunaVencimento = page.getByRole("columnheader", { name: /Vencimento/ });

    await expect(colunaVencimento).toHaveAttribute("aria-sort", "ascending");
    await expect(instituicoes).toHaveText([
      INSTITUICAO_VENCENDO,
      INSTITUICAO_CDB,
      INSTITUICAO_TESOURO,
    ]);

    await page.getByRole("button", { name: /Ordenar por Vencimento/i }).click();
    await expect(colunaVencimento).toHaveAttribute("aria-sort", "descending");
    await expect(instituicoes).toHaveText([
      INSTITUICAO_TESOURO,
      INSTITUICAO_CDB,
      INSTITUICAO_VENCENDO,
    ]);

    await page.getByRole("button", { name: /Ordenar por Instituição/i }).click();
    await expect(page.getByRole("columnheader", { name: /Instituição/ })).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
    await expect(instituicoes).toHaveText([
      INSTITUICAO_CDB,
      INSTITUICAO_VENCENDO,
      INSTITUICAO_TESOURO,
    ]);

    for (let indice = 0; indice < TOTAL_MASSA; indice += 1) {
      const criado = await criarTituloViaApi(
        page,
        dadosDoTitulo({
          instituicao: `Massa ${String(indice + 1).padStart(2, "0")}`,
          produto: "CDB",
          indexador: "Pós-CDI",
          taxa: "10",
          dataAplicacao: somarDias(hojeIso(), -120),
          vencimento: null,
          valorAplicado: "1.000,00",
          saldoAtual: "1.000,00",
          liquidez: "Diária",
        }),
      );
      expect(criado.status, criado.erro).toBe(201);
    }

    await page.goto("/renda-fixa");
    const total = TOTAL_MASSA + 3;
    await expect(page.getByText(`${total} títulos · Página 1 de 2`)).toBeVisible();
    await expect(page.locator("tbody tr")).toHaveCount(20);

    await page.getByRole("button", { name: "Próxima", exact: true }).click();
    await expect(page.getByText(`${total} títulos · Página 2 de 2`)).toBeVisible();
    await expect(page.locator("tbody tr")).toHaveCount(total - 20);

    await page.getByRole("button", { name: "Anterior", exact: true }).click();
    await expect(page.getByText(`${total} títulos · Página 1 de 2`)).toBeVisible();
  });

  test("listagem em 360 px exibe cartões sem overflow horizontal", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/renda-fixa");

    const cartao = page.locator("ul.space-y-3 li").filter({ hasText: INSTITUICAO_CDB }).first();
    await expect(cartao).toBeVisible();
    await expect.poll(() => semOverflowHorizontal(page)).toBeLessThanOrEqual(0);
  });

  test("isolamento entre titulares: B não altera nem vê o título de A", async (
    { page, playwright },
    testInfo,
  ) => {
    const criado = await criarTituloViaApi(
      page,
      dadosDoTitulo({
        instituicao: INSTITUICAO_ISOLADA,
        produto: "CDB",
        indexador: "Pré-fixado",
        taxa: "10",
        vencimento: null,
        valorAplicado: "1.000,00",
        saldoAtual: "1.000,00",
        liquidez: "Diária",
      }),
    );
    expect(criado.status, criado.erro).toBe(201);
    const idTitulo = criado.id;
    if (idTitulo === undefined) {
      throw new Error("título criado sem id");
    }

    // Controle positivo: A enxerga o próprio título.
    const listaA = await page.request.get("/api/renda-fixa", {
      params: { instituicao: INSTITUICAO_ISOLADA },
    });
    expect(listaA.status()).toBe(200);
    const corpoA = (await listaA.json()) as { data: unknown[]; meta: { total: number } };
    expect(corpoA.meta.total).toBe(1);
    expect(corpoA.data).toHaveLength(1);

    const baseURL = testInfo.project.use.baseURL;
    if (baseURL === undefined) {
      throw new Error("baseURL ausente na configuração do Playwright");
    }

    const contextoB = await playwright.request.newContext({ baseURL });
    try {
      await entrarViaApi(contextoB, usuariosDisponiveis().b);

      const patchB = await contextoB.patch(`/api/renda-fixa/${idTitulo}`, {
        data: { saldoAtual: "1.00", statusSaldo: "CONFIRMADO" },
      });
      expect(patchB.status()).toBe(404);
      expect(((await patchB.json()) as { error: { code: string } }).error.code).toBe(
        "RF_NAO_ENCONTRADA",
      );

      const listaB = await contextoB.get("/api/renda-fixa");
      expect(listaB.status()).toBe(200);
      const corpoB = (await listaB.json()) as { data: unknown[]; meta: { total: number } };
      expect(corpoB.meta.total).toBe(0);
      expect(corpoB.data).toHaveLength(0);
    } finally {
      await contextoB.dispose();
    }
  });
});
