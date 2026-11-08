/**
 * Validações de forma compartilhadas pelas telas de conta (UI_SPEC §16, RN-069).
 *
 * São regras de *forma*: presença e formato. Regra de negócio (senha vazada,
 * unicidade, token) continua no servidor — o cliente só antecipa o que dá para
 * validar localmente sem duplicar o domínio.
 */

const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const SENHA_MINIMA = 10;

const EMAIL_TAMANHO_MAXIMO = 160;

const NOME_TAMANHO_MINIMO = 3;

const NOME_TAMANHO_MAXIMO = 120;

export function emailValido(email: string): boolean {
  const normalizado = email.trim();
  return (
    normalizado.length > 0 &&
    normalizado.length <= EMAIL_TAMANHO_MAXIMO &&
    REGEX_EMAIL.test(normalizado)
  );
}

export function validarEmail(email: string): string | null {
  if (email.trim() === "") {
    return "Informe seu e-mail.";
  }
  if (!emailValido(email)) {
    return "Informe um e-mail válido.";
  }
  return null;
}

export function validarNome(nome: string): string | null {
  const normalizado = nome.trim();
  if (normalizado === "") {
    return "Informe seu nome.";
  }
  if (normalizado.length < NOME_TAMANHO_MINIMO) {
    return "O nome deve ter pelo menos 3 caracteres.";
  }
  if (normalizado.length > NOME_TAMANHO_MAXIMO) {
    return "O nome deve ter no máximo 120 caracteres.";
  }
  return null;
}

export function validarSenhaInformada(senha: string): string | null {
  return senha === "" ? "Informe sua senha." : null;
}

export function validarNovaSenha(senha: string): string | null {
  if (senha === "") {
    return "Informe uma senha.";
  }
  if (senha.length < SENHA_MINIMA) {
    return `A senha deve ter pelo menos ${SENHA_MINIMA} caracteres.`;
  }
  return null;
}

export function validarConfirmacao(senha: string, confirmacao: string): string | null {
  if (confirmacao === "") {
    return "Confirme a senha.";
  }
  if (senha !== confirmacao) {
    return "As senhas não coincidem.";
  }
  return null;
}
