/**
 * Validadores puros do cadastro de ativos (RN-010).
 *
 * Ticker é normalizado para maiúsculas antes de qualquer regra — a unicidade
 * por usuário é case-insensitive na prática porque o valor persistido é sempre
 * maiúsculo. CNPJ é validado por dígito verificador, nunca por tamanho apenas.
 */

const TICKER_FORMATO = /^[A-Z0-9]{4,20}$/;
const CNPJ_FORMATO = /^\d{14}$/;
const CNPJ_REPETIDO = /^(\d)\1{13}$/;

const PESOS_PRIMEIRO_DIGITO = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const PESOS_SEGUNDO_DIGITO = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

/** Remove espaços e aplica maiúsculas (contrato §3.2). */
export function normalizarTicker(valor: string): string {
  return valor.trim().toUpperCase();
}

export function tickerValido(ticker: string): boolean {
  return TICKER_FORMATO.test(ticker);
}

/** Texto opcional: `trim`; vazio vira `null` para não persistir string vazia. */
export function normalizarOpcional(valor: string | null): string | null {
  if (valor === null) {
    return null;
  }
  const normalizado = valor.trim();
  return normalizado.length === 0 ? null : normalizado;
}

function digitoVerificador(digitos: readonly number[], pesos: readonly number[]): number {
  const soma = digitos.reduce((total, digito, indice) => total + digito * pesos[indice], 0);
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

/** CNPJ com 14 dígitos e ambos os dígitos verificadores corretos. */
export function cnpjValido(valor: string): boolean {
  if (!CNPJ_FORMATO.test(valor) || CNPJ_REPETIDO.test(valor)) {
    return false;
  }

  const digitos = [...valor].map(Number);
  const primeiro = digitoVerificador(digitos.slice(0, 12), PESOS_PRIMEIRO_DIGITO);
  if (primeiro !== digitos[12]) {
    return false;
  }

  const segundo = digitoVerificador(digitos.slice(0, 13), PESOS_SEGUNDO_DIGITO);
  return segundo === digitos[13];
}
