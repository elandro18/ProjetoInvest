/**
 * Janela móvel de meses da série de rendimentos (RN-062).
 *
 * A data de referência chega já resolvida no calendário de São Paulo
 * (`hojeIsoSaoPaulo`, RN-020). A aritmética é feita com ano/mês civis, sem
 * `Date` local — o processo pode estar em UTC ou em qualquer fuso.
 */

export interface JanelaMeses {
  /** Primeiro dia do mês mais antigo da janela (`YYYY-MM-DD`). */
  readonly de: string;
  /** Data de referência (`YYYY-MM-DD`). */
  readonly ate: string;
  /** Meses em ordem crescente, incluindo o corrente (`YYYY-MM`). */
  readonly meses: readonly string[];
}

function chaveMes(ano: number, mes: number): string {
  return `${String(ano).padStart(4, "0")}-${String(mes).padStart(2, "0")}`;
}

/**
 * Meses em ordem crescente, terminando no mês da data de referência.
 * `2026-11-09` com `quantidade = 12` devolve `2025-12` … `2026-11`.
 */
export function mesesDaJanela(
  dataReferencia: string,
  quantidade: number,
): readonly string[] {
  if (quantidade <= 0) {
    return [];
  }

  const [ano, mes] = dataReferencia.split("-").map(Number);

  // Índice absoluto (ano * 12 + mês zero-based) simplifica a virada de ano.
  let indice = ano * 12 + (mes - 1) - (quantidade - 1);
  const meses: string[] = [];

  for (let i = 0; i < quantidade; i += 1) {
    const anoDoMes = Math.floor(indice / 12);
    const mesDoAno = (indice % 12) + 1;
    meses.push(chaveMes(anoDoMes, mesDoAno));
    indice += 1;
  }

  return meses;
}

/** Janela dos últimos `quantidade` meses, com `de` no primeiro dia do mês. */
export function janelaMeses(
  dataReferencia: string,
  quantidade = 12,
): JanelaMeses {
  const meses = mesesDaJanela(dataReferencia, quantidade);
  const primeiro = meses[0];

  return {
    de: primeiro === undefined ? dataReferencia : `${primeiro}-01`,
    ate: dataReferencia,
    meses,
  };
}
