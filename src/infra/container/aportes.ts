import type { AlocacaoMetaRepositorio } from "../../modules/alocacao/repositorio";
import type { AporteRepositorio } from "../../modules/aportes/repositorio";
import type { ValorCarteira } from "../../modules/carteira/valor-carteira";
import type { LimiteConcentracaoRepositorio } from "../../modules/risco/repositorio";
import { AlocacaoMetaPrismaRepositorio } from "../db/alocacao-meta-repositorio";
import { prisma } from "../db/client";
import { LimiteConcentracaoPrismaRepositorio } from "../db/limite-concentracao-prisma";
import { SugestaoAportePrismaRepositorio } from "../db/sugestao-aporte-prisma";
import { ValorCarteiraPrisma } from "../db/valor-carteira-prisma";

/**
 * Composition root do módulo de aportes (ARCHITECTURE.md §3).
 *
 * A borda HTTP recebe apenas este objeto; nenhum import de `@prisma/client`
 * vaza para `app/api/**` nem para `src/modules/**`.
 */

export interface ServicosAportes {
  readonly repositorio: AporteRepositorio;
  readonly metas: AlocacaoMetaRepositorio;
  readonly limites: LimiteConcentracaoRepositorio;
  /** Base da distribuição atual — o mesmo port da carteira e da alocação. */
  readonly valorCarteira: ValorCarteira;
}

export function servicosAportes(): ServicosAportes {
  return {
    repositorio: new SugestaoAportePrismaRepositorio(prisma),
    metas: new AlocacaoMetaPrismaRepositorio(prisma),
    limites: new LimiteConcentracaoPrismaRepositorio(prisma),
    valorCarteira: new ValorCarteiraPrisma(prisma),
  };
}
