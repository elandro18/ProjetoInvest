import { afterEach, describe, expect, it } from "vitest";

import { RateLimitMemoria, UMA_HORA_MS, type RateLimitRegra } from "./memory";

const REGRA: RateLimitRegra = { limite: 3, janelaMs: 1_000 };

afterEach(() => {
  delete process.env.RATE_LIMIT_DESABILITADO;
});

describe("RateLimitMemoria", () => {
  it("define a janela de uma hora usada pelos limites de conta", () => {
    expect(UMA_HORA_MS).toBe(3_600_000);
  });

  it("a primeira requisição abre a janela e desconta uma tentativa", () => {
    const limitador = new RateLimitMemoria(false);

    const resultado = limitador.consumir("login:1.2.3.4:ana@exemplo.com", REGRA, 0);

    expect(resultado).toEqual({
      permitido: true,
      restante: 2,
      redefinirEm: new Date(1_000),
    });
  });

  it("conta tentativas até o limite e bloqueia a seguinte sem estender a janela", () => {
    const limitador = new RateLimitMemoria(false);
    const chave = "login:1.2.3.4:ana@exemplo.com";

    expect(limitador.consumir(chave, REGRA, 0)).toMatchObject({ permitido: true, restante: 2 });
    expect(limitador.consumir(chave, REGRA, 100)).toMatchObject({ permitido: true, restante: 1 });
    expect(limitador.consumir(chave, REGRA, 200)).toMatchObject({ permitido: true, restante: 0 });
    expect(limitador.consumir(chave, REGRA, 300)).toMatchObject({ permitido: false, restante: 0 });
    expect(limitador.consumir(chave, REGRA, 400).redefinirEm).toEqual(new Date(1_000));
  });

  it("reinicia a contagem quando a janela vence", () => {
    const limitador = new RateLimitMemoria(false);

    limitador.consumir("chave", REGRA, 0);
    limitador.consumir("chave", REGRA, 900);
    expect(limitador.consumir("chave", REGRA, 999)).toMatchObject({ permitido: true, restante: 0 });

    const reiniciada = limitador.consumir("chave", REGRA, 1_000);

    expect(reiniciada).toEqual({ permitido: true, restante: 2, redefinirEm: new Date(2_000) });
  });

  it("mantém contadores independentes por chave", () => {
    const limitador = new RateLimitMemoria(false);

    limitador.consumir("a", REGRA, 0);
    limitador.consumir("a", REGRA, 0);
    limitador.consumir("a", REGRA, 0);

    expect(limitador.consumir("a", REGRA, 0).permitido).toBe(false);
    expect(limitador.consumir("b", REGRA, 0)).toMatchObject({ permitido: true, restante: 2 });
  });

  it("limpar() devolve todas as chaves ao estado inicial", () => {
    const limitador = new RateLimitMemoria(false);

    limitador.consumir("chave", { limite: 1, janelaMs: 1_000 }, 0);
    expect(limitador.consumir("chave", { limite: 1, janelaMs: 1_000 }, 0).permitido).toBe(false);

    limitador.limpar();

    expect(limitador.consumir("chave", { limite: 1, janelaMs: 1_000 }, 0).permitido).toBe(true);
  });

  it("desabilitado por parâmetro permite tudo sem tocar nas janelas", () => {
    const limitador = new RateLimitMemoria(true);

    for (let i = 0; i < 10; i += 1) {
      expect(limitador.consumir("chave", { limite: 1, janelaMs: 1_000 }, 0)).toEqual({
        permitido: true,
        restante: 1,
        redefinirEm: new Date(1_000),
      });
    }
  });

  it("desabilitado por variável de ambiente (RATE_LIMIT_DESABILITADO=true)", () => {
    process.env.RATE_LIMIT_DESABILITADO = "true";
    const limitador = new RateLimitMemoria();

    expect(limitador.consumir("chave", { limite: 1, janelaMs: 1_000 }, 0).permitido).toBe(true);
    expect(limitador.consumir("chave", { limite: 1, janelaMs: 1_000 }, 0).permitido).toBe(true);
  });

  it("poda janelas vencidas quando o mapa atinge o teto de chaves", () => {
    const limitador = new RateLimitMemoria(false);
    const regra: RateLimitRegra = { limite: 10, janelaMs: 1_000 };

    for (let i = 0; i < 500; i += 1) {
      limitador.consumir(`chave-${i}`, regra, 0);
    }

    // No instante 1.000 todas as 500 janelas venceram: a nova chave dispara a
    // poda e entra com contagem limpa.
    const nova = limitador.consumir("nova", regra, 1_000);
    expect(nova).toEqual({ permitido: true, restante: 9, redefinirEm: new Date(2_000) });

    // A chave antiga também recomeça — prova de que foi removida pelo podar.
    const antiga = limitador.consumir("chave-0", regra, 1_000);
    expect(antiga).toEqual({ permitido: true, restante: 9, redefinirEm: new Date(2_000) });
  });
});
