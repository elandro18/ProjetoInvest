import { z } from "zod";

import { requireUsuario } from "@/src/infra/auth/require-usuario";
import { servicosAtivos } from "@/src/infra/container/ativos";
import { withRoute } from "@/src/infra/http/handler";
import { jsonResponse } from "@/src/infra/http/response";
import { parseJsonBody, validate } from "@/src/infra/http/validation";
import { isErr } from "@/src/lib/result";
import { apresentarAtivo, apresentarAtivoDetalhe } from "@/src/modules/ativos/apresentacao";
import { criarAtivo } from "@/src/modules/ativos/criar-ativo";
import { listarAtivos, PAGE_SIZE_MAXIMO, PAGE_SIZE_PADRAO } from "@/src/modules/ativos/listar-ativos";
import { DIRECOES_ORDEM, ORDENACOES_ATIVO, STATUS_ATIVO } from "@/src/modules/ativos/repositorio";

/**
 * `GET/POST /api/ativos` — autenticado (API_CONTRACTS.md §3.1–§3.2; RN-010-2).
 *
 * O `usuarioId` vem exclusivamente da sessão (`requireUsuario`), nunca da
 * query nem do corpo. A borda valida forma; as regras de negócio (classe
 * ativa, FII exige segmento, CNPJ, unicidade) ficam nos casos de uso.
 */

export const dynamic = "force-dynamic";

const listarAtivosSchema = z.object({
  q: z.string().trim().min(1).max(160).optional(),
  classeId: z.uuid().optional(),
  segmentoId: z.uuid().optional(),
  status: z.enum(STATUS_ATIVO).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(PAGE_SIZE_MAXIMO).default(PAGE_SIZE_PADRAO),
  sort: z.enum(ORDENACOES_ATIVO).default("ticker"),
  order: z.enum(DIRECOES_ORDEM).default("asc"),
});

const criarAtivoSchema = z.strictObject({
  ticker: z.string().trim().min(1).max(20),
  nome: z.string().trim().min(3).max(160),
  classeId: z.uuid(),
  segmentoId: z.uuid().nullable().optional().default(null),
  cnpj: z.string().trim().max(20).nullable().optional().default(null),
  administrador: z.string().trim().max(160).nullable().optional().default(null),
  gestor: z.string().trim().max(160).nullable().optional().default(null),
  fonteDados: z.string().trim().max(60).nullable().optional().default(null),
  observacoes: z.string().trim().max(1000).nullable().optional().default(null),
});

export const GET = withRoute(async (request, context) => {
  const usuario = await requireUsuario();
  const query = validate(listarAtivosSchema, Object.fromEntries(new URL(request.url).searchParams));

  const resultado = await listarAtivos(
    { usuarioId: usuario.usuarioId, ...query },
    servicosAtivos(),
  );

  return jsonResponse(
    { data: resultado.itens.map(apresentarAtivo), meta: resultado.meta },
    200,
    context.requestId,
  );
});

export const POST = withRoute(async (request, context) => {
  const usuario = await requireUsuario();
  const corpo = await parseJsonBody(request, criarAtivoSchema);

  const resultado = await criarAtivo(
    { usuarioId: usuario.usuarioId, ...corpo },
    servicosAtivos(),
  );
  if (isErr(resultado)) {
    throw resultado.error;
  }

  return jsonResponse(apresentarAtivoDetalhe(resultado.value), 201, context.requestId);
});
