"use client";

import { useState } from "react";

import { Alert } from "@/src/components/ui/alert";
import { Button } from "@/src/components/ui/button";
import { Dialog } from "@/src/components/ui/dialog";
import { TextareaField } from "@/src/components/ui/textarea-field";
import {
  MOTIVO_MAX,
  formatarQuantidade,
  validarMotivo,
  type ImpactoPosicaoNegativa,
} from "./movimentacoes-ui";

export interface ConfirmarPosicaoNegativaDialogProps {
  readonly impacto: ImpactoPosicaoNegativa;
  readonly ativoTicker: string;
  readonly enviando: boolean;
  readonly erroGeral: string | null;
  readonly erroMotivo: string | null;
  readonly onConfirmar: (motivo: string) => void;
  readonly onVoltar: () => void;
}

/**
 * Confirmação de exceção de posição negativa (RN-018; AC-018b).
 *
 * Mostra o impacto exato devolvido pelo servidor (posição atual, quantidade
 * solicitada e resultante) e exige motivo auditável antes de reenviar com
 * `confirmarPosicaoNegativa: true` (API_CONTRACTS.md §4.2).
 */
export function ConfirmarPosicaoNegativaDialog({
  impacto,
  ativoTicker,
  enviando,
  erroGeral,
  erroMotivo,
  onConfirmar,
  onVoltar,
}: ConfirmarPosicaoNegativaDialogProps) {
  const [motivo, setMotivo] = useState("");
  const [erroLocal, setErroLocal] = useState<string | null>(null);

  const mensagemMotivo = erroMotivo ?? erroLocal;

  function confirmar() {
    const validacao = validarMotivo(motivo);
    if (validacao !== null) {
      setErroLocal(validacao);
      return;
    }
    setErroLocal(null);
    onConfirmar(motivo.trim());
  }

  return (
    <Dialog
      open
      title="Posição ficaria negativa"
      onClose={onVoltar}
      initialFocusId="mov-motivo-posicao-negativa"
    >
      <p>
        A venda de <strong>{ativoTicker}</strong> deixaria a posição do ativo negativa. Confirme
        apenas se esta exceção é intencional; o motivo fica registrado na auditoria.
      </p>

      <dl className="grid grid-cols-1 gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3 sm:grid-cols-3">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            Posição atual
          </dt>
          <dd className="mt-0.5 text-base font-semibold text-neutral-900">
            {formatarQuantidade(impacto.quantidadeAtual)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            Quantidade solicitada
          </dt>
          <dd className="mt-0.5 text-base font-semibold text-neutral-900">
            {formatarQuantidade(impacto.quantidadeSolicitada)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            Posição resultante
          </dt>
          <dd className="mt-0.5 text-base font-semibold text-negative">
            {formatarQuantidade(impacto.quantidadeResultante)}
          </dd>
        </div>
      </dl>

      <Alert tone="warning" title="Exceção auditada">
        <p>
          A posição negativa não é gravada no cache; a movimentação passa a ser a fonte da
          verdade até uma nova compra regularizar o saldo.
        </p>
      </Alert>

      <TextareaField
        id="mov-motivo-posicao-negativa"
        label="Motivo da confirmação"
        name="motivoPosicaoNegativa"
        maxLength={MOTIVO_MAX}
        hint="Obrigatório. Descreva por que a venda excede a posição."
        value={motivo}
        error={mensagemMotivo ?? undefined}
        onChange={(event) => {
          setMotivo(event.target.value);
          setErroLocal(null);
        }}
        onBlur={() => setErroLocal(validarMotivo(motivo))}
      />

      {erroGeral === null ? null : <Alert tone="error" title="Não foi possível confirmar">{erroGeral}</Alert>}

      <div className="flex flex-wrap gap-2">
        <Button variant="danger" onClick={confirmar} carregando={enviando}>
          {enviando ? "Confirmando…" : "Confirmar venda"}
        </Button>
        <Button variant="secondary" onClick={onVoltar} disabled={enviando}>
          Voltar
        </Button>
      </div>
    </Dialog>
  );
}
