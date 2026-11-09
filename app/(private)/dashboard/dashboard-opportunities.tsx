import Link from "next/link";

import { Alert } from "@/src/components/ui/alert";
import { StatusBadge } from "@/src/components/ui/status-badge";

import { BlocoEmBreve } from "./dashboard-charts";
import {
  formatarDesvioPontos,
  formatarMoeda,
  formatarPercentual,
  rotuloReferencia,
  type ItemOportunidadeApi,
  type OportunidadesApi,
} from "./dashboard-ui";

/**
 * Painel de oportunidades (RN-061-4; RN-063; UI_SPEC §4).
 *
 * A Fase 1 entrega classes e segmentos abaixo da meta com o valor necessário.
 * Watchlist (RN-048), fundos com alerta e sugestão de aporte (RN-025) são das
 * Fases 2/4: o bloco existe em estado "disponível em breve", nunca como erro.
 */

const ESTILO_LINK =
  "inline-flex items-center justify-center rounded-lg border border-neutral-200 bg-neutral-0 px-3 py-1.5 text-sm font-medium text-neutral-900 hover:bg-neutral-50";

function LinhaOportunidade({ item }: { readonly item: ItemOportunidadeApi }) {
  return (
    <li className="space-y-1 rounded-lg border border-neutral-200 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="break-words text-sm font-semibold text-neutral-900">
          {rotuloReferencia(item.codigo)}
        </span>
        <StatusBadge tone="warning">Abaixo da meta</StatusBadge>
      </div>
      <p className="text-sm text-neutral-700">
        {`Atual ${formatarPercentual(item.percentualAtual)} · meta ${formatarPercentual(
          item.percentualMeta,
        )} · ${formatarDesvioPontos(item.desvioPontos)}`}
      </p>
      <p className="text-sm font-medium text-neutral-900">
        {`Faltam ${formatarMoeda(item.valorParaMeta)} para atingir a meta`}
      </p>
    </li>
  );
}

interface SecaoOportunidadesProps {
  readonly titulo: string;
  readonly itens: readonly ItemOportunidadeApi[];
  readonly vazio: string;
}

function SecaoOportunidades({ titulo, itens, vazio }: SecaoOportunidadesProps) {
  return (
    <div className="space-y-2">
      <h3 className="text-base font-semibold text-neutral-900">{titulo}</h3>
      {itens.length === 0 ? (
        <p className="rounded-lg bg-neutral-50 px-3 py-3 text-sm text-neutral-700">{vazio}</p>
      ) : (
        <ul className="space-y-2">
          {itens.map((item) => (
            <LinhaOportunidade key={`${item.escopo}-${item.codigo}`} item={item} />
          ))}
        </ul>
      )}
    </div>
  );
}

export interface OportunidadesPainelProps {
  readonly oportunidades: OportunidadesApi;
  /** `false` quando o titular ainda não configurou metas de alocação. */
  readonly possuiMetas: boolean;
  /** `true` no primeiro acesso — evita "R$ 0,00" como se fosse oportunidade. */
  readonly vazio: boolean;
}

export function OportunidadesPainel({
  oportunidades,
  possuiMetas,
  vazio,
}: OportunidadesPainelProps) {
  return (
    <section aria-labelledby="dashboard-oportunidades-titulo" className="space-y-4">
      <div className="space-y-1">
        <h2 id="dashboard-oportunidades-titulo" className="text-lg font-semibold text-neutral-900">
          Oportunidades
        </h2>
        <p className="text-sm text-neutral-700">
          Onde a carteira está abaixo da meta e o que merece atenção hoje.
        </p>
      </div>

      {vazio ? (
        <Alert tone="info" title="Oportunidades após o primeiro cadastro">
          <p>
            Cadastre um ativo ou um título de renda fixa para comparar a carteira com a meta e ver
            as oportunidades.
          </p>
        </Alert>
      ) : possuiMetas ? (
        <div className="space-y-4">
          <SecaoOportunidades
            titulo="Classes abaixo da meta"
            itens={oportunidades.classesAbaixo}
            vazio="Todas as classes estão dentro ou acima da meta."
          />
          <SecaoOportunidades
            titulo="Segmentos abaixo da meta"
            itens={oportunidades.segmentosAbaixo}
            vazio="Todos os segmentos estão dentro ou acima da meta."
          />
        </div>
      ) : (
        <Alert
          tone="info"
          title="Metas de alocação não configuradas"
          action={
            <Link href="/alocacao" className={ESTILO_LINK}>
              Configurar metas
            </Link>
          }
        >
          <p>
            Sem metas não é possível apontar desvios. As metas padrão 50/50 por classe já aparecem
            na comparação acima; configure as metas por segmento em Alocação.
          </p>
        </Alert>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <BlocoEmBreve
          titulo="Ativos em observação (watchlist)"
          descricao="A watchlist e a avaliação de FIIs chegam na Fase 4. Nenhuma recomendação é feita sem os critérios explícitos da RN-039."
        />
        <BlocoEmBreve
          titulo="Fundos com alerta"
          descricao="Os alertas de fundos dependem da coleta de indicadores e da avaliação da Fase 4."
        />
        <BlocoEmBreve
          titulo="Sugestão de aporte do mês"
          descricao="A distribuição sugerida do próximo aporte chega na Fase 2. Quando existir, continuará sendo sugestão — a decisão é sua."
        />
      </div>
    </section>
  );
}
