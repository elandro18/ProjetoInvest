import { z } from "zod";

import { requireUsuario } from "@/src/infra/auth/require-usuario";
import { servicosRisco } from "@/src/infra/container/risco";
import { withRoute } from "@/src/infra/http/handler";
import { jsonResponse } from "@/src/infra/http/response";
import { parseJsonBody } from "@/src/infra/http/validation";
import { isErr } from "@/src/lib/result";
import {
  apresentarLimites,
  apresentarVigentes,
} from "@/src/modules/risco/apresentacao";
import { obterLimites } from "@/src/modules/risco/obter-limites";
import { substituirLimites } from "@/src/modules/risco/substituir-limites";

/**
 * `GET/PUT /api/configuracoes/limites` — autenticado (API_CONTRACTS.md §12;
 * RN-049-2, RN-082). O `usuarioId` vem exclusivamente da sessão
 * (`requireUsuario`), nunca da query nem do corpo.
 *
 * A dimensão e o percentual são validados no domínio para que a resposta use
 * `RISCO_LIMITE_INVALIDO` (422) com o campo em `details.campo`; a borda só
 * barra a forma do corpo.
 */

export const dynamic = "force-dynamic";

const limiteSchema = z.strictObject({
  dimensao: z.string().trim().min(1).max(40),
  referencia: z.string().trim().max(120).nullable().optional(),
  percentualMax: z.string().trim().min(1).max(30),
});

const substituirLimitesSchema = z.strictObject({
  limites: z.array(limiteSchema).max(100),
});

export const GET = withRoute(async (_request, context) => {
  const usuario = await requireUsuario();
  const servicos = servicosRisco();

  const resultado = await obterLimites(
    { usuarioId: usuario.usuarioId },
    { repositorio: servicos.limites },
  );
  if (isErr(resultado)) {
    throw resultado.error;
  }

  return jsonResponse(apresentarLimites(resultado.value), 200, context.requestId);
});

export const PUT = withRoute(async (request, context) => {
  const usuario = await requireUsuario();
  const corpo = await parseJsonBody(request, substituirLimitesSchema);
  const servicos = servicosRisco();

  const resultado = await substituirLimites(
    {
      usuarioId: usuario.usuarioId,
      limites: corpo.limites.map((limite) => ({
        dimensao: limite.dimensao,
        referencia: limite.referencia ?? null,
        percentualMax: limite.percentualMax,
      })),
    },
    { repositorio: servicos.limites },
  );
  if (isErr(resultado)) {
    throw resultado.error;
  }

  return jsonResponse(
    { vigente: apresentarVigentes(resultado.value.vigente) },
    200,
    context.requestId,
  );
});
