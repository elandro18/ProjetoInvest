import type { AlocacaoMetaRepositorio } from "../../modules/alocacao/repositorio";
import type { ValorCarteira } from "../../modules/carteira/valor-carteira";
import { AlocacaoMetaPrismaRepositorio } from "../db/alocacao-meta-repositorio";
import { prisma } from "../db/client";
import { ValorCarteiraPrisma } from "../db/valor-carteira-prisma";

/**
 * Composition root do módulo de alocação (ARCHITECTURE.md §3).
 *
 * A borda HTTP recebe apenas este objeto; nenhum import de `@prisma/client`
 * vaza para `app/api/**` nem para `src/modules/**`.
 */

export interface ServicosAlocacao {
  readonly repositorio: AlocacaoMetaRepositorio;
  readonly valorCarteira: ValorCarteira;
}

export function servicosAlocacao(): ServicosAlocacao {
  return {
    repositorio: new AlocacaoMetaPrismaRepositorio(prisma),
    valorCarteira: new ValorCarteiraPrisma(prisma),
  };
}
