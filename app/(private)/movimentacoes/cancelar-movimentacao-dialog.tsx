"use client";

import { useState } from "react";

import { Alert } from "@/src/components/ui/alert";
import { Button } from "@/src/components/ui/button";
import { Dialog } from "@/src/components/ui/dialog";
import { TextareaField } from "@/src/components/ui/textarea-field";
import {
  apiRequest,
  ehErroDeSessao,
  mensagemDeErro,
} from "@/src/lib/api-client";
import {
  MOTIVO_MAX,
  formatarData,
  formatarMoeda,
  mapaDeErrosMovimentacao,
  rotuloTipo,
  validarMotivo,
  type MovimentacaoApi,
  type RespostaCancelamentoApi,
} from "./movimentacoes-ui";

export interface CancelarMovimentacaoDialogProps {
  readonly movimentacao: MovimentacaoApi;
  readonly onFechar: () => void;
  readonly onCancelada: (resposta: RespostaCancelamentoApi) => void;
  readonly onSessaoExpirada: () => void;
}

/**
 * Cancelamento lógico de movimentação (RN-084; UI_SPEC §7).
 *
 * Nunca exclui o registro: grava o motivo no servidor e o item continua na
 * lista como cancelado. A posição recalculada volta na resposta e é usada no
 * feedback ao titular.
 */
export function CancelarMovimentacaoDialog({
  movimentacao,
  onFechar,
  onCancelada,
  onSessaoExpirada,
}: CancelarMovimentacaoDialogProps) {
  const [motivo, setMotivo] = useState("");
  const [erroMotivo, setErroMotivo] = useState<string | null>(null);
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function cancelar() {
    const validacao = validarMotivo(motivo);
    if (validacao !== null) {
      setErroMotivo(validacao);
      return;
    }

    setErroMotivo(null);
    setErroGeral(null);
    setEnviando(true);
    try {
      const resultado = await apiRequest<RespostaCancelamentoApi>(
        `/api/movimentacoes/${encodeURIComponent(movimentacao.id)}/cancelamento`,
        { method: "POST", body: { motivo: motivo.trim() } },
      );

      if (!resultado.ok) {
        if (ehErroDeSessao(resultado.error)) {
          onSessaoExpirada();
          return;
        }

        const mapa = mapaDeErrosMovimentacao(resultado.error);
        if (mapa.motivo !== undefined) {
          setErroMotivo(mapa.motivo);
          return;
        }
        setErroGeral(mensagemDeErro(resultado.error));
        return;
      }

      onCancelada(resultado.data);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog
      open
      title="Cancelar movimentação"
      onClose={onFechar}
      initialFocusId="mov-motivo-cancelamento"
    >
      <p>
        A movimentação de <strong>{rotuloTipo(movimentacao.tipo)}</strong> de{" "}
        <strong>{movimentacao.ativo.ticker}</strong> em{" "}
        {formatarData(movimentacao.data)} ({formatarMoeda(movimentacao.valorTotal)}) será
        marcada como cancelada. O registro permanece no histórico e a posição é recalculada.
      </p>

      <TextareaField
        id="mov-motivo-cancelamento"
        label="Motivo do cancelamento"
        name="motivoCancelamento"
        maxLength={MOTIVO_MAX}
        hint={`Obrigatório, até ${MOTIVO_MAX} caracteres.`}
        value={motivo}
        error={erroMotivo ?? undefined}
        onChange={(event) => {
          setMotivo(event.target.value);
          setErroMotivo(null);
        }}
        onBlur={() => setErroMotivo(validarMotivo(motivo))}
      />

      {erroGeral === null ? null : (
        <Alert tone="error" title="Não foi possível cancelar">
          <p>{erroGeral}</p>
        </Alert>
      )}

      <div className="flex flex-wrap gap-2">
        <Button variant="danger" onClick={cancelar} carregando={enviando}>
          {enviando ? "Cancelando…" : "Confirmar cancelamento"}
        </Button>
        <Button variant="secondary" onClick={onFechar} disabled={enviando}>
          Voltar
        </Button>
      </div>
    </Dialog>
  );
}
