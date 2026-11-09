import { z } from "zod";

import { requireUsuario } from "@/src/infra/auth/require-usuario";
import { servicosRendaFixa } from "@/src/infra/container/renda-fixa";
import { withRoute } from "@/src/infra/http/handler";
import { jsonResponse } from "@/src/infra/http/response";
import { parseJsonBody, validate } from "@/src/infra/http/validation";
import { isErr } from "@/src/lib/result";
import { apresentarRendaFixa } from "@/src/modules/renda-fixa/apresentacao";
import { criarRendaFixa } from "@/src/modules/renda-fixa/criar-renda-fixa";
import { dataIsoValida } from "@/src/modules/renda-fixa/datas";
import {
  listarRendaFixa,
  PAGE_SIZE_MAXIMO,
  PAGE_SIZE_PADRAO,
} from "@/src/modules/renda-fixa/listar-renda-fixa";
import {
  DIRECOES_ORDEM,
  INDEXADORES_RENDA_FIXA,
  LIQUIDEZ_RENDA_FIXA,
  ORDENACOES_RENDA_FIXA,
  PRODUTOS_RENDA_FIXA,
  STATUS_SALDO,
} from "@/src/modules/renda-fixa/repositorio";

/**
 * `GET/POST /api/renda-fixa` — autenticado (API_CONTRACTS.md §6.1–§6.2;
 * RN-057-2). O `usuarioId` vem exclusivamente da sessão (`requireUsuario`),
 * nunca da query nem do corpo.
 */

export const dynamic = "force-dynamic";

const dataIso = z.string().refine(dataIsoValida, "Data inválida (use YYYY-MM-DD).");

const listarRendaFixaSchema = z.object({
  instituicao: z.string().trim().min(1).max(120).optional(),
  produto: z.enum(PRODUTOS_RENDA_FIXA).optional(),
  vencimentoAte: dataIso.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(PAGE_SIZE_MAXIMO).default(PAGE_SIZE_PADRAO),
  sort: z.enum(ORDENACOES_RENDA_FIXA).default("vencimento"),
  order: z.enum(DIRECOES_ORDEM).default("asc"),
});

const criarRendaFixaSchema = z.strictObject({
  instituicao: z.string().trim().min(2).max(120),
  produto: z.enum(PRODUTOS_RENDA_FIXA),
  indexador: z.enum(INDEXADORES_RENDA_FIXA),
  taxa: z.string().trim().min(1).max(20),
  dataAplicacao: dataIso,
  vencimento: dataIso.nullable().optional().default(null),
  valorAplicado: z.string().trim().min(1).max(30),
  saldoAtual: z.string().trim().min(1).max(30),
  statusSaldo: z.enum(STATUS_SALDO).optional(),
  liquidez: z.enum(LIQUIDEZ_RENDA_FIXA),
  carenciaAte: dataIso.nullable().optional().default(null),
  coberturaFgc: z.boolean().optional(),
  observacoes: z.string().trim().max(1000).nullable().optional().default(null),
});

export const GET = withRoute(async (request, context) => {
  const usuario = await requireUsuario();
  const query = validate(listarRendaFixaSchema, Object.fromEntries(new URL(request.url).searchParams));

  const resultado = await listarRendaFixa(
    { usuarioId: usuario.usuarioId, ...query },
    servicosRendaFixa(),
  );

  return jsonResponse(
    { data: resultado.itens.map(apresentarRendaFixa), meta: resultado.meta },
    200,
    context.requestId,
  );
});

export const POST = withRoute(async (request, context) => {
  const usuario = await requireUsuario();
  const corpo = await parseJsonBody(request, criarRendaFixaSchema);

  const resultado = await criarRendaFixa(
    { usuarioId: usuario.usuarioId, ...corpo },
    servicosRendaFixa(),
  );
  if (isErr(resultado)) {
    throw resultado.error;
  }

  return jsonResponse(apresentarRendaFixa(resultado.value), 201, context.requestId);
});
