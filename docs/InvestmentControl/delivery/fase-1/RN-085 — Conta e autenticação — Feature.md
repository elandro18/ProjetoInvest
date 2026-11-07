---
project: INVESTMENT CONTROL
module: conta
audience: [tecnica]
status: draft
---

# RN-085 — Conta e autenticação

> Gerado por rdd-doc em 07/11/2026. Edite para revisar.
> Análise: ../../analysis/RN-085 — Conta e autenticação/
> Após revisão, use o workflow de issues para criar as tarefas no sistema de tracking.

## Issue principal

| Campo | Valor |
|---|---|
| Título | `RN-085 — Conta e autenticação` |
| Tracking ID | — (a criar) |
| Módulo | InvestmentControl |
| Milestone | Fase 1 |
| Repositórios | `elandro18/ProjetoInvest` |

## Resumo das tasks

| Task | Tipo | Repo | Descrição |
|---|---|---|---|
| RN-085-1 | Database | ProjetoInvest | Criar tabelas `usuario`, `token_conta`, `aceite_legal` e enums |
| RN-085-2 | Backend | ProjetoInvest | Implementar cadastro com aceite e envio de verificação |
| RN-085-3 | Backend | ProjetoInvest | Implementar verificação de e-mail e reenvio |
| RN-085-4 | Backend | ProjetoInvest | Implementar login, logout, sessão e middleware |
| RN-085-5 | Backend | ProjetoInvest | Implementar redefinição de senha |
| RN-085-6 | Backend | ProjetoInvest | Implementar encerramento de conta com anonimização |
| RN-085-7 | Frontend | ProjetoInvest | Implementar telas públicas de conta |
| RN-085-8 | Frontend | ProjetoInvest | Implementar tela de conta e confirmação de exclusão |
| RN-085-9 | Backend | ProjetoInvest | Testes de autenticação, isolamento e rate limit |

## Ordem de Execução

**Wave 1 — Banco:**
RN-085-1

**Wave 2 — Backend (sequencial):**
RN-085-2 → RN-085-3 → RN-085-4 → RN-085-5 → RN-085-6

**Wave 3 — Frontend:**
RN-085-7 → RN-085-8

**Wave 4 — Qualidade:**
RN-085-9

---

### RN-085-1. Criar tabelas de conta e aceite legal

| Campo | Valor |
|---|---|
| **Título** | `[Database] RN-085-1 — Criar tabelas usuario, token_conta, aceite_legal e enums` |
| **Activity** | Development |
| **RNs** | RN-070, RN-071, RN-085, RN-086, RN-087, RN-088 |

**Descrição:**
Criar as tabelas de identidade e consentimento, com unicidade de e-mail case-insensitive, índice por usuário e tipo em tokens, e restrição de uso único.

**Tabelas de referência:**

| Tabela | Coluna alvo | Uso |
|---|---|---|
| `usuario` | `email`, `senha_hash`, `status_conta`, `email_verificado_em`, `excluido_em` | Identidade e estado da conta |
| `token_conta` | `usuario_id`, `tipo`, `token_hash`, `expira_em`, `usado_em` | Verificação e redefinição |
| `aceite_legal` | `usuario_id`, `tipo`, `versao`, `aceito_em`, `ip_hash` | Evidência de consentimento |

```sql
CREATE TYPE status_conta AS ENUM ('PENDENTE_VERIFICACAO','ATIVA','SUSPENSA','EXCLUIDA');
CREATE TYPE tipo_token_conta AS ENUM ('VERIFICACAO_EMAIL','REDEFINICAO_SENHA');
CREATE TYPE tipo_aceite_legal AS ENUM ('TERMOS_USO','POLITICA_PRIVACIDADE');

CREATE TABLE usuario (
  id uuid PRIMARY KEY,
  nome varchar(120) NOT NULL,
  email varchar(160) NOT NULL,
  senha_hash text NOT NULL,
  status_conta status_conta NOT NULL DEFAULT 'PENDENTE_VERIFICACAO',
  email_verificado_em timestamptz,
  ultimo_login_em timestamptz,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  excluido_em timestamptz
);
CREATE UNIQUE INDEX ux_usuario_email ON usuario (lower(email));

CREATE TABLE token_conta (
  id uuid PRIMARY KEY,
  usuario_id uuid NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  tipo tipo_token_conta NOT NULL,
  token_hash varchar(128) NOT NULL UNIQUE,
  expira_em timestamptz NOT NULL,
  usado_em timestamptz,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_token_usuario_tipo ON token_conta (usuario_id, tipo, criado_em DESC);

CREATE TABLE aceite_legal (
  id uuid PRIMARY KEY,
  usuario_id uuid NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  tipo tipo_aceite_legal NOT NULL,
  versao varchar(20) NOT NULL,
  aceito_em timestamptz NOT NULL DEFAULT now(),
  ip_hash varchar(64)
);
CREATE INDEX ix_aceite_usuario_tipo ON aceite_legal (usuario_id, tipo, aceito_em DESC);
```

**Validações / Erros:**
- `AUTH_EMAIL_JA_CADASTRADO`: unicidade violada → 409.
- `MIGRATION_PENDENTE`: schema divergente → 500.

**Critério de Aceitação:**
- Dado o e-mail `Titular@Exemplo.com`, Quando cadastro `titular@exemplo.com`, Então a unicidade é violada.
- Dado um token já usado, Quando tento marcar `usado_em` novamente, Então a regra de uso único é verificada na aplicação.
- Dado um usuário excluído, Quando seus tokens são consultados, Então não há token válido.

**Dependências:** RN-001-2

**Notas técnicas:**
- `ON DELETE CASCADE` em token/aceite é aceitável; em dados financeiros, não.
- Não guardar IP puro: apenas `ip_hash`.

---

### RN-085-2. Implementar cadastro com aceite e envio de verificação

| Campo | Valor |
|---|---|
| **Título** | `[ProjetoInvest] RN-085-2 — Implementar cadastro com aceite e envio de verificação` |
| **Activity** | Development |
| **RNs** | RN-069, RN-071, RN-085, RN-087 |

**Descrição:**
Implementar `POST /api/auth/cadastro`: validar payload, hashear senha com Argon2id, criar usuário em `PENDENTE_VERIFICACAO`, registrar os dois aceites com versão e emitir token de verificação de 24 h. Enviar e-mail com link. Nunca retornar hash.

**Contrato:**

```
POST /api/auth/cadastro
Request: { "nome": "string", "email": "string", "senha": "string", "aceiteTermos": true, "aceitePrivacidade": true, "versaoTermos": "2026-11-01", "versaoPrivacidade": "2026-11-01" }
Response 201: { "id": "uuid", "email": "string", "statusConta": "PENDENTE_VERIFICACAO" }
```

**Validações / Erros:**
- `VALIDACAO`: campo inválido → 422.
- `AUTH_SENHA_FRACA`: senha < 10 ou vazada → 422.
- `AUTH_ACEITE_OBRIGATORIO`: aceite falso/ausente → 422.
- `AUTH_VERSAO_TERMOS_DESATUALIZADA`: versão ≠ vigente → 422.
- `AUTH_EMAIL_JA_CADASTRADO`: e-mail existente → 409.

**Critério de Aceitação:**
- Dado um cadastro válido, Quando envio, Então recebo 201 e a conta existe como `PENDENTE_VERIFICACAO`.
- Dado um cadastro sem aceite de privacidade, Quando envio, Então recebo 422.
- Dado um e-mail já cadastrado, Quando envio, Então recebo 409 sem revelar dados da conta existente.

**Dependências:** RN-085-1

**Notas técnicas:**
- `ip_hash` do aceite é SHA-256 do IP + salt do ambiente.
- E-mail deve ser normalizado para minúsculas antes de comparar.

---

### RN-085-3. Implementar verificação de e-mail e reenvio

| Campo | Valor |
|---|---|
| **Título** | `[ProjetoInvest] RN-085-3 — Implementar verificação de e-mail e reenvio` |
| **Activity** | Development |
| **RNs** | RN-085, RN-086 |

**Descrição:**
Implementar `POST /api/auth/verificar-email` (valida hash, expiração e uso único; ativa conta) e `POST /api/auth/reenviar-verificacao` (resposta sempre neutra, invalida token anterior, rate limit por e-mail).

**Contrato:**

```
POST /api/auth/verificar-email
Request: { "token": "string" }
Response 200: { "statusConta": "ATIVA", "emailVerificadoEm": "2026-11-07T12:00:00Z" }

POST /api/auth/reenviar-verificacao
Request: { "email": "string" }
Response 202: { "message": "Se o e-mail estiver cadastrado, enviaremos um novo link." }
```

**Validações / Erros:**
- `AUTH_TOKEN_INVALIDO` → 400.
- `AUTH_TOKEN_EXPIRADO` → 410.
- `AUTH_TOKEN_JA_USADO` → 409.
- `RATE_LIMIT_EXCEDIDO` → 429.

**Critério de Aceitação:**
- Dado um token válido, Quando verifico, Então a conta passa a `ATIVA` e o token recebe `usado_em`.
- Dado um token expirado, Quando verifico, Então recebo 410.
- Dado um e-mail inexistente, Quando peço reenvio, Então a resposta é 202 idêntica à de e-mail existente.

**Dependências:** RN-085-2

---

### RN-085-4. Implementar login, logout, sessão e middleware

| Campo | Valor |
|---|---|
| **Título** | `[ProjetoInvest] RN-085-4 — Implementar login, logout, sessão e middleware` |
| **Activity** | Development |
| **RNs** | RN-009, RN-067, RN-070, RN-071, RN-085 |

**Descrição:**
Configurar Auth.js com credenciais, cookie `httpOnly`/`secure`/`sameSite=lax`, expiração de 8 h e renovação por atividade. Criar middleware que libera apenas rotas públicas e exige `status_conta = ATIVA`. Implementar `/api/auth/login`, `/api/auth/logout`, `/api/auth/sessao` e o helper `requireUsuario()` usado por todas as features.

**Contrato:**

```
POST /api/auth/login
Request: { "email": "string", "senha": "string" }
Response 200: { "usuario": { "id": "uuid", "nome": "string", "email": "string", "statusConta": "ATIVA" } }

GET /api/auth/sessao
Response 200: { "usuario": { ... }, "expiraEm": "ISO" }
Response 401: { "error": { "code": "AUTH_SESSAO_EXPIRADA" } }
```

**Validações / Erros:**
- `AUTH_CREDENCIAIS_INVALIDAS` → 401 (mensagem genérica).
- `AUTH_EMAIL_NAO_VERIFICADO` → 403 com `details.podeReenviar`.
- `AUTH_CONTA_SUSPENSA` → 403.
- `NAO_AUTENTICADO` → 401 em rota privada.
- `RATE_LIMIT_EXCEDIDO` → 429.

**Critério de Aceitação:**
- Dado um usuário ativo, Quando faço login com a senha correta, Então recebo sessão e acesso à área privada.
- Dado um usuário pendente de verificação, Quando faço login, Então recebo 403 com opção de reenvio.
- Dado um usuário A autenticado, Quando acesso um recurso do usuário B, Então recebo 404.
- Dado 6 tentativas erradas em 15 min, Quando tento de novo, Então recebo 429.

**Dependências:** RN-085-3

**Notas técnicas:**
- `requireUsuario()` devolve o `usuarioId` da sessão; nunca aceitar `usuarioId` do corpo.
- 404 em vez de 403 para não confirmar existência de recurso alheio.

---

### RN-085-5. Implementar redefinição de senha

| Campo | Valor |
|---|---|
| **Título** | `[ProjetoInvest] RN-085-5 — Implementar redefinição de senha` |
| **Activity** | Development |
| **RNs** | RN-071, RN-086 |

**Descrição:**
Implementar `POST /api/auth/esqueci-senha` e `POST /api/auth/redefinir-senha`. Token de 1 h, uso único, invalidação dos anteriores e das sessões ativas após a troca.

**Contrato:**

```
POST /api/auth/esqueci-senha
Request: { "email": "string" }
Response 202: { "message": "Se o e-mail estiver cadastrado, enviaremos um link." }

POST /api/auth/redefinir-senha
Request: { "token": "string", "novaSenha": "string" }
Response 200: { "message": "Senha redefinida." }
```

**Validações / Erros:**
- `AUTH_TOKEN_INVALIDO` → 400.
- `AUTH_TOKEN_EXPIRADO` → 410.
- `AUTH_SENHA_FRACA` → 422.
- `RATE_LIMIT_EXCEDIDO` → 429.

**Critério de Aceitação:**
- Dado um e-mail cadastrado, Quando solicito redefinição, Então recebo 202 e um token válido é emitido.
- Dado um e-mail inexistente, Quando solicito, Então a resposta é idêntica.
- Dado um token já usado, Quando tento reutilizar, Então recebo 409.
- Dado uma troca de senha bem-sucedida, Quando uso a sessão antiga, Então ela é inválida.

**Dependências:** RN-085-4

---

### RN-085-6. Implementar encerramento de conta com anonimização

| Campo | Valor |
|---|---|
| **Título** | `[ProjetoInvest] RN-085-6 — Implementar encerramento de conta com anonimização` |
| **Activity** | Development |
| **RNs** | RN-070, RN-088 |

**Descrição:**
Implementar `DELETE /api/conta` com confirmação de senha. Em transação: marcar `status_conta = EXCLUIDA`, preencher `excluido_em`, substituir nome e e-mail por valores anonimizados determinísticos, apagar tokens e invalidar sessões. Dados financeiros permanecem vinculados ao registro anonimizado.

**Contrato:**

```
DELETE /api/conta
Request: { "senha": "string" }
Response 200: { "statusConta": "EXCLUIDA", "mensagem": "Conta encerrada. Dados pessoais anonimizados." }
```

**Validações / Erros:**
- `AUTH_CREDENCIAIS_INVALIDAS` → 401.
- `CONTA_EXCLUSAO_BLOQUEADA` → 409 quando houver operação em andamento.

**Critério de Aceitação:**
- Dado um titular autenticado, Quando confirma a exclusão com a senha, Então o login deixa de funcionar e o nome/e-mail estão anonimizados.
- Dado um usuário excluído, Quando tento login, Então recebo credenciais inválidas sem revelar a exclusão.
- Dado o encerramento, Quando inspeciono tokens, Então nenhum está válido.

**Dependências:** RN-085-4

**Notas técnicas:**
- E-mail anonimizado precisa continuar único: usar `excluido+<uuid>@invalid.local`.
- Não apagar `movimentacao` (integridade e histórico); decisão registrada em `COMPLIANCE.md`.

---

### RN-085-7. Implementar telas públicas de conta

| Campo | Valor |
|---|---|
| **Título** | `[ProjetoInvest] RN-085-7 — Implementar telas públicas de conta` |
| **Activity** | Development |
| **RNs** | RN-069, RN-085, RN-086, RN-087 |

**Descrição:**
Implementar `/login`, `/cadastro`, `/verificar-email`, `/esqueci-senha` e `/redefinir-senha` conforme `UI_SPEC.md` §3, com validação no blur/submit, mensagens por campo, estados de envio e acessibilidade.

**Critério de Aceitação:**
- Dado o formulário de cadastro sem os dois aceites, Quando tento enviar, Então o botão está desabilitado com explicação.
- Dado um erro 422, Quando a resposta chega, Então o campo correspondente é marcado e os dados digitados são preservados.
- Dado um leitor de tela, Quando navego no formulário, Então todos os campos têm rótulo e erro associado.

**Dependências:** RN-085-2, RN-085-3, RN-085-5

---

### RN-085-8. Implementar tela de conta e confirmação de exclusão

| Campo | Valor |
|---|---|
| **Título** | `[ProjetoInvest] RN-085-8 — Implementar tela de conta e confirmação de exclusão` |
| **Activity** | Development |
| **RNs** | RN-088 |

**Descrição:**
Implementar `/conta` com dados do titular, troca de senha e encerramento de conta. A exclusão exige senha e diálogo que explica a anonimização irreversível.

**Critério de Aceitação:**
- Dado que clico em "Encerrar conta", Quando o diálogo abre, Então o foco fica preso nele e ESC cancela.
- Dado que confirmo sem senha, Quando envio, Então recebo erro de confirmação.
- Dado que confirmo com senha correta, Quando a operação conclui, Então sou redirecionado ao login.

**Dependências:** RN-085-6, RN-085-7

---

### RN-085-9. Testes de autenticação, isolamento e rate limit

| Campo | Valor |
|---|---|
| **Título** | `[ProjetoInvest] RN-085-9 — Testes de autenticação, isolamento e rate limit` |
| **Activity** | Development |
| **RNs** | RN-070, RN-071, RN-085, RN-086, RN-088 |

**Descrição:**
Cobrir o ciclo completo com testes de integração e E2E: cadastro → verificação → login, redefinição, encerramento, IDOR entre duas contas, rate limit e ausência de `senha_hash`/`token_hash` em qualquer resposta.

**Critério de Aceitação:**
- Dado dois usuários, Quando o usuário A chama `/api/ativos/{id}` do B, Então recebe 404.
- Dado qualquer resposta da API, Quando inspeciono o JSON, Então não há `senha_hash` nem `token_hash`.
- Dado o fluxo E2E, Quando executo ponta a ponta, Então cadastro, verificação, login, logout e exclusão funcionam.

**Dependências:** RN-085-4, RN-085-6, RN-085-7, RN-085-8

**Notas técnicas:**
- Usar MailHog/Ethereal no teste de verificação.
- Rate limit precisa ser configurável por ambiente para não travar o CI.
