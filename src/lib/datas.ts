/**
 * Datas de negócio (`YYYY-MM-DD`) compartilhadas pelos módulos (RN-057, RN-014).
 *
 * Toda comparação é feita em UTC para não depender do fuso do processo. A
 * validação é por round-trip: `2026-02-30` vira `2026-03-02` no `Date` e é
 * rejeitada porque os componentes não batem.
 */

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;
const MS_POR_DIA = 24 * 60 * 60 * 1000;

function parseIso(valor: string): number | null {
  if (!DATA_ISO.test(valor)) {
    return null;
  }

  const [ano, mes, dia] = valor.split("-").map(Number);
  const ms = Date.UTC(ano, mes - 1, dia);
  const data = new Date(ms);

  if (
    data.getUTCFullYear() !== ano ||
    data.getUTCMonth() !== mes - 1 ||
    data.getUTCDate() !== dia
  ) {
    return null;
  }

  return ms;
}

export function dataIsoValida(valor: string): boolean {
  return parseIso(valor) !== null;
}

/** Data de hoje em UTC, no formato de negócio. */
export function hojeIso(agora: Date = new Date()): string {
  return agora.toISOString().slice(0, 10);
}

/** Converte um `Date` de coluna `date` (meia-noite UTC) para `YYYY-MM-DD`. */
export function dataParaIso(data: Date): string {
  return data.toISOString().slice(0, 10);
}

/** Converte `YYYY-MM-DD` para o `Date` aceito pelo Prisma em colunas `date`. */
export function isoParaData(valor: string): Date {
  const ms = parseIso(valor);
  if (ms === null) {
    throw new Error(`Data inválida: ${valor}`);
  }
  return new Date(ms);
}

/**
 * Dias inteiros de `de` até `ate` (positivo quando `ate` é futuro).
 * Datas inválidas nunca chegam aqui — são barradas pelos validadores.
 */
export function diasEntre(de: string, ate: string): number {
  const inicio = parseIso(de);
  const fim = parseIso(ate);

  if (inicio === null || fim === null) {
    throw new Error("Data inválida na comparação de dias.");
  }

  return Math.round((fim - inicio) / MS_POR_DIA);
}

/** Formata `YYYY-MM-DD` como `DD/MM/YYYY` para mensagens em PT-BR. */
export function formatarDataBr(valor: string): string {
  const [ano, mes, dia] = valor.split("-");
  return `${dia}/${mes}/${ano}`;
}
