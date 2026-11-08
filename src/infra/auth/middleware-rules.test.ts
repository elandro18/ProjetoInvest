import { describe, expect, it } from "vitest";

import { decidirAcesso, ehApiPublica, ehRotaPrivada } from "./middleware-rules";

describe("ehRotaPrivada", () => {
  it("reconhece a rota e suas subrotas", () => {
    expect(ehRotaPrivada("/carteira")).toBe(true);
    expect(ehRotaPrivada("/carteira/ativos/123")).toBe(true);
    expect(ehRotaPrivada("/configuracoes")).toBe(true);
  });

  it("não confunde prefixos parecidos nem rotas públicas", () => {
    expect(ehRotaPrivada("/carteirax")).toBe(false);
    expect(ehRotaPrivada("/login")).toBe(false);
    expect(ehRotaPrivada("/")).toBe(false);
  });
});

describe("ehApiPublica", () => {
  it("libera auth e health, inclusive subrotas", () => {
    expect(ehApiPublica("/api/auth")).toBe(true);
    expect(ehApiPublica("/api/auth/login")).toBe(true);
    expect(ehApiPublica("/api/health")).toBe(true);
  });

  it("fecha as demais APIs", () => {
    expect(ehApiPublica("/api/ativos")).toBe(false);
    expect(ehApiPublica("/api/authz")).toBe(false);
  });
});

describe("decidirAcesso", () => {
  it("libera qualquer rota com sessão", () => {
    expect(decidirAcesso({ pathname: "/api/ativos", search: "", autenticado: true })).toEqual({
      tipo: "liberar",
    });
  });

  it("responde 401 para API privada sem sessão", () => {
    expect(decidirAcesso({ pathname: "/api/ativos", search: "?x=1", autenticado: false })).toEqual({
      tipo: "naoAutenticado",
    });
  });

  it("libera API pública sem sessão", () => {
    expect(decidirAcesso({ pathname: "/api/auth/login", search: "", autenticado: false })).toEqual({
      tipo: "liberar",
    });
    expect(decidirAcesso({ pathname: "/api/health", search: "", autenticado: false })).toEqual({
      tipo: "liberar",
    });
  });

  it("redireciona página privada preservando caminho e query", () => {
    expect(
      decidirAcesso({ pathname: "/carteira", search: "?aba=fiis", autenticado: false }),
    ).toEqual({ tipo: "redirecionar", callbackUrl: "/carteira?aba=fiis" });
  });

  it("libera página pública", () => {
    expect(decidirAcesso({ pathname: "/login", search: "", autenticado: false })).toEqual({
      tipo: "liberar",
    });
  });
});
