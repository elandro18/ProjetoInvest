import { errors, type AppError } from "../../lib/errors";
import { err, ok, type Result } from "../../lib/result";
import {
  AtivoTickerDuplicadoError,
  type AtivoRegistro,
  type AtivoRepositorio,
} from "./repositorio";
import { validarSegmentoAtivo } from "./validar-segmento";
import { cnpjValido, normalizarOpcional, normalizarTicker, tickerValido } from "./validadores";

/**
 * Criação de ativo (RN-010-2; API_CONTRACTS.md §3.2).
 *
 * Ordem das regras: formato do ticker → CNPJ (quando informado) → classe
 * existente/ativa → vínculo classe/segmento → unicidade por usuário. A
 * violação de unicidade também é tratada na escrita, para o caso de corrida
 * entre a checagem e o insert.
 */

export interface CriarAtivoComando {
  readonly usuarioId: string;
  readonly ticker: string;
  readonly nome: string;
  readonly classeId: string;
  readonly segmentoId: string | null;
  readonly cnpj: string | null;
  readonly administrador: string | null;
  readonly gestor: string | null;
  readonly fonteDados: string | null;
  readonly observacoes: string | null;
}

export interface CriarAtivoDeps {
  readonly repositorio: AtivoRepositorio;
}

export async function criarAtivo(
  comando: CriarAtivoComando,
  deps: CriarAtivoDeps,
): Promise<Result<AtivoRegistro, AppError>> {
  const ticker = normalizarTicker(comando.ticker);
  if (!tickerValido(ticker)) {
    return err(errors.ativoTickerInvalido());
  }

  const cnpj = normalizarOpcional(comando.cnpj);
  if (cnpj !== null && !cnpjValido(cnpj)) {
    return err(errors.ativoCnpjInvalido());
  }

  const classe = await deps.repositorio.buscarClasse(comando.classeId);
  if (classe === null || !classe.ativo) {
    return err(errors.ativoClasseInvalida());
  }

  const segmento = await validarSegmentoAtivo(classe, comando.segmentoId, deps.repositorio);
  if (!segmento.ok) {
    return segmento;
  }

  if (await deps.repositorio.existeTicker(comando.usuarioId, ticker)) {
    return err(errors.ativoTickerDuplicado());
  }

  try {
    const criado = await deps.repositorio.criar({
      usuarioId: comando.usuarioId,
      ticker,
      nome: comando.nome.trim(),
      classeId: classe.id,
      segmentoId: segmento.value,
      cnpj,
      administrador: normalizarOpcional(comando.administrador),
      gestor: normalizarOpcional(comando.gestor),
      status: "ATIVO",
      fonteDados: normalizarOpcional(comando.fonteDados),
      observacoes: normalizarOpcional(comando.observacoes),
    });

    return ok(criado);
  } catch (erro) {
    if (erro instanceof AtivoTickerDuplicadoError) {
      return err(errors.ativoTickerDuplicado());
    }
    throw erro;
  }
}
