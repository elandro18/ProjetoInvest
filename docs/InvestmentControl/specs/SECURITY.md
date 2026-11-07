---
project: INVESTMENT CONTROL
module: seguranca
audience: [tecnica]
status: draft
---

# Segurança — Investment Control

> **Derivado de:** `REQUIREMENTS.md` §5.12 e §5.14, `specs/ARCHITECTURE.md` §7 e §9, `DECISIONS.md` ADR-003/ADR-011.
> **Escopo:** aplicação web, API interna, banco Neon e integrações com provedores externos.

---

## 1. Princípios

| # | Princípio | Consequência |
|---|---|---|
| 1 | Menor privilégio | Cada usuário acessa apenas os próprios dados; chaves de provedor só no servidor |
| 2 | Defesa em profundidade | Autenticação + autorização + validação + constraint de banco |
| 3 | Seguro por padrão | Rota é privada a menos que explicitamente pública |
| 4 | Não confiar no cliente | Toda regra é revalidada no servidor |
| 5 | Falha segura | Erro não revela existência de recurso, e-mail ou detalhe interno |
| 6 | Rastreabilidade | Ação sensível gera registro com data e usuário |

---

## 2. Ativos de informação

| Ativo | Classificação | Onde vive | Impacto se vazar |
|---|---|---|---|
| Credencial (senha) | Secreta | `usuario.senha_hash` | Crítico |
| Sessão | Secreta | Cookie `httpOnly` | Crítico |
| Dados patrimoniais (posição, movimentação, renda fixa) | Pessoal/confidencial | Tabelas com `usuario_id` | Alto |
| Dados de identificação (nome, e-mail) | Pessoal | `usuario` | Médio |
| Chave de provedor de dados | Secreta | Variável de ambiente | Alto |
| Token de verificação/redefinição | Secreta e efêmera | `token_conta` (hash) | Alto |
| Log de integração | Interna | `log_integracao` | Baixo (sanitizado) |

---

## 3. Modelo de ameaças (STRIDE)

| Ameaça | Cenário concreto | Controle |
|---|---|---|
| **Spoofing** | Tentativa de login com e-mail de outra pessoa | Senha + Argon2id; rate limit; mensagem genérica; verificação de e-mail |
| **Tampering** | Alterar `usuario_id` no payload para ler carteira alheia | `usuario_id` nunca vem do cliente; sempre da sessão |
| **Repudiation** | Usuário nega ter aceitado termos ou alterado meta | `aceite_legal` versionado; `sugestao_aporte.decisao_*`; `criado_em` |
| **Information Disclosure** | IDOR em `/api/ativos/{id}` | Filtro obrigatório por `usuario_id` no repositório; 404 em vez de 403 |
| **Denial of Service** | Enxurrada de cadastros e consultas | Rate limit por IP/e-mail; verificação obrigatória; cache |
| **Elevation of Privilege** | Rota administrativa exposta | Não há papel admin na Fase 1; configuração é por usuário |
| **CSRF** | POST forjado a partir de site externo | `sameSite=lax`, verificação de `Origin`, token de sessão |
| **XSS** | Payload em observação de movimentação | Escapar na renderização; CSP; sem `dangerouslySetInnerHTML` |
| **Injeção SQL** | Query com `$queryRaw` concatenado | Prisma parametrizado; `$queryRaw` só com template tag e revisão |
| **Session fixation** | Fixar sessão antes do login | Nova sessão no login; rotação de cookie |
| **Enumeração de e-mail** | Cadastro e recuperação revelam existência | Resposta neutra + rate limit |
| **Abuso de conta** | Criação massiva de contas | Rate limit, verificação de e-mail, CAPTCHA condicional |

---

## 4. Autenticação

| Controle | Especificação |
|---|---|
| Senha | Argon2id (memória 64 MB, iterações 3, paralelismo 1); salt por usuário |
| Política | ≥ 10 caracteres; bloqueio de senhas comuns/vazadas; sem exigência artificial de símbolo |
| Sessão | JWT assinado, cookie `httpOnly` + `secure` + `sameSite=lax`; 8 h com renovação por atividade |
| Login | Rate limit 5/15 min por IP + e-mail; atraso progressivo; log de falha sem senha |
| Verificação de e-mail | Token 32 bytes aleatórios, SHA-256 no banco, 24 h, uso único, invalidação do anterior |
| Redefinição | Token 1 h, uso único, invalidação das sessões ativas após troca |
| Logout | Invalida cookie; sessão deixa de ser aceita |
| Encerramento de conta | Exige senha; invalida sessões; anonimiza dados pessoais |

> Verificação de e-mail é **obrigatória** antes do primeiro acesso (RN-085).

---

## 5. Autorização e isolamento

- Toda tabela de negócio tem `usuario_id` e todo repositório recebe `usuarioId` como primeiro argumento obrigatório.
- Regra de lint proíbe chamar repositório sem `usuarioId` (revisão de PR + teste de integração).
- Busca por ID de outro usuário retorna **404**, não 403, para não confirmar existência.
- Operações em lote validam que todos os IDs pertencem ao usuário antes de executar.
- Não existe papel administrativo na Fase 1; configuração é sempre do próprio titular.

---

## 6. Validação e proteção de dados

| Vetor | Controle |
|---|---|
| Entrada | Zod na borda (tipo, faixa, tamanho, formato, enum); rejeição 422 por campo |
| Decimal | String validada por regex antes de converter para `Decimal` |
| Datas | Parse estrito ISO; rejeição de data inválida (ex.: 31/02) |
| Upload | Não há upload na Fase 1; se houver, limitar tipo e tamanho e validar magic bytes |
| Saída | Serialização explícita por DTO — nunca `select *` cru para o cliente (`senha_hash`, `token_hash` nunca serializados) |
| XSS | React escapa por padrão; proibido HTML cru; CSP restritiva |
| CSRF | `sameSite=lax` + checagem de `Origin` em métodos não seguros |
| Open redirect | Destino pós-login restrito a caminhos internos |
| Mass assignment | DTO explícito por operação; campos imutáveis não aceitos em PATCH |

---

## 7. Segredos e configuração

- Nenhum `.env` versionado; `.env.example` sem valores.
- Segredos na Vercel por ambiente; acesso restrito ao proprietário.
- Chave de provedor nunca incluída no bundle do cliente — importada apenas em módulo server-only.
- Rotação documentada; chave comprometida é revogada no provedor antes de qualquer deploy.
- `AUTH_SECRET` com no mínimo 32 bytes aleatórios, diferente por ambiente.

---

## 8. Cabeçalhos e transporte

| Cabeçalho | Valor |
|---|---|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` |
| `Content-Security-Policy` | `default-src 'self'`; scripts com nonce; `img-src 'self' data:`; sem `unsafe-eval` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `X-Frame-Options` | `DENY` (ou `frame-ancestors 'none'` na CSP) |
| `Permissions-Policy` | câmera, microfone e geolocalização desabilitados |
| Cache | Resposta autenticada com `Cache-Control: no-store` |

---

## 9. Dependências e supply chain

- Lockfile versionado; instalação com `npm ci`.
- `npm audit` no CI; vulnerabilidade alta/crítica bloqueia merge.
- Dependabot/Renovate com PR automático e revisão humana.
- Proibido script pós-instalação de pacote não auditado.
- Atualização de dependência que toca autenticação exige teste manual do fluxo completo.

---

## 10. Logs, auditoria e monitoramento

| Evento | Registro | Retenção |
|---|---|---|
| Login com sucesso/falha | log estruturado (e-mail mascarado, IP truncado) | 90 dias |
| Emissão/uso de token | `token_conta` (hash, datas) | até 90 dias após expiração |
| Movimentação criada/cancelada | `movimentacao` + `criado_em` | permanente |
| Sugestão e decisão | `sugestao_aporte` | permanente |
| Chamada a provedor | `log_integracao` | `PEND-014` |
| Alteração de configuração | `criado_em`/`vigencia_*` | permanente |
| Exclusão de conta | `usuario.status_conta = EXCLUIDA` + data | mínimo legal |

Proibido registrar: senha, token puro, chave de API, payload completo de integração, IP puro em log de aplicação.

---

## 11. Privacidade e LGPD

- Inventário de dados, base legal, retenção e direitos do titular em `specs/COMPLIANCE.md`.
- Dado pessoal nunca é usado para finalidade diferente da declarada.
- Anonimização no encerramento de conta: nome substituído, e-mail pseudonimizado, IP apenas em hash.
- Exportação de dados do titular: prevista como direito; formato JSON/CSV (depende de `PEND-015`).

---

## 12. Segurança das integrações externas

- Toda chamada sai do servidor; nenhuma URL de provedor é chamada com parâmetro do usuário sem allowlist.
- Timeout de 5 s por requisição; retry com backoff apenas em erro transitório (429/5xx) e no máximo 2 tentativas.
- Resposta do provedor é validada por schema antes de ser persistida; payload inesperado é registrado como `INT_RESPOSTA_INVALIDA`.
- Certificado TLS verificado; nunca `rejectUnauthorized: false`.
- Provedor sem autenticação obrigatória ainda passa por rate limit local.

---

## 13. Checklist de liberação (Fase 1)

- [ ] Nenhum segredo no repositório (`git secrets`/varredura manual).
- [ ] `senha_hash` e `token_hash` ausentes de qualquer resposta de API (teste automatizado).
- [ ] Teste de IDOR: usuário A não acessa ativo/movimentação de B (404).
- [ ] Rate limit validado em login, cadastro e redefinição.
- [ ] Cookie de sessão com `httpOnly`, `secure` e `sameSite` conferidos em produção.
- [ ] CSP ativa e sem violação no console.
- [ ] Fluxo de verificação e redefinição testado ponta a ponta.
- [ ] Exclusão de conta anonimiza e invalida sessões.
- [ ] `npm audit` sem alta/crítica.
- [ ] Backup do Neon com restauração testada (`PEND-003`).

---

## 14. Matriz RN → controle

| RN | Controle |
|---|---|
| RN-009 | Login obrigatório; middleware de rota privada |
| RN-067 | 401 em rota privada sem sessão |
| RN-068 | Segredos em variável de ambiente; `.env` fora do versionamento |
| RN-069 | Zod na borda |
| RN-070 | Filtro por `usuario_id` em todo repositório |
| RN-071 | Argon2id |
| RN-072 | Tratamento tipado de falha de provedor |
| RN-073 | Leitura de histórico local quando provedor falha |
| RN-074 | `log_integracao` |
| RN-085 | Verificação de e-mail obrigatória |
| RN-086 | Token de uso único com expiração e resposta neutra |
| RN-087 | Aceite versionado em `aceite_legal` |
| RN-088 | Anonimização e invalidação de sessões |
