---
project: INVESTMENT CONTROL
module: conta
audience: [tecnica]
status: draft
---

# RN-085 — Conta e autenticação

> Gerado por rdd-doc em 07/11/2026. Edite para revisar.

## Contexto técnico

Implementa o ciclo de vida da conta sob cadastro aberto (ADR-011): criação com aceite legal, verificação de e-mail obrigatória, login por credenciais, redefinição de senha por token de uso único, sessão em cookie e encerramento com anonimização. Também entrega a base de isolamento multiusuário (`usuario_id` em toda tabela de negócio) que as demais features usam.

Restrições: Argon2id (RN-071); token só como hash (RN-086); resposta neutra em recuperação; aceite versionado (RN-087); anonimização no encerramento (RN-088); middleware protege tudo que não for público.

## Mapa RN → repositórios/endpoints/telas

| RN | Repositório | Endpoints / Telas |
|---|---|---|
| RN-009 | ProjetoInvest | Middleware de sessão; `/login` |
| RN-067 | ProjetoInvest | Guard 401 em rota privada |
| RN-070 | ProjetoInvest | Filtro `usuario_id` nos repositórios |
| RN-071 | ProjetoInvest | `usuario.senha_hash` (Argon2id) |
| RN-085 | ProjetoInvest | `POST /api/auth/cadastro`, `POST /api/auth/verificar-email`, `POST /api/auth/reenviar-verificacao`, `/cadastro`, `/verificar-email` |
| RN-086 | ProjetoInvest | `POST /api/auth/esqueci-senha`, `POST /api/auth/redefinir-senha`, `/esqueci-senha`, `/redefinir-senha` |
| RN-087 | ProjetoInvest | `aceite_legal` no cadastro |
| RN-088 | ProjetoInvest | `DELETE /api/conta`, `/conta` |

## Decisões técnicas

| # | Decisão | Justificativa |
|---|---|---|
| 1 | Auth.js com provider de credenciais e JWT em cookie | Sem provedor externo; controle total do fluxo (ADR-003) |
| 2 | Token aleatório de 32 bytes, persistido só como SHA-256 | Vazamento do banco não permite reutilizar link |
| 3 | Um único tipo de tabela `token_conta` com `tipo` | Evita duplicação de estrutura e de rotina de expiração |
| 4 | Emissão de novo token invalida o anterior do mesmo tipo | Reduz janela de reuso |
| 5 | Encerramento marca `status_conta = EXCLUIDA` e anonimiza campos | Preserva integridade referencial sem manter PII |
| 6 | Rate limit em memória/Redis por IP + e-mail | Proteção mínima sem infraestrutura extra na Fase 1 |

## Contratos e tabelas envolvidos

- **Contratos de API:** `specs/API_CONTRACTS.md` §2.1–§2.9
- **Modelo de dados:** `specs/DATA_MODEL.md` §4.1 (`usuario`), §4.19 (`token_conta`), §4.20 (`aceite_legal`)
- **UI:** `specs/UI_SPEC.md` §3 (`/login`, `/cadastro`, `/verificar-email`, `/esqueci-senha`, `/redefinir-senha`), §14.2 (`/conta`)
- **Erros:** `specs/ERROR_CATALOG.md` §3
- **Segurança:** `specs/SECURITY.md` §4–§5, §13
- **Compliance:** `specs/COMPLIANCE.md` §3.3, §3.6
- **Legado:** não aplicável

## Riscos e pré-requisitos

- Envio de e-mail transacional é dependência externa; sem ele, o cadastro fica inutilizável.
- A anonimização precisa preservar `movimentacao`/`sugestao_aporte` — decidir se os fatos financeiros permanecem com usuário anonimizado (padrão proposto) ou são eliminados.
- `AUTH_SECRET` e `EMAIL_SERVER` precisam existir em produção.
- Teste de IDOR é pré-requisito da RN-070: precisa de duas contas de teste.
- Sem CAPTCHA na Fase 1: mitigação é rate limit + verificação obrigatória.
