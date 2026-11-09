import { z } from "zod";

import { requireUsuario } from "@/src/infra/auth/require-usuario";
import { servicosCarteira } from "@/src/infra/container/carteira";
import { withRoute } from "@/src/infra/http/handler";
import { jsonResponse } from "@/src/infra/http/response";
import { validate } from "@/src/infra/http/validation";
import { dataIsoValida } from "@/src/lib/datas";
import { isErr } from "@/src/lib/result";
import { apresentarEvolucao } from "@/src/modules/carteira/apresentacao";
import {
  GRANULARIDADE_EVOLUCAO_PADRAO,
  GRANULARIDADES_EVOLUCAO,
} from "@/src/modules/carteira/evolucao-carteira";
import { obterEvolucao } from "@/src/modules/carteira/obter-evolucao";

/**
 * `GET /api/carteira/evolucao` — autenticado (API_CONTRACTS.md §5.2;
 * RN-020, RN-062).
 *
 * Defaults: `de` = início do ano, `ate` = hoje e `granularidade = mes`.
 * Data inválida, `de > ate` e granularidade fora de `dia|mes` viram 422
 * (`VALIDACAO` com `details.errors[]`). O `usuarioId` vem da sessão.
 */

export const dynamic = "force-dynamic";

const dataIso = z.string().refine(dataIsoValida, "Data inválida (use YYYY-MM-DD).");

const evolucaoQuerySchema = z.object({
  de: dataIso.optional(),
  ate: dataIso.optional(),
  granularidade: z.enum(GRANULARIDADES_EVOLUCAO).default(GRANULARIDADE_EVOLUCAO_PADRAO),
});

export const GET = withRoute(async (request, context) => {
  const usuario = await requireUsuario();
  const query = validate(
    evolucaoQuerySchema,
    Object.fromEntries(new URL(request.url).searchParams),
  );

  const resultado = await obterEvolucao(
    { usuarioId: usuario.usuarioId, ...query },
    servicosCarteira(),
  );
  if (isErr(resultado)) {
    throw resultado.error;
  }

  return jsonResponse(apresentarEvolucao(resultado.value), 200, context.requestId);
});
