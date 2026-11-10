import type {
  ConcentracaoRepositorio,
  LimiteConcentracaoRepositorio,
} from "../../modules/risco/repositorio";
import type { ValorCarteira } from "../../modules/carteira/valor-carteira";
import { ConcentracaoPrismaRepositorio } from "../db/concentracao-prisma";
import { prisma } from "../db/client";
import { LimiteConcentracaoPrismaRepositorio } from "../db/limite-concentracao-prisma";
import { ValorCarteiraPrisma } from "../db/valor-carteira-prisma";

/**
 * Composition root do módulo de risco (ARCHITECTURE.md §3).
 *
 * A borda HTTP recebe apenas este objeto; nenhum import de `@prisma/client`
 * vaza para `app/api/**` nem para `src/modules/**`.
 */

export interface ServicosRisco {
  readonly repositorio: ConcentracaoRepositorio;
  readonly limites: LimiteConcentracaoRepositorio;
  /** Base da concentração — o mesmo port da carteira e da alocação (RN-089). */
  readonly valorCarteira: ValorCarteira;
}

export function servicosRisco(): ServicosRisco {
  return {
    repositorio: new ConcentracaoPrismaRepositorio(prisma),
    limites: new LimiteConcentracaoPrismaRepositorio(prisma),
    valorCarteira: new ValorCarteiraPrisma(prisma),
  };
}
