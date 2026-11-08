/**
 * Limite de requisições por chave, em memória (RN-085, ADR-011).
 *
 * Janela fixa: a primeira requisição abre a janela e as seguintes só
 * incrementam o contador. Sem Redis na Fase 1, o limite é por processo —
 * suficiente para conter abuso trivial, não para coordenação entre réplicas.
 * `RATE_LIMIT_DESABILITADO=true` desliga o limite (CI e testes de carga).
 */

export interface RateLimitRegra {
  readonly limite: number;
  readonly janelaMs: number;
}

export interface RateLimitResultado {
  readonly permitido: boolean;
  readonly restante: number;
  readonly redefinirEm: Date;
}

interface Janela {
  contagem: number;
  redefinirEm: number;
}

const MAX_CHAVES = 500;

/** Janela de uma hora em milissegundos — usada pelos limites de conta. */
export const UMA_HORA_MS = 60 * 60 * 1000;

export class RateLimitMemoria {
  private readonly janelas = new Map<string, Janela>();

  private readonly desabilitado: boolean;

  constructor(desabilitado = process.env.RATE_LIMIT_DESABILITADO === "true") {
    this.desabilitado = desabilitado;
  }

  consumir(chave: string, regra: RateLimitRegra, agora = Date.now()): RateLimitResultado {
    if (this.desabilitado) {
      return { permitido: true, restante: regra.limite, redefinirEm: new Date(agora + regra.janelaMs) };
    }

    this.podar(agora);

    const janela = this.janelas.get(chave);
    if (janela === undefined || janela.redefinirEm <= agora) {
      const redefinirEm = agora + regra.janelaMs;
      this.janelas.set(chave, { contagem: 1, redefinirEm });
      return { permitido: true, restante: regra.limite - 1, redefinirEm: new Date(redefinirEm) };
    }

    janela.contagem += 1;
    return {
      permitido: janela.contagem <= regra.limite,
      restante: Math.max(0, regra.limite - janela.contagem),
      redefinirEm: new Date(janela.redefinirEm),
    };
  }

  /** Usado por testes e por reinício de ambiente. */
  limpar(): void {
    this.janelas.clear();
  }

  /** Evita crescimento sem limite: acima do teto, descarta janelas vencidas. */
  private podar(agora: number): void {
    if (this.janelas.size < MAX_CHAVES) {
      return;
    }

    for (const [chave, janela] of this.janelas) {
      if (janela.redefinirEm <= agora) {
        this.janelas.delete(chave);
      }
    }
  }
}

/** Instância compartilhada pelos Route Handlers (um processo, um contador). */
export const rateLimit = new RateLimitMemoria();
