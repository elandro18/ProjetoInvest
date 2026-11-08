/**
 * Medidor simples de força de senha (UI_SPEC §3.2, RN-071).
 *
 * A avaliação é heurística e local: serve para orientar o titular, não para
 * decidir validade. O critério de aceite continua no domínio (`senhaAceitavel`
 * — mínimo de 10 caracteres e lista de senhas comuns).
 */

export type ForcaPontuacao = 0 | 1 | 2 | 3 | 4;

export interface ForcaSenha {
  readonly pontuacao: ForcaPontuacao;
  readonly rotulo: string;
  readonly dicas: readonly string[];
}

export function avaliarForcaSenha(senha: string): ForcaSenha {
  if (senha === "") {
    return { pontuacao: 0, rotulo: "Digite uma senha", dicas: [] };
  }

  const criterios = [
    senha.length >= 10,
    senha.length >= 14,
    /[a-z]/.test(senha) && /[A-Z]/.test(senha),
    /\d/.test(senha),
    /[^A-Za-z0-9]/.test(senha),
  ];

  const atendidos = criterios.filter(Boolean).length;
  const pontuacao = Math.min(4, atendidos) as ForcaPontuacao;
  const rotulos: Record<ForcaPontuacao, string> = {
    0: "Muito fraca",
    1: "Fraca",
    2: "Razoável",
    3: "Boa",
    4: "Forte",
  };

  const dicas: string[] = [];
  if (senha.length < 10) {
    dicas.push("Use pelo menos 10 caracteres");
  } else if (senha.length < 14) {
    dicas.push("Senhas mais longas são mais seguras");
  }
  if (!(/[a-z]/.test(senha) && /[A-Z]/.test(senha))) {
    dicas.push("Misture letras maiúsculas e minúsculas");
  }
  if (!/\d/.test(senha)) {
    dicas.push("Inclua números");
  }
  if (!/[^A-Za-z0-9]/.test(senha)) {
    dicas.push("Inclua um símbolo");
  }

  return { pontuacao, rotulo: rotulos[pontuacao], dicas };
}
