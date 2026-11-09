import fs from "node:fs";
import path from "node:path";

/**
 * Titulares de teste do E2E.
 *
 * Três usuários ativados são criados no `globalSetup` (diretamente no Postgres,
 * com o mesmo hash Argon2id do runtime) e expostos neste arquivo de fixture:
 *
 * - **A** — dono da carteira usada pelos fluxos de ativos (RN-010) e alocação
 *   (RN-021-5); também guarda as metas editadas;
 * - **B** — usado para provar o isolamento entre titulares (AC-070): não pode
 *   ler nem alterar ativo de A e não o vê na própria listagem. Na alocação é
 *   o titular sem patrimônio e com as metas default;
 * - **C** — carteira controlada só da alocação (RN-021-5), para conferir os
 *   desvios com FII pelo custo e renda fixa pelo saldo sem interferir nas
 *   carteiras de A/B que os outros specs assumem vazias.
 *
 * O `globalTeardown` apaga os ativos e depois as contas (a FK de `ativo` é
 * `ON DELETE RESTRICT`). Quando o banco não estiver disponível (ex.: job de
 * E2E sem serviço de Postgres), o setup grava `disponivel: false` e os testes
 * dependentes são ignorados.
 */

export type ChaveUsuarioE2E = "a" | "b" | "c";

export const SENHA_USUARIO_E2E = "SenhaE2E!2026";

export const ARQUIVO_USUARIO_E2E = path.resolve(
  process.cwd(),
  "test-results",
  "usuario-e2e.json",
);

export interface UsuarioE2E {
  readonly id: string;
  readonly nome: string;
  readonly email: string;
  readonly senha: string;
}

export interface UsuariosE2E {
  readonly a: UsuarioE2E;
  readonly b: UsuarioE2E;
  readonly c: UsuarioE2E;
}

export type RegistroUsuarioE2E =
  | { readonly disponivel: true; readonly usuarios: UsuariosE2E }
  | { readonly disponivel: false; readonly motivo: string };

/** Nome fictício por titular — nenhum dado real é usado. */
export function nomeUsuarioE2E(chave: ChaveUsuarioE2E): string {
  if (chave === "a") {
    return "Titular E2E A";
  }
  return chave === "b" ? "Titular E2E B" : "Titular E2E C";
}

/** E-mail fictício e único por execução/chave — evita colisão no índice funcional. */
export function emailUsuarioE2E(chave: ChaveUsuarioE2E, agora = Date.now()): string {
  return `e2e.${chave}.${agora}@exemplo.test`;
}

function ehUsuarioValido(valor: unknown): valor is UsuarioE2E {
  if (typeof valor !== "object" || valor === null) {
    return false;
  }

  const usuario = valor as Record<string, unknown>;
  return (
    typeof usuario.id === "string" &&
    typeof usuario.nome === "string" &&
    typeof usuario.email === "string" &&
    typeof usuario.senha === "string"
  );
}

export function gravarRegistro(registro: RegistroUsuarioE2E): void {
  fs.mkdirSync(path.dirname(ARQUIVO_USUARIO_E2E), { recursive: true });
  fs.writeFileSync(ARQUIVO_USUARIO_E2E, JSON.stringify(registro), "utf8");
}

export function lerRegistro(): RegistroUsuarioE2E {
  try {
    const conteudo = fs.readFileSync(ARQUIVO_USUARIO_E2E, "utf8");
    const dados = JSON.parse(conteudo) as {
      disponivel?: unknown;
      motivo?: unknown;
      usuarios?: unknown;
    };

    if (dados.disponivel === false) {
      return {
        disponivel: false,
        motivo: typeof dados.motivo === "string" ? dados.motivo : "motivo não informado",
      };
    }

    const usuarios = dados.usuarios as { a?: unknown; b?: unknown; c?: unknown } | undefined;
    if (
      usuarios !== undefined &&
      ehUsuarioValido(usuarios.a) &&
      ehUsuarioValido(usuarios.b) &&
      ehUsuarioValido(usuarios.c)
    ) {
      return { disponivel: true, usuarios: { a: usuarios.a, b: usuarios.b, c: usuarios.c } };
    }

    return { disponivel: false, motivo: "arquivo de fixture com formato inválido" };
  } catch (erro) {
    return {
      disponivel: false,
      motivo: erro instanceof Error ? erro.message : "fixture do usuário E2E ausente",
    };
  }
}

export function apagarRegistro(): void {
  fs.rmSync(ARQUIVO_USUARIO_E2E, { force: true });
}
