"use client";

import { useRef, useState, type FormEvent } from "react";

import { Button } from "@/src/components/ui/button";
import { Dialog } from "@/src/components/ui/dialog";
import { FormError } from "@/src/components/ui/form-error";
import { SelectField } from "@/src/components/ui/select-field";
import { TextField } from "@/src/components/ui/text-field";
import {
  apiRequest,
  ehErroDeSessao,
  mensagemDeErro,
} from "@/src/lib/api-client";
import {
  OPCOES_STATUS_SALDO,
  decimalParaApi,
  formatarNumeroDecimal,
  mapaDeErrosRendaFixa,
  rotuloProduto,
  validarSaldoRendaFixa,
  type RendaFixaApi,
  type StatusSaldo,
} from "./renda-fixa-ui";

export interface AtualizarSaldoDialogProps {
  readonly titulo: RendaFixaApi;
  readonly onFechar: () => void;
  readonly onAtualizado: (atualizado: RendaFixaApi) => void;
  readonly onSessaoExpirada: () => void;
}

/**
 * Atualização de saldo e status (RN-059; API_CONTRACTS.md §6.3).
 *
 * Só os campos editáveis entram no `PATCH`: identidade do título (produto,
 * indexador, taxa, datas) é imutável — alterá-la exige um novo cadastro
 * (`RF_CAMPO_IMUTAVEL`). O status é o que dá confiança ao número: "Estimado"
 * aparece em âmbar na lista, nunca como valor oficial.
 */
export function AtualizarSaldoDialog({
  titulo,
  onFechar,
  onAtualizado,
  onSessaoExpirada,
}: AtualizarSaldoDialogProps) {
  const saldoRef = useRef<HTMLInputElement>(null);

  const [saldo, setSaldo] = useState(formatarNumeroDecimal(titulo.saldoAtual));
  const [statusSaldo, setStatusSaldo] = useState<StatusSaldo>(titulo.statusSaldo);
  const [erroSaldo, setErroSaldo] = useState<string | null>(null);
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  function fechar() {
    if (salvando) {
      return;
    }
    onFechar();
  }

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErroGeral(null);

    const mensagem = validarSaldoRendaFixa(saldo);
    if (mensagem !== null) {
      setErroSaldo(mensagem);
      saldoRef.current?.focus();
      return;
    }
    setErroSaldo(null);

    const saldoApi = decimalParaApi(saldo, 2, true);
    if (saldoApi === null) {
      setErroSaldo("Saldo atual inválido.");
      saldoRef.current?.focus();
      return;
    }

    setSalvando(true);
    try {
      const resultado = await apiRequest<RendaFixaApi>(`/api/renda-fixa/${titulo.id}`, {
        method: "PATCH",
        body: { saldoAtual: saldoApi, statusSaldo },
      });

      if (!resultado.ok) {
        if (ehErroDeSessao(resultado.error)) {
          onSessaoExpirada();
          return;
        }

        const mapa = mapaDeErrosRendaFixa(resultado.error);
        if (mapa.saldoAtual !== undefined) {
          setErroSaldo(mapa.saldoAtual);
          saldoRef.current?.focus();
          return;
        }
        setErroGeral(mensagemDeErro(resultado.error));
        return;
      }

      onAtualizado(resultado.data);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog
      open
      title="Atualizar saldo"
      onClose={fechar}
      initialFocusId="rf-novo-saldo"
    >
      <p className="text-sm text-neutral-700">
        <strong className="text-neutral-900">
          {rotuloProduto(titulo.produto)} · {titulo.instituicao}
        </strong>
        <br />
        O saldo é informado manualmente pelo titular e classificado por confiança. O sistema não
        calcula rendimento nesta fase.
      </p>

      <form noValidate onSubmit={enviar} aria-busy={salvando} className="space-y-4">
        {erroGeral === null ? null : <FormError>{erroGeral}</FormError>}

        <TextField
          ref={saldoRef}
          id="rf-novo-saldo"
          label="Saldo atual (R$)"
          name="saldoAtual"
          inputMode="decimal"
          autoComplete="off"
          hint="Use vírgula para centavos (ex.: 10.450,00)."
          value={saldo}
          error={erroSaldo ?? undefined}
          onChange={(event) => {
            setSaldo(event.target.value);
            setErroSaldo(null);
          }}
          onBlur={() => setErroSaldo(validarSaldoRendaFixa(saldo))}
        />

        <SelectField
          label="Status do saldo"
          name="statusSaldo"
          value={statusSaldo}
          hint="“Estimado” aparece em âmbar na lista; “Confirmado” indica valor conferido."
          onChange={(event) => setStatusSaldo(event.target.value as StatusSaldo)}
        >
          {OPCOES_STATUS_SALDO.map((opcao) => (
            <option key={opcao.valor} value={opcao.valor}>
              {opcao.rotulo}
            </option>
          ))}
        </SelectField>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" carregando={salvando}>
            {salvando ? "Salvando…" : "Salvar saldo"}
          </Button>
          <Button variant="secondary" onClick={fechar} disabled={salvando}>
            Cancelar
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
