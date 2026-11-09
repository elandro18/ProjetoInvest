import { errors, type AppError } from "../../lib/errors";
import { err, ok, type Result } from "../../lib/result";
import {
  type AtivoRegistro,
  type AtivoRepositorio,
  type CamposAtualizacao,
  type StatusAtivo,
} from "./repositorio";
import { validarSegmentoAtivo } from "./validar-segmento";
import { cnpjValido, normalizarOpcional } from "./validadores";

/**
 * Atualização parcial de ativo (RN-010-3; API_CONTRACTS.md §3.4).
 *
 * `ticker` e `classeId` são imutáveis. Hoje a classe é imutável sempre; a
 * permissão condicional da RN-015 (bloquear apenas quando existir movimentação)
 * entra quando a tabela de movimentações existir. Inativar é `status:
 * "INATIVO"` — nunca delete (RN-013).
 */

export interface AtualizarAtivoComando {
  readonly usuarioId: string;
  readonly ativoId: string;
  readonly nome?: string;
  readonly segmentoId?: string | null;
  readonly cnpj?: string | null;
  readonly administrador?: string | null;
  readonly gestor?: string | null;
  readonly fonteDados?: string | null;
  readonly status?: StatusAtivo;
  readonly observacoes?: string | null;
}

export interface AtualizarAtivoDeps {
  readonly repositorio: AtivoRepositorio;
}

/**
 * `ticker` e `classeId` nunca são atualizáveis pelo PATCH. A checagem é feita
 * sobre o corpo bruto porque o schema da borda descarta campos desconhecidos —
 * e um campo descartado em silêncio seria pior que um 422 explícito.
 */
export function validarCamposImutaveis(entrada: unknown): AppError | null {
  if (typeof entrada !== "object" || entrada === null) {
    return null;
  }

  if ("classeId" in entrada) {
    return errors.ativoClasseImutavel();
  }

  if ("ticker" in entrada) {
    return errors.validacao([{ field: "ticker", message: "O ticker não pode ser alterado." }]);
  }

  return null;
}

function montarCampos(comando: AtualizarAtivoComando): CamposAtualizacao {
  return {
    ...(comando.nome !== undefined ? { nome: comando.nome.trim() } : {}),
    ...(comando.segmentoId !== undefined ? { segmentoId: comando.segmentoId } : {}),
    ...(comando.cnpj !== undefined ? { cnpj: normalizarOpcional(comando.cnpj) } : {}),
    ...(comando.administrador !== undefined
      ? { administrador: normalizarOpcional(comando.administrador) }
      : {}),
    ...(comando.gestor !== undefined ? { gestor: normalizarOpcional(comando.gestor) } : {}),
    ...(comando.fonteDados !== undefined
      ? { fonteDados: normalizarOpcional(comando.fonteDados) }
      : {}),
    ...(comando.status !== undefined ? { status: comando.status } : {}),
    ...(comando.observacoes !== undefined
      ? { observacoes: normalizarOpcional(comando.observacoes) }
      : {}),
  };
}

export async function atualizarAtivo(
  comando: AtualizarAtivoComando,
  deps: AtualizarAtivoDeps,
): Promise<Result<AtivoRegistro, AppError>> {
  const atual = await deps.repositorio.buscarPorId(comando.usuarioId, comando.ativoId);
  if (atual === null) {
    return err(errors.ativoNaoEncontrado());
  }

  if (comando.segmentoId !== undefined) {
    const classe = await deps.repositorio.buscarClasse(atual.classe.id);
    if (classe === null) {
      return err(errors.ativoClasseInvalida());
    }

    const segmento = await validarSegmentoAtivo(classe, comando.segmentoId, deps.repositorio);
    if (!segmento.ok) {
      return segmento;
    }
  }

  if (
    comando.cnpj !== undefined &&
    comando.cnpj !== null &&
    !cnpjValido(comando.cnpj.trim())
  ) {
    return err(errors.ativoCnpjInvalido());
  }

  const atualizado = await deps.repositorio.atualizar(
    comando.usuarioId,
    comando.ativoId,
    montarCampos(comando),
  );

  return atualizado === null ? err(errors.ativoNaoEncontrado()) : ok(atualizado);
}
