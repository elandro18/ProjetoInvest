import { z } from "zod";

import { isErr } from "../../lib/result";
import { autenticar } from "../../modules/conta/login";
import type { StatusConta } from "../../modules/conta/repositorio";
import { servicosConta } from "../container/conta";

/**
 * Verificação de credenciais usada pelo provider do Auth.js (RN-071, RN-085).
 *
 * Fica fora de `auth.ts` para ser testável sem inicializar o NextAuth: o
 * módulo de configuração só faz o wiring do provider.
 */

export const credenciaisSchema = z.object({
  email: z.string().trim().toLowerCase().max(160).pipe(z.email()),
  senha: z.string().min(1).max(200),
});

export interface IdentidadeAutenticada {
  readonly id: string;
  readonly nome: string;
  readonly email: string;
  readonly statusConta: StatusConta;
  readonly sessionVersion: number;
}

export async function autorizarCredenciais(
  credenciais: unknown,
): Promise<IdentidadeAutenticada | null> {
  const entrada = credenciaisSchema.safeParse(credenciais);
  if (!entrada.success) {
    return null;
  }

  const servicos = servicosConta();
  const resultado = await autenticar(entrada.data, {
    repositorio: servicos.repositorio,
    verificarSenha: servicos.verificarSenha,
  });

  if (isErr(resultado)) {
    return null;
  }

  const { usuario } = resultado.value;
  await servicos.repositorio.registrarLogin(usuario.id, servicos.agora());

  return {
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    statusConta: usuario.statusConta,
    sessionVersion: usuario.sessionVersion,
  };
}
