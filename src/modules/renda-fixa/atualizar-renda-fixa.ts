import { errors, type AppError } from "../../lib/errors";
import { err, ok, type Result } from "../../lib/result";
import {
  type CamposAtualizacaoRendaFixa,
  type InvestimentoRendaFixaRegistro,
  type LiquidezRendaFixa,
  type RendaFixaRepositorio,
  type StatusSaldo,
} from "./repositorio";
import { normalizarTextoOpcional, validarCarencia, validarSaldo } from "./validadores";

/**
 * Atualização parcial de título de renda fixa (RN-057-2, RN-059;
 * API_CONTRACTS.md §6.3).
 *
 * Atualizáveis: saldo, status do saldo, liquidez, carência, cobertura FGC e
 * observações. Identidade do título (`produto`, `indexador`, `taxa`,
 * `dataAplicacao`, `valorAplicado`, `vencimento`) é imutável: alterá-la exige
 * cadastrar um novo título (`RF_CAMPO_IMUTAVEL`).
 */

export interface AtualizarRendaFixaComando {
  readonly usuarioId: string;
  readonly id: string;
  readonly saldoAtual?: string;
  readonly statusSaldo?: StatusSaldo;
  readonly liquidez?: LiquidezRendaFixa;
  readonly carenciaAte?: string | null;
  readonly coberturaFgc?: boolean;
  readonly observacoes?: string | null;
}

export interface AtualizarRendaFixaDeps {
  readonly repositorio: RendaFixaRepositorio;
}

const CAMPOS_IMUTAVEIS = [
  "produto",
  "indexador",
  "taxa",
  "dataAplicacao",
  "valorAplicado",
  "vencimento",
] as const;

/**
 * Rejeita qualquer tentativa de alterar a identidade do título. A checagem é
 * feita sobre o corpo bruto porque o schema da borda descarta campos
 * desconhecidos — descartar em silêncio esconderia a intenção do cliente.
 */
export function validarCamposImutaveis(entrada: unknown): AppError | null {
  if (typeof entrada !== "object" || entrada === null) {
    return null;
  }

  const presentes = CAMPOS_IMUTAVEIS.filter((campo) => campo in entrada);
  return presentes.length === 0 ? null : errors.rfCampoImutavel({ campos: presentes });
}

export async function atualizarRendaFixa(
  comando: AtualizarRendaFixaComando,
  deps: AtualizarRendaFixaDeps,
): Promise<Result<InvestimentoRendaFixaRegistro, AppError>> {
  const atual = await deps.repositorio.buscarPorId(comando.usuarioId, comando.id);
  if (atual === null) {
    return err(errors.rfNaoEncontrada());
  }

  let saldoNormalizado: string | undefined;
  if (comando.saldoAtual !== undefined) {
    const saldo = validarSaldo(comando.saldoAtual);
    if (!saldo.ok) {
      return saldo;
    }
    saldoNormalizado = saldo.value;
  }

  let carenciaNormalizada: string | null | undefined;
  if (comando.carenciaAte !== undefined) {
    const carencia = validarCarencia(comando.carenciaAte, atual.dataAplicacao);
    if (!carencia.ok) {
      return carencia;
    }
    carenciaNormalizada = carencia.value;
  }

  const campos: CamposAtualizacaoRendaFixa = {
    ...(saldoNormalizado !== undefined ? { saldoAtual: saldoNormalizado } : {}),
    ...(comando.statusSaldo !== undefined ? { statusSaldo: comando.statusSaldo } : {}),
    ...(comando.liquidez !== undefined ? { liquidez: comando.liquidez } : {}),
    ...(carenciaNormalizada !== undefined ? { carenciaAte: carenciaNormalizada } : {}),
    ...(comando.coberturaFgc !== undefined ? { coberturaFgc: comando.coberturaFgc } : {}),
    ...(comando.observacoes !== undefined
      ? { observacoes: normalizarTextoOpcional(comando.observacoes) }
      : {}),
  };

  const atualizado = await deps.repositorio.atualizar(comando.usuarioId, comando.id, campos);
  return atualizado === null ? err(errors.rfNaoEncontrada()) : ok(atualizado);
}
