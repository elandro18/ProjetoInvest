"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { EmptyState } from "@/src/components/ui/empty-state";
import { ErrorState } from "@/src/components/ui/error-state";
import { StatusBadge } from "@/src/components/ui/status-badge";
import type { ConcentracaoApi } from "@/src/modules/risco/apresentacao";

import {
  carteiraVazia,
  formatarMoeda,
  formatarPercentual,
  formatarPontosPercentuais,
  rotuloDimensao,
} from "./configuracoes-ui";

type DimensaoApi = ConcentracaoApi["dimensoes"][number];
type ItemApi = DimensaoApi["itens"][number];

export interface ConcentracaoPanelProps {
  readonly concentracao: ConcentracaoApi | null;
  readonly carregando: boolean;
  readonly erro: string | null;
  readonly traceId: string | null;
  readonly onRetry: () => void;
  readonly sessaoExpirada: boolean;
}

const ESTILO_LINK_SECUNDARIO =
  "inline-flex items-center justify-center rounded-lg border border-neutral-200 bg-neutral-0 px-4 py-2 text-sm font-medium text-neutral-900 transition-colors hover:bg-neutral-50";

function Esqueleto() {
  return (
    <div aria-busy="true" className="space-y-3">
      <span className="sr-only">Carregando concentração da carteira…</span>
      <div className="h-56 animate-pulse rounded-xl bg-neutral-200" />
      <div className="h-56 animate-pulse rounded-xl bg-neutral-200" />
    </div>
  );
}

/**
 * Situação do item com texto além da cor (UI_SPEC §18).
 *
 * - excedido: badge "Excedido" + excesso em p.p.;
 * - limite configurado e dentro: badge "Dentro do limite";
 * - sem limite: nenhum badge — o percentual continua visível.
 */
function SituacaoItem({ item }: { readonly item: ItemApi }) {
  if (item.excedido) {
    return (
      <div className="space-y-0.5">
        <StatusBadge tone="error">Excedido</StatusBadge>
        <p className="text-xs font-medium text-negative">
          {`${formatarPontosPercentuais(item.excessoPontos)} p.p. acima do limite`}
        </p>
      </div>
    );
  }

  if (item.limite !== null) {
    return <StatusBadge tone="success">Dentro do limite</StatusBadge>;
  }

  return <span className="text-sm text-neutral-500">Sem limite configurado</span>;
}

function ReferenciaItem({ item }: { readonly item: ItemApi }) {
  return (
    <div className="min-w-0">
      <p className="break-words font-medium text-neutral-900">{item.nome}</p>
      {item.referencia === item.nome ? null : (
        <p className="break-words text-xs text-neutral-500">{item.referencia}</p>
      )}
    </div>
  );
}

function TabelaDimensao({ dimensao }: { readonly dimensao: DimensaoApi }) {
  return (
    <>
      <div className="hidden overflow-x-auto rounded-xl border border-neutral-200 bg-neutral-0 md:block">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <caption className="sr-only">
            {`Concentração por ${rotuloDimensao(dimensao.dimensao)}: referência, valor, percentual do patrimônio, limite e situação.`}
          </caption>
          <thead className="border-b border-neutral-200 bg-neutral-50 text-left">
            <tr>
              <th scope="col" className="px-3 py-2 font-semibold text-neutral-700">
                Referência
              </th>
              <th scope="col" className="px-3 py-2 text-right font-semibold text-neutral-700">
                Valor
              </th>
              <th scope="col" className="px-3 py-2 text-right font-semibold text-neutral-700">
                % do patrimônio
              </th>
              <th scope="col" className="px-3 py-2 text-right font-semibold text-neutral-700">
                Limite
              </th>
              <th scope="col" className="px-3 py-2 font-semibold text-neutral-700">
                Situação
              </th>
            </tr>
          </thead>
          <tbody>
            {dimensao.itens.map((item) => (
              <tr
                key={`${dimensao.dimensao}-${item.referencia}`}
                className="border-b border-neutral-200 last:border-b-0"
              >
                <td className="max-w-56 px-3 py-3">
                  <ReferenciaItem item={item} />
                </td>
                <td className="px-3 py-3 text-right text-neutral-900">
                  {formatarMoeda(item.valor)}
                </td>
                <td className="px-3 py-3 text-right text-neutral-900">
                  {formatarPercentual(item.percentual)}
                </td>
                <td className="px-3 py-3 text-right text-neutral-700">
                  {item.limite === null ? "Sem limite" : formatarPercentual(item.limite)}
                </td>
                <td className="px-3 py-3">
                  <SituacaoItem item={item} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-3 md:hidden">
        {dimensao.itens.map((item) => (
          <li
            key={`${dimensao.dimensao}-${item.referencia}`}
            className="rounded-xl border border-neutral-200 bg-neutral-0 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <ReferenciaItem item={item} />
              <div className="shrink-0 text-right">
                <SituacaoItem item={item} />
              </div>
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                  Valor
                </dt>
                <dd className="mt-0.5 text-neutral-900">{formatarMoeda(item.valor)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                  % do patrimônio
                </dt>
                <dd className="mt-0.5 text-neutral-900">
                  {formatarPercentual(item.percentual)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                  Limite
                </dt>
                <dd className="mt-0.5 text-neutral-700">
                  {item.limite === null ? "Sem limite" : formatarPercentual(item.limite)}
                </dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}

function SecaoDimensao({ dimensao }: { readonly dimensao: DimensaoApi }) {
  const tituloId = `concentracao-${dimensao.dimensao}-titulo`;

  let conteudo: ReactNode;
  if (!dimensao.disponivel) {
    conteudo = (
      <p className="rounded-xl border border-dashed border-neutral-200 bg-neutral-0 px-4 py-6 text-sm text-neutral-700">
        Indisponível até a Fase 3/4.
      </p>
    );
  } else if (dimensao.itens.length === 0) {
    conteudo = (
      <p className="rounded-xl border border-dashed border-neutral-200 bg-neutral-0 px-4 py-6 text-sm text-neutral-500">
        Nenhuma posição nesta dimensão.
      </p>
    );
  } else {
    conteudo = <TabelaDimensao dimensao={dimensao} />;
  }

  return (
    <section aria-labelledby={tituloId} className="space-y-3">
      <h3 id={tituloId} className="text-base font-semibold text-neutral-900">
        {rotuloDimensao(dimensao.dimensao)}
      </h3>
      {conteudo}
    </section>
  );
}

/**
 * Painel **Concentração atual** (RN-049-4; RN-049-3; UI_SPEC §14.1, §17).
 *
 * A API já entrega o percentual, o limite resolvido (específico vence o
 * padrão) e o excesso em p.p. — a tela só apresenta, nunca recalcula. Carteira
 * sem posições vira estado vazio explicativo; `IMOVEL` permanece visível como
 * indisponível até a Fase 3/4.
 */
export function ConcentracaoPanel({
  concentracao,
  carregando,
  erro,
  traceId,
  onRetry,
  sessaoExpirada,
}: ConcentracaoPanelProps) {
  return (
    <section aria-labelledby="configuracoes-concentracao-titulo" className="space-y-4">
      <div className="space-y-1">
        <h2
          id="configuracoes-concentracao-titulo"
          className="text-xl font-semibold text-neutral-900"
        >
          Concentração atual
        </h2>
        <p className="text-sm text-neutral-700">
          Participação de cada referência sobre o patrimônio total da carteira.
        </p>
      </div>

      {carregando ? (
        <Esqueleto />
      ) : erro !== null ? (
        <ErrorState
          title="Concentração indisponível"
          message={erro}
          traceId={traceId}
          onRetry={sessaoExpirada ? undefined : onRetry}
          action={
            sessaoExpirada ? (
              <Link
                href="/login?callbackUrl=%2Fconfiguracoes"
                className={ESTILO_LINK_SECUNDARIO}
              >
                Entrar novamente
              </Link>
            ) : undefined
          }
        />
      ) : concentracao === null ? null : (
        <>
          {carteiraVazia(concentracao) ? (
            <EmptyState
              title="Carteira vazia"
              description="Cadastre ativos e renda fixa para ver a concentração por dimensão. Os percentuais aparecem quando existir patrimônio."
              action={
                <Link href="/ativos/novo" className={ESTILO_LINK_SECUNDARIO}>
                  Cadastrar ativo
                </Link>
              }
            />
          ) : null}

          {(carteiraVazia(concentracao)
            ? concentracao.dimensoes.filter((item) => item.dimensao === "IMOVEL")
            : concentracao.dimensoes
          ).map((dimensao) => (
            <SecaoDimensao key={dimensao.dimensao} dimensao={dimensao} />
          ))}
        </>
      )}
    </section>
  );
}
