# Architecture Decision Records — Investment Control

> Formato MADR simplificado. Numeração sequencial e imutável.
> Decisões marcadas como **Proposto** aguardam confirmação do proprietário antes de orientar código.

---

## ADR-001: Stack de aplicação — Next.js (App Router) como monolito modular na Vercel

**Status:** Aceito
**Data:** 07/11/2026
**Decisor:** Proprietário do produto (confirmado em revisão das features da Fase 1)
**Contexto:** A especificação exige frontend web responsivo, API REST, PostgreSQL no Neon, ORM Prisma e hospedagem na Vercel. Não define framework. Rodar frontend e backend em projetos separados na Vercel adiciona um segundo deploy, CORS, autenticação duplicada e dois conjuntos de variáveis de ambiente — custo desproporcional para uma aplicação de uso pessoal.
**Decisão:** Usar um único projeto Next.js 15+ com TypeScript e App Router. A UI é composta por Server e Client Components; a API REST é implementada com Route Handlers em `app/api/**`. A lógica de negócio fica em `src/modules/**` (camada de domínio), fora dos componentes e das rotas.
**Consequências:**
- Positivas: um deploy só, tipos compartilhados entre UI e API, autenticação única, menor superfície operacional.
- Negativas: acoplamento ao runtime da Vercel; se no futuro for necessário outro backend, a camada de domínio precisa ser extraível — por isso ela não pode importar nada de `next/*`.
- Risco: Route Handlers não são um framework de API completo (sem validação/serialização por padrão) — mitigado por Zod + camada de serviço.

---

## ADR-002: PostgreSQL no Neon com Prisma ORM e migrations versionadas

**Status:** Aceito (definido na especificação)
**Data:** 07/11/2026
**Decisor:** Documento de especificação (proprietário)
**Contexto:** A especificação define PostgreSQL, banco hospedado no Neon e ORM Prisma ou equivalente.
**Decisão:** Adotar PostgreSQL no Neon com Prisma. O schema evolui exclusivamente por migrations versionadas em `prisma/migrations/`; `prisma db push` não é usado em nenhum ambiente que contenha dados reais.
**Consequências:**
- Positivas: schema versionado, tipos gerados, integração direta com TypeScript.
- Negativas: Prisma limita queries muito específicas (ex.: window functions complexas) — nesses casos, usar `$queryRaw` documentado e testado.
- Operacional: a estratégia de backup segue o plano contratado do Neon (`PEND-003`).

---

## ADR-003: Autenticação com credenciais e hash Argon2id

**Status:** Aceito
**Data:** 07/11/2026
**Decisor:** Proprietário do produto
**Contexto:** A especificação exige login individual e proíbe senha em texto puro, sem definir provedor de identidade. Em 07/11/2026 o proprietário decidiu cadastro aberto (`RN-085`), o que exige verificação de e-mail e redefinição de senha.
**Decisão:** Usar Auth.js (NextAuth) com provider de credenciais, sessão em cookie `httpOnly`, `secure` e `sameSite=lax`. Senhas armazenadas com Argon2id e salt individual. Rotas privadas protegidas por middleware; toda consulta de dados filtra por `usuario_id`. Verificação de e-mail e redefinição usam token de uso único com hash no banco (`token_conta`).
**Consequências:**
- Positivas: sem dependência de provedor externo, sem custo, controle total do fluxo.
- Negativas: envio de e-mail transacional passa a ser dependência de infraestrutura.
- Segurança: rate limit no login e nos endpoints de token, mensagens de erro genéricas e bloqueio progressivo (`RN-067`, `RN-071`, `RN-086`).

---

## ADR-004: Arquitetura em camadas com domínio isolado de framework

**Status:** Aceito (definido na especificação)
**Data:** 07/11/2026
**Decisor:** Documento de especificação (proprietário)
**Contexto:** A especificação exige separar interface, regras de negócio, acesso ao banco e integrações externas, e proíbe que o frontend chame APIs financeiras diretamente.
**Decisão:** Quatro camadas com dependência unidirecional:
1. `app/` e `components/` — apresentação (não contém cálculo financeiro).
2. `src/modules/<dominio>/` — domínio e casos de uso (TypeScript puro, testável).
3. `src/infra/` — persistência (Prisma) e integrações (provedores).
4. `src/lib/` — utilidades transversais (dinheiro, datas, resultado).
Regra de dependência: domínio não importa Prisma, `next/*` nem SDK de provedor; ele recebe interfaces (ports) implementadas pela infraestrutura.
**Consequências:**
- Positivas: regras financeiras testáveis sem banco, troca de provedor e de ORM sem tocar no domínio.
- Negativas: mais arquivos e mapeamento explícito entre entidade de domínio e modelo Prisma.

---

## ADR-005: Camada de provedores com contrato por capacidade

**Status:** Aceito (definido na especificação)
**Data:** 07/11/2026
**Decisor:** Documento de especificação (proprietário)
**Contexto:** A especificação exige interface padronizada (`FiiDataProvider`, `CvmDataProvider`, `B3DataProvider`, `FixedIncomeDataProvider`), sem acoplar a um fornecedor, e determina que cada provedor implemente apenas o que realmente oferece.
**Decisão:** Definir um contrato base com operações granulares e um mecanismo de capacidades declaradas (`supports('quote')`, `supports('dividends')`, etc.). O registry de provedores decide, por operação, qual provedor usar segundo prioridade configurada. O domínio consome apenas as interfaces; nenhum tipo de SDK externo vaza para fora de `src/infra/providers/<provedor>/`.
**Consequências:**
- Positivas: troca de provedor por configuração; ausência de operação é tratada como "não suportado", não como erro genérico.
- Negativas: normalização de dados entre fontes é trabalhosa e precisa de testes por provedor.

---

## ADR-006: Dinheiro em decimal, proibido ponto flutuante

**Status:** Aceito (definido na especificação e nas boas práticas financeiras)
**Data:** 07/11/2026
**Decisor:** Documento de especificação (proprietário)
**Contexto:** O sistema calcula patrimônio, preço médio, rendimentos e projeções. Ponto flutuante binário acumula erro (0.1 + 0.2 ≠ 0.3) e produz divergência de centavos em relatórios.
**Decisão:** Valores monetários usam `numeric(18,2)` no PostgreSQL, `Decimal` no Prisma e uma biblioteca decimal (decimal.js ou Prisma.Decimal) no domínio. Quantidades de cotas usam `numeric(18,8)`. Percentuais usam `numeric(9,6)`. Conversão para `number` só é permitida na borda de apresentação.
**Consequências:**
- Positivas: soma de carteira fecha com o extrato ao centavo; arredondamento explícito.
- Negativas: serialização em JSON precisa de tratamento (string ↔ Decimal) e os gráficos convertem no cliente.

---

## ADR-007: Proveniência obrigatória de dado externo

**Status:** Aceito (definido na especificação)
**Data:** 07/11/2026
**Decisor:** Documento de especificação (proprietário)
**Contexto:** A especificação exige registrar origem e data de referência de cada informação e diferenciar dado atualizado, histórico, indisponível e estimado.
**Decisão:** Todo registro de dado de mercado (preço, indicador, rendimento) carrega `fonte`, `provedor_id`, `data_referencia`, `coletado_em` e `status_dado` (`OFICIAL`, `MERCADO`, `ESTIMADO`, `HISTORICO`, `INDISPONIVEL`). A API devolve esses campos junto ao valor; a UI é obrigada a exibi-los.
**Consequências:**
- Positivas: nenhum número "solto" na tela; auditoria possível.
- Negativas: payloads maiores e mais colunas de metadados em todas as tabelas de série histórica.

---

## ADR-008: Regras, metas e pesos configuráveis em banco

**Status:** Aceito (definido na especificação)
**Data:** 07/11/2026
**Decisor:** Documento de especificação (proprietário)
**Contexto:** A especificação exige que metas, critérios, pesos e limites sejam configuráveis sem alterar código.
**Decisão:** Metas de alocação, pesos de avaliação, critérios de qualidade e limites de concentração vivem em tabelas versionadas (`alocacao_meta`, `criterio_avaliacao`, `limite_concentracao`), com vigência por data. Constantes no código ficam restritas a valores default de primeira configuração, criados por seed — nunca lidos diretamente pelo domínio.
**Consequências:**
- Positivas: mudança de estratégia não exige deploy; histórico de metas preservado para relatórios retroativos.
- Negativas: a configuração precisa de validação (soma 100%, peso total 100) e de uma tela de administração própria.

---

## ADR-009: Escopo da primeira entrega limitado à Fase 1

**Status:** Aceito (definido na especificação)
**Data:** 07/11/2026
**Decisor:** Documento de especificação (proprietário)
**Contexto:** O documento define cinco fases e afirma explicitamente que a primeira entrega deverá contemplar somente a Fase 1.
**Decisão:** A Fase 1 entrega estrutura, banco, deploy, cadastro de ativos, movimentações, renda fixa, carteira consolidada, dashboard e meta 50/50. Épicos de pesquisa, avaliação, regras de risco e projeções permanecem documentados (`RN-027` a `RN-059`) e não são implementados antes do aceite da Fase 1.
**Consequências:**
- Positivas: entrega utilizável em semanas, com o núcleo de confiança (posição e patrimônio) validado antes de qualquer inferência.
- Negativas: o produto não responde "onde aportar" até a Fase 2 — expectativa precisa ser comunicada.

---

## ADR-010: Testes de regra financeira são pré-requisito de task

**Status:** Aceito
**Data:** 07/11/2026
**Decisor:** Documento de especificação (proprietário)
**Contexto:** A especificação exige testes para regras financeiras e implementação de uma task por vez, sem avançar sem validar a anterior.
**Decisão:** Nenhuma task que altere cálculo de posição, preço médio, rendimento, alocação, desvio, pontuação ou projeção é considerada concluída sem teste automatizado cobrindo o caso feliz e ao menos um caso de borda. A suíte usa Vitest para domínio e Playwright para fluxo crítico.
**Consequências:**
- Positivas: erro de cálculo é detectado antes de contaminar a carteira.
- Negativas: aumenta o tempo por task em um produto de uso pessoal — custo aceito por se tratar de dinheiro.

---

## ADR-011: Cadastro aberto com verificação de e-mail e consentimento versionado

**Status:** Aceito
**Data:** 07/11/2026
**Decisor:** Proprietário do produto
**Contexto:** A versão inicial previa conta única fechada (`PEND-002`). O proprietário decidiu permitir cadastro aberto, o que transforma o produto em aplicação multiusuário de fato e exige isolamento real de dados, verificação de e-mail, proteção contra abuso e base legal explícita para tratamento de dado pessoal.
**Decisão:**
1. Cadastro aberto com nome, e-mail único e senha; conta nasce em `PENDENTE_VERIFICACAO`.
2. Login só é liberado após verificação do e-mail por token de uso único (24 h).
3. Redefinição de senha por token de 1 h, com resposta neutra para e-mail inexistente.
4. Aceite obrigatório e versionado dos Termos de Uso e da Política de Privacidade no cadastro, registrado em `aceite_legal`.
5. Todo dado de negócio carrega `usuario_id`; nenhuma consulta pode omitir o filtro.
6. Encerramento de conta disponível ao titular, com anonimização dos dados pessoais e retenção apenas do exigido por lei.
**Consequências:**
- Positivas: produto utilizável por outras pessoas sem novo desenvolvimento; conformidade LGPD com base legal demonstrável.
- Negativas: necessidade de e-mail transacional, rate limiting, proteção antiabuso (CAPTCHA condicional) e rotina de anonimização.
- Riscos: abuso de criação de contas e enumeração de e-mails — mitigados por rate limit, respostas neutras e verificação obrigatória.
- Impacto: `RN-085` a `RN-088`; tabelas `token_conta` e `aceite_legal`; fluxo de autenticação em `SECURITY.md` e `UI_SPEC.md`.
