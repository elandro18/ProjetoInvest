import type {
  InconsistenciaCarteira,
  RegistrarInconsistenciaCarteira,
} from "../../modules/carteira/obter-carteira";
import type { CarteiraRepositorio } from "../../modules/carteira/repositorio";
import { CarteiraPrismaRepositorio } from "../db/carteira-repositorio";
import { prisma } from "../db/client";
import { logger } from "../logging/logger";

/**
 * Composition root do módulo de carteira (ARCHITECTURE.md §3).
 *
 * A borda HTTP recebe apenas este objeto; nenhum import de `@prisma/client`
 * vaza para `app/api/**` nem para `src/modules/**`.
 */

export interface ServicosCarteira {
  readonly repositorio: CarteiraRepositorio;
  readonly registrarInconsistencia: RegistrarInconsistenciaCarteira;
}

/**
 * Log de inconsistência do agregado (RN-020): a soma das classes não fechou
 * com o patrimônio total. O logger mascara chaves financeiras estruturadas;
 * por isso só a divergência em reais (campo próprio) e o titular são
 * registrados — nunca o payload financeiro completo.
 */
function registrarInconsistencia(dados: InconsistenciaCarteira): void {
  logger.warn("carteira.inconsistencia_classes", {
    usuarioId: dados.usuarioId,
    divergencia: dados.divergencia,
    somaClasses: dados.somaClasses,
    patrimonioTotal: dados.patrimonioTotal,
    tolerancia: dados.tolerancia,
  });
}

export function servicosCarteira(): ServicosCarteira {
  return {
    repositorio: new CarteiraPrismaRepositorio(prisma),
    registrarInconsistencia,
  };
}
