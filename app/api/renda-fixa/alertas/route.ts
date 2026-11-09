import type { ConfiguracaoAlertasRendaFixa } from "@/src/modules/renda-fixa/alertas";

import { requireUsuario } from "@/src/infra/auth/require-usuario";
import { servicosRendaFixa } from "@/src/infra/container/renda-fixa";
import { withRoute } from "@/src/infra/http/handler";
import { jsonResponse } from "@/src/infra/http/response";
import { obterAlertas } from "@/src/modules/renda-fixa/obter-alertas";

/**
 * `GET /api/renda-fixa/alertas` — autenticado (API_CONTRACTS.md §6.4;
 * RN-058). Alertas são calculados sob demanda, nunca persistidos.
 *
 * Os limites vêm do ambiente e **não têm default**: PEND-004 (concentração por
 * instituição) e PEND-012 (limite de FGC) continuam em aberto. Sem valor
 * configurado, o alerta correspondente não é gerado.
 */

export const dynamic = "force-dynamic";

function configuracaoDoAmbiente(): ConfiguracaoAlertasRendaFixa {
  return {
    concentracaoMaximaPercentual: process.env.RF_CONCENTRACAO_MAXIMA_PERCENTUAL ?? null,
    limiteFgc: process.env.RF_LIMITE_FGC ?? null,
  };
}

export const GET = withRoute(async (_request, context) => {
  const usuario = await requireUsuario();

  const alertas = await obterAlertas(
    { usuarioId: usuario.usuarioId, config: configuracaoDoAmbiente() },
    servicosRendaFixa(),
  );

  return jsonResponse({ alertas }, 200, context.requestId);
});
