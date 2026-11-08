import { describe, expect, it } from "vitest";

import type { Session, User } from "next-auth";
import type { JWT } from "next-auth/jwt";

import { authConfig, PAGINA_LOGIN, SESSAO_MAX_AGE_SEGUNDOS } from "./auth.config";

type JwtCallback = (params: { token: JWT; user?: User }) => Promise<JWT>;
type SessionCallback = (params: { session: Session; token: JWT }) => Promise<Session>;

const callbacks = authConfig.callbacks as unknown as {
  jwt: JwtCallback;
  session: SessionCallback;
};

const USUARIO = {
  id: "33333333-3333-3333-3333-333333333333",
  nome: "Carla Titular",
  email: "carla@exemplo.com",
  statusConta: "ATIVA",
  sessionVersion: 7,
} as User;

describe("authConfig", () => {
  it("aponta o login para /login e fixa a sessão de 8 h", () => {
    expect(PAGINA_LOGIN).toBe("/login");
    expect(authConfig.pages?.signIn).toBe("/login");
    expect(SESSAO_MAX_AGE_SEGUNDOS).toBe(28_800);
    expect(authConfig.session?.maxAge).toBe(SESSAO_MAX_AGE_SEGUNDOS);
    expect(authConfig.session?.strategy).toBe("jwt");
    expect(authConfig.trustHost).toBe(true);
  });

  it("copia identidade e versão da conta para o JWT no login", async () => {
    const token = await callbacks.jwt({ token: {} as JWT, user: USUARIO });

    expect(token.id).toBe(USUARIO.id);
    expect(token.nome).toBe(USUARIO.nome);
    expect(token.statusConta).toBe("ATIVA");
    expect(token.sessionVersion).toBe(7);
  });

  it("mantém o JWT existente quando não há usuário (refresh)", async () => {
    const token = { id: "x", nome: "Y", statusConta: "ATIVA", sessionVersion: 1 } as JWT;

    const resultado = await callbacks.jwt({ token });

    expect(resultado).toBe(token);
  });

  it("expõe identidade e versão na sessão", async () => {
    const session = { user: { name: "Carla", email: USUARIO.email }, expires: "" } as Session;
    const token = {
      id: USUARIO.id,
      nome: USUARIO.nome,
      statusConta: "ATIVA",
      sessionVersion: 7,
    } as JWT;

    const resultado = await callbacks.session({ session, token });

    expect(resultado.user?.id).toBe(USUARIO.id);
    expect(resultado.user?.nome).toBe(USUARIO.nome);
    expect(resultado.user?.statusConta).toBe("ATIVA");
    expect(resultado.user?.sessionVersion).toBe(7);
  });
});
