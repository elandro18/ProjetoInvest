import { describe, expect, it } from "vitest";

import { Decimal } from "../../lib/decimal";
import type { Result } from "../../lib/result";
import { aplicarMovimentacao, posicaoVazia } from "./aplicar-movimentacao";
import {
  calcularBaixaVenda,
  calcularPrecoMedio,
  custoMedio,
} from "./baixa";
import {
  ordenarMovimentacoes,
  reconstruirPosicao,
} from "./reconstruir-posicao";
import type {
  MovimentacaoParaPosicao,
  Posicao,
  TipoMovimentacao,
} from "./tipos";
import {
  TOLERANCIA_VALOR_TOTAL,
  validarValorTotal,
  validarVenda,
} from "./validacoes";

/**
 * Casos de ouro G1–G7 e G14 (`quality/TEST_STRATEGY.md` §5) e regras
 * complementares de ordenação, cancelamento, erro e reconstrução.
 *
 * Tudo roda sem banco: o domínio é puro e recebe a lista de movimentações.
 */

function mov(
  overrides: Partial<MovimentacaoParaPosicao> = {},
): MovimentacaoParaPosicao {
  return {
    id: "mov-1",
    tipo: "COMPRA",
    data: "2026-01-10",
    criadoEm: new Date("2026-01-10T12:00:00.000Z"),
    quantidade: null,
    valorUnitario: null,
    valorTotal: "0.01",
    custos: "0.00",
    canceladaEm: null,
    ...overrides,
  };
}

function compra(
  id: string,
  data: string,
  quantidade: string,
  valorUnitario: string,
  extras: Partial<MovimentacaoParaPosicao> = {},
): MovimentacaoParaPosicao {
  return mov({
    id,
    tipo: "COMPRA",
    data,
    quantidade,
    valorUnitario,
    valorTotal: Decimal.from(quantidade).mul(valorUnitario).toFixed(2),
    ...extras,
  });
}

function venda(
  id: string,
  data: string,
  quantidade: string,
  valorUnitario: string,
  extras: Partial<MovimentacaoParaPosicao> = {},
): MovimentacaoParaPosicao {
  return mov({
    id,
    tipo: "VENDA",
    data,
    quantidade,
    valorUnitario,
    valorTotal: Decimal.from(quantidade).mul(valorUnitario).toFixed(2),
    ...extras,
  });
}

function rendimento(
  id: string,
  data: string,
  tipo: Extract<TipoMovimentacao, "DIVIDENDO" | "JUROS" | "TAXA">,
  valor: string,
): MovimentacaoParaPosicao {
  return mov({ id, tipo, data, valorTotal: valor });
}

function sucesso<T, E>(result: Result<T, E>): T {
  if (!result.ok) {
    throw new Error(`esperado sucesso, recebido ${JSON.stringify(result.error)}`);
  }
  return result.value;
}

function posicaoDe(movimentacoes: readonly MovimentacaoParaPosicao[]): Posicao {
  return sucesso(reconstruirPosicao(movimentacoes));
}

function esperarQuantidade(posicao: Posicao, quantidade: string): void {
  expect(posicao.quantidade.toFixed(8)).toBe(quantidade);
}

function esperarDinheiro(posicao: Posicao, custoTotal: string, precoMedio: string): void {
  expect(posicao.custoTotal.toFixed(2)).toBe(custoTotal);
  expect(posicao.precoMedio.toFixed(2)).toBe(precoMedio);
}

describe("casos de ouro G1–G7", () => {
  it("G1 — preço médio com duas compras", () => {
    const posicao = posicaoDe([
      compra("c1", "2026-01-10", "10", "100.00"),
      compra("c2", "2026-01-11", "10", "120.00"),
    ]);

    esperarQuantidade(posicao, "20.00000000");
    esperarDinheiro(posicao, "2200.00", "110.00");
  });

  it("G2 — venda mantém o preço médio e apura resultado realizado", () => {
    const compras = [
      compra("c1", "2026-01-10", "10", "100.00"),
      compra("c2", "2026-01-11", "10", "120.00"),
    ];
    const vendaDe5 = venda("v1", "2026-01-12", "5", "130.00");

    const posicao = posicaoDe([...compras, vendaDe5]);

    esperarQuantidade(posicao, "15.00000000");
    esperarDinheiro(posicao, "1650.00", "110.00");

    const baixa = sucesso(calcularBaixaVenda(posicaoDe(compras), vendaDe5));
    expect(baixa.custoBaixado.toFixed(2)).toBe("550.00");
    expect(baixa.resultadoRealizado.toFixed(2)).toBe("100.00");
  });

  it("G3 — nova compra após venda recalcula sobre as 20 cotas", () => {
    const posicao = posicaoDe([
      compra("c1", "2026-01-10", "10", "100.00"),
      compra("c2", "2026-01-11", "10", "120.00"),
      venda("v1", "2026-01-12", "5", "130.00"),
      compra("c3", "2026-01-13", "5", "100.00"),
    ]);

    esperarQuantidade(posicao, "20.00000000");
    esperarDinheiro(posicao, "2150.00", "107.50");
  });

  it("G4 — vender tudo zera quantidade, custo e preço médio", () => {
    const posicao = posicaoDe([
      compra("c1", "2026-01-10", "10", "100.00"),
      venda("v1", "2026-01-11", "10", "120.00"),
    ]);

    esperarQuantidade(posicao, "0.00000000");
    esperarDinheiro(posicao, "0.00", "0.00");
  });

  it("G5 — venda acima da posição retorna MOV_POSICAO_NEGATIVA com detalhes", () => {
    const posicao10 = posicaoDe([compra("c1", "2026-01-10", "10", "100.00")]);

    const validacao = validarVenda(posicao10, "15");
    expect(validacao.ok).toBe(false);
    if (!validacao.ok) {
      expect(validacao.error.codigo).toBe("MOV_POSICAO_NEGATIVA");
      expect(validacao.error.detalhes).toEqual({
        quantidadeAtual: "10.00000000",
        quantidadeSolicitada: "15.00000000",
        quantidadeResultante: "-5.00000000",
      });
    }

    const reconstrucao = reconstruirPosicao([
      compra("c1", "2026-01-10", "10", "100.00"),
      venda("v1", "2026-01-11", "15", "120.00"),
    ]);
    expect(reconstrucao.ok).toBe(false);
    if (!reconstrucao.ok) {
      expect(reconstrucao.error.codigo).toBe("MOV_POSICAO_NEGATIVA");
    }
  });

  it("bloqueia venda em posição zerada (preço médio zero)", () => {
    const resultado = aplicarMovimentacao(
      posicaoVazia(),
      venda("v1", "2026-01-11", "1", "100.00"),
    );

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.error.codigo).toBe("MOV_POSICAO_NEGATIVA");
      expect(resultado.error.detalhes.quantidadeAtual).toBe("0.00000000");
    }
  });

  it("G6 — total inconsistente exige observação e respeita a tolerância de R$ 0,01", () => {
    const base = { quantidade: "10", valorUnitario: "100.00", custos: "3.00" };

    const consistente = sucesso(
      validarValorTotal({ ...base, valorTotal: "1003.00" }),
    );
    expect(consistente.valorTotalCalculado.toFixed(2)).toBe("1003.00");
    expect(consistente.diferenca.toFixed(2)).toBe("0.00");

    const naTolerancia = sucesso(
      validarValorTotal({ ...base, valorTotal: "1003.01" }),
    );
    expect(naTolerancia.diferenca.toFixed(2)).toBe("0.01");

    const acimaDaTolerancia = validarValorTotal({
      ...base,
      valorTotal: "1003.02",
    });
    expect(acimaDaTolerancia.ok).toBe(false);
    if (!acimaDaTolerancia.ok) {
      expect(acimaDaTolerancia.error.codigo).toBe("MOV_VALOR_INCONSISTENTE");
      expect(acimaDaTolerancia.error.detalhes.diferenca).toBe("0.02");
    }

    const inconsistente = validarValorTotal({ ...base, valorTotal: "1005.00" });
    expect(inconsistente.ok).toBe(false);
    if (!inconsistente.ok) {
      expect(inconsistente.error.codigo).toBe("MOV_VALOR_INCONSISTENTE");
      expect(inconsistente.error.detalhes).toEqual({
        valorTotalInformado: "1005.00",
        valorTotalCalculado: "1003.00",
        diferenca: "2.00",
      });
    }

    expect(TOLERANCIA_VALOR_TOTAL.toFixed(2)).toBe("0.01");
  });

  it("G7 — dividendos não afetam preço médio e são registrados à parte", () => {
    const posicao = posicaoDe([
      compra("c1", "2026-01-10", "10", "100.00"),
      rendimento("d1", "2026-01-11", "DIVIDENDO", "50.00"),
    ]);

    esperarQuantidade(posicao, "10.00000000");
    esperarDinheiro(posicao, "1000.00", "100.00");
  });

  it("G14 — arredondamento monetário decimal exato", () => {
    expect(Decimal.from("0.1").add("0.2").toFixed(2)).toBe("0.30");

    const posicao = posicaoDe([
      compra("c1", "2026-01-10", "1", "0.10"),
      compra("c2", "2026-01-11", "1", "0.20"),
    ]);

    expect(posicao.custoTotal.toFixed(2)).toBe("0.30");
  });
});

describe("rendimentos e tipos sem efeito na posição", () => {
  it.each(["DIVIDENDO", "JUROS", "TAXA"] as const)(
    "%s não altera a posição",
    (tipo) => {
      const posicao = posicaoDe([
        compra("c1", "2026-01-10", "10", "100.00"),
        rendimento("r1", "2026-01-11", tipo, "25.00"),
      ]);

      esperarQuantidade(posicao, "10.00000000");
      esperarDinheiro(posicao, "1000.00", "100.00");
    },
  );

  it.each(["APLICACAO_RF", "RESGATE_RF"] as const)(
    "%s não altera a posição de renda variável",
    (tipo) => {
      const posicao = posicaoDe([
        compra("c1", "2026-01-10", "10", "100.00"),
        mov({ id: "rf1", tipo, data: "2026-01-11", valorTotal: "500.00" }),
      ]);

      esperarQuantidade(posicao, "10.00000000");
      esperarDinheiro(posicao, "1000.00", "100.00");
    },
  );
});

describe("ordenação e cancelamento", () => {
  it("ordena por data e, no mesmo dia, por criadoEm", () => {
    const compraCem = compra("a", "2026-01-10", "10", "100.00");
    const vendaDez = venda("b", "2026-01-15", "10", "120.00", {
      criadoEm: new Date("2026-01-15T09:00:00.000Z"),
    });
    const compraDuzentos = compra("c", "2026-01-15", "10", "200.00", {
      criadoEm: new Date("2026-01-15T10:00:00.000Z"),
    });

    // Entrada fora de ordem: venda e compra do mesmo dia invertidas.
    const posicao = posicaoDe([compraDuzentos, vendaDez, compraCem]);

    esperarQuantidade(posicao, "10.00000000");
    esperarDinheiro(posicao, "2000.00", "200.00");
  });

  it("mantém a ordem de entrada quando data e criadoEm empatam", () => {
    const primeiro = compra("a", "2026-01-10", "1", "100.00");
    const segundo = compra("b", "2026-01-10", "1", "200.00");

    const ordenadas = ordenarMovimentacoes([segundo, primeiro]);
    expect(ordenadas.map((item) => item.id)).toEqual(["b", "a"]);
  });

  it("ignora movimentações canceladas na reconstrução", () => {
    const posicao = posicaoDe([
      compra("c1", "2026-01-10", "10", "100.00"),
      compra("c2", "2026-01-11", "5", "200.00", {
        canceladaEm: new Date("2026-01-12T10:00:00.000Z"),
      }),
      venda("v1", "2026-01-13", "2", "150.00", {
        canceladaEm: new Date("2026-01-14T10:00:00.000Z"),
      }),
    ]);

    esperarQuantidade(posicao, "10.00000000");
    esperarDinheiro(posicao, "1000.00", "100.00");
  });
});

describe("reconstrução incremental x completa", () => {
  it("aplica em sequência com o mesmo resultado da reconstrução completa", () => {
    const movimentacoes = [
      compra("c1", "2026-01-10", "10", "100.00"),
      compra("c2", "2026-01-11", "5", "120.00"),
      venda("v1", "2026-01-12", "4", "130.00"),
      compra("c3", "2026-01-13", "2", "90.00"),
      venda("v2", "2026-01-14", "3", "95.00"),
    ];

    let incremental = posicaoVazia();
    for (const item of movimentacoes) {
      incremental = sucesso(aplicarMovimentacao(incremental, item));
    }

    const completa = posicaoDe(movimentacoes);

    expect(incremental.quantidade.toString()).toBe(completa.quantidade.toString());
    expect(incremental.custoTotal.toString()).toBe(completa.custoTotal.toString());
    expect(incremental.precoMedio.toString()).toBe(completa.precoMedio.toString());
  });

  it("posição vazia usa as escalas do contrato", () => {
    const vazia = posicaoVazia();

    expect(vazia.quantidade.toFixed(8)).toBe("0.00000000");
    expect(vazia.custoTotal.toFixed(2)).toBe("0.00");
    expect(vazia.precoMedio.toFixed(6)).toBe("0.000000");
  });
});

describe("validações de entrada do domínio", () => {
  it("compra sem quantidade retorna MOV_QTD_OBRIGATORIA", () => {
    const resultado = aplicarMovimentacao(
      posicaoVazia(),
      mov({ tipo: "COMPRA", valorTotal: "100.00" }),
    );

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.error.codigo).toBe("MOV_QTD_OBRIGATORIA");
      expect(resultado.error.detalhes.tipo).toBe("COMPRA");
    }
  });

  it("compra com quantidade zero retorna MOV_QTD_OBRIGATORIA", () => {
    const resultado = aplicarMovimentacao(
      posicaoVazia(),
      compra("c1", "2026-01-10", "0", "100.00"),
    );

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.error.codigo).toBe("MOV_QTD_OBRIGATORIA");
    }
  });

  it("venda sem quantidade retorna MOV_QTD_OBRIGATORIA", () => {
    const resultado = aplicarMovimentacao(
      posicaoDe([compra("c1", "2026-01-10", "10", "100.00")]),
      mov({ tipo: "VENDA", valorTotal: "100.00" }),
    );

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.error.codigo).toBe("MOV_QTD_OBRIGATORIA");
      expect(resultado.error.detalhes.tipo).toBe("VENDA");
    }
  });

  it("venda sem valor unitário retorna MOV_QTD_OBRIGATORIA", () => {
    const resultado = aplicarMovimentacao(
      posicaoDe([compra("c1", "2026-01-10", "10", "100.00")]),
      mov({ tipo: "VENDA", quantidade: "1", valorTotal: "100.00" }),
    );

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.error.codigo).toBe("MOV_QTD_OBRIGATORIA");
    }
  });

  it("venda com quantidade zero retorna MOV_QTD_OBRIGATORIA", () => {
    const resultado = aplicarMovimentacao(
      posicaoDe([compra("c1", "2026-01-10", "10", "100.00")]),
      venda("v1", "2026-01-11", "0", "100.00"),
    );

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.error.codigo).toBe("MOV_QTD_OBRIGATORIA");
    }
  });

  it("sem quantidade ou valor unitário, a consistência do total não se aplica", () => {
    const semQuantidade = sucesso(
      validarValorTotal({
        quantidade: null,
        valorUnitario: "100.00",
        custos: "0.00",
        valorTotal: "50.00",
      }),
    );
    expect(semQuantidade.diferenca.toFixed(2)).toBe("0.00");

    const semValorUnitario = sucesso(
      validarValorTotal({
        quantidade: "10",
        valorUnitario: null,
        custos: "0.00",
        valorTotal: "50.00",
      }),
    );
    expect(semValorUnitario.diferenca.toFixed(2)).toBe("0.00");
  });

  it("calcula preço médio zero quando a quantidade é zero", () => {
    expect(
      calcularPrecoMedio(Decimal.zero(2), Decimal.zero(8)).toFixed(6),
    ).toBe("0.000000");
  });

  it("permite injetar explicitamente a estratégia de custo médio", () => {
    const posicao = posicaoDe([compra("c1", "2026-01-10", "10", "100.00")]);
    const baixa = sucesso(
      calcularBaixaVenda(
        posicao,
        venda("v1", "2026-01-11", "5", "120.00"),
        custoMedio,
      ),
    );

    expect(baixa.posicao.quantidade.toFixed(8)).toBe("5.00000000");
    expect(baixa.resultadoRealizado.toFixed(2)).toBe("100.00");
  });
});

describe("posição negativa confirmada (RN-018)", () => {
  it("venda acima da posição em modo permissivo deixa quantidade negativa e custo zerado", () => {
    const posicao = posicaoDe([compra("c1", "2026-01-10", "10", "100.00")]);

    const resultado = sucesso(
      aplicarMovimentacao(
        posicao,
        venda("v1", "2026-01-11", "15", "120.00"),
        custoMedio,
        { permitirPosicaoNegativa: true },
      ),
    );

    expect(resultado.quantidade.toFixed(8)).toBe("-5.00000000");
    expect(resultado.precoMedio.toFixed(6)).toBe("0.000000");
    expect(resultado.custoTotal.toFixed(2)).toBe("0.00");
  });

  it("venda permissiva em posição zerada não divide por zero", () => {
    const resultado = sucesso(
      aplicarMovimentacao(posicaoVazia(), venda("v1", "2026-01-11", "1", "100.00"), custoMedio, {
        permitirPosicaoNegativa: true,
      }),
    );

    expect(resultado.quantidade.toFixed(8)).toBe("-1.00000000");
    expect(resultado.custoTotal.toFixed(2)).toBe("0.00");
  });

  it("reconstrução permissiva volta a fechar positiva depois de compra posterior", () => {
    const movimentacoes = [
      compra("c1", "2026-01-10", "10", "100.00"),
      venda("v1", "2026-01-11", "15", "120.00"),
      compra("c2", "2026-01-12", "10", "100.00"),
    ];

    const estrita = reconstruirPosicao(movimentacoes);
    expect(estrita.ok).toBe(false);

    const permissiva = sucesso(
      reconstruirPosicao(movimentacoes, custoMedio, { permitirPosicaoNegativa: true }),
    );
    expect(permissiva.quantidade.toFixed(8)).toBe("5.00000000");
    expect(permissiva.custoTotal.toFixed(2)).toBe("1000.00");
    expect(permissiva.precoMedio.toFixed(6)).toBe("200.000000");
  });
});
