/**
 * Reexporta as datas de negócio do módulo de renda fixa (RN-057, RN-058).
 *
 * As funções são genéricas e passaram a viver em `src/lib/datas.ts` para serem
 * reaproveitadas por movimentações sem acoplar dois módulos de domínio.
 */

export * from "../../lib/datas";
