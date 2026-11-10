"use client";

import { Button } from "@/src/components/ui/button";
import { SelectField } from "@/src/components/ui/select-field";
import { TextField } from "@/src/components/ui/text-field";

import {
  DIMENSOES_UI,
  dicaReferencia,
  idDoCampo,
  type CampoLimite,
  type LinhaLimiteForm,
  type MapaErrosLimite,
} from "./configuracoes-ui";

export interface LimitesFormProps {
  readonly linhas: readonly LinhaLimiteForm[];
  readonly erros: MapaErrosLimite;
  readonly salvando: boolean;
  readonly onAlterar: (id: string, campo: CampoLimite, valor: string) => void;
  readonly onAdicionar: () => void;
  readonly onRemover: (id: string) => void;
  readonly onSalvar: () => void;
}

/**
 * Seção **Limites de concentração** (RN-049-4; UI_SPEC §14.1, §16).
 *
 * O `PUT` substitui o conjunto inteiro: por isso a lista é editada como um
 * todo e o botão de salvar nunca fica escondido — a validação acontece no
 * submit, com mensagem por campo e foco no primeiro inválido. O botão só fica
 * desabilitado durante o envio; remover todas as linhas é uma operação válida
 * (desliga os alertas do painel).
 */
export function LimitesForm({
  linhas,
  erros,
  salvando,
  onAlterar,
  onAdicionar,
  onRemover,
  onSalvar,
}: LimitesFormProps) {
  return (
    <section aria-labelledby="configuracoes-limites-titulo" className="space-y-4">
      <div className="space-y-1">
        <h2 id="configuracoes-limites-titulo" className="text-xl font-semibold text-neutral-900">
          Limites de concentração
        </h2>
        <p className="text-sm text-neutral-700">
          Defina o percentual máximo por dimensão. A referência é opcional: vazio vale como
          padrão da dimensão, e um limite específico de referência vence o padrão.
        </p>
      </div>

      <div className="flex justify-end">
        <Button variant="secondary" onClick={onAdicionar}>
          Adicionar limite
        </Button>
      </div>

      {linhas.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-200 bg-neutral-0 px-4 py-6 text-sm text-neutral-700">
          Nenhum limite configurado. Sem limite, o painel mostra os percentuais sem badge de
          alerta. Adicione uma linha para começar.
        </p>
      ) : (
        <ul className="space-y-3">
          {linhas.map((linha, indice) => {
            const numero = indice + 1;
            const errosDaLinha = erros[linha.id];
            const dimensaoDesconhecida = !DIMENSOES_UI.some(
              (item) => item.valor === linha.dimensao,
            );

            return (
              <li
                key={linha.id}
                className="rounded-xl border border-neutral-200 bg-neutral-0 p-4"
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <SelectField
                    id={idDoCampo(linha.id, "dimensao")}
                    label={`Dimensão do limite ${numero}`}
                    value={linha.dimensao}
                    onChange={(event) => onAlterar(linha.id, "dimensao", event.target.value)}
                    error={errosDaLinha?.dimensao}
                  >
                    {dimensaoDesconhecida ? (
                      <option value={linha.dimensao}>{linha.dimensao}</option>
                    ) : null}
                    {DIMENSOES_UI.map((dimensao) => (
                      <option key={dimensao.valor} value={dimensao.valor}>
                        {dimensao.rotulo}
                      </option>
                    ))}
                  </SelectField>

                  <TextField
                    id={idDoCampo(linha.id, "percentual")}
                    label={`Percentual máximo do limite ${numero} (%)`}
                    inputMode="decimal"
                    autoComplete="off"
                    value={linha.percentual}
                    onChange={(event) => onAlterar(linha.id, "percentual", event.target.value)}
                    error={errosDaLinha?.percentual}
                    hint="Maior que 0 e até 100."
                  />

                  <div className="sm:col-span-2">
                    <TextField
                      id={idDoCampo(linha.id, "referencia")}
                      label={`Referência do limite ${numero} (opcional)`}
                      autoComplete="off"
                      maxLength={120}
                      value={linha.referencia}
                      onChange={(event) =>
                        onAlterar(linha.id, "referencia", event.target.value)
                      }
                      error={errosDaLinha?.referencia}
                      hint={dicaReferencia(linha.dimensao)}
                    />
                  </div>

                  <div className="flex justify-end sm:col-span-2">
                    <Button
                      variant="ghost"
                      onClick={() => onRemover(linha.id)}
                      aria-label={`Remover limite ${numero}`}
                    >
                      Remover
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-col gap-3 border-t border-neutral-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-neutral-700">
          {linhas.length === 0
            ? "Salvar vai remover todos os limites vigentes."
            : "Ao salvar, o conjunto vigente passa para o histórico."}
        </p>
        <Button onClick={onSalvar} carregando={salvando}>
          Salvar limites
        </Button>
      </div>
    </section>
  );
}
