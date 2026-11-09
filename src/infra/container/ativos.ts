import type { AtivoRepositorio } from "../../modules/ativos/repositorio";
import { AtivoPrismaRepositorio } from "../db/ativo-repositorio";
import { prisma } from "../db/client";

/**
 * Composition root do módulo de ativos (ARCHITECTURE.md §3).
 *
 * A borda HTTP recebe apenas este objeto; nenhum import de `@prisma/client`
 * vaza para `app/api/**` nem para `src/modules/**`.
 */

export interface ServicosAtivos {
  readonly repositorio: AtivoRepositorio;
}

export function servicosAtivos(): ServicosAtivos {
  return { repositorio: new AtivoPrismaRepositorio(prisma) };
}
