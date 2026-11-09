import type { DashboardRepositorio } from "../../modules/dashboard/repositorio";
import { DashboardPrismaRepositorio } from "../db/dashboard-repositorio";
import { prisma } from "../db/client";
import { servicosAlocacao, type ServicosAlocacao } from "./alocacao";
import { servicosCarteira, type ServicosCarteira } from "./carteira";

/**
 * Composition root do dashboard (ARCHITECTURE.md §3).
 *
 * Reutiliza os containers de carteira (RN-020) e alocação (RN-021) e adiciona
 * apenas o port das séries. A borda HTTP não importa `@prisma/client`.
 */

export interface ServicosDashboard {
  readonly carteira: ServicosCarteira;
  readonly alocacao: ServicosAlocacao;
  readonly dashboard: DashboardRepositorio;
}

export function servicosDashboard(): ServicosDashboard {
  return {
    carteira: servicosCarteira(),
    alocacao: servicosAlocacao(),
    dashboard: new DashboardPrismaRepositorio(prisma),
  };
}
