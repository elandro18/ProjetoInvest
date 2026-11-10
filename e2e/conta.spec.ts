import { expect, test, type Page } from "@playwright/test";

import { lerRegistro, type UsuarioE2E } from "./usuario-e2e";

/**
 * E2E da conta (RN-085-9, AC-067, AC-085, AC-088b).
 *
 * Cobre o que o navegador consegue observar sem provedor de e-mail:
 * - rota privada sem sessão redireciona para o login com `callbackUrl`;
 * - credencial inválida mostra erro genérico;
 * - login válido chega ao dashboard;
 * - navegação para a conta preserva a área de conta;
 * - logout volta para o login;
 * - diálogo de encerramento abre, ESC fecha e senha errada mantém o erro.
 *
 * Verificação de e-mail e redefinição de senha não têm E2E porque o token só
 * chega por e-mail; o fluxo é coberto por testes de domínio.
 */

function usuarioDisponivel(): UsuarioE2E {
  const registro = lerRegistro();

  test.skip(
    !registro.disponivel,
    registro.disponivel ? "" : `usuário E2E indisponível: ${registro.motivo}`,
  );

  if (!registro.disponivel) {
    throw new Error("usuário E2E indisponível");
  }

  return registro.usuarios.a;
}

async function entrar(page: Page, usuario: UsuarioE2E): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("E-mail", { exact: true }).fill(usuario.email);
  await page.getByLabel("Senha", { exact: true }).fill(usuario.senha);
  await page.getByRole("button", { name: "Entrar" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Dashboard", level: 1 })).toBeVisible();
}

test("/conta sem sessão redireciona para o login preservando o destino", async ({ page }) => {
  await page.goto("/conta");

  await expect(page).toHaveURL(/\/login\?callbackUrl=(%2F|\/)conta$/);
  await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();
  await expect(page.getByText("Acesse sua conta para continuar.")).toBeVisible();
});

test("login inválido mostra erro genérico sem revelar a causa", async ({ page }) => {
  const emailInexistente = `nao-existe.${Date.now()}@exemplo.test`;

  await page.goto("/login");
  await page.getByLabel("E-mail", { exact: true }).fill(emailInexistente);
  await page.getByLabel("Senha", { exact: true }).fill("SenhaErrada123!");
  await page.getByRole("button", { name: "Entrar" }).click();

  await expect(page.getByText("E-mail ou senha inválidos.")).toBeVisible();
  await expect(page.getByText("Não foi possível entrar")).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});

test("login válido leva ao dashboard", async ({ page }) => {
  const usuario = usuarioDisponivel();

  await entrar(page, usuario);

  await page.goto("/conta");
  await expect(page.getByRole("heading", { name: "Conta", level: 1 })).toBeVisible();
  await expect(page.getByRole("main").getByText(usuario.nome)).toBeVisible();
  await expect(page.getByRole("main").getByText(usuario.email)).toBeVisible();
});

test("logout encerra a sessão e volta para o login", async ({ page }) => {
  const usuario = usuarioDisponivel();

  await entrar(page, usuario);
  await page.goto("/conta");
  // Espera a sessão da tela carregar: sem isso, a resposta de `/api/auth/sessao`
  // pode chegar depois do logout e reemitir o cookie (corrida do teste).
  await expect(page.getByRole("main").getByText(usuario.nome)).toBeVisible();
  // Os prefetches do header também atravessam o middleware, que devolve
  // `Set-Cookie` da sessão; uma resposta atrasada poderia recriar o cookie
  // logo depois do logout (corrida do próprio teste, não da aplicação).
  // Esperar a rede ficar ociosa elimina essa resposta em voo.
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Sair" }).click();

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();

  // Confirma o contrato do logout antes de navegar: o cookie de sessão saiu.
  await expect
    .poll(async () =>
      (await page.context().cookies()).some((cookie) =>
        cookie.name.includes("authjs.session-token"),
      ),
    )
    .toBe(false);

  await page.goto("/conta");
  await expect(page).toHaveURL(/\/login\?callbackUrl=(%2F|\/)conta$/);
});

test("diálogo de encerramento abre, ESC fecha e senha errada mantém o erro", async ({ page }) => {
  const usuario = usuarioDisponivel();

  await entrar(page, usuario);
  await page.goto("/conta");

  await page.getByRole("button", { name: "Encerrar conta" }).click();
  const dialogo = page.getByRole("dialog");
  await expect(dialogo).toBeVisible();
  await expect(
    dialogo.getByRole("heading", { name: "Confirmar encerramento" }),
  ).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(dialogo).toBeHidden();

  await page.getByRole("button", { name: "Encerrar conta" }).click();
  await expect(dialogo).toBeVisible();
  await dialogo.getByLabel("Senha atual", { exact: true }).fill("SenhaErrada123!");
  await dialogo.getByRole("button", { name: "Encerrar conta" }).click();

  await expect(dialogo.getByText("E-mail ou senha inválidos.")).toBeVisible();
  await expect(dialogo).toBeVisible();
  await expect(page).toHaveURL(/\/conta$/);
});

test("resposta de login não expõe hash de senha nem versão de sessão", async ({ request }) => {
  const usuario = usuarioDisponivel();

  const resposta = await request.post("/api/auth/login", {
    data: { email: usuario.email, senha: usuario.senha },
  });

  expect(resposta.status()).toBe(200);
  const corpo = (await resposta.json()) as Record<string, unknown>;
  const serializado = JSON.stringify(corpo);

  expect(serializado).not.toContain("senhaHash");
  expect(serializado).not.toContain("senha_hash");
  expect(serializado).not.toContain("tokenHash");
  expect(serializado).not.toContain("token_hash");
  expect(serializado).not.toContain("sessionVersion");
});
