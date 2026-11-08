import type { PrismaClient } from "@prisma/client";

import { errors } from "../../lib/errors";
import {
  isCapacidade,
  type Capacidade,
  type ProvedorDados,
} from "../../modules/pesquisa/provedor";

/**
 * Registry de provedores (ARCHITECTURE.md §5.2 / RN-030).
 *
 * A precedência é configuração (`provedor_dados.prioridade`), nunca código:
 * o registry lê o cadastro, filtra os ativos, ordena por prioridade e devolve
 * o primeiro provedor que tem a capacidade **e** um adapter registrado.
 *
 * Nenhum adapter concreto é registrado por padrão — quem compõe a aplicação
 * injeta o mapa `nome -> adapter` (RN-031/RN-033).
 */

export interface ProvedorRegistro {
  readonly id: string;
  readonly nome: string;
  readonly capacidades: readonly Capacidade[];
  readonly prioridade: number;
  readonly ativo: boolean;
}

/** Port de leitura do cadastro — implementado por Prisma em produção. */
export interface ProvedorFonte {
  listar(): Promise<readonly ProvedorRegistro[]>;
}

export interface ProvedorResolvido {
  readonly id: string;
  readonly nome: string;
  readonly prioridade: number;
  readonly provedor: ProvedorDados;
}

export interface ProvedorRegistryOptions {
  readonly fonte: ProvedorFonte;
  readonly adapters: Readonly<Record<string, ProvedorDados>>;
}

/** Normaliza o `jsonb` de capacidades: descarta valores fora do contrato e duplicatas. */
export function normalizarCapacidades(valor: unknown): Capacidade[] {
  if (!Array.isArray(valor)) {
    return [];
  }

  const capacidades = new Set<Capacidade>();
  for (const item of valor) {
    if (isCapacidade(item)) {
      capacidades.add(item);
    }
  }

  return [...capacidades];
}

function porPrioridade(a: ProvedorRegistro, b: ProvedorRegistro): number {
  if (a.prioridade !== b.prioridade) {
    return a.prioridade - b.prioridade;
  }
  return a.nome.localeCompare(b.nome, "pt-BR");
}

export class ProvedorRegistry {
  readonly #fonte: ProvedorFonte;
  readonly #adapters: Readonly<Record<string, ProvedorDados>>;

  constructor(options: ProvedorRegistryOptions) {
    this.#fonte = options.fonte;
    this.#adapters = options.adapters;
  }

  /**
   * Resolve o provedor de maior prioridade para a capacidade.
   *
   * Provedor inativo, sem adapter ou sem a capacidade é ignorado; se nenhum
   * sobrar, lança `INT_OPERACAO_NAO_SUPORTADA` — nunca devolve valor zero.
   */
  async resolver(capacidade: Capacidade): Promise<ProvedorResolvido> {
    const registros = await this.#fonte.listar();

    const candidatos = registros
      .filter((registro) => registro.ativo && registro.capacidades.includes(capacidade))
      .sort(porPrioridade);

    for (const registro of candidatos) {
      const adapter = this.#adapters[registro.nome];
      if (adapter === undefined || !adapter.suporta(capacidade)) {
        continue;
      }

      return {
        id: registro.id,
        nome: registro.nome,
        prioridade: registro.prioridade,
        provedor: adapter,
      };
    }

    throw errors.integracao("INT_OPERACAO_NAO_SUPORTADA", {
      details: { capacidade },
    });
  }
}

export function createProvedorRegistry(options: ProvedorRegistryOptions): ProvedorRegistry {
  return new ProvedorRegistry(options);
}

interface LinhaProvedor {
  readonly id: string;
  readonly nome: string;
  readonly capacidades: unknown;
  readonly prioridade: number;
  readonly ativo: boolean;
}

export function createPrismaProvedorFonte(prisma: PrismaClient): ProvedorFonte {
  return {
    async listar(): Promise<readonly ProvedorRegistro[]> {
      const linhas = await prisma.provedorDados.findMany({
        where: { ativo: true },
        select: { id: true, nome: true, capacidades: true, prioridade: true, ativo: true },
        orderBy: { prioridade: "asc" },
      });

      return linhas.map((linha: LinhaProvedor) => ({
        id: linha.id,
        nome: linha.nome,
        capacidades: normalizarCapacidades(linha.capacidades),
        prioridade: linha.prioridade,
        ativo: linha.ativo,
      }));
    },
  };
}
