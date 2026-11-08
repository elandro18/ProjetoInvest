import { errors, type AppError } from "../../lib/errors";
import { err, ok, type Result } from "../../lib/result";
import type { VerificarSenha } from "./login";
import type { ContaRepositorio } from "./repositorio";

/**
 * Encerramento de conta com anonimização (RN-085-6, RN-070, RN-088).
 *
 * Exige a senha atual — a sessão sozinha não basta para uma operação
 * irreversível. A anonimização é feita na mesma transação que marca a conta
 * como `EXCLUIDA`: nome e e-mail viram valores determinísticos (e-mail ainda
 * único) e `sessionVersion` sobe, derrubando as sessões ativas.
 *
 * Evidência legal (`aceite_legal`) e registros financeiros permanecem
 * vinculados ao registro anonimizado (COMPLIANCE.md §3.6).
 */

export const NOME_CONTA_ENCERRADA = "Conta encerrada";

export const MENSAGEM_CONTA_ENCERRADA = "Conta encerrada. Dados pessoais anonimizados.";

/** E-mail sintético único e determinístico (`excluido+<uuid>@invalid.local`). */
export function emailAnonimizado(usuarioId: string): string {
  return `excluido+${usuarioId}@invalid.local`;
}

export interface EncerrarContaComando {
  readonly usuarioId: string;
  readonly senha: string;
}

export interface EncerrarContaDeps {
  readonly repositorio: ContaRepositorio;
  readonly verificarSenha: VerificarSenha;
  readonly agora?: () => Date;
}

export interface ContaEncerrada {
  readonly statusConta: "EXCLUIDA";
  readonly mensagem: string;
}

export async function encerrarConta(
  comando: EncerrarContaComando,
  deps: EncerrarContaDeps,
): Promise<Result<ContaEncerrada, AppError>> {
  const agora = deps.agora?.() ?? new Date();

  const conta = await deps.repositorio.buscarCredenciaisPorId(comando.usuarioId);
  if (conta === null) {
    return err(errors.naoAutenticado());
  }

  if (conta.excluidoEm !== null || conta.statusConta === "EXCLUIDA") {
    return err(errors.contaExclusaoBloqueada());
  }

  if (!(await deps.verificarSenha(conta.senhaHash, comando.senha))) {
    return err(errors.authCredenciaisInvalidas());
  }

  const encerrada = await deps.repositorio.encerrarConta({
    usuarioId: conta.id,
    nomeAnonimizado: NOME_CONTA_ENCERRADA,
    emailAnonimizado: emailAnonimizado(conta.id),
    agora,
  });

  if (!encerrada) {
    return err(errors.contaExclusaoBloqueada());
  }

  return ok({ statusConta: "EXCLUIDA", mensagem: MENSAGEM_CONTA_ENCERRADA });
}
