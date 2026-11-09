import { Decimal } from "../../lib/decimal";
import { diasEntre, formatarDataBr } from "./datas";
import type {
  InvestimentoRendaFixaRegistro,
  LiquidezRendaFixa,
} from "./repositorio";

/**
 * Alertas operacionais de renda fixa, calculados sob demanda (RN-058;
 * API_CONTRACTS.md §6.4). Não há tabela de alerta: a verdade é sempre o
 * conjunto de títulos + configuração vigente + data de hoje.
 *
 * Limites de concentração (PEND-004) e de FGC (PEND-012) não têm valor
 * default: quando não configurados, o alerta correspondente **não existe**.
 */

export const ALERTA_VENCIMENTO_DIAS = 30;
export const ALERTA_VENCIMENTO_CRITICO_DIAS = 7;

export const TIPOS_ALERTA_RENDA_FIXA = [
  "VENCIMENTO_PROXIMO",
  "CARENCIA",
  "SEM_LIQUIDEZ",
  "CONCENTRACAO_INSTITUICAO",
  "LIMITE_FGC",
] as const;

export type TipoAlertaRendaFixa = (typeof TIPOS_ALERTA_RENDA_FIXA)[number];

export const SEVERIDADES_ALERTA = ["INFO", "ATENCAO", "CRITICO"] as const;

export type SeveridadeAlerta = (typeof SEVERIDADES_ALERTA)[number];

export interface AlertaRendaFixa {
  readonly tipo: TipoAlertaRendaFixa;
  readonly tituloFixoId: string;
  readonly mensagem: string;
  readonly severidade: SeveridadeAlerta;
}

export interface ConfiguracaoAlertasRendaFixa {
  /** `RF_CONCENTRACAO_MAXIMA_PERCENTUAL`; ausente = regra desativada. */
  readonly concentracaoMaximaPercentual?: string | null;
  /** `RF_LIMITE_FGC`; ausente = regra desativada. */
  readonly limiteFgc?: string | null;
}

const ORDEM_SEVERIDADE: Readonly<Record<SeveridadeAlerta, number>> = {
  CRITICO: 0,
  ATENCAO: 1,
  INFO: 2,
};

const ROTULO_LIQUIDEZ: Readonly<Record<LiquidezRendaFixa, string>> = {
  DIARIA: "liquidez diária",
  NO_VENCIMENTO: "liquidez no vencimento",
  PRAZO: "liquidez no prazo",
};

function limitePositivo(valor: string | null | undefined): Decimal | null {
  if (valor === null || valor === undefined || valor.trim().length === 0) {
    return null;
  }

  const parsed = Decimal.parse(valor);
  if (!parsed.ok || !parsed.value.isPositive() || parsed.value.isZero()) {
    return null;
  }

  return parsed.value;
}

function formatarPtBr(valor: Decimal, casas: number): string {
  return valor.toFixed(casas).replace(".", ",");
}

function ordenarGrupo(itens: readonly InvestimentoRendaFixaRegistro[]): InvestimentoRendaFixaRegistro[] {
  return [...itens].sort((a, b) => {
    const porSaldo = Decimal.from(b.saldoAtual).compare(a.saldoAtual);
    return porSaldo !== 0 ? porSaldo : a.id.localeCompare(b.id);
  });
}

function agruparPorInstituicao(
  itens: readonly InvestimentoRendaFixaRegistro[],
): Map<string, InvestimentoRendaFixaRegistro[]> {
  const grupos = new Map<string, InvestimentoRendaFixaRegistro[]>();

  for (const item of itens) {
    const grupo = grupos.get(item.instituicao);
    if (grupo === undefined) {
      grupos.set(item.instituicao, [item]);
    } else {
      grupo.push(item);
    }
  }

  return new Map([...grupos.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

function alertasDoTitulo(
  item: InvestimentoRendaFixaRegistro,
  hoje: string,
): AlertaRendaFixa[] {
  const alertas: AlertaRendaFixa[] = [];

  if (item.vencimento !== null) {
    const dias = diasEntre(hoje, item.vencimento);
    if (dias <= ALERTA_VENCIMENTO_DIAS) {
      const mensagem =
        dias < 0
          ? `Vencido há ${Math.abs(dias)} dia(s).`
          : dias === 0
            ? "Vence hoje."
            : `Vence em ${dias} dia(s).`;

      alertas.push({
        tipo: "VENCIMENTO_PROXIMO",
        tituloFixoId: item.id,
        mensagem,
        severidade: dias <= ALERTA_VENCIMENTO_CRITICO_DIAS ? "CRITICO" : "ATENCAO",
      });
    }
  }

  if (item.carenciaAte !== null && item.carenciaAte >= hoje) {
    alertas.push({
      tipo: "CARENCIA",
      tituloFixoId: item.id,
      mensagem: `Em carência até ${formatarDataBr(item.carenciaAte)}.`,
      severidade: "ATENCAO",
    });
  }

  if (item.liquidez !== "DIARIA") {
    alertas.push({
      tipo: "SEM_LIQUIDEZ",
      tituloFixoId: item.id,
      mensagem: `Sem liquidez diária (${ROTULO_LIQUIDEZ[item.liquidez]}).`,
      severidade: "INFO",
    });
  }

  return alertas;
}

function alertasDaInstituicao(
  instituicao: string,
  grupo: readonly InvestimentoRendaFixaRegistro[],
  totalSaldo: Decimal,
  config: ConfiguracaoAlertasRendaFixa,
): AlertaRendaFixa[] {
  const alertas: AlertaRendaFixa[] = [];
  const ordenado = ordenarGrupo(grupo);
  const referencia = ordenado[0];

  const saldoInstituicao = grupo.reduce(
    (total, item) => total.add(item.saldoAtual),
    Decimal.zero(2),
  );

  const limiteConcentracao = limitePositivo(config.concentracaoMaximaPercentual);
  if (limiteConcentracao !== null && totalSaldo.gt("0")) {
    const percentual = saldoInstituicao.div(totalSaldo, 6).mul("100").round(2);
    if (percentual.gt(limiteConcentracao)) {
      alertas.push({
        tipo: "CONCENTRACAO_INSTITUICAO",
        tituloFixoId: referencia.id,
        mensagem: `Concentração de ${formatarPtBr(percentual, 2)}% do saldo em ${instituicao} (limite ${formatarPtBr(limiteConcentracao, 2)}%).`,
        severidade: "ATENCAO",
      });
    }
  }

  const limiteFgc = limitePositivo(config.limiteFgc);
  if (limiteFgc !== null) {
    const grupoComFgc = grupo.filter((item) => item.coberturaFgc);
    if (grupoComFgc.length > 0) {
      const saldoFgc = grupoComFgc.reduce(
        (total, item) => total.add(item.saldoAtual),
        Decimal.zero(2),
      );

      if (saldoFgc.gt(limiteFgc)) {
        alertas.push({
          tipo: "LIMITE_FGC",
          tituloFixoId: ordenarGrupo(grupoComFgc)[0].id,
          mensagem: `Saldo com FGC em ${instituicao} (R$ ${formatarPtBr(saldoFgc, 2)}) acima do limite configurado (R$ ${formatarPtBr(limiteFgc, 2)}).`,
          severidade: "ATENCAO",
        });
      }
    }
  }

  return alertas;
}

export function calcularAlertas(
  itens: readonly InvestimentoRendaFixaRegistro[],
  config: ConfiguracaoAlertasRendaFixa,
  hoje: string,
): readonly AlertaRendaFixa[] {
  const totalSaldo = itens.reduce(
    (total, item) => total.add(item.saldoAtual),
    Decimal.zero(2),
  );

  const alertas: AlertaRendaFixa[] = itens.flatMap((item) => alertasDoTitulo(item, hoje));

  for (const [instituicao, grupo] of agruparPorInstituicao(itens)) {
    alertas.push(...alertasDaInstituicao(instituicao, grupo, totalSaldo, config));
  }

  return alertas.sort(
    (a, b) =>
      ORDEM_SEVERIDADE[a.severidade] - ORDEM_SEVERIDADE[b.severidade] ||
      a.tipo.localeCompare(b.tipo) ||
      a.tituloFixoId.localeCompare(b.tituloFixoId),
  );
}
