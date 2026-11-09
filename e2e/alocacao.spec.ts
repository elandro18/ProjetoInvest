import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

import { lerRegistro, type UsuariosE2E, type UsuarioE2E } from "./usuario-e2e";

/**
 * E2E de alocação (RN-021-5; RN-021 a RN-024, RN-082, RN-089, RN-091).
 *
 * Cobre no navegador e no contrato:
 * - defaults lazy no primeiro acesso (50/50 nas classes e 8 segmentos somando 100);
 * - edição 60/40 com confirmação, persistência após reload e preservação da
 *   configuração anterior no histórico (vigência);
 * - soma inválida por classe (G11 60 + 30 → "Faltam 10,0 p.p."; 60 + 50 →
 *   "Excede 10,0 p.p.") com o botão desabilitado e nada gravado;
 * - soma inválida por segmento bloqueando apenas o bloco de segmentos;
 * - desvios com FII pelo custo e renda fixa pelo saldo: DENTRO (50/50),
 *   ACIMA/ABAIXO no G8 (RF 40 / FII 60), valor para meta e aviso "Valor pelo
 *   custo" (RN-091); segmento usando o patrimônio total como denominador
 *   (RN-089);
 * - estado sem patrimônio com CTA;
 * - layout de 360 px sem overflow horizontal;
 * - isolamento A/B: B mantém 50/50 e não enxerga as metas 60/40 de A.
 *
 * Titulares: A edita as metas; B é o titular sem patrimônio/defaults; C tem a
 * carteira controlada só deste spec (FII 1.000 de custo + RF 1.000 de saldo),
 * para não interferir nas carteiras que os outros specs assumem vazias.
 * As contas são criadas/limpas pelo globalSetup/globalTeardown.
 */

const TICKER_C = "ALOC11";
const NOME_C = "FII Alocação E2E";
const SEGMENTO_C = "RECEBIVEIS";
const INSTITUICAO_C = "Banco Alocação E2E";
const CUSTO_FII = "1000.00";
const SALDO_RF = "1000.00";

const SEGMENTOS_PADRAO: ReadonlyArray<{ readonly codigo: string; readonly valor: string }> = [
  { codigo: "LOGISTICA", valor: "25" },
  { codigo: "SHOPPING", valor: "15" },
  { codigo: "RECEBIVEIS", valor: "25" },
  { codigo: "LAJES", valor: "10" },
  { codigo: "AGRO", valor: "5" },
  { codigo: "CAIXA_OPORTUNIDADES", valor: "5" },
  { codigo: "RENDA_URBANA", valor: "7,5" },
  { codigo: "HIBRIDO", valor: "7,5" },
];

type Escopo = "classe" | "segmento";

interface MetaClasseApi {
  readonly classeId: string;
  readonly codigo: string;
  readonly percentual: string;
}

interface MetaSegmentoApi {
  readonly segmentoId: string;
  readonly codigo: string;
  readonly percentual: string;
}

interface PeriodoMetasApi {
  readonly vigenciaInicio: string;
  readonly vigenciaFim: string;
  readonly classe: readonly MetaClasseApi[];
  readonly segmento: readonly MetaSegmentoApi[];
}

interface MetasApiResposta {
  readonly vigente: {
    readonly classe: readonly MetaClasseApi[];
    readonly segmento: readonly MetaSegmentoApi[];
    readonly vigenciaInicio: string;
  };
  readonly historico: readonly PeriodoMetasApi[];
}

interface ItemDesvioApi {
  readonly escopo: "CLASSE" | "SEGMENTO";
  readonly codigo: string;
  readonly percentualAtual: string;
  readonly percentualMeta: string;
  readonly desvioPontos: string;
  readonly valorParaMeta: string;
  readonly situacao: "ABAIXO" | "ACIMA" | "DENTRO";
  readonly valorIndisponivel: boolean;
}

interface DesviosApiResposta {
  readonly baseCalculo: string;
  readonly itens: readonly ItemDesvioApi[];
}

interface ReferenciaAtivosApi {
  readonly classes: ReadonlyArray<{
    readonly id: string;
    readonly codigo: string;
    readonly segmentos: ReadonlyArray<{ readonly id: string; readonly codigo: string }>;
  }>;
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

function bloco(page: Page, escopo: Escopo) {
  return page.locator(`section[aria-labelledby='alocacao-${escopo}-titulo']`);
}

function campoPercentual(page: Page, escopo: Escopo, codigo: string) {
  return page.locator(`#alocacao-${escopo}-${codigo}`);
}

function botaoSalvar(page: Page, escopo: Escopo) {
  return page.getByRole("button", { name: `Salvar metas por ${escopo}` });
}

function paragrafoDaSoma(page: Page, escopo: Escopo) {
  return page.locator(`#alocacao-soma-${escopo}`);
}

function tabelaDeDesvios(page: Page, indice: 0 | 1) {
  return page
    .locator("section[aria-labelledby='alocacao-desvios-titulo'] table")
    .nth(indice);
}

function linhaDeDesvio(page: Page, texto: string | RegExp, indice: 0 | 1 = 0) {
  return tabelaDeDesvios(page, indice).locator("tbody tr").filter({ hasText: texto });
}

function percentualSeisCasas(valor: string): string {
  return Number(valor).toFixed(6);
}

function percentualClasse(metas: MetasApiResposta, codigo: string): string {
  const meta = metas.vigente.classe.find((item) => item.codigo === codigo);
  if (meta === undefined) {
    throw new Error(`meta de classe ${codigo} ausente`);
  }
  return meta.percentual;
}

async function obterMetas(request: APIRequestContext): Promise<MetasApiResposta> {
  const resposta = await request.get("/api/alocacao/metas");
  expect(resposta.status()).toBe(200);
  return (await resposta.json()) as MetasApiResposta;
}

/**
 * Substitui os percentuais das classes mantendo os segmentos vigentes.
 *
 * O `PUT` troca os dois escopos de uma vez; por isso o segmento é reenviado
 * exatamente como está — o objetivo aqui é controlar só a estratégia de classe.
 */
async function substituirClasses(
  request: APIRequestContext,
  percentuais: Readonly<Record<string, string>>,
): Promise<void> {
  const atual = await obterMetas(request);

  const resposta = await request.put("/api/alocacao/metas", {
    data: {
      classe: atual.vigente.classe.map((meta) => ({
        referenciaId: meta.classeId,
        percentual: percentuais[meta.codigo] ?? meta.percentual,
      })),
      segmento: atual.vigente.segmento.map((meta) => ({
        referenciaId: meta.segmentoId,
        percentual: meta.percentual,
      })),
    },
  });

  expect(resposta.status()).toBe(200);
}

async function semOverflowHorizontal(page: Page): Promise<number> {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

function hojeIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Garante a carteira controlada do titular C (idempotente entre retentativas). */
async function garantirCarteiraC(page: Page): Promise<void> {
  const referencia = await page.request.get("/api/referencia/ativos");
  expect(referencia.status()).toBe(200);
  const { classes } = (await referencia.json()) as ReferenciaAtivosApi;

  const fii = classes.find((classe) => classe.codigo === "FII");
  const segmento = fii?.segmentos.find((item) => item.codigo === SEGMENTO_C) ?? fii?.segmentos[0];
  if (fii === undefined || segmento === undefined) {
    throw new Error("referência de FII/Recebíveis ausente no catálogo");
  }

  const listaAtivos = await page.request.get("/api/ativos", { params: { q: TICKER_C } });
  expect(listaAtivos.status()).toBe(200);
  const ativoExistente = (
    (await listaAtivos.json()) as { data: ReadonlyArray<{ id: string }> }
  ).data[0];

  let ativoId = ativoExistente?.id;
  if (ativoId === undefined) {
    const criado = await page.request.post("/api/ativos", {
      data: {
        ticker: TICKER_C,
        nome: NOME_C,
        classeId: fii.id,
        segmentoId: segmento.id,
      },
    });
    expect(criado.status()).toBe(201);
    ativoId = ((await criado.json()) as { id: string }).id;
  }

  const movimentacoes = await page.request.get("/api/movimentacoes", {
    params: { ativoId, tipo: "COMPRA", pageSize: "100" },
  });
  expect(movimentacoes.status()).toBe(200);
  const compraExistente = (
    (await movimentacoes.json()) as { data: ReadonlyArray<{ id: string }> }
  ).data[0];

  if (compraExistente === undefined) {
    const compra = await page.request.post("/api/movimentacoes", {
      data: {
        ativoId,
        tipo: "COMPRA",
        data: hojeIso(),
        quantidade: "10",
        valorUnitario: "100.00",
        valorTotal: CUSTO_FII,
        custos: "0.00",
        observacoes: null,
      },
    });
    expect(compra.status()).toBe(201);
  }

  const titulos = await page.request.get("/api/renda-fixa", {
    params: { instituicao: INSTITUICAO_C },
  });
  expect(titulos.status()).toBe(200);
  const tituloExistente = (
    (await titulos.json()) as { data: ReadonlyArray<{ id: string }> }
  ).data[0];

  if (tituloExistente === undefined) {
    const titulo = await page.request.post("/api/renda-fixa", {
      data: {
        instituicao: INSTITUICAO_C,
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

test.describe("alocação — defaults e estado sem patrimônio (titular B)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page }) => {
    await entrar(page, usuariosDisponiveis().b);
  });

  test("primeiro acesso materializa 50/50 nas classes e 8 segmentos somando 100", async ({
    page,
  }) => {
    const metas = await obterMetas(page.request);

    expect(metas.vigente.classe.map((meta) => meta.codigo).sort()).toEqual([
      "FII",
      "RENDA_FIXA",
    ]);
    expect(percentualSeisCasas(percentualClasse(metas, "RENDA_FIXA"))).toBe("50.000000");
    expect(percentualSeisCasas(percentualClasse(metas, "FII"))).toBe("50.000000");

    expect(metas.vigente.segmento).toHaveLength(8);
    const somaSegmentos = metas.vigente.segmento.reduce(
      (total, meta) => total + Number(meta.percentual),
      0,
    );
    expect(somaSegmentos).toBeCloseTo(100, 6);

    await page.goto("/alocacao");
    await expect(page.getByRole("heading", { name: "Alocação", level: 1 })).toBeVisible();

    await expect(campoPercentual(page, "classe", "RENDA_FIXA")).toHaveValue("50");
    await expect(campoPercentual(page, "classe", "FII")).toHaveValue("50");
    await expect(paragrafoDaSoma(page, "classe")).toContainText("Soma: 100%.");
    await expect(paragrafoDaSoma(page, "classe")).toContainText("Soma correta.");

    await expect(bloco(page, "segmento").locator("input")).toHaveCount(8);
    for (const segmento of SEGMENTOS_PADRAO) {
      await expect(campoPercentual(page, "segmento", segmento.codigo)).toHaveValue(
        segmento.valor,
      );
    }
    await expect(paragrafoDaSoma(page, "segmento")).toContainText("Soma: 100%.");
    await expect(paragrafoDaSoma(page, "segmento")).toContainText("Soma correta.");
  });

  test("sem patrimônio mostra percentuais 0% e CTA de cadastro", async ({ page }) => {
    const resposta = await page.request.get("/api/alocacao/desvios");
    expect(resposta.status()).toBe(200);
    const desvios = (await resposta.json()) as DesviosApiResposta;

    // RN-089/RN-023: sem patrimônio nada é inventado — atual 0% em todos os itens.
    expect(desvios.baseCalculo).toBe("PATRIMONIO_TOTAL");
    expect(desvios.itens).toHaveLength(10);
    expect(desvios.itens.every((item) => item.percentualAtual === "0.000000")).toBe(true);

    await page.goto("/alocacao");
    await expect(page.getByText("Sem patrimônio cadastrado")).toBeVisible();
    const cta = page.getByRole("link", { name: "Cadastrar ativo" });
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute("href", "/ativos/novo");

    const linhaRendaFixa = linhaDeDesvio(page, "Renda Fixa");
    await expect(linhaRendaFixa.locator("td").nth(1)).toHaveText("0%");
    await expect(linhaRendaFixa.locator("td").nth(2)).toHaveText("50%");
    await expect(linhaRendaFixa.locator("td").nth(3)).toHaveText("-50 p.p.");
    await expect(linhaRendaFixa.locator("td").nth(4)).toHaveText("R$ 0,00");
    await expect(linhaRendaFixa.locator("td").nth(5)).toContainText("Abaixo");
  });

  test("tela em 360 px não tem overflow horizontal", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/alocacao");

    await expect(page.getByRole("heading", { name: "Alocação", level: 1 })).toBeVisible();

    const cartaoRendaFixa = page
      .locator("ul.space-y-3 li")
      .filter({ hasText: "Renda Fixa" })
      .first();
    await expect(cartaoRendaFixa).toBeVisible();
    await expect(cartaoRendaFixa).toContainText("Abaixo");

    await expect.poll(() => semOverflowHorizontal(page)).toBeLessThanOrEqual(0);
  });
});

test.describe("alocação — edição, soma e vigência (titular A)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page }) => {
    await entrar(page, usuariosDisponiveis().a);
  });

  test("altera classes para 60/40, confirma, salva, recarrega e preserva o histórico", async ({
    page,
  }) => {
    await page.goto("/alocacao");
    await expect(campoPercentual(page, "classe", "RENDA_FIXA")).toBeVisible();

    const antes = await obterMetas(page.request);

    await campoPercentual(page, "classe", "RENDA_FIXA").fill("60");
    await campoPercentual(page, "classe", "FII").fill("40");
    await expect(paragrafoDaSoma(page, "classe")).toContainText("Soma: 100%.");
    await expect(paragrafoDaSoma(page, "classe")).toContainText("Soma correta.");

    const salvar = botaoSalvar(page, "classe");
    await expect(salvar).toBeEnabled();
    await salvar.click();

    const dialogo = page.getByRole("dialog", { name: "Salvar novas metas" });
    await expect(dialogo).toBeVisible();
    await expect(dialogo).toContainText("passa para o histórico");
    await dialogo.getByRole("button", { name: "Salvar metas" }).click();
    await expect(dialogo).toBeHidden();

    await expect(
      page.getByRole("status").filter({ hasText: "Metas salvas" }),
    ).toBeVisible();

    // Persistência: após recarregar, a tela lê a nova vigência do servidor.
    await page.reload();
    await expect(campoPercentual(page, "classe", "RENDA_FIXA")).toHaveValue("60");
    await expect(campoPercentual(page, "classe", "FII")).toHaveValue("40");

    const depois = await obterMetas(page.request);
    expect(percentualSeisCasas(percentualClasse(depois, "RENDA_FIXA"))).toBe("60.000000");
    expect(percentualSeisCasas(percentualClasse(depois, "FII"))).toBe("40.000000");

    // RN-021/AC-021b: a configuração anterior recebe vigência encerrada e
    // continua representada no histórico do contrato.
    expect(depois.historico.length).toBeGreaterThanOrEqual(1);
    expect(depois.historico.every((periodo) => periodo.vigenciaFim.length > 0)).toBe(true);
    const rendaFixaNoHistorico = depois.historico.some((periodo) =>
      periodo.classe.some(
        (meta) =>
          meta.codigo === "RENDA_FIXA" &&
          percentualSeisCasas(meta.percentual) ===
            percentualSeisCasas(percentualClasse(antes, "RENDA_FIXA")),
      ),
    );
    expect(rendaFixaNoHistorico).toBe(true);
  });

  test("soma 90 e soma 110 bloqueiam o salvar sem gravar nada", async ({ page }) => {
    await page.goto("/alocacao");
    await expect(campoPercentual(page, "classe", "RENDA_FIXA")).toHaveValue("60");
    await expect(campoPercentual(page, "classe", "FII")).toHaveValue("40");

    const salvar = botaoSalvar(page, "classe");

    // G11: 60 + 30 = 90.
    await campoPercentual(page, "classe", "FII").fill("30");
    await expect(paragrafoDaSoma(page, "classe")).toContainText("Faltam 10,0 p.p.");
    await expect(salvar).toBeDisabled();

    // 60 + 50 = 110.
    await campoPercentual(page, "classe", "FII").fill("50");
    await expect(paragrafoDaSoma(page, "classe")).toContainText("Excede 10,0 p.p.");
    await expect(salvar).toBeDisabled();

    // Voltando a 60/40 o bloco libera, mas nada foi gravado nas tentativas.
    await campoPercentual(page, "classe", "FII").fill("40");
    await expect(paragrafoDaSoma(page, "classe")).toContainText("Soma correta.");
    await expect(salvar).toBeEnabled();

    const metas = await obterMetas(page.request);
    expect(percentualSeisCasas(percentualClasse(metas, "RENDA_FIXA"))).toBe("60.000000");
    expect(percentualSeisCasas(percentualClasse(metas, "FII"))).toBe("40.000000");
  });

  test("soma inválida por segmento bloqueia apenas o bloco de segmentos", async ({ page }) => {
    await page.goto("/alocacao");
    await expect(campoPercentual(page, "segmento", "LOGISTICA")).toHaveValue("25");

    const salvarSegmento = botaoSalvar(page, "segmento");
    const salvarClasse = botaoSalvar(page, "classe");

    // 25 → 20: a soma dos segmentos cai para 95.
    await campoPercentual(page, "segmento", "LOGISTICA").fill("20");
    await expect(paragrafoDaSoma(page, "segmento")).toContainText("Faltam 5,0 p.p.");
    await expect(salvarSegmento).toBeDisabled();
    // As classes continuam válidas (60/40) e o bloco delas permanece liberado.
    await expect(salvarClasse).toBeEnabled();

    // 25 → 30: a soma dos segmentos sobe para 105.
    await campoPercentual(page, "segmento", "LOGISTICA").fill("30");
    await expect(paragrafoDaSoma(page, "segmento")).toContainText("Excede 5,0 p.p.");
    await expect(salvarSegmento).toBeDisabled();

    await campoPercentual(page, "segmento", "LOGISTICA").fill("25");
    await expect(paragrafoDaSoma(page, "segmento")).toContainText("Soma: 100%.");
    await expect(paragrafoDaSoma(page, "segmento")).toContainText("Soma correta.");
    await expect(salvarSegmento).toBeEnabled();
  });
});

test.describe("alocação — isolamento A/B", () => {
  test("B mantém 50/50 e não enxerga as metas de A", async ({
    page,
    playwright,
  }, testInfo) => {
    await entrar(page, usuariosDisponiveis().b);

    const baseURL = testInfo.project.use.baseURL;
    if (baseURL === undefined) {
      throw new Error("baseURL ausente na configuração do Playwright");
    }

    // Controle: A grava 60/40 pela própria sessão.
    const contextoA = await playwright.request.newContext({ baseURL });
    try {
      await entrarViaApi(contextoA, usuariosDisponiveis().a);
      await substituirClasses(contextoA, { RENDA_FIXA: "60", FII: "40" });

      const metasA = await obterMetas(contextoA);
      expect(percentualSeisCasas(percentualClasse(metasA, "RENDA_FIXA"))).toBe("60.000000");
      expect(percentualSeisCasas(percentualClasse(metasA, "FII"))).toBe("40.000000");

      // B (sessão do navegador) nunca configurou metas: continua no default.
      const metasB = await obterMetas(page.request);
      expect(metasB.historico).toHaveLength(0);
      expect(percentualSeisCasas(percentualClasse(metasB, "RENDA_FIXA"))).toBe("50.000000");
      expect(percentualSeisCasas(percentualClasse(metasB, "FII"))).toBe("50.000000");

      await page.goto("/alocacao");
      await expect(campoPercentual(page, "classe", "RENDA_FIXA")).toHaveValue("50");
      await expect(campoPercentual(page, "classe", "FII")).toHaveValue("50");
      await expect(paragrafoDaSoma(page, "classe")).toContainText("Soma: 100%.");
    } finally {
      await contextoA.dispose();
    }
  });
});

test.describe("alocação — desvios com patrimônio (titular C)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page }) => {
    await entrar(page, usuariosDisponiveis().c);
  });

  test("classifica DENTRO, ABAIXO e ACIMA com FII pelo custo e RF pelo saldo", async ({
    page,
  }) => {
    await garantirCarteiraC(page);

    // 50/50: patrimônio 2.000 (FII 1.000 pelo custo + RF 1.000 pelo saldo) —
    // as duas classes ficam exatamente na meta.
    await substituirClasses(page.request, { RENDA_FIXA: "50", FII: "50" });
    await page.goto("/alocacao");

    const rendaFixaDentro = linhaDeDesvio(page, "Renda Fixa");
    await expect(rendaFixaDentro.locator("td").nth(1)).toHaveText("50%");
    await expect(rendaFixaDentro.locator("td").nth(2)).toHaveText("50%");
    await expect(rendaFixaDentro.locator("td").nth(3)).toHaveText("+0 p.p.");
    await expect(rendaFixaDentro.locator("td").nth(5)).toContainText("Dentro");

    const fiiDentro = linhaDeDesvio(page, "Fundos Imobiliários");
    await expect(fiiDentro.locator("td").nth(5)).toContainText("Dentro");

    // G8: RF 40 / FII 60 sobre o patrimônio total.
    await substituirClasses(page.request, { RENDA_FIXA: "40", FII: "60" });
    await page.reload();

    const rendaFixa = linhaDeDesvio(page, "Renda Fixa");
    await expect(rendaFixa.locator("td").nth(1)).toHaveText("50%");
    await expect(rendaFixa.locator("td").nth(2)).toHaveText("40%");
    await expect(rendaFixa.locator("td").nth(3)).toHaveText("+10 p.p.");
    await expect(rendaFixa.locator("td").nth(4)).toHaveText("R$ 0,00");
    await expect(rendaFixa.locator("td").nth(5)).toContainText("Acima");
    await expect(rendaFixa).not.toContainText("Valor pelo custo");

    // FII entra pelo custo (RN-091): 50% atual, meta 60%, faltam R$ 200,00.
    const fii = linhaDeDesvio(page, "Fundos Imobiliários");
    await expect(fii.locator("td").nth(1)).toHaveText("50%");
    await expect(fii.locator("td").nth(2)).toHaveText("60%");
    await expect(fii.locator("td").nth(3)).toHaveText("-10 p.p.");
    await expect(fii.locator("td").nth(4)).toHaveText("R$ 200,00");
    await expect(fii.locator("td").nth(5)).toContainText("Abaixo");
    await expect(fii).toContainText("Valor pelo custo");

    await expect(page.getByText("Valores pelo custo de aquisição")).toBeVisible();

    // RN-089: o segmento Recebíveis tem 1.000 de 2.000 do patrimônio total = 50%,
    // e não 100% de uma base restrita aos FIIs. Segmentos ficam na 2ª tabela.
    const recebiveis = linhaDeDesvio(page, /Recebíveis/, 1);
    await expect(recebiveis.locator("td").nth(1)).toHaveText("50%");
    await expect(recebiveis.locator("td").nth(2)).toHaveText("25%");
    await expect(recebiveis.locator("td").nth(3)).toHaveText("+25 p.p.");
    await expect(recebiveis.locator("td").nth(5)).toContainText("Acima");

    // Sanidade da base usada pelo cálculo: 2.000 de patrimônio (1.000 + 1.000).
    const resposta = await page.request.get("/api/alocacao/desvios");
    expect(resposta.status()).toBe(200);
    const desvios = (await resposta.json()) as DesviosApiResposta;
    expect(desvios.baseCalculo).toBe("PATRIMONIO_TOTAL");
  });
});
