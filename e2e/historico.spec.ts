import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import type { PrismaClient } from "@prisma/client";

import {
  abrirPrisma,
  limparDadosInvestimento,
  limparLimitesConcentracao,
} from "./carteira-fixtures";
import { lerRegistro, type UsuariosE2E, type UsuarioE2E } from "./usuario-e2e";

/**
 * E2E do histórico de sugestões (RN-052; RN-052-3).
 *
 * Cobre no navegador e no contrato:
 * - duas sugestões geradas em `/aportes`, uma ACEITA com observação e a outra
 *   sem decisão; a lista mostra as duas com "Aceita" e "Sem decisão";
 * - filtro por decisão (`ACEITA`) reduz para uma linha e "Limpar filtros"
 *   devolve as duas;
 * - o detalhe exibe exatamente o snapshot persistido (valor, decisão,
 *   observação, distribuição por classe e ativos avaliados), sem nenhum
 *   controle de decisão — o histórico é somente leitura;
 * - a tela em 360 px não tem overflow horizontal;
 * - isolamento A/B: o histórico de B fica vazio, B não recebe nenhuma sugestão
 *   de A e o detalhe de A responde 404 para B.
 *
 * Titular A recebe só um ativo (FII) neste spec; o `beforeAll` limpa também as
 * sugestões que outros specs deixam para B, para o estado vazio ser
 * determinístico. Toda a limpeza roda no arquivo e no `globalTeardown`.
 */

const TICKER_A = "APORH11";
const NOME_A = "FII Histórico E2E";
const SEGMENTO_A = "LOGISTICA";
const VALOR_APORTE = "1000.00";
const OBSERVACAO_ACEITE = "Vou aportar em duas etapas e reavaliar o restante.";

interface SugestaoApi {
  readonly id: string;
  readonly data: string;
  readonly valorDisponivel: string;
  readonly distribuicaoAtual: {
    readonly classe: ReadonlyArray<{ readonly codigo: string; readonly percentual: string }>;
    readonly segmento: ReadonlyArray<{ readonly codigo: string; readonly percentual: string }>;
  };
  readonly distribuicaoSugerida: {
    readonly classe: ReadonlyArray<{
      readonly codigo: string;
      readonly valor: string;
      readonly justificativa: string;
    }>;
    readonly segmento: ReadonlyArray<{
      readonly codigo: string;
      readonly valor: string;
      readonly justificativa: string;
    }>;
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

interface DetalheApi extends SugestaoApi {
  readonly decisaoUsuario: string | null;
  readonly decisaoEm: string | null;
  readonly observacoes: string | null;
}

interface HistoricoApi {
  readonly data: ReadonlyArray<{ readonly id: string }>;
  readonly meta: { readonly total: number };
}

interface RespostaErroApi {
  readonly error: { readonly code: string };
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

/** Garante um FII de A para o snapshot ter um ativo avaliado. */
async function garantirAtivoA(request: APIRequestContext): Promise<void> {
  const referencia = await request.get("/api/referencia/ativos");
  expect(referencia.status()).toBe(200);
  const { classes } = (await referencia.json()) as ReferenciaAtivosApi;

  const fii = classes.find((classe) => classe.codigo === "FII");
  const segmento = fii?.segmentos.find((item) => item.codigo === SEGMENTO_A) ?? fii?.segmentos[0];
  if (fii === undefined || segmento === undefined) {
    throw new Error("referência de FII/Logística ausente no catálogo");
  }

  const lista = await request.get("/api/ativos", { params: { q: TICKER_A } });
  expect(lista.status()).toBe(200);
  if (((await lista.json()) as ListaApi).data.length > 0) {
    return;
  }

  const criado = await request.post("/api/ativos", {
    data: {
      ticker: TICKER_A,
      nome: NOME_A,
      classeId: fii.id,
      segmentoId: segmento.id,
    },
  });
  expect(criado.status()).toBe(201);
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
  await expect(page.getByRole("link", { name: "Ver histórico" })).toHaveAttribute(
    "href",
    "/aportes/historico",
  );

  // `exact` isola o atalho da sugestão do atalho do simulador, cujo nome
  // acessível ("Simular R$ 1.000") também contém o valor.
  await page.getByRole("button", { name: "R$ 1.000", exact: true }).click();
  await expect(page.getByLabel("Valor disponível (R$)")).toHaveValue("1.000,00");

  const sugestao = await gerarPelaTela(page);
  await expect(
    page.getByRole("heading", { name: "Sugestão para R$ 1.000,00" }),
  ).toBeVisible();

  return sugestao;
}

function tabelaHistorico(page: Page) {
  return page.locator("table").filter({ hasText: "Resumo por classe" });
}

function linhasHistorico(page: Page) {
  return tabelaHistorico(page).locator("tbody tr");
}

let prisma: PrismaClient | null = null;
let usuarios: UsuariosE2E | null = null;

test.beforeAll(async () => {
  const registro = lerRegistro();
  if (!registro.disponivel) {
    return;
  }

  usuarios = registro.usuarios;
  const cliente = abrirPrisma();
  prisma = cliente;

  // Estado determinístico: A sem carteira/sugestões herdadas e B sem as
  // sugestões que outros specs geram para o titular sem patrimônio.
  for (const usuario of [usuarios.a, usuarios.b]) {
    await cliente.sugestaoAporte.deleteMany({ where: { usuarioId: usuario.id } });
  }
  await limparDadosInvestimento(cliente, usuarios.a.id);
  await limparLimitesConcentracao(cliente, usuarios.a.id);
});

test.afterAll(async () => {
  const cliente = prisma;
  const contas = usuarios;
  if (cliente === null || contas === null) {
    return;
  }

  for (const usuario of [contas.a, contas.b]) {
    await cliente.sugestaoAporte
      .deleteMany({ where: { usuarioId: usuario.id } })
      .catch(() => undefined);
  }
  await limparDadosInvestimento(cliente, contas.a.id).catch(() => undefined);
  await cliente.$disconnect().catch(() => undefined);
});

test.describe("histórico — listagem, filtro e detalhe (titular A)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page }) => {
    await entrar(page, usuariosDisponiveis().a);
  });

  test("lista as sugestões com decisão, filtra e mostra o snapshot somente leitura", async ({
    page,
  }) => {
    await garantirAtivoA(page.request);

    // 1) Duas sugestões: a primeira ACEITA com observação, a segunda sem decisão.
    const sugestaoAceita = await abrirSugestaoDeMil(page);
    expect(sugestaoAceita.valorDisponivel).toBe(VALOR_APORTE);

    await page.getByRole("button", { name: "Aceitar", exact: true }).click();
    const dialogoAceite = page.getByRole("dialog", { name: "Aceitar sugestão" });
    await expect(dialogoAceite).toBeVisible();
    await dialogoAceite.getByLabel("Observação (opcional)").fill(OBSERVACAO_ACEITE);
    await dialogoAceite.getByRole("button", { name: "Registrar aceite" }).click();
    await expect(dialogoAceite).toBeHidden();
    await expect(page.getByRole("status").filter({ hasText: "Decisão registrada" })).toBeVisible();

    const sugestaoSemDecisao = await gerarPelaTela(page);
    expect(sugestaoSemDecisao.id).not.toBe(sugestaoAceita.id);

    // 2) Histórico: duas linhas, uma "Aceita" e outra "Sem decisão".
    await page.goto("/aportes/historico");
    await expect(
      page.getByRole("heading", { name: "Histórico de sugestões", level: 1 }),
    ).toBeVisible();

    const linhas = linhasHistorico(page);
    await expect(linhas).toHaveCount(2);

    const linhaAceita = linhas.filter({ hasText: "Aceita" });
    await expect(linhaAceita).toHaveCount(1);
    await expect(linhaAceita).toContainText("R$ 1.000,00");
    await expect(linhaAceita).toContainText("Renda Fixa");

    const linhaSemDecisao = linhas.filter({ hasText: "Sem decisão" });
    await expect(linhaSemDecisao).toHaveCount(1);
    await expect(linhaSemDecisao).toContainText("R$ 1.000,00");

    // 3) Filtro por decisão: só a aceita; limpar devolve as duas.
    await page.getByLabel("Decisão").selectOption("ACEITA");
    await expect(linhas).toHaveCount(1);
    await expect(linhas.first()).toContainText("Aceita");
    await expect(page.getByText("1 sugestão · Página 1 de 1")).toBeVisible();

    await page.getByRole("button", { name: "Limpar filtros" }).click();
    await expect(page.getByLabel("Decisão")).toHaveValue("");
    await expect(linhas).toHaveCount(2);

    // 4) Detalhe: snapshot persistido e nenhum controle de decisão.
    const [respostaDetalhe] = await Promise.all([
      page.waitForResponse(
        (resposta) =>
          new RegExp(`/api/aportes/${sugestaoAceita.id}$`).test(resposta.url()) &&
          resposta.request().method() === "GET",
      ),
      linhaAceita
        .getByRole("button", { name: /Ver detalhe da sugestão de/ })
        .click(),
    ]);
    expect(respostaDetalhe.status()).toBe(200);

    const detalhe = (await respostaDetalhe.json()) as DetalheApi;
    expect(detalhe.id).toBe(sugestaoAceita.id);
    expect(detalhe.data).toBe(sugestaoAceita.data);
    expect(detalhe.valorDisponivel).toBe(VALOR_APORTE);
    expect(detalhe.decisaoUsuario).toBe("ACEITA");
    expect(detalhe.decisaoEm).not.toBeNull();
    expect(detalhe.observacoes).toBe(OBSERVACAO_ACEITE);
    expect(detalhe.distribuicaoSugerida).toEqual(sugestaoAceita.distribuicaoSugerida);
    expect(detalhe.ativosAvaliados).toEqual(sugestaoAceita.ativosAvaliados);
    expect(detalhe.ativosAvaliados.map((ativo) => ativo.ticker)).toContain(TICKER_A);

    const dialogo = page.getByRole("dialog", { name: "Detalhe da sugestão" });
    await expect(dialogo).toBeVisible();
    await expect(dialogo.getByRole("heading", { name: "Sugestão de R$ 1.000,00" })).toBeVisible();
    await expect(dialogo.getByText("Somente leitura")).toBeVisible();

    const resumoDecisao = dialogo.locator("dl").first();
    await expect(resumoDecisao).toContainText("R$ 1.000,00");
    await expect(resumoDecisao).toContainText("Aceita");
    await expect(resumoDecisao).toContainText(OBSERVACAO_ACEITE);

    const distribuicao = dialogo.locator(
      "section[aria-labelledby='historico-detalhe-classe-titulo']",
    );
    await expect(distribuicao).toBeVisible();
    await expect(
      distribuicao.getByRole("heading", { name: "Distribuição por classe" }),
    ).toBeVisible();
    await expect(distribuicao.locator("tbody")).toContainText("Renda Fixa");

    const ativos = dialogo.locator(
      "section[aria-labelledby='historico-detalhe-ativos-titulo']",
    );
    await expect(ativos).toBeVisible();
    await expect(ativos).toContainText(TICKER_A);
    await expect(ativos).toContainText(NOME_A);

    // O histórico não decide: nenhuma ação de decisão no detalhe.
    await expect(dialogo.getByRole("button", { name: "Aceitar" })).toHaveCount(0);
    await expect(dialogo.getByRole("button", { name: "Ignorar" })).toHaveCount(0);
    await expect(dialogo.getByRole("button", { name: "Alterar" })).toHaveCount(0);
    await expect(dialogo.getByRole("button", { name: "Registrar aceite" })).toHaveCount(0);
    await expect(dialogo.getByRole("button", { name: "Fechar" }).last()).toBeVisible();
  });

  test("360 px mostra os cartões do histórico sem overflow horizontal", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/aportes/historico");

    await expect(
      page.getByRole("heading", { name: "Histórico de sugestões", level: 1 }),
    ).toBeVisible();

    // O `getByRole` enxerga só os cartões móveis (a tabela está display:none).
    await expect(page.getByRole("button", { name: /^Ver detalhe da sugestão de/ })).toHaveCount(
      2,
    );
    // No 360 px só o cartão existe na árvore visível; `.last()` é o cartão.
    await expect(page.getByText("Aceita", { exact: true }).last()).toBeVisible();
    await expect(page.getByText("Sem decisão", { exact: true }).last()).toBeVisible();

    await expect.poll(() => semOverflowHorizontal(page)).toBeLessThanOrEqual(0);
  });
});

test.describe("histórico — isolamento A/B", () => {
  test("B vê o histórico vazio e não acessa o detalhe de A", async ({ page, playwright }, testInfo) => {
    const contas = usuariosDisponiveis();
    const baseURL = testInfo.project.use.baseURL;
    if (baseURL === undefined) {
      throw new Error("baseURL ausente na configuração do Playwright");
    }

    // Tela de B: estado vazio, nenhuma sugestão de A na lista.
    await entrar(page, contas.b);
    await page.goto("/aportes/historico");
    await expect(
      page.getByRole("heading", { name: "Histórico de sugestões", level: 1 }),
    ).toBeVisible();
    await expect(page.getByText("Nenhuma sugestão registrada")).toBeVisible();
    await expect(linhasHistorico(page)).toHaveCount(0);

    const contextoA = await playwright.request.newContext({ baseURL });
    const contextoB = await playwright.request.newContext({ baseURL });

    try {
      await entrarViaApi(contextoA, contas.a);
      await entrarViaApi(contextoB, contas.b);

      const historicoA = await contextoA.get("/api/aportes/historico");
      expect(historicoA.status()).toBe(200);
      let listaA = (await historicoA.json()) as HistoricoApi;

      // Independente do cenário da tela: garante ao menos uma sugestão de A
      // para provar que ela não aparece para B.
      if (listaA.meta.total === 0) {
        const criada = await contextoA.post("/api/aportes/sugestao", {
          data: { valorDisponivel: VALOR_APORTE },
        });
        expect(criada.status()).toBe(201);

        const recarregado = await contextoA.get("/api/aportes/historico");
        expect(recarregado.status()).toBe(200);
        listaA = (await recarregado.json()) as HistoricoApi;
      }

      const sugestaoDeA = listaA.data[0];
      if (sugestaoDeA === undefined) {
        throw new Error("titular A deveria ter ao menos uma sugestão no histórico");
      }

      const historicoB = await contextoB.get("/api/aportes/historico");
      expect(historicoB.status()).toBe(200);
      const listaB = (await historicoB.json()) as HistoricoApi;
      expect(listaB.meta.total).toBe(0);
      expect(listaB.data).toHaveLength(0);

      // B conhece o id de A, mas recebe o 404 unificado (RN-070).
      const detalheB = await contextoB.get(`/api/aportes/${sugestaoDeA.id}`);
      expect(detalheB.status()).toBe(404);
      expect(((await detalheB.json()) as RespostaErroApi).error.code).toBe(
        "APORTE_NAO_ENCONTRADO",
      );
    } finally {
      await contextoA.dispose();
      await contextoB.dispose();
    }
  });
});
