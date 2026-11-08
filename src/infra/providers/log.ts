import type { PrismaClient } from "@prisma/client";

import { AppError } from "../../lib/errors";
import { logger } from "../logging/logger";
import type { DadoProveniente } from "../../modules/pesquisa/provedor";

/**
 * Registro de auditoria de chamadas a provedores externos (RN-074).
 *
 * A `mensagem` passa por sanitização **antes** de tocar o banco:
 * - token/chave/segredo/credencial viram `[REDACTED]`;
 * - valores financeiros viram `[OMITIDO]`;
 * - quebras de linha são colapsadas e o texto é truncado no limite da coluna.
 *
 * Payload completo de resposta nunca deve ser passado como `mensagem`.
 */

export const STATUS_INTEGRACAO = [
  "SUCESSO",
  "ERRO",
  "TIMEOUT",
  "LIMITE",
  "DADOS_INCOMPLETOS",
] as const;

export type StatusIntegracao = (typeof STATUS_INTEGRACAO)[number];

export const MENSAGEM_MAX_LENGTH = 1_000;
export const OPERACAO_MAX_LENGTH = 60;
export const RECURSO_MAX_LENGTH = 120;

export interface RegistroIntegracao {
  readonly provedorId: string;
  readonly operacao: string;
  readonly recurso?: string | null;
  readonly status: StatusIntegracao;
  readonly httpStatus?: number | null;
  readonly duracaoMs?: number | null;
  readonly dataConsulta: Date;
  readonly dataReferencia?: Date | null;
  readonly mensagem?: string | null;
}

/** Port de escrita — implementado por Prisma em produção. */
export interface LogIntegracaoStore {
  registrar(registro: RegistroIntegracao): Promise<void>;
}

const SENSITIVE_PATTERN =
  /((?:token|api[_-]?key|apikey|secret|segredo|senha|password|authorization|credencial)\s*[:=]\s*)("[^"]*"|'[^']*'|[^\s&,;]+)/gi;

const FINANCIAL_PATTERN =
  /((?:valor|preco|preço|saldo|patrimonio|patrimônio|quantidade|precoMedio|preçoMédio)\s*[:=]\s*)("[^"]*"|'[^']*'|[^\s&,;}]+)/gi;

/** Remove segredos e dados financeiros de uma mensagem livre (RN-074). */
export function sanitizarMensagem(mensagem?: string | null): string | null {
  if (mensagem === undefined || mensagem === null) {
    return null;
  }

  const limpa = mensagem
    .replace(/\r?\n+/g, " ")
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED]")
    .replace(SENSITIVE_PATTERN, "$1[REDACTED]")
    .replace(FINANCIAL_PATTERN, "$1[OMITIDO]")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (limpa.length <= MENSAGEM_MAX_LENGTH) {
    return limpa;
  }

  return limpa.slice(0, MENSAGEM_MAX_LENGTH - 1) + "…";
}

function limitar(texto: string, tamanho: number): string {
  return texto.length > tamanho ? texto.slice(0, tamanho) : texto;
}

function normalizarDuracao(duracaoMs: number | null | undefined): number | null {
  if (duracaoMs === null || duracaoMs === undefined) {
    return null;
  }
  return Math.max(0, Math.round(duracaoMs));
}

export function createPrismaLogIntegracaoStore(prisma: PrismaClient): LogIntegracaoStore {
  return {
    async registrar(registro: RegistroIntegracao): Promise<void> {
      await prisma.logIntegracao.create({
        data: {
          provedorId: registro.provedorId,
          operacao: limitar(registro.operacao, OPERACAO_MAX_LENGTH),
          recurso: registro.recurso === undefined || registro.recurso === null
            ? null
            : limitar(registro.recurso, RECURSO_MAX_LENGTH),
          status: registro.status,
          httpStatus: registro.httpStatus ?? null,
          duracaoMs: normalizarDuracao(registro.duracaoMs),
          dataConsulta: registro.dataConsulta,
          dataReferencia: registro.dataReferencia ?? null,
          mensagem: sanitizarMensagem(registro.mensagem),
        },
      });
    },
  };
}

/** Traduz o erro da operação para o status tipado de `log_integracao` (RN-074). */
export function statusPorErro(error: unknown): StatusIntegracao {
  if (!AppError.isAppError(error)) {
    return "ERRO";
  }

  switch (error.code) {
    case "INT_TIMEOUT":
      return "TIMEOUT";
    case "INT_LIMITE_EXCEDIDO":
      return "LIMITE";
    case "INT_RESPOSTA_INVALIDA":
    case "INT_DADOS_INCOMPLETOS":
      return "DADOS_INCOMPLETOS";
    default:
      return "ERRO";
  }
}

export interface ExecucaoIntegracao<T> {
  readonly provedorId: string;
  readonly operacao: string;
  readonly recurso?: string | null;
  readonly dataReferencia?: Date | null;
  readonly store: LogIntegracaoStore;
  readonly clock?: () => Date;
  readonly executar: () => Promise<DadoProveniente<T>>;
}

function dataReferenciaDe(dado: DadoProveniente<unknown>): Date | null {
  const data = new Date(`${dado.dataReferencia}T00:00:00.000Z`);
  return Number.isNaN(data.getTime()) ? null : data;
}

function mensagemDeErro(error: unknown): string {
  return AppError.isAppError(error) ? error.message : "Falha inesperada na integração.";
}

async function registrarFalha<T>(
  execucao: ExecucaoIntegracao<T>,
  error: unknown,
  dataConsulta: Date,
  iniciouEm: number,
): Promise<void> {
  try {
    await execucao.store.registrar({
      provedorId: execucao.provedorId,
      operacao: execucao.operacao,
      recurso: execucao.recurso,
      status: statusPorErro(error),
      httpStatus: AppError.isAppError(error) ? error.status : null,
      duracaoMs: performance.now() - iniciouEm,
      dataConsulta,
      dataReferencia: execucao.dataReferencia ?? null,
      mensagem: mensagemDeErro(error),
    });
  } catch {
    logger.error("integracao.log_falhou", {
      provedorId: execucao.provedorId,
      operacao: execucao.operacao,
    });
  }
}

/**
 * Executa uma operação de provedor e grava exatamente um registro em
 * `log_integracao`, sempre — sucesso ou falha.
 *
 * A falha de escrita do log nunca mascara o erro original da integração.
 */
export async function executarComLog<T>(execucao: ExecucaoIntegracao<T>): Promise<DadoProveniente<T>> {
  const clock = execucao.clock ?? (() => new Date());
  const dataConsulta = clock();
  const iniciouEm = performance.now();

  try {
    const dado = await execucao.executar();

    await execucao.store.registrar({
      provedorId: execucao.provedorId,
      operacao: execucao.operacao,
      recurso: execucao.recurso,
      status: "SUCESSO",
      duracaoMs: performance.now() - iniciouEm,
      dataConsulta,
      dataReferencia: execucao.dataReferencia ?? dataReferenciaDe(dado),
    });

    return dado;
  } catch (error) {
    await registrarFalha(execucao, error, dataConsulta, iniciouEm);
    throw error;
  }
}
