import { z } from "zod";

import { requireUsuario } from "@/src/infra/auth/require-usuario";
import { servicosAtivos } from "@/src/infra/container/ativos";
import { withRoute, type RouteContext } from "@/src/infra/http/handler";
import { jsonResponse } from "@/src/infra/http/response";
import { readJsonBody, validate } from "@/src/infra/http/validation";
import { errors } from "@/src/lib/errors";
import { isErr } from "@/src/lib/result";
import { apresentarAtivoDetalhe } from "@/src/modules/ativos/apresentacao";
import { atualizarAtivo, validarCamposImutaveis } from "@/src/modules/ativos/atualizar-ativo";
import { obterAtivo } from "@/src/modules/ativos/obter-ativo";
import { STATUS_ATIVO } from "@/src/modules/ativos/repositorio";

/**
 * `GET/PATCH /api/ativos/{id}` — autenticado (API_CONTRACTS.md §3.3–§3.4;
 * RN-010-3). ID inválido ou de outro titular é sempre `ATIVO_NAO_ENCONTRADO`
 * (404), nunca 403. `ticker` e `classeId` são imutáveis; a classe só voltará a
 * ser editável quando a RN-015 (movimentações) existir com a regra condicional.
 */

export const dynamic = "force-dynamic";

interface ParametrosAtivo {
  readonly id?: unknown;
}

const atualizarAtivoSchema = z.strictObject({
  nome: z.string().trim().min(3).max(160).optional(),
  segmentoId: z.uuid().nullable().optional(),
  cnpj: z.string().trim().max(20).nullable().optional(),
  administrador: z.string().trim().max(160).nullable().optional(),
  gestor: z.string().trim().max(160).nullable().optional(),
  fonteDados: z.string().trim().max(60).nullable().optional(),
  status: z.enum(STATUS_ATIVO).optional(),
  observacoes: z.string().trim().max(1000).nullable().optional(),
});

async function idDaRota(context: RouteContext): Promise<string> {
  const params = context.params as
    | Promise<ParametrosAtivo>
    | ParametrosAtivo
    | undefined;
  const resolvidos = await params;
  const id = resolvidos?.id;

  if (typeof id !== "string" || !z.uuid().safeParse(id).success) {
    throw errors.ativoNaoEncontrado();
  }
  return id;
}

export const GET = withRoute(async (_request, context) => {
  const usuario = await requireUsuario();
  const ativoId = await idDaRota(context);

  const resultado = await obterAtivo(
    { usuarioId: usuario.usuarioId, ativoId },
    servicosAtivos(),
  );
  if (isErr(resultado)) {
    throw resultado.error;
  }

  return jsonResponse(apresentarAtivoDetalhe(resultado.value), 200, context.requestId);
});

export const PATCH = withRoute(async (request, context) => {
  const usuario = await requireUsuario();
  const ativoId = await idDaRota(context);

  const corpo = await readJsonBody(request);
  const imutavel = validarCamposImutaveis(corpo);
  if (imutavel !== null) {
    throw imutavel;
  }

  const campos = validate(atualizarAtivoSchema, corpo);
  const resultado = await atualizarAtivo(
    { usuarioId: usuario.usuarioId, ativoId, ...campos },
    servicosAtivos(),
  );
  if (isErr(resultado)) {
    throw resultado.error;
  }

  return jsonResponse(apresentarAtivoDetalhe(resultado.value), 200, context.requestId);
});
