import { z } from "zod";

import { requireUsuario } from "@/src/infra/auth/require-usuario";
import { servicosAlocacao } from "@/src/infra/container/alocacao";
import { withRoute } from "@/src/infra/http/handler";
import { jsonResponse } from "@/src/infra/http/response";
import { parseJsonBody } from "@/src/infra/http/validation";
import { isErr } from "@/src/lib/result";
import { apresentarMetas, apresentarVigente } from "@/src/modules/alocacao/apresentacao";
import { obterMetas } from "@/src/modules/alocacao/obter-metas";
import { substituirMetas } from "@/src/modules/alocacao/substituir-metas";

/**
 * `GET/PUT /api/alocacao/metas` — autenticado (API_CONTRACTS.md §7.1–§7.2;
 * RN-021-2). O `usuarioId` vem exclusivamente da sessão (`requireUsuario`),
 * nunca da query nem do corpo.
 *
 * O `GET` materializa a estratégia inicial do titular na primeira leitura
 * (defaults lazy) — não existe seed global porque as metas são por usuário.
 */

export const dynamic = "force-dynamic";

const metaSchema = z.strictObject({
  referenciaId: z.uuid(),
  percentual: z.string().trim().min(1).max(30),
});

const substituirMetasSchema = z.strictObject({
  classe: z.array(metaSchema).min(1).max(100),
  segmento: z.array(metaSchema).min(1).max(100),
});

export const GET = withRoute(async (_request, context) => {
  const usuario = await requireUsuario();

  const resultado = await obterMetas({ usuarioId: usuario.usuarioId }, servicosAlocacao());
  if (isErr(resultado)) {
    throw resultado.error;
  }

  return jsonResponse(apresentarMetas(resultado.value), 200, context.requestId);
});

export const PUT = withRoute(async (request, context) => {
  const usuario = await requireUsuario();
  const corpo = await parseJsonBody(request, substituirMetasSchema);

  const resultado = await substituirMetas(
    { usuarioId: usuario.usuarioId, ...corpo },
    servicosAlocacao(),
  );
  if (isErr(resultado)) {
    throw resultado.error;
  }

  return jsonResponse(
    { vigente: apresentarVigente(resultado.value.vigente) },
    200,
    context.requestId,
  );
});
