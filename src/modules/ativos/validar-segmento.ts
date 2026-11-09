import { errors, type AppError } from "../../lib/errors";
import { err, ok, type Result } from "../../lib/result";
import {
  CODIGO_CLASSE_FII,
  type AtivoRepositorio,
  type ClasseAtivoRef,
} from "./repositorio";

/**
 * Regra FII ↔ segmento (RN-010; DATA_MODEL.md §4.4).
 *
 * Depende de `classe_ativo.codigo`, por isso vive no domínio e não como CHECK
 * de linha: FII exige segmento; qualquer outra classe não aceita segmento;
 * o segmento informado precisa existir, estar ativo e pertencer à classe.
 */
export async function validarSegmentoAtivo(
  classe: ClasseAtivoRef,
  segmentoId: string | null,
  repositorio: AtivoRepositorio,
): Promise<Result<string | null, AppError>> {
  const exigeSegmento = classe.codigo === CODIGO_CLASSE_FII;

  if (segmentoId === null) {
    return exigeSegmento ? err(errors.ativoSegmentoObrigatorio()) : ok(null);
  }

  const segmento = await repositorio.buscarSegmento(segmentoId);
  if (
    segmento === null ||
    !segmento.ativo ||
    !exigeSegmento ||
    segmento.classeId !== classe.id
  ) {
    return err(errors.ativoSegmentoInvalido());
  }

  return ok(segmento.id);
}
