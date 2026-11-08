import { createHash } from "node:crypto";

/**
 * Hash do IP de origem (RN-085, DATA_MODEL.md §4.20).
 *
 * O IP puro nunca é persistido: apenas `SHA-256(salt + ":" + ip)`, com salt
 * do ambiente. Sem salt configurado o hash continua determinístico, mas
 * correlacionável entre instalações — daí a obrigação de configurá-lo em
 * produção (`IP_HASH_SALT`, com fallback para `AUTH_SECRET`).
 */

export function hashIp(ip: string | null, salt?: string): string | null {
  if (ip === null || ip.trim() === "") {
    return null;
  }

  const segredo = salt ?? process.env.IP_HASH_SALT ?? process.env.AUTH_SECRET ?? "";
  return createHash("sha256").update(`${segredo}:${ip.trim()}`, "utf8").digest("hex");
}

/** IP de origem a partir dos cabeçalhos de proxy; `null` quando ausente. */
export function ipDaRequisicao(headers: Headers): string | null {
  const encaminhado = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (encaminhado !== undefined && encaminhado !== "") {
    return encaminhado;
  }

  const direto = headers.get("x-real-ip")?.trim();
  return direto !== undefined && direto !== "" ? direto : null;
}
