import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import type { PrismaClient } from "@prisma/client";

import {
  abrirPrisma,
  limparDadosInvestimento,
  limparLimitesConcentracao,
} from "./carteira-fixtures";
import { lerRegistro, type UsuariosE2E, type UsuarioE2E } from "./usuario-e2e";

/**
 * E2E da sugestão de aporte (RN-025-7; RN-025 a RN-027, RN-050 a RN-054).
 *
 * Cobre no navegador e no contrato:
 * - carteira com renda fixa bem abaixo da meta (FII é a maior parte): os
 *   R$ 1.000,00 vão 100% para RF, com justificativa e soma exata — e não 50/50;
 * - checklist de oito itens com os critérios sem dado como "não avaliado"
 *   (nunca "ok", RN-077) e classificação do ativo acima da meta;
 * - decisão ACEITA com observação (badge, data e observação visíveis, sugestão
 *   preservada) e, numa nova sugestão, IGNORADA;
 * - estado sem patrimônio (titular B) com os CTAs de cadastro;
 * - layout de 360 px sem overflow horizontal;
 * - isolamento A/B pela API: B tenta decidir a sugestão de A e recebe 404
 *   `APORTE_NAO_ENCONTRADO`; A decide a própria sugestão.
 *
 * Titular A: carteira criada só deste spec (FII 3.000 pelo custo + RF 100 de
 * saldo) e metas 60/40, limpas no `afterAll`. B permanece sem patrimônio — é o
 * cenário de carteira vazia. As contas e as sugestões criadas aqui saem no
 * `globalTeardown` (inclusive `sugestao_aporte`, cuja FK é RESTRICT).
 */

const TICKER_A = "APOR11";
const NOME_A = "FII Aportes E2E";
const SEGMENTO_A = "LOGISTICA";
const INSTITUICAO_A = "Banco Aportes E2E";
const CUSTO_FII = "3000.00";
const QUANTIDADE_FII = "30";
const PRECO_FII = "100.00";
const SALDO_RF = "100.00";
const VALOR_APORTE = "1000.00";
const OBSERVACAO_ACEITE = "Vou aportar metade em renda fixa e reavaliar o restante.";

interface LinhaDistribuicaoApi {
  readonly codigo: string;
  readonly valor: string;
  readonly justificativa: string;
}

interface SugestaoApi {
  readonly id: string;
  readonly data: string;
  readonly valorDisponivel: string;
  readonly distribuicaoAtual: {
    readonly classe: ReadonlyArray<{ readonly codigo: string; readonly percentual: string }>;
    readonly segmento: ReadonlyArray<{ readonly codigo: string; readonly percentual: string }>;
  };
  readonly distribuicaoSugerida: {
    readonly classe: readonly LinhaDistribuicaoApi[];
    readonly segmento: readonly LinhaDistribuicaoApi[];
  };
  readonly ativosAvaliados: ReadonlyArray<{
    readonly ativoId: string;
    readonly ticker: string;
    readonly nome: string;
    readonly classe: string;
    readonly segmento: string | null;
    readonly classificacao: string;
    readonly checklist: Readonly<Record<string, boolean | string>>;
    readonly motivos: readonly string[];
  }>;
  readonly justificativas: readonly string[];
  readonly alertas: readonly string[];
}

interface DecisaoApi {
  readonly id: string;
  readonly decisaoUsuario: string | null;
  readonly decisaoEm: string | null;
  readonly observacoes: string | null;
}

interface RespostaErroApi {
  readonly error: { readonly code: string };
}

interface MetasApi {
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

interface ReferenciaAtivosApi {
  readonly classes: ReadonlyArray<{
    readonly id: string;
    readonly codigo: string;
    readonly segmentos: ReadonlyArray<{ readonly id: string; readonly codigo: string }>;
  }>;
}

interface ListaApi {
  readonly data: ReadonlyArray<{ readonly id: string }>;
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

async function semOverflowHorizontal(page: Page): Promise<number> {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

function hojeIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function somaDasClasses(sugestao: SugestaoApi): number {
  return sugestao.distribuicaoSugerida.classe.reduce(
    (total, linha) => total + Number(linha.valor),
    0,
  );
}

/**
 * Fixa as metas de A em RF 60 / FII 40 preservando os segmentos vigentes.
 *
 * O `PUT` troca os dois escopos de uma vez; sem isso, uma carteira com FII
 * dominante também poderia receber aporte em FII dependendo das metas herdadas
 * de outro spec. Com 60/40 o gap da RF é sempre maior que o aporte.
 */
async function definirMetasA(request: APIRequestContext): Promise<void> {
  const resposta = await request.get("/api/alocacao/metas");
  expect(resposta.status()).toBe(200);
  const metas = (await resposta.json()) as MetasApi;

  const percentual = (codigo: string): number =>
    Number(metas.vigente.classe.find((meta) => meta.codigo === codigo)?.percentual ?? 0);

  // Idempotente entre testes/retentativas: não cria nova vigência se as metas
  // já estão no cenário do spec.
  if (percentual("RENDA_FIXA") === 60 && percentual("FII") === 40) {
    return;
  }

  const salva = await request.put("/api/alocacao/metas", {
    data: {
      classe: metas.vigente.classe.map((meta) => ({
        referenciaId: meta.classeId,
        percentual: meta.codigo === "RENDA_FIXA" ? "60" : "40",
      })),
      segmento: metas.vigente.segmento.map((meta) => ({
        referenciaId: meta.segmentoId,
        percentual: meta.percentual,
      })),
    },
  });
  expect(salva.status()).toBe(200);
}

/** Garante o FII de 3.000 (custo) e o título de RF de 100 (saldo) do titular A. */
async function garantirCarteiraA(request: APIRequestContext): Promise<void> {
  const referencia = await request.get("/api/referencia/ativos");
  expect(referencia.status()).toBe(200);
  const { classes } = (await referencia.json()) as ReferenciaAtivosApi;

  const fii = classes.find((classe) => classe.codigo === "FII");
  const segmento = fii?.segmentos.find((item) => item.codigo === SEGMENTO_A) ?? fii?.segmentos[0];
  if (fii === undefined || segmento === undefined) {
    throw new Error("referência de FII/Logística ausente no catálogo");
  }

  const listaAtivos = await request.get("/api/ativos", { params: { q: TICKER_A } });
  expect(listaAtivos.status()).toBe(200);
  const ativoExistente = ((await listaAtivos.json()) as ListaApi).data[0];

  let ativoId = ativoExistente?.id;
  if (ativoId === undefined) {
    const criado = await request.post("/api/ativos", {
      data: {
        ticker: TICKER_A,
        nome: NOME_A,
        classeId: fii.id,
        segmentoId: segmento.id,
      },
    });
    expect(criado.status()).toBe(201);
    ativoId = ((await criado.json()) as { id: string }).id;
  }

  const movimentacoes = await request.get("/api/movimentacoes", {
    params: { ativoId, tipo: "COMPRA", pageSize: "100" },
  });
  expect(movimentacoes.status()).toBe(200);
  const compraExistente = ((await movimentacoes.json()) as ListaApi).data[0];

  if (compraExistente === undefined) {
    const compra = await request.post("/api/movimentacoes", {
      data: {
        ativoId,
        tipo: "COMPRA",
        data: hojeIso(),
        quantidade: QUANTIDADE_FII,
        valorUnitario: PRECO_FII,
        valorTotal: CUSTO_FII,
        custos: "0.00",
        observacoes: null,
      },
    });
    expect(compra.status()).toBe(201);
  }

  const titulos = await request.get("/api/renda-fixa", {
    params: { instituicao: INSTITUICAO_A },
  });
  expect(titulos.status()).toBe(200);
  const tituloExistente = ((await titulos.json()) as ListaApi).data[0];

  if (tituloExistente === undefined) {
    const titulo = await request.post("/api/renda-fixa", {
      data: {
        instituicao: INSTITUICAO_A,
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

async function prepararCenarioA(request: APIRequestContext): Promise<void> {
  await definirMetasA(request);
  await garantirCarteiraA(request);
}

/** Gera a sugestão pelo formulário e devolve o corpo do `POST` observado. */
async function gerarPelaTela(page: Page): Promise<SugestaoApi> {
  const [resposta] = await Promise.all([
    page.waitForResponse(
      (resposta) =>
        resposta.url().endsWith("/api/aportes/sugestao") &&
        resposta.request().method() === "POST",
    ),
    page.getByRole("button", { name: "Gerar sugestão" }).click(),
  ]);
  expect(resposta.status()).toBe(201);

  return (await resposta.json()) as SugestaoApi;
}

/** Abre `/aportes`, escolhe o atalho de R$ 1.000 e gera a sugestão. */
async function abrirSugestaoDeMil(page: Page): Promise<SugestaoApi> {
  await page.goto("/aportes");
  await expect(page.getByRole("heading", { name: "Aportes", level: 1 })).toBeVisible();

  await page.getByRole("button", { name: "R$ 1.000" }).click();
  await expect(page.getByLabel("Valor disponível (R$)")).toHaveValue("1.000,00");

  const sugestao = await gerarPelaTela(page);
  await expect(
    page.getByRole("heading", { name: "Sugestão para R$ 1.000,00" }),
  ).toBeVisible();

  return sugestao;
}

function secaoClasse(page: Page) {
  return page.locator("section[aria-labelledby='aportes-distribuicao-classe-titulo']");
}

function secaoDecisao(page: Page) {
  return page.locator("section[aria-labelledby='aportes-decisao-titulo']");
}

test.describe("aportes — sugestão, checklist e decisão (titular A)", () => {
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
    // Estado determinístico: sem posições, sem limites e sem sugestões
    // herdadas de outra execução/spec.
    await limparDadosInvestimento(prisma, usuarioAId);
    await limparLimitesConcentracao(prisma, usuarioAId);
    await prisma.sugestaoAporte.deleteMany({ where: { usuarioId: usuarioAId } });
  });

  test.afterAll(async () => {
    if (prisma !== null) {
      if (usuarioAId !== null) {
        // As sugestões de A saem aqui; as de B ficam para o globalTeardown,
        // que agora apaga `sugestao_aporte` antes de `usuario` (RESTRICT).
        await prisma.sugestaoAporte
          .deleteMany({ where: { usuarioId: usuarioAId } })
          .catch(() => undefined);
        await limparDadosInvestimento(prisma, usuarioAId).catch(() => undefined);
      }
      await prisma.$disconnect().catch(() => undefined);
    }
  });

  test.beforeEach(async ({ page }) => {
    await entrar(page, usuariosDisponiveis().a);
  });

  test("RF abaixo da meta recebe 100% do aporte, com justificativa e soma exata", async ({
    page,
  }) => {
    await prepararCenarioA(page.request);

    const sugestao = await abrirSugestaoDeMil(page);

    // Contrato: FII é a maior parte da carteira, então todo o aporte é da RF.
    const porClasse = new Map(
      sugestao.distribuicaoSugerida.classe.map((linha) => [linha.codigo, linha]),
    );
    expect(porClasse.get("RENDA_FIXA")?.valor).toBe(VALOR_APORTE);
    expect(porClasse.get("FII")?.valor).toBe("0.00");
    expect(somaDasClasses(sugestao)).toBeCloseTo(Number(VALOR_APORTE), 2);
    expect(porClasse.get("RENDA_FIXA")?.justificativa).toContain("abaixo da meta");
    expect(porClasse.get("RENDA_FIXA")?.justificativa).toContain("R$ 1.000,00");

    // Tela: tabela de classes com valor, justificativa e total.
    const tabela = secaoClasse(page).locator("table");
    await expect(tabela).toBeVisible();

    const linhaRendaFixa = tabela.locator("tbody tr").filter({ hasText: "Renda Fixa" });
    await expect(linhaRendaFixa.locator("td").nth(0)).toHaveText("R$ 1.000,00");
    await expect(linhaRendaFixa.locator("td").nth(1)).toContainText("abaixo da meta");
    await expect(linhaRendaFixa.locator("td").nth(1)).toContainText("R$ 1.000,00");

    const linhaFii = tabela.locator("tbody tr").filter({ hasText: "Fundos Imobiliários" });
    await expect(linhaFii.locator("td").nth(0)).toHaveText("R$ 0,00");

    await expect(tabela.locator("tfoot")).toContainText("R$ 1.000,00");

    // Sem parcela de FII, o detalhamento por segmento não recebe valor.
    await expect(
      page.getByText("Nenhum valor foi direcionado aos segmentos neste aporte"),
    ).toBeVisible();
  });

  test("checklist mostra os itens sem dado como não avaliado e classifica o ativo", async ({
    page,
  }) => {
    await prepararCenarioA(page.request);
    await abrirSugestaoDeMil(page);

    const secaoAtivos = page.locator("section[aria-labelledby='aportes-ativos-titulo']");
    const cartao = secaoAtivos.locator("li").filter({ hasText: TICKER_A });
    await expect(cartao).toHaveCount(1);

    // FII com 96,8% da carteira contra meta de 40% → acima da meta.
    await expect(cartao.getByText("Acima da meta", { exact: true })).toBeVisible();

    // Oito verificações; quatro sem dado nesta fase (RN-050, RN-077).
    const checklist = cartao
      .locator("ul")
      .filter({ hasText: "Concentração dentro do limite" });
    await expect(checklist.locator("li")).toHaveCount(8);
    await expect(cartao.getByText("não avaliado", { exact: true })).toHaveCount(4);

    // Ausência de limite configurado é explicada, nunca lida como "ok".
    await expect(
      cartao.getByText("Sem limite de concentração configurado para esta classe"),
    ).toBeVisible();
    await expect(
      cartao.getByText("Dados de mercado ainda não são coletados nesta fase"),
    ).toBeVisible();
  });

  test("aceita com observação e depois ignora outra sugestão sem apagá-la", async ({
    page,
  }) => {
    await prepararCenarioA(page.request);
    await abrirSugestaoDeMil(page);

    await page.getByRole("button", { name: "Aceitar", exact: true }).click();
    const dialogoAceite = page.getByRole("dialog", { name: "Aceitar sugestão" });
    await expect(dialogoAceite).toBeVisible();
    await dialogoAceite.getByLabel("Observação (opcional)").fill(OBSERVACAO_ACEITE);
    await dialogoAceite.getByRole("button", { name: "Registrar aceite" }).click();
    await expect(dialogoAceite).toBeHidden();

    await expect(
      page.getByRole("status").filter({ hasText: "Decisão registrada" }),
    ).toBeVisible();

    const decisao = secaoDecisao(page);
    await expect(decisao.getByText("Aceita", { exact: true })).toBeVisible();
    await expect(decisao).toContainText("Decisão registrada em");
    await expect(decisao).toContainText(`Observação: ${OBSERVACAO_ACEITE}`);

    // A sugestão permanece na tela depois da decisão.
    await expect(
      page.getByRole("heading", { name: "Sugestão para R$ 1.000,00" }),
    ).toBeVisible();

    // Nova sugestão limpa a decisão anterior; em seguida registra IGNORADA.
    await gerarPelaTela(page);
    await expect(decisao.getByText("Aceita", { exact: true })).toHaveCount(0);

    await page.getByRole("button", { name: "Ignorar", exact: true }).click();
    const dialogoIgnorar = page.getByRole("dialog", { name: "Ignorar sugestão" });
    await expect(dialogoIgnorar).toBeVisible();
    await dialogoIgnorar.getByRole("button", { name: "Registrar que ignorei" }).click();
    await expect(dialogoIgnorar).toBeHidden();

    await expect(decisao.getByText("Ignorada", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Sugestão para R$ 1.000,00" }),
    ).toBeVisible();
  });

  test("tela em 360 px não tem overflow horizontal", async ({ page }) => {
    await prepararCenarioA(page.request);
    await page.setViewportSize({ width: 360, height: 800 });

    await abrirSugestaoDeMil(page);

    const cartaoRendaFixa = secaoClasse(page)
      .locator("ul li")
      .filter({ hasText: "Renda Fixa" });
    await expect(cartaoRendaFixa).toBeVisible();
    await expect(cartaoRendaFixa).toContainText("R$ 1.000,00");

    await expect.poll(() => semOverflowHorizontal(page)).toBeLessThanOrEqual(0);
  });
});

test.describe("aportes — estado sem patrimônio (titular B)", () => {
  test("carteira vazia mantém a sugestão e mostra os CTAs de cadastro", async ({
    page,
  }) => {
    await entrar(page, usuariosDisponiveis().b);

    const sugestao = await abrirSugestaoDeMil(page);

    // Contrato: sem patrimônio os percentuais atuais são todos 0%.
    const percentuais = [
      ...sugestao.distribuicaoAtual.classe,
      ...sugestao.distribuicaoAtual.segmento,
    ];
    expect(percentuais.length).toBeGreaterThan(0);
    expect(percentuais.every((linha) => Number(linha.percentual) === 0)).toBe(true);

    await expect(page.getByText("Sem patrimônio cadastrado")).toBeVisible();

    const cadastrarAtivo = page.getByRole("link", { name: "Cadastrar ativo" }).first();
    await expect(cadastrarAtivo).toBeVisible();
    await expect(cadastrarAtivo).toHaveAttribute("href", "/ativos/novo");

    const cadastrarRendaFixa = page.getByRole("link", { name: "Cadastrar renda fixa" });
    await expect(cadastrarRendaFixa).toBeVisible();
    await expect(cadastrarRendaFixa).toHaveAttribute("href", "/renda-fixa");

    // Nenhum ativo para estudar: o vazio também orienta o cadastro.
    await expect(page.getByText("Nenhum ativo cadastrado para avaliar")).toBeVisible();

    const tabela = secaoClasse(page).locator("table");
    await expect(tabela.locator("tfoot")).toContainText("R$ 1.000,00");
  });
});

test.describe("aportes — isolamento A/B", () => {
  test("B recebe 404 ao decidir a sugestão de A; A decide a própria", async ({
    playwright,
  }, testInfo) => {
    const usuarios = usuariosDisponiveis();
    const baseURL = testInfo.project.use.baseURL;
    if (baseURL === undefined) {
      throw new Error("baseURL ausente na configuração do Playwright");
    }

    const contextoA = await playwright.request.newContext({ baseURL });
    const contextoB = await playwright.request.newContext({ baseURL });

    try {
      await entrarViaApi(contextoA, usuarios.a);
      await entrarViaApi(contextoB, usuarios.b);

      // A cria a sugestão; qualquer carteira serve (o alvo é a autorização).
      const criada = await contextoA.post("/api/aportes/sugestao", {
        data: { valorDisponivel: VALOR_APORTE },
      });
      expect(criada.status()).toBe(201);
      const sugestao = (await criada.json()) as SugestaoApi;

      // B conhece o id, mas não é o titular: 404, nunca 403 nem alteração.
      const decisaoB = await contextoB.patch(`/api/aportes/${sugestao.id}/decisao`, {
        data: { decisao: "ACEITA", observacoes: "tentativa de B" },
      });
      expect(decisaoB.status()).toBe(404);
      expect(((await decisaoB.json()) as RespostaErroApi).error.code).toBe(
        "APORTE_NAO_ENCONTRADO",
      );

      // A vê a própria sugestão e a decisão é registrada nela.
      const decisaoA = await contextoA.patch(`/api/aportes/${sugestao.id}/decisao`, {
        data: { decisao: "IGNORADA", observacoes: "não vou aportar agora" },
      });
      expect(decisaoA.status()).toBe(200);
      const registrada = (await decisaoA.json()) as DecisaoApi;
      expect(registrada.id).toBe(sugestao.id);
      expect(registrada.decisaoUsuario).toBe("IGNORADA");
      expect(registrada.observacoes).toBe("não vou aportar agora");
      expect(registrada.decisaoEm).not.toBeNull();
    } finally {
      await contextoA.dispose();
      await contextoB.dispose();
    }
  });
});
