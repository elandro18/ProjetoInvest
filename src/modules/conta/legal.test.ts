import { describe, expect, it } from "vitest";

import {
  VERSAO_POLITICA_PRIVACIDADE,
  VERSAO_TERMOS_USO,
  versoesVigentes,
} from "./legal";

describe("versoesVigentes", () => {
  it("aceita exatamente as versões vigentes", () => {
    expect(versoesVigentes(VERSAO_TERMOS_USO, VERSAO_POLITICA_PRIVACIDADE)).toBe(true);
  });

  it("ignora espaços em volta das versões enviadas", () => {
    expect(
      versoesVigentes(`  ${VERSAO_TERMOS_USO} `, ` ${VERSAO_POLITICA_PRIVACIDADE}  `),
    ).toBe(true);
  });

  it.each([
    ["termos diferente", "2025-01-01", VERSAO_POLITICA_PRIVACIDADE],
    ["privacidade diferente", VERSAO_TERMOS_USO, "2025-01-01"],
    ["ambos vazios", "", ""],
  ])("recusa %s", (_caso, termos, privacidade) => {
    expect(versoesVigentes(termos, privacidade)).toBe(false);
  });
});
