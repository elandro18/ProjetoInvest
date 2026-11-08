import fs from "node:fs";
import path from "node:path";

/**
 * Usuário de teste do E2E de conta (RN-085-9).
 *
 * O `globalSetup` do Playwright cria a conta diretamente no Postgres (mesmo
 * hash Argon2id do runtime) e escreve os dados neste arquivo; o
 * `globalTeardown` apaga a conta e o arquivo. Nenhum dado real de titular é
 * usado: e-mail, nome e senha são fictícios e o e-mail é único por execução.
 *
 * Quando o banco não estiver disponível (ex.: job de E2E sem serviço de
 * Postgres), o setup grava `disponivel: false` e o teste de login válido é
 * ignorado — os fluxos sem sessão continuam rodando.
 */

export const NOME_USUARIO_E2E = "Titular E2E";

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

export type RegistroUsuarioE2E =
  | { readonly disponivel: true; readonly usuario: UsuarioE2E }
  | { readonly disponivel: false; readonly motivo: string };

/** E-mail fictício e único por execução — evita colisão no índice funcional. */
export function emailUsuarioE2E(agora = Date.now()): string {
  return `e2e.${agora}@exemplo.test`;
}

export function gravarRegistro(registro: RegistroUsuarioE2E): void {
  fs.mkdirSync(path.dirname(ARQUIVO_USUARIO_E2E), { recursive: true });
  fs.writeFileSync(ARQUIVO_USUARIO_E2E, JSON.stringify(registro), "utf8");
}

export function lerRegistro(): RegistroUsuarioE2E {
  try {
    const conteudo = fs.readFileSync(ARQUIVO_USUARIO_E2E, "utf8");
    const dados = JSON.parse(conteudo) as Partial<RegistroUsuarioE2E>;

    if (dados.disponivel === false) {
      return { disponivel: false, motivo: dados.motivo ?? "motivo não informado" };
    }

    const usuario = (dados as { usuario?: Partial<UsuarioE2E> }).usuario;
    if (
      usuario !== undefined &&
      typeof usuario.id === "string" &&
      typeof usuario.nome === "string" &&
      typeof usuario.email === "string" &&
      typeof usuario.senha === "string"
    ) {
      return {
        disponivel: true,
        usuario: {
          id: usuario.id,
          nome: usuario.nome,
          email: usuario.email,
          senha: usuario.senha,
        },
      };
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
