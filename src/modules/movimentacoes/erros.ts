import { AppError, errors } from "../../lib/errors";
import type { ErroPosicao } from "../posicao/tipos";

/**
 * Tradução dos erros do domínio de posição para o catálogo público
 * (ERROR_CATALOG.md §5). O domínio devolve `ErroPosicao`; a borda HTTP só
 * conhece `AppError`.
 */

export function mapearErroPosicao(erro: ErroPosicao): AppError {
  switch (erro.codigo) {
    case "MOV_POSICAO_NEGATIVA":
      return errors.movPosicaoNegativa({ ...erro.detalhes, requerConfirmacao: true });
    case "MOV_VALOR_INCONSISTENTE":
      return errors.movValorInconsistente(erro.detalhes);
    case "MOV_QTD_OBRIGATORIA":
      return errors.movQtdObrigatoria(erro.detalhes);
  }
}

/** `APLICACAO_RF`/`RESGATE_RF` dependem do vínculo com renda fixa (PEND-017). */
export const MENSAGEM_RENDA_FIXA = "Use o cadastro de renda fixa.";

export function erroRendaFixaSemVinculo(): AppError {
  return new AppError("VALIDACAO", {
    message: MENSAGEM_RENDA_FIXA,
    details: { errors: [{ field: "tipo", message: MENSAGEM_RENDA_FIXA }] },
  });
}

export function erroConfirmacaoSemMotivo(): AppError {
  return new AppError("VALIDACAO", {
    message: "Informe o motivo da confirmação.",
    details: {
      errors: [{ field: "motivo", message: "Informe o motivo da confirmação." }],
    },
  });
}
