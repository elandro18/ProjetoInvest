/**
 * Barrel da camada de provedores (RN-001-4).
 *
 * Importe daqui na composição da aplicação. Nenhum adapter concreto é
 * registrado por padrão — CVM/mercado chegam nas RN-031/RN-033.
 */

export * from "./http-client";
export * from "./log";
export * from "./registry";
export * from "./stub";
export * from "../../modules/pesquisa/provedor";
