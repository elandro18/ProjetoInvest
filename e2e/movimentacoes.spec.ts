import { randomUUID } from "node:crypto";

import { expect, test, type APIRequestContext, type Locator, type Page } from "@playwright/test";

import { lerRegistro, type UsuariosE2E, type UsuarioE2E } from "./usuario-e2e";

/**
 * E2E de movimentações (RN-014-6; RN-014 a RN-019, RN-084).
 *
 * Cobre os casos de ouro e os fluxos de borda no navegador, com o titular A:
 * - compra de FII (10 × 100 + 3) com item na lista e posição/preço médio no feedback;
 * - dividendo que não altera o preço médio e é registrado à parte;
 * - venda acima da posição: 409 → diálogo com impacto (10/15/−5) → motivo
 *   obrigatório → reenvio confirmado (AC-018, AC-018b);
 * - cancelamento lógico da compra: item permanece com badge "Cancelada" e a
 *   posição é recalculada (RN-084);
 * - filtros por ativo/tipo/período/"incluir canceladas" e ordenação (`aria-sort`);
 * - layout de 360 px sem overflow nos cartões;
 * - idempotência real via `Idempotency-Key` repetida na API;
 * - isolamento A/B: o titular B não cancela nem enxerga a movimentação de A.
 *
 * O grupo é serial porque os cenários compartilham a carteira do titular A
 * criada ao longo do fluxo. A conta e os dados são criados/limpos pelo
 * globalSetup/globalTeardown.
 */

const TICKER = "MXRF11";
const NOME = "Maxi Renda FII";
const SEGMENTO = "RECEBIVEIS";

let ativoId: string | null = null;
let ativoRotulo = `${TICKER} — ${NOME}`;

interface AtivoCriado {
  readonly id: string;
}

interface MovimentacaoApi {
  readonly id: string;
  readonly ativo: { readonly id: string; readonly ticker: string };
  readonly tipo: string;
  readonly data: string;
  readonly quantidade: string | null;
  readonly valorUnitario: string | null;
  readonly valorTotal: string;
  readonly custos: string;
  readonly canceladaEm: string | null;
  readonly cancelamentoMotivo: string | null;
}

interface PosicaoApi {
  readonly quantidade: string;
  readonly precoMedio: string;
  readonly custoTotal: string;
}

interface ListaMovimentacoesApi {
  readonly data: readonly MovimentacaoApi[];
  readonly meta: { readonly total: number };
}

interface RespostaCriacaoApi {
  readonly movimentacao: MovimentacaoApi;
  readonly posicao: PosicaoApi;
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

function hojeIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function somarDias(dataIso: string, dias: number): string {
  const [ano, mes, dia] = dataIso.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia + dias)).toISOString().slice(0, 10);
}

function dataBr(dataIso: string): string {
  const [ano, mes, dia] = dataIso.split("-");
  return `${dia}/${mes}/${ano}`;
}

async function semOverflowHorizontal(page: Page): Promise<number> {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

/**
 * Cria o FII do fluxo uma única vez (idempotente entre retentativas).
 *
 * O ativo é criado pela API do próprio titular A, exatamente como a tela de
 * ativos faria; a fixture A/B é reutilizada para o isolamento.
 */
async function garantirAtivo(page: Page): Promise<string> {
  if (ativoId !== null) {
    return ativoId;
  }

  const referencia = await page.request.get("/api/referencia/ativos");
  expect(referencia.status()).toBe(200);
  const { classes } = (await referencia.json()) as ReferenciaAtivosApi;

  const fii = classes.find((classe) => classe.codigo === "FII");
  const segmento = fii?.segmentos.find((item) => item.codigo === SEGMENTO);
  if (fii === undefined || segmento === undefined) {
    throw new Error("referência de FII/Recebíveis ausente no catálogo");
  }

  const criado = await page.request.post("/api/ativos", {
    data: { ticker: TICKER, nome: NOME, classeId: fii.id, segmentoId: segmento.id },
  });

  if (criado.status() === 201) {
    ativoId = ((await criado.json()) as AtivoCriado).id;
  } else if (criado.status() === 409) {
    // Retentativa sobre banco não limpo: reaproveita o ativo já existente.
    const lista = await page.request.get("/api/ativos", { params: { q: TICKER } });
    expect(lista.status()).toBe(200);
    const corpo = (await lista.json()) as { data: ReadonlyArray<AtivoCriado> };
    const existente = corpo.data[0];
    if (existente === undefined) {
      throw new Error("ativo duplicado sem registro na listagem");
    }
    ativoId = existente.id;
  } else {
    throw new Error(`falha ao criar o ativo do fluxo: HTTP ${criado.status()}`);
  }

  ativoRotulo = `${TICKER} — ${NOME}`;
  return ativoId;
}

async function abrirFormulario(page: Page): Promise<Locator> {
  await page.getByRole("button", { name: "Nova movimentação" }).click();
  const dialogo = page.getByRole("dialog", { name: "Nova movimentação" });
  await expect(dialogo).toBeVisible();
  return dialogo;
}

async function selecionarAtivo(dialogo: Locator): Promise<void> {
  await dialogo.getByLabel("Ativo", { exact: true }).selectOption({ label: ativoRotulo });
}

async function escolherTipo(dialogo: Locator, tipo: string): Promise<void> {
  // O input é `sr-only`; o clique no rótulo é o gesto real do titular.
  await dialogo.locator("label", { hasText: tipo }).click();
}

async function salvar(dialogo: Locator): Promise<void> {
  await dialogo.getByRole("button", { name: "Salvar", exact: true }).click();
}

function linhaPorTipo(page: Page, tipo: string): Locator {
  return page.getByRole("row").filter({ hasText: tipo });
}

async function listarMovimentacoes(
  page: Page,
  params: Record<string, string>,
): Promise<ListaMovimentacoesApi> {
  const resposta = await page.request.get("/api/movimentacoes", {
    params: { pageSize: "100", incluirCanceladas: "true", ...params },
  });
  expect(resposta.status()).toBe(200);
  return (await resposta.json()) as ListaMovimentacoesApi;
}

async function idDaMovimentacao(page: Page, tipo: string): Promise<string> {
  const lista = await listarMovimentacoes(page, { ativoId: ativoId ?? "", tipo });
  const ativa = lista.data.find((item) => item.canceladaEm === null);
  if (ativa === undefined) {
    throw new Error(`movimentação ativa do tipo ${tipo} não encontrada`);
  }
  return ativa.id;
}

test.describe("movimentações e posição", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page }) => {
    await entrar(page, usuariosDisponiveis().a);
  });

  test("compra de FII entra na lista e o feedback mostra posição e preço médio", async ({
    page,
  }) => {
    await garantirAtivo(page);
    const dataCompra = somarDias(hojeIso(), -2);

    await page.goto("/movimentacoes");
    await expect(page.getByRole("heading", { name: "Movimentações", level: 1 })).toBeVisible();

    const dialogo = await abrirFormulario(page);
    await selecionarAtivo(dialogo);
    await escolherTipo(dialogo, "Compra");
    await dialogo.getByLabel("Data", { exact: true }).fill(dataCompra);
    await dialogo.getByLabel("Quantidade", { exact: true }).fill("10");
    await dialogo.getByLabel("Valor unitário (R$)", { exact: true }).fill("100,00");
    await dialogo.getByLabel("Custos (R$)", { exact: true }).fill("3,00");

    // RN-019: o total é calculado em tempo real (10 × 100 + 3).
    await expect(dialogo.getByLabel("Valor total (R$)", { exact: true })).toHaveValue("1.003,00");

    await salvar(dialogo);
    await expect(dialogo).toBeHidden();

    await expect(
      page.getByText(
        new RegExp(
          `Movimentação registrada: Compra de ${TICKER} em ${dataBr(dataCompra)}.*preço médio R\\$ 100,30`,
        ),
      ),
    ).toBeVisible();

    const linha = linhaPorTipo(page, "Compra");
    await expect(linha).toBeVisible();
    await expect(linha).toContainText(TICKER);
    await expect(linha).toContainText(dataBr(dataCompra));
    await expect(linha).toContainText("R$ 1.003,00");
    await expect(linha).toContainText("Ativa");
  });

  test("dividendo entra na lista sem alterar o preço médio", async ({ page }) => {
    const ativo = await garantirAtivo(page);
    const dataDividendo = somarDias(hojeIso(), -1);

    await page.goto("/movimentacoes");
    const dialogo = await abrirFormulario(page);
    await selecionarAtivo(dialogo);
    await escolherTipo(dialogo, "Dividendo");
    await dialogo.getByLabel("Data", { exact: true }).fill(dataDividendo);
    await dialogo.getByLabel("Valor total (R$)", { exact: true }).fill("50,00");

    await salvar(dialogo);
    await expect(dialogo).toBeHidden();

    // RN-017: provento não mexe no preço médio (continua 100,30).
    await expect(
      page.getByText(new RegExp(`Movimentação registrada: Dividendo de ${TICKER}.*preço médio R\\$ 100,30`)),
    ).toBeVisible();

    const linha = linhaPorTipo(page, "Dividendo");
    await expect(linha).toBeVisible();
    await expect(linha).toContainText("R$ 50,00");

    const lista = await listarMovimentacoes(page, { ativoId: ativo, tipo: "DIVIDENDO" });
    expect(lista.data[0]?.tipo).toBe("DIVIDENDO");
  });

  test("venda acima da posição mostra impacto, exige motivo e reenvia confirmada", async ({
    page,
  }) => {
    await garantirAtivo(page);
    const dataVenda = hojeIso();

    await page.goto("/movimentacoes");
    const dialogo = await abrirFormulario(page);
    await selecionarAtivo(dialogo);
    await escolherTipo(dialogo, "Venda");
    await dialogo.getByLabel("Data", { exact: true }).fill(dataVenda);
    await dialogo.getByLabel("Quantidade", { exact: true }).fill("15");
    await dialogo.getByLabel("Valor unitário (R$)", { exact: true }).fill("100,00");

    await salvar(dialogo);

    const confirmacao = page.getByRole("dialog", { name: "Posição ficaria negativa" });
    await expect(confirmacao).toBeVisible();
    await expect(confirmacao).toContainText(TICKER);

    // AC-018: impacto exato da exceção (posição 10, venda 15, resultado −5).
    await expect(confirmacao.locator("dl dd")).toHaveText(["10", "15", "-5"]);

    // Sem motivo o reenvio não acontece.
    await confirmacao.getByRole("button", { name: "Confirmar venda" }).click();
    await expect(confirmacao.getByText("Informe o motivo.")).toBeVisible();

    await confirmacao
      .getByLabel("Motivo da confirmação", { exact: true })
      .fill("Venda a descoberto autorizada pelo titular");
    await confirmacao.getByRole("button", { name: "Confirmar venda" }).click();
    await expect(confirmacao).toBeHidden();

    // AC-018b: a exceção é gravada e a posição resultante fica descoberta.
    await expect(
      page.getByText(new RegExp(`Movimentação registrada: Venda de ${TICKER}.*Posição de ${TICKER}: -5 cotas`)),
    ).toBeVisible();

    const linha = linhaPorTipo(page, "Venda");
    await expect(linha).toBeVisible();
    await expect(linha).toContainText("R$ 1.500,00");
  });

  test("cancelamento lógico mantém o item com badge Cancelada e recalcula a posição", async ({
    page,
  }) => {
    await garantirAtivo(page);
    const dataCompra = somarDias(hojeIso(), -2);

    await page.goto("/movimentacoes");
    const botaoCancelar = page.getByRole("button", {
      name: `Cancelar movimentação de ${TICKER} de ${dataBr(dataCompra)}`,
    });
    await expect(botaoCancelar).toBeVisible();
    await botaoCancelar.click();

    const dialogo = page.getByRole("dialog", { name: "Cancelar movimentação" });
    await expect(dialogo).toBeVisible();

    // Motivo obrigatório (RN-084): vazio não confirma.
    await dialogo.getByRole("button", { name: "Confirmar cancelamento" }).click();
    await expect(dialogo.getByText("Informe o motivo.")).toBeVisible();

    await dialogo
      .getByLabel("Motivo do cancelamento", { exact: true })
      .fill("Compra lançada em duplicidade");
    await dialogo.getByRole("button", { name: "Confirmar cancelamento" }).click();
    await expect(dialogo).toBeHidden();

    // Sem a compra de 10, a venda confirmada de 15 deixa a posição em −15.
    await expect(
      page.getByText(new RegExp(`Movimentação cancelada.*Posição de ${TICKER}: -15 cotas`)),
    ).toBeVisible();

    const linha = linhaPorTipo(page, "Compra");
    await expect(linha).toBeVisible();
    await expect(linha).toContainText("Cancelada");

    // A exclusão é lógica: após recarregar, a consulta padrão não a mostra.
    await page.reload();
    await expect(linhaPorTipo(page, "Compra")).toHaveCount(0);
    await expect(linhaPorTipo(page, "Venda")).toBeVisible();
    await expect(linhaPorTipo(page, "Dividendo")).toBeVisible();
  });

  test("filtra por ativo, tipo, período e incluir canceladas", async ({ page }) => {
    await garantirAtivo(page);
    const dataDividendo = somarDias(hojeIso(), -1);

    await page.goto("/movimentacoes");
    await expect(page.locator("tbody tr")).toHaveCount(2);

    // Ativo: o filtro lista o FII do titular e mantém as movimentações dele.
    const filtroAtivo = page.getByLabel("Filtrar por ativo", { exact: true });
    await filtroAtivo.selectOption({ label: ativoRotulo });
    await expect(page.locator("tbody tr")).toHaveCount(2);

    // Tipo: apenas o dividendo.
    await page.getByLabel("Filtrar por tipo", { exact: true }).selectOption({ label: "Dividendo" });
    await expect(page.locator("tbody tr")).toHaveCount(1);
    await expect(linhaPorTipo(page, "Dividendo")).toBeVisible();
    await page.getByRole("button", { name: "Limpar filtros" }).click();
    await expect(page.locator("tbody tr")).toHaveCount(2);

    // Período: só o dia do dividendo.
    await page.getByLabel("Data inicial", { exact: true }).fill(dataDividendo);
    await page.getByLabel("Data final", { exact: true }).fill(dataDividendo);
    await expect(page.locator("tbody tr")).toHaveCount(1);
    await expect(linhaPorTipo(page, "Dividendo")).toBeVisible();
    await page.getByRole("button", { name: "Limpar filtros" }).click();

    // Incluir canceladas: a compra cancelada volta com o badge.
    const incluir = page.getByRole("checkbox", { name: "Incluir canceladas" });
    await incluir.check();
    await expect(page.locator("tbody tr")).toHaveCount(3);
    await expect(linhaPorTipo(page, "Compra")).toContainText("Cancelada");

    await incluir.uncheck();
    await expect(page.locator("tbody tr")).toHaveCount(2);
    await expect(linhaPorTipo(page, "Compra")).toHaveCount(0);
  });

  test("ordena por data e por valor total refletindo em aria-sort", async ({ page }) => {
    await garantirAtivo(page);
    const dataCompra = somarDias(hojeIso(), -2);
    const dataDividendo = somarDias(hojeIso(), -1);
    const dataVenda = hojeIso();

    await page.goto("/movimentacoes");
    await page.getByRole("checkbox", { name: "Incluir canceladas" }).check();
    await expect(page.locator("tbody tr")).toHaveCount(3);

    const colunaData = page.getByRole("columnheader", { name: /Data/ });
    const colunaValorTotal = page.getByRole("columnheader", { name: /Valor total/ });
    const datas = page.locator("tbody tr td:first-child");

    // Ordenação padrão: data descendente (mais recente primeiro).
    await expect(colunaData).toHaveAttribute("aria-sort", "descending");
    await expect(colunaValorTotal).toHaveAttribute("aria-sort", "none");
    await expect(datas).toHaveText([
      dataBr(dataVenda),
      dataBr(dataDividendo),
      dataBr(dataCompra),
    ]);

    await page.getByRole("button", { name: /Ordenar por Data/i }).click();
    await expect(colunaData).toHaveAttribute("aria-sort", "ascending");
    await expect(datas).toHaveText([
      dataBr(dataCompra),
      dataBr(dataDividendo),
      dataBr(dataVenda),
    ]);

    // Valor total: primeira ativação ordena ascendente (50 < 1.003 < 1.500).
    await page.getByRole("button", { name: /Ordenar por Valor total/i }).click();
    await expect(colunaValorTotal).toHaveAttribute("aria-sort", "ascending");
    await expect(datas).toHaveText([
      dataBr(dataDividendo),
      dataBr(dataCompra),
      dataBr(dataVenda),
    ]);

    await page.getByRole("button", { name: /Ordenar por Valor total/i }).click();
    await expect(colunaValorTotal).toHaveAttribute("aria-sort", "descending");
    await expect(datas).toHaveText([
      dataBr(dataVenda),
      dataBr(dataCompra),
      dataBr(dataDividendo),
    ]);
  });

  test("listagem em 360 px exibe cartões sem overflow horizontal", async ({ page }) => {
    await garantirAtivo(page);
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/movimentacoes");

    const cartao = page.locator("ul.space-y-3 li").filter({ hasText: TICKER }).first();
    await expect(cartao).toBeVisible();
    await expect(cartao).toContainText("Venda");
    await expect.poll(() => semOverflowHorizontal(page)).toBeLessThanOrEqual(0);
  });

  test("Idempotency-Key repetida devolve o mesmo recurso sem duplicar linha", async ({ page }) => {
    const ativo = await garantirAtivo(page);
    const antes = (await listarMovimentacoes(page, { ativoId: ativo })).meta.total;
    const chave = randomUUID();
    // 16 cotas regularizam a posição descoberta de −15 e deixam um cache real
    // em `posicao_ativo` (referenciando esta movimentação) para o teardown.
    const corpo = {
      ativoId: ativo,
      tipo: "COMPRA",
      data: hojeIso(),
      quantidade: "16",
      valorUnitario: "100.00",
      valorTotal: "1600.00",
      custos: "0.00",
      observacoes: null,
    };

    const primeira = await page.request.post("/api/movimentacoes", {
      data: corpo,
      headers: { "Idempotency-Key": chave },
    });
    expect(primeira.status()).toBe(201);
    const criada = (await primeira.json()) as RespostaCriacaoApi;

    const segunda = await page.request.post("/api/movimentacoes", {
      data: corpo,
      headers: { "Idempotency-Key": chave },
    });
    expect(segunda.status()).toBe(200);
    const replay = (await segunda.json()) as RespostaCriacaoApi;

    expect(replay.movimentacao.id).toBe(criada.movimentacao.id);
    // A posição descoberta de −15 é regularizada para +1 cota.
    expect(criada.posicao.quantidade).toBe("1.00000000");
    expect(replay.posicao.quantidade).toBe(criada.posicao.quantidade);

    const depois = await listarMovimentacoes(page, { ativoId: ativo });
    expect(depois.meta.total).toBe(antes + 1);
    const ocorrencias = depois.data.filter((item) => item.id === criada.movimentacao.id);
    expect(ocorrencias).toHaveLength(1);
  });

  test("isolamento A/B: B não cancela nem lista a movimentação de A", async ({
    page,
    playwright,
  }, testInfo) => {
    const ativo = await garantirAtivo(page);
    const idDividendo = await idDaMovimentacao(page, "DIVIDENDO");

    // Controle positivo: A enxerga a própria movimentação.
    const listaA = await listarMovimentacoes(page, { ativoId: ativo });
    expect(listaA.data.some((item) => item.id === idDividendo)).toBe(true);

    const baseURL = testInfo.project.use.baseURL;
    if (baseURL === undefined) {
      throw new Error("baseURL ausente na configuração do Playwright");
    }

    const contextoB = await playwright.request.newContext({ baseURL });
    try {
      await entrarViaApi(contextoB, usuariosDisponiveis().b);

      const cancelamentoB = await contextoB.post(
        `/api/movimentacoes/${idDividendo}/cancelamento`,
        { data: { motivo: "tentativa de cancelamento do titular B" } },
      );
      expect(cancelamentoB.status()).toBe(404);
      expect(((await cancelamentoB.json()) as { error: { code: string } }).error.code).toBe(
        "MOV_NAO_ENCONTRADA",
      );

      const listaB = await contextoB.get("/api/movimentacoes", { params: { ativoId: ativo } });
      expect(listaB.status()).toBe(200);
      const corpoB = (await listaB.json()) as ListaMovimentacoesApi;
      expect(corpoB.meta.total).toBe(0);
      expect(corpoB.data).toHaveLength(0);
    } finally {
      await contextoB.dispose();
    }
  });
});
