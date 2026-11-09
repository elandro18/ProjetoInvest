import { describe, expect, it } from "vitest";

import { apresentarAtivo, apresentarAtivoDetalhe } from "./apresentacao";
import { atualizarAtivo, validarCamposImutaveis } from "./atualizar-ativo";
import { criarAtivo, type CriarAtivoComando } from "./criar-ativo";
import { listarAtivos, PAGE_SIZE_MAXIMO, PAGE_SIZE_PADRAO } from "./listar-ativos";
import { obterAtivo } from "./obter-ativo";
import {
  AtivoTickerDuplicadoError,
  type AtivoRegistro,
  type AtivoRepositorio,
  type CamposAtualizacao,
  type ClasseAtivoRef,
  type FiltroAtivos,
  type NovoAtivo,
  type PaginaAtivos,
  type SegmentoAtivoRef,
} from "./repositorio";
import { cnpjValido, normalizarOpcional, normalizarTicker, tickerValido } from "./validadores";

const AGORA = new Date("2026-11-08T12:00:00.000Z");
const USUARIO_A = "usuario-a";
const USUARIO_B = "usuario-b";

const CLASSES: readonly ClasseAtivoRef[] = [
  { id: "classe-fii", codigo: "FII", nome: "Fundos Imobiliários", ativo: true },
  { id: "classe-rf", codigo: "RENDA_FIXA", nome: "Renda Fixa", ativo: true },
  { id: "classe-inativa", codigo: "ACOES", nome: "Ações", ativo: false },
];

const SEGMENTOS: readonly SegmentoAtivoRef[] = [
  {
    id: "seg-logistica",
    classeId: "classe-fii",
    codigo: "LOGISTICA",
    nome: "Logística",
    ativo: true,
  },
  {
    id: "seg-shopping",
    classeId: "classe-fii",
    codigo: "SHOPPING",
    nome: "Shopping",
    ativo: false,
  },
];

interface AtivoArmazenado {
  usuarioId: string;
  id: string;
  ticker: string;
  nome: string;
  classeId: string;
  segmentoId: string | null;
  cnpj: string | null;
  administrador: string | null;
  gestor: string | null;
  status: AtivoRegistro["status"];
  fonteDados: string | null;
  observacoes: string | null;
  criadoEm: Date;
  atualizadoEm: Date;
}

/**
 * Repositório em memória — espelha o contrato do port sem banco.
 * Unicidade por `(usuarioId, ticker)` e escopo por titular iguais ao Prisma.
 */
class AtivoRepositorioFake implements AtivoRepositorio {
  readonly ativos: AtivoArmazenado[] = [];
  private sequencia = 0;

  constructor(
    private readonly classes: readonly ClasseAtivoRef[] = CLASSES,
    private readonly segmentos: readonly SegmentoAtivoRef[] = SEGMENTOS,
  ) {}

  async buscarClasse(classeId: string): Promise<ClasseAtivoRef | null> {
    return this.classes.find((classe) => classe.id === classeId) ?? null;
  }

  async buscarSegmento(segmentoId: string): Promise<SegmentoAtivoRef | null> {
    return this.segmentos.find((segmento) => segmento.id === segmentoId) ?? null;
  }

  async existeTicker(usuarioId: string, ticker: string, ignorarId?: string): Promise<boolean> {
    return this.ativos.some(
      (ativo) =>
        ativo.usuarioId === usuarioId && ativo.ticker === ticker && ativo.id !== ignorarId,
    );
  }

  async criar(novo: NovoAtivo): Promise<AtivoRegistro> {
    if (await this.existeTicker(novo.usuarioId, novo.ticker)) {
      throw new AtivoTickerDuplicadoError();
    }

    this.sequencia += 1;
    const armazenado: AtivoArmazenado = {
      usuarioId: novo.usuarioId,
      id: `ativo-${this.sequencia}`,
      ticker: novo.ticker,
      nome: novo.nome,
      classeId: novo.classeId,
      segmentoId: novo.segmentoId,
      cnpj: novo.cnpj,
      administrador: novo.administrador,
      gestor: novo.gestor,
      status: novo.status,
      fonteDados: novo.fonteDados,
      observacoes: novo.observacoes,
      criadoEm: AGORA,
      atualizadoEm: AGORA,
    };
    this.ativos.push(armazenado);
    return this.apresentar(armazenado);
  }

  async listar(filtro: FiltroAtivos): Promise<PaginaAtivos> {
    const texto = filtro.q?.toLowerCase();
    const filtrados = this.ativos.filter(
      (ativo) =>
        ativo.usuarioId === filtro.usuarioId &&
        (filtro.classeId === undefined || ativo.classeId === filtro.classeId) &&
        (filtro.segmentoId === undefined || ativo.segmentoId === filtro.segmentoId) &&
        (filtro.status === undefined || ativo.status === filtro.status) &&
        (texto === undefined ||
          ativo.ticker.toLowerCase().includes(texto) ||
          ativo.nome.toLowerCase().includes(texto)),
    );

    const ordenados = [...filtrados].sort((a, b) => {
      const comparacao =
        filtro.sort === "criadoEm"
          ? a.criadoEm.getTime() - b.criadoEm.getTime()
          : String(a[filtro.sort]).localeCompare(String(b[filtro.sort]));
      return filtro.order === "asc" ? comparacao : -comparacao;
    });

    const inicio = (filtro.page - 1) * filtro.pageSize;
    return {
      itens: ordenados
        .slice(inicio, inicio + filtro.pageSize)
        .map((ativo) => this.apresentar(ativo)),
      total: filtrados.length,
    };
  }

  async buscarPorId(usuarioId: string, ativoId: string): Promise<AtivoRegistro | null> {
    const encontrado = this.ativos.find(
      (ativo) => ativo.id === ativoId && ativo.usuarioId === usuarioId,
    );
    return encontrado === undefined ? null : this.apresentar(encontrado);
  }

  async atualizar(
    usuarioId: string,
    ativoId: string,
    campos: CamposAtualizacao,
  ): Promise<AtivoRegistro | null> {
    const encontrado = this.ativos.find(
      (ativo) => ativo.id === ativoId && ativo.usuarioId === usuarioId,
    );
    if (encontrado === undefined) {
      return null;
    }

    if (campos.nome !== undefined) encontrado.nome = campos.nome;
    if (campos.segmentoId !== undefined) encontrado.segmentoId = campos.segmentoId;
    if (campos.cnpj !== undefined) encontrado.cnpj = campos.cnpj;
    if (campos.administrador !== undefined) encontrado.administrador = campos.administrador;
    if (campos.gestor !== undefined) encontrado.gestor = campos.gestor;
    if (campos.status !== undefined) encontrado.status = campos.status;
    if (campos.fonteDados !== undefined) encontrado.fonteDados = campos.fonteDados;
    if (campos.observacoes !== undefined) encontrado.observacoes = campos.observacoes;
    encontrado.atualizadoEm = AGORA;

    return this.apresentar(encontrado);
  }

  private apresentar(ativo: AtivoArmazenado): AtivoRegistro {
    const classe = this.classes.find((item) => item.id === ativo.classeId);
    if (classe === undefined) {
      throw new Error(`Classe ${ativo.classeId} ausente no fake.`);
    }

    const segmento =
      ativo.segmentoId === null
        ? null
        : (this.segmentos.find((item) => item.id === ativo.segmentoId) ?? null);

    return {
      id: ativo.id,
      ticker: ativo.ticker,
      nome: ativo.nome,
      classe: { id: classe.id, codigo: classe.codigo, nome: classe.nome },
      segmento:
        segmento === null
          ? null
          : { id: segmento.id, codigo: segmento.codigo, nome: segmento.nome },
      cnpj: ativo.cnpj,
      administrador: ativo.administrador,
      gestor: ativo.gestor,
      status: ativo.status,
      fonteDados: ativo.fonteDados,
      observacoes: ativo.observacoes,
      criadoEm: ativo.criadoEm,
      atualizadoEm: ativo.atualizadoEm,
    };
  }
}

const COMANDO_FII: CriarAtivoComando = {
  usuarioId: USUARIO_A,
  ticker: " hglg11 ",
  nome: "  CSHG Logística  ",
  classeId: "classe-fii",
  segmentoId: "seg-logistica",
  cnpj: null,
  administrador: null,
  gestor: null,
  fonteDados: null,
  observacoes: null,
};

function deps(repositorio: AtivoRepositorio = new AtivoRepositorioFake()): {
  repositorio: AtivoRepositorio;
} {
  return { repositorio };
}

function esperaErro(
  resultado: { ok: true; value: unknown } | { ok: false; error: { code: string } },
  codigo: string,
): void {
  expect(resultado.ok).toBe(false);
  if (!resultado.ok) {
    expect(resultado.error.code).toBe(codigo);
  }
}

describe("validadores", () => {
  it("normaliza o ticker para maiúsculas sem espaços", () => {
    expect(normalizarTicker("  hglg11 ")).toBe("HGLG11");
    expect(normalizarTicker("knri11")).toBe("KNRI11");
  });

  it("aceita apenas ticker de 4 a 20 caracteres alfanuméricos em maiúsculas", () => {
    expect(tickerValido("HGLG11")).toBe(true);
    expect(tickerValido("ABCD")).toBe(true);
    expect(tickerValido("ABC")).toBe(false);
    expect(tickerValido("ABCDEFGHIJKLMNOPQRSTU")).toBe(false);
    expect(tickerValido("HGLG-11")).toBe(false);
    expect(tickerValido("hglg11")).toBe(false);
  });

  it("valida CNPJ pelo dígito verificador", () => {
    expect(cnpjValido("11222333000181")).toBe(true);
    // Primeiro dígito verificador 0 (resto < 2 no módulo 11).
    expect(cnpjValido("10000002375707")).toBe(true);
    expect(cnpjValido("11222333000180")).toBe(false);
    // Primeiro dígito verificador incorreto (8 esperado, 9 informado).
    expect(cnpjValido("11222333000191")).toBe(false);
    expect(cnpjValido("11111111111111")).toBe(false);
    expect(cnpjValido("11.222.333/0001-81")).toBe(false);
    expect(cnpjValido("123")).toBe(false);
  });

  it("normaliza opcional vazio para null", () => {
    expect(normalizarOpcional(null)).toBeNull();
    expect(normalizarOpcional("   ")).toBeNull();
    expect(normalizarOpcional("  gestora ")).toBe("gestora");
  });
});

describe("criarAtivo", () => {
  it("cria FII com segmento, normaliza ticker/nome e nasce ATIVO", async () => {
    const repositorio = new AtivoRepositorioFake();

    const resultado = await criarAtivo(COMANDO_FII, deps(repositorio));

    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.value).toMatchObject({
        ticker: "HGLG11",
        nome: "CSHG Logística",
        status: "ATIVO",
        classe: { codigo: "FII" },
        segmento: { codigo: "LOGISTICA" },
      });
    }
    expect(repositorio.ativos[0]).toMatchObject({
      usuarioId: USUARIO_A,
      ticker: "HGLG11",
      nome: "CSHG Logística",
      segmentoId: "seg-logistica",
    });
  });

  it("rejeita ticker fora do formato", async () => {
    const resultado = await criarAtivo({ ...COMANDO_FII, ticker: "HGLG-11" }, deps());

    esperaErro(resultado, "ATIVO_TICKER_INVALIDO");
  });

  it("rejeita CNPJ com dígito verificador inválido e aceita CNPJ válido", async () => {
    const invalido = await criarAtivo(
      { ...COMANDO_FII, cnpj: "11222333000180" },
      deps(),
    );
    esperaErro(invalido, "ATIVO_CNPJ_INVALIDO");

    const repositorio = new AtivoRepositorioFake();
    const valido = await criarAtivo(
      { ...COMANDO_FII, cnpj: "11222333000181" },
      deps(repositorio),
    );
    expect(valido.ok).toBe(true);
    expect(repositorio.ativos[0]?.cnpj).toBe("11222333000181");
  });

  it("rejeita classe inexistente ou inativa", async () => {
    const inexistente = await criarAtivo({ ...COMANDO_FII, classeId: "nao-existe" }, deps());
    esperaErro(inexistente, "ATIVO_CLASSE_INVALIDA");

    const inativa = await criarAtivo({ ...COMANDO_FII, classeId: "classe-inativa" }, deps());
    esperaErro(inativa, "ATIVO_CLASSE_INVALIDA");
  });

  it("exige segmento quando a classe é FII", async () => {
    const resultado = await criarAtivo({ ...COMANDO_FII, segmentoId: null }, deps());

    esperaErro(resultado, "ATIVO_SEGMENTO_OBRIGATORIO");
  });

  it("rejeita segmento inexistente, inativo ou de outra classe", async () => {
    const inexistente = await criarAtivo(
      { ...COMANDO_FII, segmentoId: "seg-inexistente" },
      deps(),
    );
    esperaErro(inexistente, "ATIVO_SEGMENTO_INVALIDO");

    const inativo = await criarAtivo({ ...COMANDO_FII, segmentoId: "seg-shopping" }, deps());
    esperaErro(inativo, "ATIVO_SEGMENTO_INVALIDO");

    const outraClasse = await criarAtivo(
      {
        ...COMANDO_FII,
        classeId: "classe-rf",
        segmentoId: "seg-logistica",
      },
      deps(),
    );
    esperaErro(outraClasse, "ATIVO_SEGMENTO_INVALIDO");
  });

  it("cria renda fixa quando não há segmento", async () => {
    const repositorio = new AtivoRepositorioFake();
    const resultado = await criarAtivo(
      {
        ...COMANDO_FII,
        ticker: "TESOURO2030",
        classeId: "classe-rf",
        segmentoId: null,
      },
      deps(repositorio),
    );

    expect(resultado.ok).toBe(true);
    expect(repositorio.ativos[0]?.segmentoId).toBeNull();
  });

  it("rejeita ticker duplicado para o mesmo usuário e aceita para outro", async () => {
    const repositorio = new AtivoRepositorioFake();
    await criarAtivo(COMANDO_FII, deps(repositorio));

    const duplicado = await criarAtivo({ ...COMANDO_FII, ticker: "hglg11" }, deps(repositorio));
    esperaErro(duplicado, "ATIVO_TICKER_DUPLICADO");

    const outroUsuario = await criarAtivo(
      { ...COMANDO_FII, usuarioId: USUARIO_B },
      deps(repositorio),
    );
    expect(outroUsuario.ok).toBe(true);
  });

  it("converte corrida de unicidade em ATIVO_TICKER_DUPLICADO", async () => {
    const repositorio = new AtivoRepositorioFake();
    const corrida: AtivoRepositorio = {
      ...repositorio,
      existeTicker: async () => false,
      criar: async () => {
        throw new AtivoTickerDuplicadoError();
      },
      buscarClasse: repositorio.buscarClasse.bind(repositorio),
      buscarSegmento: repositorio.buscarSegmento.bind(repositorio),
      listar: repositorio.listar.bind(repositorio),
      buscarPorId: repositorio.buscarPorId.bind(repositorio),
      atualizar: repositorio.atualizar.bind(repositorio),
    };

    const resultado = await criarAtivo(COMANDO_FII, deps(corrida));

    esperaErro(resultado, "ATIVO_TICKER_DUPLICADO");
  });

  it("propaga erro inesperado da persistência", async () => {
    const repositorio = new AtivoRepositorioFake();
    const falha: AtivoRepositorio = {
      ...repositorio,
      existeTicker: async () => false,
      criar: async () => {
        throw new Error("falha de infraestrutura");
      },
      buscarClasse: repositorio.buscarClasse.bind(repositorio),
      buscarSegmento: repositorio.buscarSegmento.bind(repositorio),
      listar: repositorio.listar.bind(repositorio),
      buscarPorId: repositorio.buscarPorId.bind(repositorio),
      atualizar: repositorio.atualizar.bind(repositorio),
    };

    await expect(criarAtivo(COMANDO_FII, deps(falha))).rejects.toThrow(
      "falha de infraestrutura",
    );
  });
});

describe("listarAtivos", () => {
  async function tresAtivos(): Promise<AtivoRepositorioFake> {
    const repositorio = new AtivoRepositorioFake();
    await criarAtivo(COMANDO_FII, deps(repositorio));
    await criarAtivo(
      { ...COMANDO_FII, ticker: "KNRI11", nome: "Kinea Renda Imobiliária" },
      deps(repositorio),
    );
    await criarAtivo(
      { ...COMANDO_FII, usuarioId: USUARIO_B, ticker: "XPML11", nome: "XP Malls" },
      deps(repositorio),
    );
    return repositorio;
  }

  it("lista apenas ativos do titular, com paginação padrão e totalPages", async () => {
    const repositorio = await tresAtivos();

    const pagina = await listarAtivos({ usuarioId: USUARIO_A }, deps(repositorio));

    expect(pagina.itens.map((ativo) => ativo.ticker)).toEqual(["HGLG11", "KNRI11"]);
    expect(pagina.meta).toEqual({
      page: 1,
      pageSize: PAGE_SIZE_PADRAO,
      total: 2,
      totalPages: 1,
    });
  });

  it("aplica busca textual e filtro de status", async () => {
    const repositorio = await tresAtivos();

    const porNome = await listarAtivos(
      { usuarioId: USUARIO_A, q: "  logística " },
      deps(repositorio),
    );
    expect(porNome.itens.map((ativo) => ativo.ticker)).toEqual(["HGLG11"]);

    const porStatus = await listarAtivos(
      { usuarioId: USUARIO_A, status: "INATIVO" },
      deps(repositorio),
    );
    expect(porStatus.itens).toHaveLength(0);
    expect(porStatus.meta.totalPages).toBe(0);
  });

  it("normaliza página e limita o pageSize ao máximo", async () => {
    const repositorio = await tresAtivos();

    const pagina = await listarAtivos(
      { usuarioId: USUARIO_A, page: 0, pageSize: 500, sort: "nome", order: "desc" },
      deps(repositorio),
    );

    expect(pagina.meta.page).toBe(1);
    expect(pagina.meta.pageSize).toBe(PAGE_SIZE_MAXIMO);
    expect(pagina.itens.map((ativo) => ativo.nome)).toEqual([
      "Kinea Renda Imobiliária",
      "CSHG Logística",
    ]);
  });

  it("pagina resultados e calcula totalPages", async () => {
    const repositorio = await tresAtivos();

    const pagina = await listarAtivos(
      { usuarioId: USUARIO_A, page: 2, pageSize: 1 },
      deps(repositorio),
    );

    expect(pagina.itens.map((ativo) => ativo.ticker)).toEqual(["KNRI11"]);
    expect(pagina.meta).toMatchObject({ page: 2, pageSize: 1, total: 2, totalPages: 2 });
  });
});

describe("obterAtivo", () => {
  it("devolve o ativo do titular", async () => {
    const repositorio = new AtivoRepositorioFake();
    await criarAtivo(COMANDO_FII, deps(repositorio));

    const resultado = await obterAtivo(
      { usuarioId: USUARIO_A, ativoId: "ativo-1" },
      deps(repositorio),
    );

    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.value.ticker).toBe("HGLG11");
    }
  });

  it("trata ativo de outro usuário como inexistente", async () => {
    const repositorio = new AtivoRepositorioFake();
    await criarAtivo(COMANDO_FII, deps(repositorio));

    const resultado = await obterAtivo(
      { usuarioId: USUARIO_B, ativoId: "ativo-1" },
      deps(repositorio),
    );

    esperaErro(resultado, "ATIVO_NAO_ENCONTRADO");
  });
});

describe("validarCamposImutaveis", () => {
  it("rejeita classeId com ATIVO_CLASSE_IMUTAVEL", () => {
    expect(validarCamposImutaveis({ classeId: "classe-rf" })?.code).toBe(
      "ATIVO_CLASSE_IMUTAVEL",
    );
  });

  it("rejeita ticker com VALIDACAO por campo", () => {
    const erro = validarCamposImutaveis({ ticker: "OUTRO11" });

    expect(erro?.code).toBe("VALIDACAO");
    expect(erro?.details).toEqual({
      errors: [{ field: "ticker", message: "O ticker não pode ser alterado." }],
    });
  });

  it("libera corpo sem campos imutáveis e corpo não-objeto", () => {
    expect(validarCamposImutaveis({ status: "INATIVO" })).toBeNull();
    expect(validarCamposImutaveis(null)).toBeNull();
    expect(validarCamposImutaveis("texto")).toBeNull();
  });
});

describe("atualizarAtivo", () => {
  async function comAtivo(): Promise<AtivoRepositorioFake> {
    const repositorio = new AtivoRepositorioFake();
    await criarAtivo(COMANDO_FII, deps(repositorio));
    return repositorio;
  }

  it("inativa via status e persiste a mudança", async () => {
    const repositorio = await comAtivo();

    const resultado = await atualizarAtivo(
      { usuarioId: USUARIO_A, ativoId: "ativo-1", status: "INATIVO" },
      deps(repositorio),
    );

    expect(resultado.ok).toBe(true);
    expect(repositorio.ativos[0]?.status).toBe("INATIVO");
  });

  it("atualiza campos editáveis e limpa opcionais com null", async () => {
    const repositorio = await comAtivo();

    const resultado = await atualizarAtivo(
      {
        usuarioId: USUARIO_A,
        ativoId: "ativo-1",
        nome: "  CSHG Logística II ",
        administrador: "  CSHG ",
        gestor: "  Gestora ",
        fonteDados: " cvm ",
        observacoes: "  revisar  ",
      },
      deps(repositorio),
    );

    expect(resultado.ok).toBe(true);
    expect(repositorio.ativos[0]).toMatchObject({
      nome: "CSHG Logística II",
      administrador: "CSHG",
      gestor: "Gestora",
      fonteDados: "cvm",
      observacoes: "revisar",
    });

    await atualizarAtivo(
      {
        usuarioId: USUARIO_A,
        ativoId: "ativo-1",
        administrador: null,
        gestor: null,
        fonteDados: null,
        observacoes: "   ",
      },
      deps(repositorio),
    );
    expect(repositorio.ativos[0]).toMatchObject({
      administrador: null,
      gestor: null,
      fonteDados: null,
      observacoes: null,
    });
  });

  it("troca o segmento de um FII por outro válido", async () => {
    const fake = new AtivoRepositorioFake(CLASSES, [
      ...SEGMENTOS,
      {
        id: "seg-lajes",
        classeId: "classe-fii",
        codigo: "LAJES",
        nome: "Lajes",
        ativo: true,
      },
    ]);
    await criarAtivo(COMANDO_FII, deps(fake));

    const resultado = await atualizarAtivo(
      { usuarioId: USUARIO_A, ativoId: "ativo-1", segmentoId: "seg-lajes" },
      deps(fake),
    );

    expect(resultado.ok).toBe(true);
    expect(fake.ativos[0]?.segmentoId).toBe("seg-lajes");
  });

  it("impede limpar o segmento de um FII", async () => {
    const repositorio = await comAtivo();

    const resultado = await atualizarAtivo(
      { usuarioId: USUARIO_A, ativoId: "ativo-1", segmentoId: null },
      deps(repositorio),
    );

    esperaErro(resultado, "ATIVO_SEGMENTO_OBRIGATORIO");
  });

  it("rejeita segmento inexistente e segmento em classe sem segmento", async () => {
    const repositorio = await comAtivo();

    const inexistente = await atualizarAtivo(
      { usuarioId: USUARIO_A, ativoId: "ativo-1", segmentoId: "seg-inexistente" },
      deps(repositorio),
    );
    esperaErro(inexistente, "ATIVO_SEGMENTO_INVALIDO");

    const rendaFixa = new AtivoRepositorioFake();
    await criarAtivo(
      { ...COMANDO_FII, ticker: "TESOURO2030", classeId: "classe-rf", segmentoId: null },
      deps(rendaFixa),
    );
    const comSegmento = await atualizarAtivo(
      { usuarioId: USUARIO_A, ativoId: "ativo-1", segmentoId: "seg-logistica" },
      deps(rendaFixa),
    );
    esperaErro(comSegmento, "ATIVO_SEGMENTO_INVALIDO");
  });

  it("rejeita CNPJ inválido e aceita válido", async () => {
    const repositorio = await comAtivo();

    const invalido = await atualizarAtivo(
      { usuarioId: USUARIO_A, ativoId: "ativo-1", cnpj: "11222333000180" },
      deps(repositorio),
    );
    esperaErro(invalido, "ATIVO_CNPJ_INVALIDO");

    const valido = await atualizarAtivo(
      { usuarioId: USUARIO_A, ativoId: "ativo-1", cnpj: "11222333000181" },
      deps(repositorio),
    );
    expect(valido.ok).toBe(true);
    expect(repositorio.ativos[0]?.cnpj).toBe("11222333000181");
  });

  it("devolve ATIVO_NAO_ENCONTRADO para ativo de outro usuário ou inexistente", async () => {
    const repositorio = await comAtivo();

    const outroUsuario = await atualizarAtivo(
      { usuarioId: USUARIO_B, ativoId: "ativo-1", status: "INATIVO" },
      deps(repositorio),
    );
    esperaErro(outroUsuario, "ATIVO_NAO_ENCONTRADO");

    const inexistente = await atualizarAtivo(
      { usuarioId: USUARIO_A, ativoId: "nao-existe", status: "INATIVO" },
      deps(repositorio),
    );
    esperaErro(inexistente, "ATIVO_NAO_ENCONTRADO");
  });

  it("trata sumiço concorrente do ativo durante a atualização", async () => {
    const repositorio = await comAtivo();
    const sumico: AtivoRepositorio = {
      ...repositorio,
      buscarClasse: repositorio.buscarClasse.bind(repositorio),
      buscarSegmento: repositorio.buscarSegmento.bind(repositorio),
      existeTicker: repositorio.existeTicker.bind(repositorio),
      criar: repositorio.criar.bind(repositorio),
      listar: repositorio.listar.bind(repositorio),
      buscarPorId: repositorio.buscarPorId.bind(repositorio),
      atualizar: async () => null,
    };

    const resultado = await atualizarAtivo(
      { usuarioId: USUARIO_A, ativoId: "ativo-1", status: "INATIVO" },
      deps(sumico),
    );

    esperaErro(resultado, "ATIVO_NAO_ENCONTRADO");
  });

  it("trata classe ausente ao validar novo segmento", async () => {
    const repositorio = await comAtivo();
    const semClasse: AtivoRepositorio = {
      ...repositorio,
      buscarClasse: async () => null,
      buscarSegmento: repositorio.buscarSegmento.bind(repositorio),
      existeTicker: repositorio.existeTicker.bind(repositorio),
      criar: repositorio.criar.bind(repositorio),
      listar: repositorio.listar.bind(repositorio),
      buscarPorId: repositorio.buscarPorId.bind(repositorio),
      atualizar: repositorio.atualizar.bind(repositorio),
    };

    const resultado = await atualizarAtivo(
      { usuarioId: USUARIO_A, ativoId: "ativo-1", segmentoId: "seg-logistica" },
      deps(semClasse),
    );

    esperaErro(resultado, "ATIVO_CLASSE_INVALIDA");
  });

  it("aceita PATCH sem campos e devolve o ativo inalterado", async () => {
    const repositorio = await comAtivo();

    const resultado = await atualizarAtivo(
      { usuarioId: USUARIO_A, ativoId: "ativo-1" },
      deps(repositorio),
    );

    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.value.ticker).toBe("HGLG11");
    }
  });
});

describe("apresentacao", () => {
  const ATIVO: AtivoRegistro = {
    id: "ativo-1",
    ticker: "HGLG11",
    nome: "CSHG Logística",
    classe: { id: "classe-fii", codigo: "FII", nome: "Fundos Imobiliários" },
    segmento: { id: "seg-logistica", codigo: "LOGISTICA", nome: "Logística" },
    cnpj: "11222333000181",
    administrador: "CSHG",
    gestor: "Gestora",
    status: "ATIVO",
    fonteDados: "cvm",
    observacoes: "nota",
    criadoEm: AGORA,
    atualizadoEm: AGORA,
  };

  it("lista apenas os campos do contrato e posicao null", () => {
    expect(apresentarAtivo(ATIVO)).toEqual({
      id: "ativo-1",
      ticker: "HGLG11",
      nome: "CSHG Logística",
      classe: { id: "classe-fii", codigo: "FII", nome: "Fundos Imobiliários" },
      segmento: { id: "seg-logistica", codigo: "LOGISTICA", nome: "Logística" },
      status: "ATIVO",
      posicao: null,
    });
  });

  it("detalhe inclui campos cadastrais, rendimentos zerados e série vazia", () => {
    const detalhe = apresentarAtivoDetalhe(ATIVO);

    expect(detalhe).toMatchObject({
      cnpj: "11222333000181",
      administrador: "CSHG",
      gestor: "Gestora",
      fonteDados: "cvm",
      observacoes: "nota",
      rendimentosAcumulados: "0.00",
      ultimosPrecos: [],
      posicao: null,
    });
    expect(detalhe.criadoEm).toBe(AGORA.toISOString());
    expect(detalhe.atualizadoEm).toBe(AGORA.toISOString());
  });

  it("detalhe de renda fixa mantém segmento nulo", () => {
    const detalhe = apresentarAtivoDetalhe({
      ...ATIVO,
      segmento: null,
      cnpj: null,
      administrador: null,
      gestor: null,
      fonteDados: null,
      observacoes: null,
    });

    expect(detalhe.segmento).toBeNull();
    expect(detalhe.cnpj).toBeNull();
  });
});
