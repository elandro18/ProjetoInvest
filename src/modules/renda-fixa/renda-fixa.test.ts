import { describe, expect, it } from "vitest";

import { AppError } from "../../lib/errors";
import { isErr, isOk } from "../../lib/result";
import { apresentarRendaFixa } from "./apresentacao";
import {
  ALERTA_VENCIMENTO_CRITICO_DIAS,
  ALERTA_VENCIMENTO_DIAS,
  calcularAlertas,
  type AlertaRendaFixa,
  type ConfiguracaoAlertasRendaFixa,
} from "./alertas";
import {
  atualizarRendaFixa,
  validarCamposImutaveis,
} from "./atualizar-renda-fixa";
import { criarRendaFixa, type CriarRendaFixaComando } from "./criar-renda-fixa";
import {
  dataIsoValida,
  dataParaIso,
  diasEntre,
  formatarDataBr,
  hojeIso,
  isoParaData,
} from "./datas";
import { listarRendaFixa, PAGE_SIZE_MAXIMO, PAGE_SIZE_PADRAO } from "./listar-renda-fixa";
import { obterAlertas } from "./obter-alertas";
import type {
  CamposAtualizacaoRendaFixa,
  FiltroRendaFixa,
  InvestimentoRendaFixaRegistro,
  NovoInvestimentoRendaFixa,
  PaginaRendaFixa,
  RendaFixaRepositorio,
} from "./repositorio";
import {
  derivarCoberturaFgc,
  normalizarTextoOpcional,
  validarCarencia,
  validarDataAplicacao,
  validarInstituicao,
  validarSaldo,
  validarTaxa,
  validarValorAplicado,
  validarVencimento,
} from "./validadores";

const AGORA = new Date("2026-11-09T12:00:00.000Z");
const HOJE = "2026-11-09";
const USUARIO_A = "usuario-a";
const USUARIO_B = "usuario-b";

function esperarErro(codigo: string, resultado: { ok: boolean; error?: AppError }): void {
  expect(resultado.ok).toBe(false);
  expect(resultado.error?.code).toBe(codigo);
}

/** Registro com defaults válidos; usado nos casos de uso e nos alertas. */
function registro(
  overrides: Partial<InvestimentoRendaFixaRegistro> = {},
): InvestimentoRendaFixaRegistro {
  return {
    id: "rf-1",
    instituicao: "Banco X",
    produto: "CDB",
    indexador: "POS_CDI",
    taxa: "12.000000",
    dataAplicacao: "2026-01-10",
    vencimento: null,
    valorAplicado: "10000.00",
    saldoAtual: "10450.00",
    statusSaldo: "INFORMADO",
    liquidez: "NO_VENCIMENTO",
    carenciaAte: null,
    coberturaFgc: true,
    observacoes: null,
    criadoEm: AGORA,
    atualizadoEm: AGORA,
    ...overrides,
  };
}

interface Armazenado extends InvestimentoRendaFixaRegistro {
  readonly usuarioId: string;
}

/**
 * Repositório em memória — espelha o contrato do port sem banco.
 * Escopo por titular, filtros, ordenação e paginação iguais ao Prisma.
 */
class RendaFixaRepositorioFake implements RendaFixaRepositorio {
  readonly itens: Armazenado[] = [];
  private sequencia = 0;

  async criar(novo: NovoInvestimentoRendaFixa): Promise<InvestimentoRendaFixaRegistro> {
    this.sequencia += 1;
    const item: Armazenado = {
      ...novo,
      id: `rf-${this.sequencia}`,
      criadoEm: AGORA,
      atualizadoEm: AGORA,
    };
    this.itens.push(item);
    return { ...item };
  }

  async listar(filtro: FiltroRendaFixa): Promise<PaginaRendaFixa> {
    const instituicao = filtro.instituicao?.toLowerCase();
    const filtrados = this.itens
      .filter((item) => item.usuarioId === filtro.usuarioId)
      .filter(
        (item) =>
          instituicao === undefined || item.instituicao.toLowerCase().includes(instituicao),
      )
      .filter((item) => filtro.produto === undefined || item.produto === filtro.produto)
      .filter(
        (item) =>
          filtro.vencimentoAte === undefined ||
          (item.vencimento !== null && item.vencimento <= filtro.vencimentoAte),
      )
      .sort((a, b) => {
        const va = a[filtro.sort] ?? "";
        const vb = b[filtro.sort] ?? "";
        const comparacao = String(va).localeCompare(String(vb));
        return filtro.order === "desc" ? -comparacao : comparacao;
      });

    const inicio = (filtro.page - 1) * filtro.pageSize;
    return {
      itens: filtrados.slice(inicio, inicio + filtro.pageSize).map((item) => ({ ...item })),
      total: filtrados.length,
    };
  }

  async buscarPorId(
    usuarioId: string,
    id: string,
  ): Promise<InvestimentoRendaFixaRegistro | null> {
    const item = this.itens.find((candidato) => candidato.id === id && candidato.usuarioId === usuarioId);
    return item === undefined ? null : { ...item };
  }

  async atualizar(
    usuarioId: string,
    id: string,
    campos: CamposAtualizacaoRendaFixa,
  ): Promise<InvestimentoRendaFixaRegistro | null> {
    const indice = this.itens.findIndex(
      (candidato) => candidato.id === id && candidato.usuarioId === usuarioId,
    );
    if (indice === -1) {
      return null;
    }

    const atual = this.itens[indice];
    const atualizado: Armazenado = { ...atual, ...campos, atualizadoEm: AGORA };
    this.itens[indice] = atualizado;
    return { ...atualizado };
  }

  async listarPorUsuario(usuarioId: string): Promise<readonly InvestimentoRendaFixaRegistro[]> {
    return this.itens
      .filter((item) => item.usuarioId === usuarioId)
      .map((item) => ({ ...item }));
  }
}

function comandoValido(
  overrides: Partial<CriarRendaFixaComando> = {},
): CriarRendaFixaComando {
  return {
    usuarioId: USUARIO_A,
    instituicao: "Banco X",
    produto: "CDB",
    indexador: "POS_CDI",
    taxa: "12.000000",
    dataAplicacao: "2026-01-10",
    vencimento: "2028-01-10",
    valorAplicado: "10000.00",
    saldoAtual: "10450.00",
    liquidez: "NO_VENCIMENTO",
    carenciaAte: null,
    observacoes: null,
    hoje: HOJE,
    ...overrides,
  };
}

describe("datas de negócio", () => {
  it("valida datas reais do calendário", () => {
    expect(dataIsoValida("2026-02-28")).toBe(true);
    expect(dataIsoValida("2026-02-30")).toBe(false);
    expect(dataIsoValida("2026-13-01")).toBe(false);
    expect(dataIsoValida("10/01/2026")).toBe(false);
  });

  it("converte entre ISO e Date sem deslocar fuso", () => {
    expect(dataParaIso(new Date("2026-01-10T00:00:00.000Z"))).toBe("2026-01-10");
    expect(isoParaData("2026-01-10").toISOString()).toBe("2026-01-10T00:00:00.000Z");
  });

  it("calcula o dia de hoje em UTC", () => {
    expect(hojeIso(new Date("2026-11-09T23:59:59.000Z"))).toBe("2026-11-09");
  });

  it("conta dias inteiros entre duas datas", () => {
    expect(diasEntre("2026-11-09", "2026-11-29")).toBe(20);
    expect(diasEntre("2026-11-09", "2026-11-09")).toBe(0);
    expect(diasEntre("2026-11-09", "2026-11-01")).toBe(-8);
  });

  it("formata data para PT-BR", () => {
    expect(formatarDataBr("2026-01-10")).toBe("10/01/2026");
  });

  it("rejeita data inválida nas conversões", () => {
    expect(() => isoParaData("2026-02-30")).toThrow("Data inválida");
    expect(() => diasEntre("2026-02-30", "2026-03-01")).toThrow(
      "Data inválida na comparação de dias.",
    );
  });
});

describe("validadores de renda fixa", () => {
  it("deriva cobertura do FGC pelo produto", () => {
    expect(derivarCoberturaFgc("CDB")).toBe(true);
    expect(derivarCoberturaFgc("LCI")).toBe(true);
    expect(derivarCoberturaFgc("LCA")).toBe(true);
    expect(derivarCoberturaFgc("TESOURO_SELIC")).toBe(false);
    expect(derivarCoberturaFgc("DEBENTURE")).toBe(false);
    expect(derivarCoberturaFgc("OUTRO")).toBe(false);
  });

  it("normaliza texto opcional", () => {
    expect(normalizarTextoOpcional("  nota  ")).toBe("nota");
    expect(normalizarTextoOpcional("   ")).toBeNull();
    expect(normalizarTextoOpcional(null)).toBeNull();
  });

  it("valida instituição entre 2 e 120 caracteres", () => {
    const ok = validarInstituicao("  Banco X  ");
    expect(isOk(ok)).toBe(true);
    if (ok.ok) {
      expect(ok.value).toBe("Banco X");
    }
    esperarErro("VALIDACAO", validarInstituicao("X"));
    esperarErro("VALIDACAO", validarInstituicao("X".repeat(121)));
  });

  it("aceita taxa entre 0 e 100 e normaliza com 6 casas", () => {
    const zero = validarTaxa("0");
    expect(zero.ok && zero.value).toBe("0.000000");

    const limite = validarTaxa("100");
    expect(limite.ok && limite.value).toBe("100.000000");

    const simples = validarTaxa("12.5");
    expect(simples.ok && simples.value).toBe("12.500000");
  });

  it("rejeita taxa negativa, acima de 100 ou não numérica", () => {
    esperarErro("RF_TAXA_INVALIDA", validarTaxa("-0.01"));
    esperarErro("RF_TAXA_INVALIDA", validarTaxa("100.01"));
    esperarErro("RF_TAXA_INVALIDA", validarTaxa("abc"));
  });

  it("valida valor aplicado positivo e com 2 casas", () => {
    const resultado = validarValorAplicado("1000");
    expect(resultado.ok && resultado.value).toBe("1000.00");

    esperarErro("VALIDACAO", validarValorAplicado("0"));
    esperarErro("VALIDACAO", validarValorAplicado("-10"));
    esperarErro("VALIDACAO", validarValorAplicado("abc"));
  });

  it("valida saldo maior ou igual a zero", () => {
    const resultado = validarSaldo("0");
    expect(resultado.ok && resultado.value).toBe("0.00");

    esperarErro("RF_SALDO_INVALIDO", validarSaldo("-0.01"));
    esperarErro("RF_SALDO_INVALIDO", validarSaldo("abc"));
  });

  it("valida data de aplicação existente e não futura", () => {
    const resultado = validarDataAplicacao("2026-01-10", HOJE);
    expect(resultado.ok && resultado.value).toBe("2026-01-10");

    esperarErro("VALIDACAO", validarDataAplicacao("2026-02-30", HOJE));
    esperarErro("VALIDACAO", validarDataAplicacao("2026-11-10", HOJE));
  });

  it("valida vencimento posterior à aplicação", () => {
    const nulo = validarVencimento(null, "2026-01-10");
    expect(nulo.ok && nulo.value).toBeNull();

    const valido = validarVencimento("2026-02-10", "2026-01-10");
    expect(valido.ok && valido.value).toBe("2026-02-10");

    esperarErro("RF_VENCIMENTO_INVALIDO", validarVencimento("2026-01-10", "2026-01-10"));
    esperarErro("VALIDACAO", validarVencimento("2026-02-30", "2026-01-10"));
  });

  it("valida carência posterior ou igual à aplicação", () => {
    const nulo = validarCarencia(null, "2026-01-10");
    expect(nulo.ok && nulo.value).toBeNull();

    const valido = validarCarencia("2026-01-10", "2026-01-10");
    expect(valido.ok && valido.value).toBe("2026-01-10");

    esperarErro("VALIDACAO", validarCarencia("2026-01-09", "2026-01-10"));
    esperarErro("VALIDACAO", validarCarencia("2026-02-30", "2026-01-10"));
  });
});

describe("criarRendaFixa", () => {
  it("cria CDB derivando cobertura do FGC e normalizando escalas", async () => {
    const repositorio = new RendaFixaRepositorioFake();
    const resultado = await criarRendaFixa(
      comandoValido({ taxa: "12.5", valorAplicado: "10000", saldoAtual: "10450.5" }),
      { repositorio },
    );

    expect(isOk(resultado)).toBe(true);
    if (resultado.ok) {
      expect(resultado.value.coberturaFgc).toBe(true);
      expect(resultado.value.taxa).toBe("12.500000");
      expect(resultado.value.valorAplicado).toBe("10000.00");
      expect(resultado.value.saldoAtual).toBe("10450.50");
      expect(resultado.value.statusSaldo).toBe("INFORMADO");
    }
  });

  it("não deriva FGC para Tesouro, Debênture e Outro", async () => {
    for (const produto of ["TESOURO_SELIC", "DEBENTURE", "OUTRO"] as const) {
      const repositorio = new RendaFixaRepositorioFake();
      const resultado = await criarRendaFixa(comandoValido({ produto }), { repositorio });
      expect(resultado.ok && resultado.value.coberturaFgc).toBe(false);
    }
  });

  it("respeita sobrescrita explícita de cobertura do FGC", async () => {
    const repositorio = new RendaFixaRepositorioFake();
    const resultado = await criarRendaFixa(
      comandoValido({ produto: "CDB", coberturaFgc: false }),
      { repositorio },
    );
    expect(resultado.ok && resultado.value.coberturaFgc).toBe(false);
  });

  it("rejeita vencimento anterior ou igual à aplicação", async () => {
    const repositorio = new RendaFixaRepositorioFake();
    const resultado = await criarRendaFixa(
      comandoValido({ vencimento: "2026-01-09" }),
      { repositorio },
    );
    esperarErro("RF_VENCIMENTO_INVALIDO", resultado);
  });

  it("rejeita taxa fora da faixa ou não numérica", async () => {
    const repositorio = new RendaFixaRepositorioFake();
    esperarErro("RF_TAXA_INVALIDA", await criarRendaFixa(comandoValido({ taxa: "120" }), { repositorio }));
    esperarErro("RF_TAXA_INVALIDA", await criarRendaFixa(comandoValido({ taxa: "abc" }), { repositorio }));
  });

  it("rejeita saldo negativo", async () => {
    const repositorio = new RendaFixaRepositorioFake();
    esperarErro(
      "RF_SALDO_INVALIDO",
      await criarRendaFixa(comandoValido({ saldoAtual: "-1" }), { repositorio }),
    );
  });

  it("rejeita data de aplicação futura ou inexistente", async () => {
    const repositorio = new RendaFixaRepositorioFake();
    esperarErro(
      "VALIDACAO",
      await criarRendaFixa(comandoValido({ dataAplicacao: "2026-11-10" }), { repositorio }),
    );
    esperarErro(
      "VALIDACAO",
      await criarRendaFixa(comandoValido({ dataAplicacao: "2026-02-30" }), { repositorio }),
    );
  });

  it("rejeita valor aplicado não positivo, carência anterior e instituição curta", async () => {
    const repositorio = new RendaFixaRepositorioFake();
    esperarErro(
      "VALIDACAO",
      await criarRendaFixa(comandoValido({ valorAplicado: "0" }), { repositorio }),
    );
    esperarErro(
      "VALIDACAO",
      await criarRendaFixa(comandoValido({ carenciaAte: "2026-01-09" }), { repositorio }),
    );
    esperarErro(
      "VALIDACAO",
      await criarRendaFixa(comandoValido({ instituicao: "X" }), { repositorio }),
    );
  });

  it("normaliza observações vazias e preserva o titular", async () => {
    const repositorio = new RendaFixaRepositorioFake();
    const resultado = await criarRendaFixa(
      comandoValido({ observacoes: "   ", statusSaldo: "ESTIMADO" }),
      { repositorio },
    );

    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.value.observacoes).toBeNull();
      expect(resultado.value.statusSaldo).toBe("ESTIMADO");
    }
    expect(repositorio.itens[0].usuarioId).toBe(USUARIO_A);
  });
});

describe("listarRendaFixa", () => {
  async function semear(repositorio: RendaFixaRepositorioFake): Promise<void> {
    await repositorio.criar({
      ...comandoValido({ instituicao: "Banco X", produto: "CDB", vencimento: "2028-01-10" }),
      statusSaldo: "INFORMADO",
      coberturaFgc: true,
      observacoes: null,
    });
    await repositorio.criar({
      ...comandoValido({
        usuarioId: USUARIO_A,
        instituicao: "Tesouro Nacional",
        produto: "TESOURO_SELIC",
        vencimento: "2027-03-01",
      }),
      statusSaldo: "INFORMADO",
      coberturaFgc: false,
      observacoes: null,
    });
    await repositorio.criar({
      ...comandoValido({ usuarioId: USUARIO_B, instituicao: "Banco Y", produto: "LCI" }),
      statusSaldo: "INFORMADO",
      coberturaFgc: true,
      observacoes: null,
    });
  }

  it("lista apenas os títulos do titular com meta de paginação", async () => {
    const repositorio = new RendaFixaRepositorioFake();
    await semear(repositorio);

    const lista = await listarRendaFixa({ usuarioId: USUARIO_A }, { repositorio });

    expect(lista.itens).toHaveLength(2);
    expect(lista.meta).toEqual({ page: 1, pageSize: PAGE_SIZE_PADRAO, total: 2, totalPages: 1 });
  });

  it("filtra por instituição, produto e vencimento máximo", async () => {
    const repositorio = new RendaFixaRepositorioFake();
    await semear(repositorio);

    const porInstituicao = await listarRendaFixa(
      { usuarioId: USUARIO_A, instituicao: "  banco x  " },
      { repositorio },
    );
    expect(porInstituicao.itens.map((item) => item.instituicao)).toEqual(["Banco X"]);

    const porProduto = await listarRendaFixa(
      { usuarioId: USUARIO_A, produto: "TESOURO_SELIC" },
      { repositorio },
    );
    expect(porProduto.itens.map((item) => item.produto)).toEqual(["TESOURO_SELIC"]);

    const porVencimento = await listarRendaFixa(
      { usuarioId: USUARIO_A, vencimentoAte: "2027-12-31" },
      { repositorio },
    );
    expect(porVencimento.itens.map((item) => item.vencimento)).toEqual(["2027-03-01"]);
  });

  it("normaliza paginação fora da faixa e ordenação explícita", async () => {
    const repositorio = new RendaFixaRepositorioFake();
    await semear(repositorio);

    const lista = await listarRendaFixa(
      {
        usuarioId: USUARIO_A,
        page: 0,
        pageSize: 1000,
        sort: "instituicao",
        order: "desc",
      },
      { repositorio },
    );

    expect(lista.meta.page).toBe(1);
    expect(lista.meta.pageSize).toBe(PAGE_SIZE_MAXIMO);
    expect(lista.itens.map((item) => item.instituicao)).toEqual([
      "Tesouro Nacional",
      "Banco X",
    ]);
  });

  it("devolve totalPages 0 quando não há itens", async () => {
    const repositorio = new RendaFixaRepositorioFake();
    const lista = await listarRendaFixa({ usuarioId: USUARIO_A }, { repositorio });

    expect(lista.itens).toEqual([]);
    expect(lista.meta.totalPages).toBe(0);
  });
});

describe("atualizarRendaFixa", () => {
  async function criar(
    repositorio: RendaFixaRepositorioFake,
    usuarioId = USUARIO_A,
  ): Promise<string> {
    const resultado = await criarRendaFixa(comandoValido({ usuarioId }), { repositorio });
    if (!resultado.ok) {
      throw new Error("falha ao semear título");
    }
    return resultado.value.id;
  }

  it.each([
    ["produto", { produto: "LCI" }],
    ["indexador", { indexador: "PRE" }],
    ["taxa", { taxa: "10" }],
    ["dataAplicacao", { dataAplicacao: "2026-01-11" }],
    ["valorAplicado", { valorAplicado: "20000.00" }],
    ["vencimento", { vencimento: "2029-01-10" }],
  ])("bloqueia %s no PATCH", (campo, corpo) => {
    const erro = validarCamposImutaveis(corpo);
    expect(erro?.code).toBe("RF_CAMPO_IMUTAVEL");
    expect(erro?.details).toEqual({ campos: [campo] });
  });

  it("aceita corpo vazio e corpo não-objeto na checagem de imutáveis", () => {
    expect(validarCamposImutaveis({})).toBeNull();
    expect(validarCamposImutaveis(null)).toBeNull();
    expect(validarCamposImutaveis("texto")).toBeNull();
  });

  it("atualiza saldo, status, liquidez, carência, FGC e observações", async () => {
    const repositorio = new RendaFixaRepositorioFake();
    const id = await criar(repositorio);

    const resultado = await atualizarRendaFixa(
      {
        usuarioId: USUARIO_A,
        id,
        saldoAtual: "10600",
        statusSaldo: "CONFIRMADO",
        liquidez: "DIARIA",
        carenciaAte: "2026-02-10",
        coberturaFgc: false,
        observacoes: "  revisado  ",
      },
      { repositorio },
    );

    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.value.saldoAtual).toBe("10600.00");
      expect(resultado.value.statusSaldo).toBe("CONFIRMADO");
      expect(resultado.value.liquidez).toBe("DIARIA");
      expect(resultado.value.carenciaAte).toBe("2026-02-10");
      expect(resultado.value.coberturaFgc).toBe(false);
      expect(resultado.value.observacoes).toBe("revisado");
    }
  });

  it("permite limpar carência e observações com null", async () => {
    const repositorio = new RendaFixaRepositorioFake();
    const id = await criar(repositorio);

    await atualizarRendaFixa(
      { usuarioId: USUARIO_A, id, carenciaAte: "2026-02-10", observacoes: "nota" },
      { repositorio },
    );
    const resultado = await atualizarRendaFixa(
      { usuarioId: USUARIO_A, id, carenciaAte: null, observacoes: null },
      { repositorio },
    );

    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.value.carenciaAte).toBeNull();
      expect(resultado.value.observacoes).toBeNull();
    }
  });

  it("aceita PATCH vazio devolvendo o título atual", async () => {
    const repositorio = new RendaFixaRepositorioFake();
    const id = await criar(repositorio);

    const resultado = await atualizarRendaFixa({ usuarioId: USUARIO_A, id }, { repositorio });

    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.value.saldoAtual).toBe("10450.00");
    }
  });

  it("rejeita saldo negativo e carência anterior à aplicação", async () => {
    const repositorio = new RendaFixaRepositorioFake();
    const id = await criar(repositorio);

    esperarErro(
      "RF_SALDO_INVALIDO",
      await atualizarRendaFixa({ usuarioId: USUARIO_A, id, saldoAtual: "-1" }, { repositorio }),
    );
    esperarErro(
      "VALIDACAO",
      await atualizarRendaFixa(
        { usuarioId: USUARIO_A, id, carenciaAte: "2026-01-09" },
        { repositorio },
      ),
    );
  });

  it("não encontra título inexistente ou de outro titular", async () => {
    const repositorio = new RendaFixaRepositorioFake();
    const id = await criar(repositorio);

    esperarErro(
      "RF_NAO_ENCONTRADA",
      await atualizarRendaFixa({ usuarioId: USUARIO_A, id: "rf-inexistente" }, { repositorio }),
    );
    esperarErro(
      "RF_NAO_ENCONTRADA",
      await atualizarRendaFixa({ usuarioId: USUARIO_B, id }, { repositorio }),
    );
  });
});

describe("isolar dados por titular", () => {
  it("não expõe título do titular A para o titular B", async () => {
    const repositorio = new RendaFixaRepositorioFake();
    const criado = await criarRendaFixa(comandoValido(), { repositorio });
    if (!criado.ok) {
      throw new Error("falha ao semear título");
    }

    expect(await repositorio.buscarPorId(USUARIO_B, criado.value.id)).toBeNull();
    expect(await repositorio.listarPorUsuario(USUARIO_B)).toEqual([]);

    const listaB = await listarRendaFixa({ usuarioId: USUARIO_B }, { repositorio });
    expect(listaB.itens).toEqual([]);
  });
});

function alerta(
  registros: readonly InvestimentoRendaFixaRegistro[],
  config: ConfiguracaoAlertasRendaFixa = {},
): readonly AlertaRendaFixa[] {
  return calcularAlertas(registros, config, HOJE);
}

describe("alertas de renda fixa", () => {
  it("não gera alerta quando não há títulos", () => {
    expect(alerta([])).toEqual([]);
  });

  it("gera VENCIMENTO_PROXIMO em 30 dias com severidade ATENCAO", () => {
    const alertas = alerta([registro({ vencimento: "2026-11-29", liquidez: "DIARIA" })]);
    const vencimento = alertas.find((item) => item.tipo === "VENCIMENTO_PROXIMO");

    expect(ALERTA_VENCIMENTO_DIAS).toBe(30);
    expect(vencimento).toEqual({
      tipo: "VENCIMENTO_PROXIMO",
      tituloFixoId: "rf-1",
      mensagem: "Vence em 20 dia(s).",
      severidade: "ATENCAO",
    });
  });

  it("marca como CRITICO o vencimento em até 7 dias, hoje ou vencido", () => {
    const critico = alerta([
      registro({ id: "sete", vencimento: "2026-11-16", liquidez: "DIARIA" }),
      registro({ id: "hoje", vencimento: "2026-11-09", liquidez: "DIARIA" }),
      registro({ id: "vencido", vencimento: "2026-11-01", liquidez: "DIARIA" }),
    ]);

    expect(ALERTA_VENCIMENTO_CRITICO_DIAS).toBe(7);
    expect(
      critico
        .filter((item) => item.tipo === "VENCIMENTO_PROXIMO")
        .map((item) => [item.tituloFixoId, item.severidade, item.mensagem]),
    ).toEqual([
      ["hoje", "CRITICO", "Vence hoje."],
      ["sete", "CRITICO", "Vence em 7 dia(s)."],
      ["vencido", "CRITICO", "Vencido há 8 dia(s)."],
    ]);
  });

  it("ignora vencimento fora da janela de 30 dias", () => {
    const alertas = alerta([
      registro({ vencimento: "2026-12-10", liquidez: "DIARIA" }),
      registro({ id: "sem-vencimento", vencimento: null, liquidez: "DIARIA" }),
    ]);
    expect(alertas).toEqual([]);
  });

  it("gera CARENCIA enquanto a data de carência não passou", () => {
    const alertas = alerta([
      registro({ carenciaAte: "2026-11-09", liquidez: "DIARIA" }),
      registro({ id: "futura", carenciaAte: "2027-01-01", liquidez: "DIARIA" }),
      registro({ id: "passada", carenciaAte: "2026-11-08", liquidez: "DIARIA" }),
    ]);

    expect(
      alertas
        .filter((item) => item.tipo === "CARENCIA")
        .map((item) => [item.tituloFixoId, item.severidade, item.mensagem]),
    ).toEqual([
      ["futura", "ATENCAO", "Em carência até 01/01/2027."],
      ["rf-1", "ATENCAO", "Em carência até 09/11/2026."],
    ]);
  });

  it("gera SEM_LIQUIDEZ quando a liquidez não é diária", () => {
    const alertas = alerta([
      registro({ liquidez: "DIARIA" }),
      registro({ id: "vencimento", liquidez: "NO_VENCIMENTO" }),
      registro({ id: "prazo", liquidez: "PRAZO" }),
    ]);

    expect(
      alertas
        .filter((item) => item.tipo === "SEM_LIQUIDEZ")
        .map((item) => [item.tituloFixoId, item.severidade]),
    ).toEqual([
      ["prazo", "INFO"],
      ["vencimento", "INFO"],
    ]);
  });

  it("não inventa concentração quando o limite não está configurado", () => {
    const alertas = alerta([
      registro({ id: "a", instituicao: "Banco X", saldoAtual: "70000.00", liquidez: "DIARIA" }),
      registro({ id: "b", instituicao: "Banco Y", saldoAtual: "30000.00", liquidez: "DIARIA" }),
    ]);

    expect(alertas.some((item) => item.tipo === "CONCENTRACAO_INSTITUICAO")).toBe(false);
  });

  it("não inventa concentração com limite inválido ou saldo total zero", () => {
    const registros = [
      registro({ id: "a", instituicao: "Banco X", saldoAtual: "0.00", liquidez: "DIARIA" }),
      registro({ id: "b", instituicao: "Banco Y", saldoAtual: "0.00", liquidez: "DIARIA" }),
    ];

    expect(
      alerta(registros, { concentracaoMaximaPercentual: "50" }).some(
        (item) => item.tipo === "CONCENTRACAO_INSTITUICAO",
      ),
    ).toBe(false);
    expect(
      alerta(
        [
          registro({ instituicao: "Banco X", saldoAtual: "70000.00", liquidez: "DIARIA" }),
          registro({
            id: "b",
            instituicao: "Banco Y",
            saldoAtual: "30000.00",
            liquidez: "DIARIA",
          }),
        ],
        { concentracaoMaximaPercentual: "abc" },
      ).some((item) => item.tipo === "CONCENTRACAO_INSTITUICAO"),
    ).toBe(false);
  });

  it("gera CONCENTRACAO_INSTITUICAO quando o limite configurado é ultrapassado", () => {
    const alertas = alerta(
      [
        registro({ id: "a", instituicao: "Banco X", saldoAtual: "70000.00", liquidez: "DIARIA" }),
        registro({ id: "b", instituicao: "Banco Y", saldoAtual: "30000.00", liquidez: "DIARIA" }),
      ],
      { concentracaoMaximaPercentual: "50" },
    );

    expect(alertas.filter((item) => item.tipo === "CONCENTRACAO_INSTITUICAO")).toEqual([
      {
        tipo: "CONCENTRACAO_INSTITUICAO",
        tituloFixoId: "a",
        mensagem: "Concentração de 70,00% do saldo em Banco X (limite 50,00%).",
        severidade: "ATENCAO",
      },
    ]);
  });

  it("não gera concentração quando o limite não é ultrapassado", () => {
    const alertas = alerta(
      [
        registro({ id: "a", instituicao: "Banco X", saldoAtual: "40000.00", liquidez: "DIARIA" }),
        registro({ id: "b", instituicao: "Banco Y", saldoAtual: "60000.00", liquidez: "DIARIA" }),
      ],
      { concentracaoMaximaPercentual: "80" },
    );

    expect(alertas.some((item) => item.tipo === "CONCENTRACAO_INSTITUICAO")).toBe(false);
  });

  it("não gera alerta de FGC quando o limite não está configurado", () => {
    const alertas = alerta([
      registro({ instituicao: "Banco X", saldoAtual: "300000.00", coberturaFgc: true }),
    ]);

    expect(alertas.some((item) => item.tipo === "LIMITE_FGC")).toBe(false);
  });

  it("gera LIMITE_FGC somando apenas os títulos cobertos na instituição", () => {
    const alertas = alerta(
      [
        registro({ id: "cdb", instituicao: "Banco X", saldoAtual: "200000.00", coberturaFgc: true }),
        registro({ id: "lci", instituicao: "Banco X", saldoAtual: "100000.00", coberturaFgc: true }),
        registro({
          id: "deb",
          instituicao: "Banco X",
          saldoAtual: "900000.00",
          produto: "DEBENTURE",
          coberturaFgc: false,
        }),
      ],
      { limiteFgc: "250000.00" },
    );

    expect(alertas.filter((item) => item.tipo === "LIMITE_FGC")).toEqual([
      {
        tipo: "LIMITE_FGC",
        tituloFixoId: "cdb",
        mensagem:
          "Saldo com FGC em Banco X (R$ 300000,00) acima do limite configurado (R$ 250000,00).",
        severidade: "ATENCAO",
      },
    ]);
  });

  it("não gera LIMITE_FGC quando a instituição não tem título coberto ou o saldo cabe no limite", () => {
    const semFgc = alerta(
      [registro({ produto: "TESOURO_SELIC", coberturaFgc: false, saldoAtual: "900000.00" })],
      { limiteFgc: "250000.00" },
    );
    expect(semFgc.some((item) => item.tipo === "LIMITE_FGC")).toBe(false);

    const dentroDoLimite = alerta(
      [registro({ coberturaFgc: true, saldoAtual: "250000.00" })],
      { limiteFgc: "250000.00" },
    );
    expect(dentroDoLimite.some((item) => item.tipo === "LIMITE_FGC")).toBe(false);

    const invalido = alerta([registro({ coberturaFgc: true, saldoAtual: "900000.00" })], {
      limiteFgc: "-1",
    });
    expect(invalido.some((item) => item.tipo === "LIMITE_FGC")).toBe(false);
  });

  it("ordena alertas por severidade, tipo e título", () => {
    const alertas = alerta(
      [
        registro({
          id: "z",
          vencimento: "2026-12-20",
          liquidez: "NO_VENCIMENTO",
          instituicao: "Banco X",
          saldoAtual: "80000.00",
        }),
        registro({
          id: "a",
          vencimento: "2026-11-10",
          liquidez: "DIARIA",
          instituicao: "Banco Y",
          saldoAtual: "20000.00",
        }),
      ],
      { concentracaoMaximaPercentual: "50" },
    );

    expect(alertas.map((item) => `${item.severidade}:${item.tipo}:${item.tituloFixoId}`)).toEqual([
      "CRITICO:VENCIMENTO_PROXIMO:a",
      "ATENCAO:CONCENTRACAO_INSTITUICAO:z",
      "INFO:SEM_LIQUIDEZ:z",
    ]);
  });

  it("obterAlertas carrega somente os títulos do titular", async () => {
    const repositorio = new RendaFixaRepositorioFake();
    await criarRendaFixa(comandoValido({ vencimento: "2026-11-29" }), { repositorio });
    await criarRendaFixa(comandoValido({ usuarioId: USUARIO_B, vencimento: "2026-11-29" }), {
      repositorio,
    });

    const alertas = await obterAlertas(
      { usuarioId: USUARIO_A, config: {}, hoje: HOJE },
      { repositorio },
    );

    expect(alertas.filter((item) => item.tipo === "VENCIMENTO_PROXIMO")).toHaveLength(1);
    expect(alertas[0].tituloFixoId).toBe("rf-1");
  });

  it("usa hoje UTC quando a data não é injetada", async () => {
    const repositorio = new RendaFixaRepositorioFake();
    await criarRendaFixa(comandoValido({ hoje: undefined, vencimento: null }), { repositorio });

    const alertas = await obterAlertas({ usuarioId: USUARIO_A, config: {} }, { repositorio });

    expect(alertas.some((item) => item.tipo === "SEM_LIQUIDEZ")).toBe(true);
  });
});

describe("apresentarRendaFixa", () => {
  it("serializa timestamps em ISO e preserva o contrato", () => {
    const api = apresentarRendaFixa(registro({ carenciaAte: "2026-03-01" }));

    expect(api).toEqual({
      id: "rf-1",
      instituicao: "Banco X",
      produto: "CDB",
      indexador: "POS_CDI",
      taxa: "12.000000",
      dataAplicacao: "2026-01-10",
      vencimento: null,
      valorAplicado: "10000.00",
      saldoAtual: "10450.00",
      statusSaldo: "INFORMADO",
      liquidez: "NO_VENCIMENTO",
      carenciaAte: "2026-03-01",
      coberturaFgc: true,
      observacoes: null,
      criadoEm: "2026-11-09T12:00:00.000Z",
      atualizadoEm: "2026-11-09T12:00:00.000Z",
    });
  });

  it("não expõe o usuário dono do título", () => {
    const api = apresentarRendaFixa(registro());

    expect(api).not.toHaveProperty("usuarioId");
    expect(api).not.toHaveProperty("usuario_id");
  });
});

describe("erros de domínio", () => {
  it("usa isErr/isOk de forma consistente", async () => {
    const repositorio = new RendaFixaRepositorioFake();

    expect(isErr(await criarRendaFixa(comandoValido({ taxa: "120" }), { repositorio }))).toBe(
      true,
    );
    expect(isOk(await criarRendaFixa(comandoValido(), { repositorio }))).toBe(true);
  });
});
