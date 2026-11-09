import { calcularAlertas, type AlertaRendaFixa, type ConfiguracaoAlertasRendaFixa } from "./alertas";
import { hojeIso } from "./datas";
import type { RendaFixaRepositorio } from "./repositorio";

/**
 * Cálculo dos alertas do titular (RN-058; API_CONTRACTS.md §6.4).
 *
 * O caso de uso só carrega os títulos; toda a regra temporal e de limite fica
 * em `calcularAlertas`, que é pura e independe de banco.
 */

export interface ObterAlertasComando {
  readonly usuarioId: string;
  readonly config: ConfiguracaoAlertasRendaFixa;
  /** Injetável nos testes; default = hoje UTC. */
  readonly hoje?: string;
}

export interface ObterAlertasDeps {
  readonly repositorio: RendaFixaRepositorio;
}

export async function obterAlertas(
  comando: ObterAlertasComando,
  deps: ObterAlertasDeps,
): Promise<readonly AlertaRendaFixa[]> {
  const itens = await deps.repositorio.listarPorUsuario(comando.usuarioId);

  return calcularAlertas(itens, comando.config, comando.hoje ?? hojeIso());
}
