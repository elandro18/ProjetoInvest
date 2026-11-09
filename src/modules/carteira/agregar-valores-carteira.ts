import { Decimal } from "../../lib/decimal";
import type { ValorReferenciaCarteira, ValoresCarteira } from "./valor-carteira";

/**
 * Agregação pura dos valores da carteira (RN-020, RN-021, RN-089, RN-091).
 *
 * Separada do Prisma para ser testável e reutilizada por qualquer adaptador.
 * Regras:
 * - patrimônio total = custo das posições + saldo da renda fixa;
 * - posições entram pelo custo e, sem cotação, são marcadas indisponíveis;
 * - renda fixa entra pelo saldo e é atribuída à classe `RENDA_FIXA`;
 * - segmentos recebem apenas posições (FIIs) e sempre sem cotação.
 */

export interface PosicaoParaAgregacao {
  readonly classeId: string;
  readonly segmentoId: string | null;
  /** `posicao_ativo.custo_total` com 2 casas. */
  readonly custoTotal: string;
}

export interface ClasseParaAgregacao {
  readonly id: string;
  readonly codigo: string;
}

export interface DadosAgregacaoCarteira {
  readonly posicoes: readonly PosicaoParaAgregacao[];
  /** `investimento_renda_fixa.saldo_atual` somado; `"0.00"` sem títulos. */
  readonly saldoRendaFixa: string;
  readonly classes: readonly ClasseParaAgregacao[];
}

const CODIGO_RENDA_FIXA = "RENDA_FIXA";
const CODIGO_FII = "FII";

export function agregarValoresCarteira(dados: DadosAgregacaoCarteira): ValoresCarteira {
  const porClasse = new Map<string, Decimal>();
  const porSegmento = new Map<string, Decimal>();
  let somaPosicoes = Decimal.zero(2);

  for (const posicao of dados.posicoes) {
    const custo = Decimal.from(posicao.custoTotal);
    somaPosicoes = somaPosicoes.add(custo);
    porClasse.set(
      posicao.classeId,
      (porClasse.get(posicao.classeId) ?? Decimal.zero(2)).add(custo),
    );

    if (posicao.segmentoId !== null) {
      porSegmento.set(
        posicao.segmentoId,
        (porSegmento.get(posicao.segmentoId) ?? Decimal.zero(2)).add(custo),
      );
    }
  }

  const classeRendaFixa = dados.classes.find((classe) => classe.codigo === CODIGO_RENDA_FIXA);
  const saldoRendaFixa = Decimal.from(dados.saldoRendaFixa);

  if (classeRendaFixa !== undefined) {
    porClasse.set(
      classeRendaFixa.id,
      (porClasse.get(classeRendaFixa.id) ?? Decimal.zero(2)).add(saldoRendaFixa),
    );
  }

  const total = somaPosicoes.add(saldoRendaFixa);

  const classes: ValorReferenciaCarteira[] = dados.classes.map((classe) => ({
    id: classe.id,
    valor: (porClasse.get(classe.id) ?? Decimal.zero(2)).toFixed(2),
    // Renda fixa tem saldo informado; FII (e qualquer posição de mercado sem
    // cotação nesta fase) é custo de aquisição.
    valorIndisponivel: classe.codigo === CODIGO_FII,
  }));

  const segmentos: ValorReferenciaCarteira[] = [...porSegmento].map(([id, valor]) => ({
    id,
    valor: valor.toFixed(2),
    valorIndisponivel: true,
  }));

  return { total: total.toFixed(2), classes, segmentos };
}
