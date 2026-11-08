import { z, type ZodType } from "zod";

import { errors } from "../../lib/errors";
import {
  CAPACIDADES,
  STATUS_DADO,
  type Capacidade,
  type DadoProveniente,
  type ProvedorDados,
  type StatusDado,
} from "../../modules/pesquisa/provedor";

/**
 * Provedor de teste/smoke (RN-001-4).
 *
 * Devolve `DadoProveniente` a partir de dados fixos e valida tanto o valor
 * (quando um schema é informado) quanto o envelope com Zod. **Não** é
 * registrado por padrão — nenhum adapter concreto entra na fundação.
 */

const dadoProvenienteSchema = z.object({
  valor: z.unknown(),
  fonte: z.string().min(1),
  provedorId: z.string().min(1),
  dataReferencia: z.iso.date(),
  coletadoEm: z.iso.datetime(),
  statusDado: z.enum(STATUS_DADO),
});

export interface ProvedorStubOptions {
  readonly nome?: string;
  readonly provedorId?: string;
  readonly capacidades?: readonly Capacidade[];
  readonly dados: Readonly<Record<string, unknown>>;
  readonly statusDado?: StatusDado;
  readonly dataReferencia?: string;
  readonly clock?: () => Date;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export class ProvedorStub implements ProvedorDados {
  readonly nome: string;
  readonly capacidades: ReadonlySet<Capacidade>;

  readonly #provedorId: string;
  readonly #dados: Readonly<Record<string, unknown>>;
  readonly #statusDado: StatusDado;
  readonly #dataReferencia: string;
  readonly #clock: () => Date;

  constructor(options: ProvedorStubOptions) {
    const nome = options.nome ?? "stub";
    this.nome = nome;
    this.capacidades = new Set(options.capacidades ?? CAPACIDADES);
    this.#provedorId = options.provedorId ?? nome;
    this.#dados = options.dados;
    this.#statusDado = options.statusDado ?? "ESTIMADO";
    this.#clock = options.clock ?? (() => new Date());
    this.#dataReferencia = options.dataReferencia ?? isoDate(this.#clock());
  }

  suporta(capacidade: Capacidade): boolean {
    return this.capacidades.has(capacidade);
  }

  #valor<T>(recurso: string, schema?: ZodType<T>): T {
    if (!Object.prototype.hasOwnProperty.call(this.#dados, recurso)) {
      throw errors.integracao("INT_ATIVO_NAO_ENCONTRADO", {
        details: { recurso, provedor: this.nome },
      });
    }

    const bruto = this.#dados[recurso];
    if (schema === undefined) {
      // Stub sem schema: o valor fixo é devolvido como veio.
      return bruto as T;
    }

    const parsed = schema.safeParse(bruto);
    if (!parsed.success) {
      throw errors.integracao("INT_RESPOSTA_INVALIDA", {
        details: { recurso, provedor: this.nome },
      });
    }

    return parsed.data;
  }

  #montarDado<T>(valor: T): DadoProveniente<T> {
    const dado: DadoProveniente<T> = {
      valor,
      fonte: this.nome,
      provedorId: this.#provedorId,
      dataReferencia: this.#dataReferencia,
      coletadoEm: this.#clock().toISOString(),
      statusDado: this.#statusDado,
    };

    if (!dadoProvenienteSchema.safeParse(dado).success) {
      throw errors.integracao("INT_RESPOSTA_INVALIDA", { details: { provedor: this.nome } });
    }

    return dado;
  }

  /** Simula uma operação de provedor: busca por chave no dados fixos. */
  async buscar<T = unknown>(
    recurso: string,
    capacidade: Capacidade,
    schema?: ZodType<T>,
  ): Promise<DadoProveniente<T>> {
    if (!this.suporta(capacidade)) {
      throw errors.integracao("INT_OPERACAO_NAO_SUPORTADA", {
        details: { capacidade, provedor: this.nome },
      });
    }

    return this.#montarDado(this.#valor(recurso, schema));
  }
}
