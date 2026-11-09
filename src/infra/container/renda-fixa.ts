import type { RendaFixaRepositorio } from "../../modules/renda-fixa/repositorio";
import { prisma } from "../db/client";
import { RendaFixaPrismaRepositorio } from "../db/renda-fixa-repositorio";

/**
 * Composition root do módulo de renda fixa (ARCHITECTURE.md §3).
 *
 * A borda HTTP recebe apenas este objeto; nenhum import de `@prisma/client`
 * vaza para `app/api/**` nem para `src/modules/**`.
 */

export interface ServicosRendaFixa {
  readonly repositorio: RendaFixaRepositorio;
}

export function servicosRendaFixa(): ServicosRendaFixa {
  return { repositorio: new RendaFixaPrismaRepositorio(prisma) };
}
