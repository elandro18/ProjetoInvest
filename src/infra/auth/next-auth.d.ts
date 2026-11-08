import type { StatusConta } from "../../modules/conta/repositorio";

/**
 * Extensão dos tipos do Auth.js para carregar identidade e estado de conta no
 * JWT e na sessão (RN-085). O `sessionVersion` permite invalidar sessões
 * emitidas antes de uma troca de senha ou encerramento (RN-086, RN-088).
 */

declare module "next-auth" {
  interface User {
    nome: string;
    statusConta: StatusConta;
    sessionVersion: number;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    nome: string;
    statusConta: StatusConta;
    sessionVersion: number;
  }
}
