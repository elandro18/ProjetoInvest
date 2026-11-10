import { Alert } from "@/src/components/ui/alert";
import { StatusBadge } from "@/src/components/ui/status-badge";
import type { SugestaoDetalheApi } from "@/src/modules/aportes/apresentacao";
import type {
  AtivoAvaliado,
  LinhaDistribuicaoAtual,
  LinhaDistribuicaoSugerida,
} from "@/src/modules/aportes/tipos";

import {
  exibirChecklist,
  formatarDataHora,
  formatarMoeda,
  rotuloClassificacao,
  rotuloReferencia,
} from "../aportes-ui";
import { formatarPercentual, mesclarDistribuicao, rotuloDecisaoHistorico } from "./historico-ui";

/**
 * Snapshot somente leitura de uma sugestão (UI_SPEC §10.1; RN-052).
 *
 * Lê exatamente o que o contrato (§8.4) devolveu: distribuição atual e
 * sugerida por classe e segmento, ativos avaliados com classificação e
 * checklist, justificativas, alertas, decisão e observação. Nenhum controle de
 * decisão existe aqui — registrar decisão é da tela de Aportes (RN-053).
 */

/** Id do primeiro elemento focado ao abrir o detalhe (UI_SPEC §18). */
export const ID_FOCO_DETALHE = "historico-detalhe-inicio";

// ---------------------------------------------------------------------------
// Detalhe: distribuição do snapshot
// ---------------------------------------------------------------------------

interface DistribuicaoSnapshotProps {
  readonly id: string;
  readonly titulo: string;
  readonly descricao: string;
  readonly atual: readonly LinhaDistribuicaoAtual[];
  readonly sugerida: readonly LinhaDistribuicaoSugerida[];
  readonly incluirZerados: boolean;
}

/**
 * Fotografia da carteira × sugestão gravada (UI_SPEC §10.1).
 *
 * Tabela no desktop e cartões abaixo de 768 px (§15, §19). O percentual atual
 * e o valor sugerido convivem na mesma linha para que a leitura não dependa de
 * cruzar dois blocos; o "—" representa ausência de registro, nunca zero.
 */
function DistribuicaoSnapshot({
  id,
  titulo,
  descricao,
  atual,
  sugerida,
  incluirZerados,
}: DistribuicaoSnapshotProps) {
  const linhas = mesclarDistribuicao(atual, sugerida, incluirZerados);
  const tituloId = `${id}-titulo`;

  return (
    <section aria-labelledby={tituloId} className="space-y-2">
      <div className="space-y-1">
        <h4 id={tituloId} className="text-sm font-semibold text-neutral-900">
          {titulo}
        </h4>
        <p className="text-sm text-neutral-700">{descricao}</p>
      </div>

      {linhas.length === 0 ? (
        <p className="rounded-lg border border-neutral-200 bg-neutral-0 px-3 py-2 text-sm text-neutral-700">
          Nenhum registro de {titulo.toLowerCase()} neste pedido de sugestão.
        </p>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-xl border border-neutral-200 bg-neutral-0 md:block">
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <caption className="sr-only">
                {`${titulo}: participação atual, valor sugerido e justificativa de cada linha.`}
              </caption>
              <thead className="border-b border-neutral-200 bg-neutral-50 text-left">
                <tr>
                  <th scope="col" className="px-3 py-2 font-semibold text-neutral-700">
                    Referência
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold text-neutral-700">
                    Atual
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold text-neutral-700">
                    Sugerido
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold text-neutral-700">
                    Justificativa
                  </th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((linha) => (
                  <tr key={linha.codigo} className="border-b border-neutral-200 align-top last:border-b-0">
                    <th scope="row" className="px-3 py-3 text-left font-medium text-neutral-900">
                      {linha.rotulo}
                    </th>
                    <td className="whitespace-nowrap px-3 py-3 text-right text-neutral-900">
                      {linha.percentualAtual === null
                        ? "—"
                        : formatarPercentual(linha.percentualAtual)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right text-neutral-900">
                      {linha.valorSugerido === null ? "—" : formatarMoeda(linha.valorSugerido)}
                    </td>
                    <td className="px-3 py-3 text-neutral-700">
                      {linha.justificativa ?? "Não havia justificativa registrada para esta linha."}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="space-y-2 md:hidden">
            {linhas.map((linha) => (
              <li key={linha.codigo} className="rounded-xl border border-neutral-200 bg-neutral-0 p-3">
                <p className="break-words font-semibold text-neutral-900">{linha.rotulo}</p>
                <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                      Atual
                    </dt>
                    <dd className="mt-0.5 text-neutral-900">
                      {linha.percentualAtual === null
                        ? "—"
                        : formatarPercentual(linha.percentualAtual)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                      Sugerido
                    </dt>
                    <dd className="mt-0.5 text-neutral-900">
                      {linha.valorSugerido === null ? "—" : formatarMoeda(linha.valorSugerido)}
                    </dd>
                  </div>
                </dl>
                <p className="mt-2 break-words text-sm text-neutral-700">
                  {linha.justificativa ?? "Não havia justificativa registrada para esta linha."}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Detalhe: ativos avaliados
// ---------------------------------------------------------------------------

function ChecklistSnapshot({ ativo }: { readonly ativo: AtivoAvaliado }) {
  const itens = exibirChecklist(ativo.checklist);

  return (
    <div className="space-y-2">
      <h5 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Checklist</h5>
      <ul className="grid gap-2">
        {itens.map((item) => {
          const explicacaoId = `${ativo.ativoId}-${item.chave}-motivo`;

          return (
            <li
              key={item.chave}
              className="rounded-lg border border-neutral-200 bg-neutral-0 px-3 py-2"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="min-w-0 break-words text-sm text-neutral-900">{item.rotulo}</span>
                <span title={item.explicacao ?? undefined}>
                  <StatusBadge tone={item.tone}>{item.valor}</StatusBadge>
                </span>
              </div>
              {item.explicacao === null ? null : (
                <p id={explicacaoId} className="mt-1 text-xs text-neutral-500">
                  {item.explicacao}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function AtivoSnapshot({ ativo }: { readonly ativo: AtivoAvaliado }) {
  const classificacao = rotuloClassificacao(ativo.classificacao);
  const local = [
    rotuloReferencia(ativo.classe),
    ativo.segmento === null ? null : rotuloReferencia(ativo.segmento),
  ]
    .filter((valor): valor is string => valor !== null)
    .join(" · ");

  return (
    <li className="space-y-3 rounded-xl border border-neutral-200 bg-neutral-0 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <p className="break-words text-sm font-semibold text-neutral-900">
            {`${ativo.ticker} — ${ativo.nome}`}
          </p>
          <p className="break-words text-sm text-neutral-700">{local}</p>
        </div>
        <StatusBadge tone={classificacao.tone}>{classificacao.texto}</StatusBadge>
      </div>

      {ativo.motivos.length === 0 ? null : (
        <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-700">
          {ativo.motivos.map((motivo) => (
            <li key={motivo} className="break-words">
              {motivo}
            </li>
          ))}
        </ul>
      )}

      <ChecklistSnapshot ativo={ativo} />
    </li>
  );
}

// ---------------------------------------------------------------------------
// Detalhe: corpo do snapshot
// ---------------------------------------------------------------------------

export function DetalheSugestao({ sugestao }: { readonly sugestao: SugestaoDetalheApi }) {
  const decisao = rotuloDecisaoHistorico(sugestao.decisaoUsuario);
  const classes = mesclarDistribuicao(
    sugestao.distribuicaoAtual.classe,
    sugestao.distribuicaoSugerida.classe,
  ).length;
  const segmentos = mesclarDistribuicao(
    sugestao.distribuicaoAtual.segmento,
    sugestao.distribuicaoSugerida.segmento,
    false,
  ).length;

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h3
          id={ID_FOCO_DETALHE}
          tabIndex={-1}
          className="text-base font-semibold text-neutral-900"
        >
          {`Sugestão de ${formatarMoeda(sugestao.valorDisponivel)}`}
        </h3>
        <p className="text-sm text-neutral-700">
          {`Gerada em ${formatarDataHora(sugestao.data)}.`}
        </p>
      </div>

      <Alert tone="info" title="Somente leitura">
        <p>
          Este é o snapshot gravado da sugestão, com a decisão que ficou registrada. Registrar ou
          alterar a decisão acontece apenas na tela de Aportes.
        </p>
      </Alert>

      <dl className="grid gap-3 rounded-xl border border-neutral-200 bg-neutral-0 p-3 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">Valor</dt>
          <dd className="mt-0.5 text-sm font-semibold text-neutral-900">
            {formatarMoeda(sugestao.valorDisponivel)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">Decisão</dt>
          <dd className="mt-1 flex flex-wrap items-center gap-2 text-sm text-neutral-900">
            <StatusBadge tone={decisao.tone}>{decisao.texto}</StatusBadge>
            {sugestao.decisaoEm === null ? null : (
              <span className="text-neutral-700">
                {`registrada em ${formatarDataHora(sugestao.decisaoEm)}`}
              </span>
            )}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            Observação
          </dt>
          <dd className="mt-0.5 break-words text-sm text-neutral-900">
            {sugestao.observacoes === null || sugestao.observacoes.trim() === ""
              ? "Nenhuma observação registrada."
              : sugestao.observacoes}
          </dd>
        </div>
      </dl>

      <DistribuicaoSnapshot
        id="historico-detalhe-classe"
        titulo="Distribuição por classe"
        descricao="Participação atual no patrimônio e quanto a sugestão destinava a cada classe."
        atual={sugestao.distribuicaoAtual.classe}
        sugerida={sugestao.distribuicaoSugerida.classe}
        incluirZerados
      />

      {segmentos === 0 ? null : (
        <DistribuicaoSnapshot
          id="historico-detalhe-segmento"
          titulo="Distribuição por segmento"
          descricao="Recorte dentro da parcela de FII. Segmentos sem exposição e sem aporte não são listados."
          atual={sugestao.distribuicaoAtual.segmento}
          sugerida={sugestao.distribuicaoSugerida.segmento}
          incluirZerados={false}
        />
      )}

      <section aria-labelledby="historico-detalhe-ativos-titulo" className="space-y-2">
        <h4 id="historico-detalhe-ativos-titulo" className="text-sm font-semibold text-neutral-900">
          Ativos avaliados
        </h4>
        {sugestao.ativosAvaliados.length === 0 ? (
          <p className="rounded-lg border border-neutral-200 bg-neutral-0 px-3 py-2 text-sm text-neutral-700">
            Nenhum ativo foi avaliado nesta sugestão.
          </p>
        ) : (
          <ul className="space-y-3">
            {sugestao.ativosAvaliados.map((ativo) => (
              <AtivoSnapshot key={ativo.ativoId} ativo={ativo} />
            ))}
          </ul>
        )}
      </section>

      {sugestao.justificativas.length === 0 ? null : (
        <section aria-labelledby="historico-detalhe-justificativas-titulo" className="space-y-2">
          <h4
            id="historico-detalhe-justificativas-titulo"
            className="text-sm font-semibold text-neutral-900"
          >
            Justificativas
          </h4>
          <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-700">
            {sugestao.justificativas.map((justificativa) => (
              <li key={justificativa} className="break-words">
                {justificativa}
              </li>
            ))}
          </ul>
        </section>
      )}

      {sugestao.alertas.length === 0 ? null : (
        <Alert tone="warning" title="Alertas da sugestão">
          <ul className="list-disc space-y-1 pl-5">
            {sugestao.alertas.map((alerta) => (
              <li key={alerta} className="break-words">
                {alerta}
              </li>
            ))}
          </ul>
        </Alert>
      )}

      <p className="text-xs text-neutral-500">
        {`Snapshot com ${classes} ${classes === 1 ? "classe" : "classes"} e ${sugestao.ativosAvaliados.length} ${
          sugestao.ativosAvaliados.length === 1 ? "ativo avaliado" : "ativos avaliados"
        }.`}
      </p>
    </div>
  );
}
