import { z } from "zod";

import { requireUsuario } from "@/src/infra/auth/require-usuario";
import { servicosMovimentacoes } from "@/src/infra/container/movimentacoes";
import { withRoute, type RouteContext } from "@/src/infra/http/handler";
import { jsonResponse } from "@/src/infra/http/response";
import { parseJsonBody } from "@/src/infra/http/validation";
import { errors } from "@/src/lib/errors";
import { isErr } from "@/src/lib/result";
import { apresentarMovimentacao, apresentarPosicao } from "@/src/modules/movimentacoes/apresentacao";
import { cancelarMovimentacao } from "@/src/modules/movimentacoes/cancelar-movimentacao";

/**
 * `POST /api/movimentacoes/{id}/cancelamento` — autenticado
 * (API_CONTRACTS.md §4.3; RN-084). Nunca há exclusão física; a movimentação
 * permanece listável como cancelada e a posição é recalculada na transação.
 */

export const dynamic = "force-dynamic";

interface ParametrosMovimentacao {
  readonly id?: unknown;
}

const cancelamentoSchema = z.strictObject({
  motivo: z.string().trim().max(1000).optional().default(""),
});

async function idDaRota(context: RouteContext): Promise<string> {
  const params = context.params as
    | Promise<ParametrosMovimentacao>
    | ParametrosMovimentacao
    | undefined;
  const resolvidos = await params;
  const id = resolvidos?.id;

  if (typeof id !== "string" || !z.uuid().safeParse(id).success) {
    throw errors.movNaoEncontrada();
  }

  return id;
}

export const POST = withRoute(async (request, context) => {
  const usuario = await requireUsuario();
  const movimentacaoId = await idDaRota(context);
  const corpo = await parseJsonBody(request, cancelamentoSchema);

  const resultado = await cancelarMovimentacao(
    {
      usuarioId: usuario.usuarioId,
      movimentacaoId,
      motivo: corpo.motivo,
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
    200,
    context.requestId,
  );
});
