import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import type { PrismaClient } from "@prisma/client";

import {
  abrirPrisma,
  limparDadosInvestimento,
  limparLimitesConcentracao,
} from "./carteira-fixtures";
import { lerRegistro, type UsuarioE2E } from "./usuario-e2e";

/**
 * E2E do simulador de aportes (RN-028-3; RN-028, RN-025, RN-021).
 *
 * Cobre no navegador e no contrato:
 * - cenário do critério de aceitação: metas 50/50 com carteira RF 35% /
 *   FII 65%; simular R$ 1.000 aplica 100% em RF → depois RF 40,9%
 *   (+5,9 p.p.) e FII 59,1% (−5,9 p.p.), com o sinal e o texto da variação;
 * - aviso permanente "nada é aplicado à carteira", `GET /api/carteira`
 *   idêntico antes/depois (exceto `atualizadoEm`, que é o carimbo de cada
 *   requisição) e nenhuma linha nova em `sugestao_aporte` (Prisma);
 * - valor 0 → erro de campo sem `POST /api/aportes/simulacao`;
 * - titular B sem patrimônio: a simulação parte das metas (antes 0%, depois
 *   50/50) e a carteira continua vazia;
 * - layout de 360 px sem overflow horizontal.
 *
 * Titular A: carteira criada só deste spec (FII 6.500 pelo custo + RF 3.500
 * de saldo) e metas 50/50, limpas no `afterAll`. B fica sem patrimônio e sem
 * metas próprias — é o cenário de defaults lazy (RN-021). As contas saem no
 * `globalTeardown`.
 */

const TICKER_A = "SIM11";
const NOME_A = "FII Simulador E2E";
const SEGMENTO_A = "LOGISTICA";
const INSTITUICAO_A = "Banco Simulador E2E";
const QUANTIDADE_FII = "65";
const PRECO_FII = "100.00";
const CUSTO_FII = "6500.00";
const SALDO_RF = "3500.00";
const PATRIMONIO_A = "10000.00";

const TEXTO_AVISO_CARTEIRA = "Simulação — nada é aplicado à carteira";
const TEXTO_ERRO_ZERO = "O valor a simular deve ser maior que zero.";

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

interface CarteiraApi {
  readonly resumo: {
    readonly patrimonioTotal: string;
    readonly rendaFixa: string;
    readonly fiis: string;
    readonly percentualRendaFixa: string;
    readonly percentualFiis: string;
  };
  readonly porClasse: ReadonlyArray<{ readonly codigo: string; readonly valor: string }>;
  readonly porSegmento: ReadonlyArray<{ readonly codigo: string; readonly valor: string }>;
  readonly posicoes: readonly { readonly ativoId: string; readonly valorAtual: string }[];
  readonly consistente: boolean;
  readonly atualizadoEm: string;
  readonly cotacoes: { readonly statusDado: string; readonly dataReferencia: string | null };
}

function usuariosDisponiveis() {
  const registro = lerRegistro();
  test.skip(!registro.disponivel, registro.disponivel ? "" : `usuários E2E indisponíveis: ${registro.motivo}`);
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

async function semOverflowHorizontal(page: Page): Promise<number> {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

function hojeIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Corpo da carteira sem o carimbo de requisição (`atualizadoEm`). */
function carteiraComparavel(carteira: CarteiraApi): string {
  return JSON.stringify({ ...carteira, atualizadoEm: "" });
}

/**
 * Fixa as metas de A em RF 50 / FII 50 preservando os segmentos vigentes.
 *
 * O `GET` materializa os defaults lazy (RN-021) quando necessário; o `PUT`
 * troca os dois escopos de uma vez. A simulação usa essas metas: com a
 * carteira em 35/65 o gap da RF absorve todo o aporte hipotético.
 */
async function definirMetasA(request: APIRequestContext): Promise<void> {
  const resposta = await request.get("/api/alocacao/metas");
  expect(resposta.status()).toBe(200);
  const metas = (await resposta.json()) as MetasApi;

  const percentual = (codigo: string): number =>
    Number(metas.vigente.classe.find((meta) => meta.codigo === codigo)?.percentual ?? 0);

  if (percentual("RENDA_FIXA") === 50 && percentual("FII") === 50) {
    return;
  }

  const salva = await request.put("/api/alocacao/metas", {
    data: {
      classe: metas.vigente.classe.map((meta) => ({
        referenciaId: meta.classeId,
        percentual: "50",
      })),
      segmento: metas.vigente.segmento.map((meta) => ({
        referenciaId: meta.segmentoId,
        percentual: meta.percentual,
      })),
    },
  });
  expect(salva.status()).toBe(200);
}

/** Garante o FII de 6.500 (custo) e o título de RF de 3.500 (saldo) do titular A. */
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

function secaoSimulador(page: Page) {
  return page.locator("section[aria-labelledby='aportes-simulador-titulo']");
}

function secaoClasse(page: Page) {
  return page.locator("section[aria-labelledby='aportes-simulador-classe-titulo']");
}

async function simularMil(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Simular R$ 1.000" }).click();
  await expect(page.getByLabel("Valor a simular (R$)")).toHaveValue("1.000,00");

  await page.getByRole("button", { name: "Simular", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Simulação para R$ 1.000,00" }),
  ).toBeVisible();
}

test.describe("simulador de aportes (RN-028)", () => {
  test.describe.configure({ mode: "serial" });

  let prisma: PrismaClient | null = null;
  let usuarioAId: string | null = null;
  let usuarioBId: string | null = null;

  test.beforeAll(async () => {
    const registro = lerRegistro();
    if (!registro.disponivel) {
      return;
    }

    prisma = abrirPrisma();
    usuarioAId = registro.usuarios.a.id;
    usuarioBId = registro.usuarios.b.id;

    // Estado determinístico: A recomeça sem posições nem sugestões herdadas;
    // B fica sem patrimônio e sem metas próprias (defaults lazy 50/50).
    await limparDadosInvestimento(prisma, usuarioAId);
    await limparLimitesConcentracao(prisma, usuarioAId);
    await prisma.sugestaoAporte.deleteMany({ where: { usuarioId: usuarioAId } });

    await limparDadosInvestimento(prisma, usuarioBId);
    await prisma.sugestaoAporte.deleteMany({ where: { usuarioId: usuarioBId } });
    await prisma.alocacaoMeta.deleteMany({ where: { usuarioId: usuarioBId } });
  });

  test.afterAll(async () => {
    if (prisma !== null) {
      if (usuarioAId !== null) {
        await limparDadosInvestimento(prisma, usuarioAId).catch(() => undefined);
        await prisma.sugestaoAporte
          .deleteMany({ where: { usuarioId: usuarioAId } })
          .catch(() => undefined);
      }
      if (usuarioBId !== null) {
        await limparDadosInvestimento(prisma, usuarioBId).catch(() => undefined);
        await prisma.sugestaoAporte
          .deleteMany({ where: { usuarioId: usuarioBId } })
          .catch(() => undefined);
      }
      await prisma.$disconnect().catch(() => undefined);
    }
  });

  test("metas 50/50 e carteira 35/65: R$ 1.000 aplicam 100% em RF (+5,9 p.p.) sem persistir nada", async ({
    page,
  }) => {
    await entrar(page, usuariosDisponiveis().a);
    await prepararCenarioA(page.request);

    // Sanidade do cenário: a carteira tem exatamente 35% em RF e 65% em FII.
    const carteiraAntes = await page.request.get("/api/carteira");
    expect(carteiraAntes.status()).toBe(200);
    const antes = (await carteiraAntes.json()) as CarteiraApi;
    expect(antes.resumo.patrimonioTotal).toBe(PATRIMONIO_A);
    expect(Number(antes.resumo.percentualRendaFixa)).toBeCloseTo(35, 6);
    expect(Number(antes.resumo.percentualFiis)).toBeCloseTo(65, 6);

    const sugestoesAntes = await prisma!.sugestaoAporte.count({
      where: { usuarioId: usuarioAId! },
    });

    await page.goto("/aportes");
    await expect(page.getByRole("heading", { name: "Aportes", level: 1 })).toBeVisible();

    // Aviso permanente: a simulação nunca toca na carteira.
    const simulador = secaoSimulador(page);
    await expect(simulador.getByText(TEXTO_AVISO_CARTEIRA)).toBeVisible();

    await simularMil(page);

    // Patrimônio: a soma do depois é o patrimônio atual + o aporte.
    await expect(
      simulador.getByText(
        `Patrimônio de R$ 10.000,00 para R$ 11.000,00 (+R$ 1.000,00).`,
      ),
    ).toBeVisible();

    // RF: 35,0% → 40,9% (+5,9 p.p.), com sinal e texto — a cor não é o único portador.
    const linhaRendaFixa = secaoClasse(page)
      .locator("li")
      .filter({ hasText: "Renda Fixa" });
    await expect(linhaRendaFixa).toHaveCount(1);
    await expect(linhaRendaFixa).toContainText("35,0%");
    await expect(linhaRendaFixa).toContainText("40,9%");
    await expect(linhaRendaFixa).toContainText("R$ 3.500,00");
    await expect(linhaRendaFixa).toContainText("R$ 4.500,00");
    await expect(linhaRendaFixa.getByText("+5,9 p.p.", { exact: true })).toBeVisible();
    await expect(linhaRendaFixa.getByText("aumento de 5,9 p.p.", { exact: true })).toBeVisible();

    // FII: 65,0% → 59,1% (−5,9 p.p.): o valor não muda, a participação cai.
    const linhaFii = secaoClasse(page)
      .locator("li")
      .filter({ hasText: "Fundos Imobiliários" });
    await expect(linhaFii).toHaveCount(1);
    await expect(linhaFii).toContainText("65,0%");
    await expect(linhaFii).toContainText("59,1%");
    await expect(linhaFii).toContainText("R$ 6.500,00");
    await expect(linhaFii.getByText("−5,9 p.p.", { exact: true })).toBeVisible();
    await expect(linhaFii.getByText("redução de 5,9 p.p.", { exact: true })).toBeVisible();

    // A carteira continua idêntica: só o carimbo de requisição muda.
    const carteiraDepois = await page.request.get("/api/carteira");
    expect(carteiraDepois.status()).toBe(200);
    const depois = (await carteiraDepois.json()) as CarteiraApi;
    expect(carteiraComparavel(depois)).toBe(carteiraComparavel(antes));
    expect(depois.resumo.patrimonioTotal).toBe(PATRIMONIO_A);

    // E nenhuma sugestão de aporte foi criada pela simulação.
    const sugestoesDepois = await prisma!.sugestaoAporte.count({
      where: { usuarioId: usuarioAId! },
    });
    expect(sugestoesDepois).toBe(sugestoesAntes);
  });

  test("valor 0 mostra erro de campo sem chamar a API de simulação", async ({ page }) => {
    await entrar(page, usuariosDisponiveis().a);

    const chamadas: string[] = [];
    page.on("request", (requisicao) => {
      if (requisicao.url().includes("/api/aportes/simulacao")) {
        chamadas.push(requisicao.url());
      }
    });

    await page.goto("/aportes");
    await expect(page.getByRole("heading", { name: "Aportes", level: 1 })).toBeVisible();

    const campo = page.getByLabel("Valor a simular (R$)");
    await campo.fill("0,00");
    await page.getByRole("button", { name: "Simular", exact: true }).click();

    await expect(page.getByText(TEXTO_ERRO_ZERO)).toBeVisible();
    await expect(campo).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByRole("heading", { name: /^Simulação para/ })).toHaveCount(0);
    expect(chamadas).toEqual([]);
  });

  test("titular B sem patrimônio simula a partir das metas e a carteira continua vazia", async ({
    page,
  }) => {
    await entrar(page, usuariosDisponiveis().b);

    await page.goto("/aportes");
    await expect(page.getByRole("heading", { name: "Aportes", level: 1 })).toBeVisible();

    await simularMil(page);

    const simulador = secaoSimulador(page);
    // Antes sem patrimônio → depois exatamente o valor simulado.
    await expect(
      simulador.getByText(
        `Patrimônio de R$ 0,00 para R$ 1.000,00 (+R$ 1.000,00).`,
      ),
    ).toBeVisible();
    await expect(
      simulador.getByText("Carteira vazia — simulação a partir das metas"),
    ).toBeVisible();

    // Defaults lazy 50/50 (RN-021): o aporte hipotético vai metade para cada classe.
    const linhaRendaFixa = secaoClasse(page)
      .locator("li")
      .filter({ hasText: "Renda Fixa" });
    await expect(linhaRendaFixa).toHaveCount(1);
    await expect(linhaRendaFixa).toContainText("0,0%");
    await expect(linhaRendaFixa).toContainText("R$ 500,00");
    await expect(linhaRendaFixa).toContainText("50,0%");
    await expect(linhaRendaFixa.getByText("+50,0 p.p.", { exact: true })).toBeVisible();

    const linhaFii = secaoClasse(page)
      .locator("li")
      .filter({ hasText: "Fundos Imobiliários" });
    await expect(linhaFii).toHaveCount(1);
    await expect(linhaFii).toContainText("R$ 500,00");
    await expect(linhaFii).toContainText("50,0%");

    // Nada foi aplicado: a carteira do titular B continua zerada.
    const carteira = await page.request.get("/api/carteira");
    expect(carteira.status()).toBe(200);
    const resposta = (await carteira.json()) as CarteiraApi;
    expect(resposta.resumo.patrimonioTotal).toBe("0.00");
    expect(Number(resposta.resumo.percentualRendaFixa)).toBe(0);
    expect(Number(resposta.resumo.percentualFiis)).toBe(0);
  });

  test("simulador em 360 px não tem overflow horizontal", async ({ page }) => {
    await entrar(page, usuariosDisponiveis().a);
    await prepararCenarioA(page.request);
    await page.setViewportSize({ width: 360, height: 800 });

    await page.goto("/aportes");
    await expect(page.getByRole("heading", { name: "Aportes", level: 1 })).toBeVisible();
    await simularMil(page);

    const linhaRendaFixa = secaoClasse(page)
      .locator("li")
      .filter({ hasText: "Renda Fixa" });
    await expect(linhaRendaFixa).toBeVisible();
    await expect(linhaRendaFixa).toContainText("40,9%");

    await expect.poll(() => semOverflowHorizontal(page)).toBeLessThanOrEqual(0);
  });
});
