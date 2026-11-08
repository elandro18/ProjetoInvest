/**
 * Versões vigentes dos documentos legais (RN-087).
 *
 * O cadastro registra a versão aceita em `aceite_legal.versao`; versão enviada
 * diferente da vigente é recusada com `AUTH_VERSAO_TERMOS_DESATUALIZADA`, para
 * que o titular nunca aceite um texto que não viu.
 */

export const VERSAO_TERMOS_USO = "2026-11-01";

export const VERSAO_POLITICA_PRIVACIDADE = "2026-11-01";

/** Versão vigente aceita no payload? Comparação literal (formato `AAAA-MM-DD`). */
export function versoesVigentes(versaoTermos: string, versaoPrivacidade: string): boolean {
  return (
    versaoTermos.trim() === VERSAO_TERMOS_USO &&
    versaoPrivacidade.trim() === VERSAO_POLITICA_PRIVACIDADE
  );
}
