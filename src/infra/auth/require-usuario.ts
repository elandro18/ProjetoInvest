import { errors } from "../../lib/errors";
import { servicosConta } from "../container/conta";
import { auth } from "./auth";

/**
 * Porta de entrada de toda feature autenticada (RN-085; ARCHITECTURE.md §7).
 *
 * `requireUsuario()` é o único lugar autorizado a traduzir sessão em
 * `usuarioId`: o identificador vem do JWT validado, nunca do corpo da
 * requisição. Além de exigir sessão, recarrega a conta no banco para:
 *
 * - recusar conta que deixou de estar `ATIVA` (suspensa/excluída);
 * - comparar `sessionVersion` do JWT com a do banco — se a senha for trocada
 *   ou a conta encerrada, a versão sobe e todas as sessões antigas caem.
 */

export interface UsuarioAutenticado {
  readonly usuarioId: string;
  readonly nome: string;
  readonly email: string;
}

export async function requireUsuario(): Promise<UsuarioAutenticado> {
  const sessao = await auth();
  const usuarioSessao = sessao?.user;

  if (usuarioSessao?.id === undefined) {
    throw errors.naoAutenticado();
  }

  const conta = await servicosConta().repositorio.buscarSessao(usuarioSessao.id);

  if (conta === null || conta.excluidoEm !== null || conta.statusConta !== "ATIVA") {
    throw errors.naoAutenticado();
  }

  if (conta.sessionVersion !== usuarioSessao.sessionVersion) {
    throw errors.authSessaoExpirada();
  }

  return { usuarioId: conta.id, nome: conta.nome, email: conta.email };
}
