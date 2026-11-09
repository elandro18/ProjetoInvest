import { z } from "zod";

import { requireUsuario } from "@/src/infra/auth/require-usuario";
import { servicosMovimentacoes } from "@/src/infra/container/movimentacoes";
import { withRoute } from "@/src/infra/http/handler";
import { jsonResponse } from "@/src/infra/http/response";
import { parseJsonBody, validate } from "@/src/infra/http/validation";
import { dataIsoValida } from "@/src/lib/datas";
import { isErr } from "@/src/lib/result";
import { apresentarMovimentacao, apresentarPosicao } from "@/src/modules/movimentacoes/apresentacao";
import { criarMovimentacao } from "@/src/modules/movimentacoes/criar-movimentacao";
import { listarMovimentacoes } from "@/src/modules/movimentacoes/listar-movimentacoes";
import {
  DIRECOES_ORDEM,
  ORDENACOES_MOVIMENTACAO,
  PAGE_SIZE_MAXIMO,
  PAGE_SIZE_PADRAO,
  TIPOS_MOVIMENTACAO,
} from "@/src/modules/movimentacoes/repositorio";

/**
 * `GET/POST /api/movimentacoes` — autenticado (API_CONTRACTS.md §4.1–§4.2).
 *
 * O `usuarioId` vem exclusivamente da sessão (`requireUsuario`), nunca da query
 * nem do corpo. A borda valida forma; as regras de negócio (ativo, consistência
 * do total, posição negativa, idempotência) ficam no caso de uso.
 */

export const dynamic = "force-dynamic";

const dataIso = z.string().refine(dataIsoValida, "Data inválida (use YYYY-MM-DD).");

const listarMovimentacoesSchema = z.object({
  ativoId: z.uuid().optional(),
  tipo: z.enum(TIPOS_MOVIMENTACAO).optional(),
  de: dataIso.optional(),
  ate: dataIso.optional(),
  incluirCanceladas: z
    .enum(["true", "false"])
    .default("false")
    .transform((valor) => valor === "true"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(PAGE_SIZE_MAXIMO)
    .default(PAGE_SIZE_PADRAO),
  sort: z.enum(ORDENACOES_MOVIMENTACAO).default("data"),
  order: z.enum(DIRECOES_ORDEM).default("desc"),
});

const criarMovimentacaoSchema = z.strictObject({
  ativoId: z.uuid(),
  tipo: z.enum(TIPOS_MOVIMENTACAO),
  data: dataIso,
  quantidade: z.string().trim().min(1).max(30).nullable().optional().default(null),
  valorUnitario: z.string().trim().min(1).max(30).nullable().optional().default(null),
  valorTotal: z.string().trim().min(1).max(30),
  custos: z.string().trim().max(30).optional().default("0.00"),
  observacoes: z.string().trim().max(1000).nullable().optional().default(null),
  confirmarPosicaoNegativa: z.boolean().optional().default(false),
  motivo: z.string().trim().max(1000).nullable().optional().default(null),
});

export const GET = withRoute(async (request, context) => {
  const usuario = await requireUsuario();
  const query = validate(
    listarMovimentacoesSchema,
    Object.fromEntries(new URL(request.url).searchParams),
  );

  const resultado = await listarMovimentacoes(
    { usuarioId: usuario.usuarioId, ...query },
    servicosMovimentacoes(),
  );
  if (isErr(resultado)) {
    throw resultado.error;
  }

  return jsonResponse(
    {
      data: resultado.value.itens.map(apresentarMovimentacao),
      meta: resultado.value.meta,
    },
    200,
    context.requestId,
  );
});

export const POST = withRoute(async (request, context) => {
  const usuario = await requireUsuario();
  const corpo = await parseJsonBody(request, criarMovimentacaoSchema);

  const resultado = await criarMovimentacao(
    {
      usuarioId: usuario.usuarioId,
      requestId: context.requestId,
      idempotencyKey: request.headers.get("idempotency-key"),
      ...corpo,
    },
    servicosMovimentacoes(),
  );
  if (isErr(resultado)) {
    throw resultado.error;
  }

  return jsonResponse(
    {
      movimentacao: apresentarMovimentacao(resultado.value.movimentacao),
      posicao: apresentarPosicao(resultado.value.posicao),
    },
    resultado.value.replay ? 200 : 201,
    context.requestId,
  );
});
