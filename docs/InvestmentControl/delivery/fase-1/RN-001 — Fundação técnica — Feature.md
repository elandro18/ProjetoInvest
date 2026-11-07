---
project: INVESTMENT CONTROL
module: fundacao
audience: [tecnica]
status: draft
---

# RN-001 — Fundação técnica

> Gerado por rdd-doc em 07/11/2026. Edite para revisar.
> Análise: ../../analysis/RN-001 — Fundação técnica/
> Após revisão, use o workflow de issues para criar as tarefas no sistema de tracking.

## Issue principal

| Campo | Valor |
|---|---|
| Título | `RN-001 — Fundação técnica` |
| Tracking ID | — (a criar) |
| Módulo | InvestmentControl |
| Milestone | Fase 1 |
| Repositórios | `elandro18/ProjetoInvest` |

## Resumo das tasks

| Task | Tipo | Repo | Descrição |
|---|---|---|---|
| RN-001-1 | DevOps | ProjetoInvest | Criar estrutura Next.js, scripts e configuração de ambiente |
| RN-001-2 | Database | ProjetoInvest | Configurar Prisma/Neon e migration inicial com classes e segmentos |
| RN-001-3 | Backend | ProjetoInvest | Implementar núcleo transversal: Result, erro, Zod, requestId, logging |
| RN-001-4 | Backend | ProjetoInvest | Implementar camada de provedores, registry e log de integração |
| RN-001-5 | DevOps | ProjetoInvest | Configurar deploy na Vercel, healthcheck e observabilidade |
| RN-001-6 | Backend | ProjetoInvest | Implementar testes de fundação e gates de qualidade |

## Ordem de Execução

**Wave 1 — Estrutura e banco:**
RN-001-1 → RN-001-2

**Wave 2 — Núcleo transversal:**
RN-001-3

**Wave 3 — Integrações:**
RN-001-4

**Wave 4 — Deploy:**
RN-001-5

**Wave 5 — Qualidade:**
RN-001-6

---

### RN-001-1. Criar estrutura do projeto Next.js e configuração de ambiente

| Campo | Valor |
|---|---|
| **Título** | `[DevOps] RN-001-1 — Criar estrutura do projeto Next.js e configuração de ambiente` |
| **Activity** | Development |
| **RNs** | RN-001, RN-008, RN-068 |

**Descrição:**
Criar o projeto Next.js 15+ com TypeScript, App Router, Tailwind e as pastas de camada (`app/`, `src/modules/`, `src/infra/`, `src/lib/`). Configurar scripts (`dev`, `build`, `start`, `lint`, `typecheck`, `test`, `test:e2e`, `db:migrate`, `db:seed`), `.env.example` sem valores reais, `.gitignore` cobrindo `.env*` (exceto o example), e a regra de lint que impede o domínio de importar `next/*`, `@prisma/client` e SDKs de provedor.

**Critério de Aceitação:**
- Dado o repositório clonado e `npm ci`, Quando executo `npm run dev`, Então a aplicação sobe localmente sem erro.
- Dado que um arquivo em `src/modules/` importa `@prisma/client`, Quando executo `npm run lint`, Então o lint falha com mensagem clara.
- Dado o repositório, Quando procuro arquivos `.env` versionados, Então nenhum é encontrado além de `.env.example`.

**Dependências:** — (primeira task)

**Notas técnicas:**
- Não criar pastas de features futuras vazias; apenas a estrutura de camadas.
- `package.json` com `engines.node >= 22`.
- Tailwind apenas com tokens semânticos definidos em `UI_SPEC.md` §1.1.

---

### RN-001-2. Configurar Prisma/Neon e migration inicial com classes e segmentos

| Campo | Valor |
|---|---|
| **Título** | `[Database] RN-001-2 — Configurar Prisma/Neon e migration inicial com classes e segmentos` |
| **Activity** | Development |
| **RNs** | RN-003, RN-006, RN-008, RN-084 |

**Descrição:**
Configurar o Prisma com duas conexões (`DATABASE_URL` pooled e `DIRECT_URL` direta), criar a migration inicial com os dados de referência de classes e segmentos e a função de atualização de `atualizado_em`. Criar seed idempotente. Nenhuma tabela de negócio além das referências entra nesta task.

**Tabelas de referência:**

| Tabela | Coluna alvo | Uso |
|---|---|---|
| `classe_ativo` | `codigo`, `nome`, `ativo`, `ordem` | Referência de classe de investimento |
| `segmento_ativo` | `classe_id`, `codigo`, `nome`, `ativo`, `ordem` | Referência de segmento de FII |

```sql
CREATE TABLE classe_ativo (
  id uuid PRIMARY KEY,
  codigo varchar(30) NOT NULL UNIQUE,
  nome varchar(60) NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  ordem smallint NOT NULL DEFAULT 0
);

CREATE TABLE segmento_ativo (
  id uuid PRIMARY KEY,
  classe_id uuid NOT NULL REFERENCES classe_ativo(id) ON DELETE RESTRICT,
  codigo varchar(40) NOT NULL,
  nome varchar(80) NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  ordem smallint NOT NULL DEFAULT 0,
  CONSTRAINT ux_segmento_classe_codigo UNIQUE (classe_id, codigo)
);

CREATE OR REPLACE FUNCTION set_atualizado_em() RETURNS trigger AS $$
BEGIN NEW.atualizado_em = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;
```

**Validações / Erros:**
- `MIGRATION_PENDENTE`: schema divergente em runtime → 500.
- Seed executado duas vezes não duplica registro (upsert por `codigo`).

**Critério de Aceitação:**
- Dado banco vazio, Quando `prisma migrate deploy` e `db:seed` executam, Então existem 2 classes e 9 segmentos.
- Dado o seed executado duas vezes, Quando conto os registros, Então o total não muda.
- Dado um `INSERT` de segmento com `classe_id` inexistente, Quando executo, Então a FK rejeita.

**Dependências:** RN-001-1

**Notas técnicas:**
- Seed de segmentos: Logística, Shopping Centers, Recebíveis Imobiliários, Lajes Corporativas, Renda Urbana, Híbridos, Agronegócio, Outros, Caixa e Oportunidades.
- `Caixa e Oportunidades` é segmento da carteira (RN-089).
- Não usar `prisma db push` em ambiente com dados (ADR-002).

---

### RN-001-3. Implementar núcleo transversal: Result, erro, Zod, requestId e logging

| Campo | Valor |
|---|---|
| **Título** | `[ProjetoInvest] RN-001-3 — Implementar núcleo transversal de erro, validação e logging` |
| **Activity** | Development |
| **RNs** | RN-069, RN-072 |

**Descrição:**
Criar em `src/lib` e `src/infra` os blocos usados por todas as features: tipo `Result<T, E>`, `AppError` com código do catálogo, `toHttpResponse` (mapeamento código → status e envelope), wrapper de Route Handler que injeta `requestId`, validação Zod com `details.errors[].field`, logger estruturado com mascaramento e `Money`/`Decimal` (serialização como string).

**Contrato:**

```
Envelope de erro (todos os endpoints)
Response 422: { "error": { "code": "VALIDACAO", "message": "...", "details": { "errors": [ { "field": "data", "message": "..." } ], "traceId": "..." } } }
```

**Validações / Erros:**
- `VALIDACAO`: schema inválido → 422.
- `ERRO_INTERNO`: exceção não tratada → 500 com `details.traceId`.
- `NAO_AUTENTICADO`: ausência de sessão → 401 (depende da RN-085).

**Critério de Aceitação:**
- Dado um handler que lança exceção, Quando a rota é chamada, Então a resposta é 500 no envelope padrão e o log contém o mesmo `traceId`.
- Dado um payload inválido, Quando a rota é chamada, Então a resposta é 422 com um item por campo inválido.
- Dado um valor `Decimal("1234.50")`, Quando serializo, Então o JSON contém `"1234.50"` (string), nunca `1234.5` numérico.

**Dependências:** RN-001-1

**Notas técnicas:**
- Nunca logar payload financeiro completo; logar `requestId`, rota, status e duração.
- `traceId` não deve ser previsível a partir do usuário.

---

### RN-001-4. Implementar camada de provedores, registry e log de integração

| Campo | Valor |
|---|---|
| **Título** | `[ProjetoInvest] RN-001-4 — Implementar camada de provedores e log de integração` |
| **Activity** | Development |
| **RNs** | RN-001, RN-002, RN-003, RN-004, RN-005, RN-006, RN-030, RN-034, RN-072, RN-073, RN-074 |

**Descrição:**
Criar a interface `ProvedorDados` com capacidades declaradas, `DadoProveniente<T>`, o registry que resolve provedor por operação e prioridade (lida de `provedor_dados`), o cliente HTTP com timeout de 5 s e retry limitado, e o registro em `log_integracao` com status tipado. Nenhum provedor concreto é implementado aqui — apenas o contrato e um stub de teste.

**Contrato:**

```
GET /api/health
Response 200: { "status": "ok", "banco": "ok", "ultimaImportacaoCvm": null }
Response 503: { "status": "degraded", "banco": "erro" }
```

**Tabelas de referência:**

| Tabela | Coluna alvo | Uso |
|---|---|---|
| `provedor_dados` | `nome`, `capacidades`, `prioridade`, `ativo` | Resolução de provedor |
| `log_integracao` | `provedor_id`, `operacao`, `status`, `duracao_ms`, `data_consulta` | Auditoria de chamada |

**Validações / Erros:**
- `INT_OPERACAO_NAO_SUPORTADA`: capacidade ausente → 422.
- `INT_TIMEOUT`: tempo excedido → 504.
- `INT_RESPOSTA_INVALIDA`: payload fora do schema → 502.

**Critério de Aceitação:**
- Dado um provedor sem a capacidade `dividendos`, Quando a operação é solicitada, Então retorna `INT_OPERACAO_NAO_SUPORTADA` e não zero.
- Dado um provedor que demora mais de 5 s, Quando a operação é solicitada, Então o registro em `log_integracao` tem status `TIMEOUT`.
- Dado um provedor que responde fora do schema, Quando a operação é solicitada, Então o log tem status `DADOS_INCOMPLETOS`/`ERRO` e nada é persistido como válido.

**Dependências:** RN-001-2, RN-001-3

**Notas técnicas:**
- `DadoProveniente` é obrigatório no retorno de toda operação de provedor (RN-003).
- Fallback lê o último registro de `historico_*` e marca `statusDado: HISTORICO` (RN-073).
- Log nunca inclui chave de API nem resposta completa.

---

### RN-001-5. Configurar deploy na Vercel, healthcheck e observabilidade

| Campo | Valor |
|---|---|
| **Título** | `[DevOps] RN-001-5 — Configurar deploy na Vercel, healthcheck e observabilidade` |
| **Activity** | Development |
| **RNs** | RN-001, RN-068, RN-072, RN-074 |

**Descrição:**
Configurar o projeto na Vercel com os três ambientes, variáveis por ambiente (sem valor no repositório), build com `prisma generate` e `prisma migrate deploy` apenas em produção, branch principal com deploy automático e `/api/health` monitorado. Documentar o processo em `docs/howto/deploy.md`.

**Contrato:**

```
GET /api/health
Response 200: { "status": "ok", "banco": "ok" }
Response 503: { "status": "degraded", "banco": "erro" }
```

**Validações / Erros:**
- `BANCO_INDISPONIVEL`: falha de conexão → 503.
- `MIGRATION_PENDENTE`: schema divergente → 500.

**Critério de Aceitação:**
- Dado um push na branch principal, Quando o build termina, Então a aplicação está acessível por URL pública.
- Dado o ambiente de preview, Quando o build roda, Então nenhuma migration é aplicada no banco de produção.
- Dado que o banco está inacessível, Quando chamo `/api/health`, Então recebo 503.

**Dependências:** RN-001-2, RN-001-4

**Notas técnicas:**
- `AUTH_SECRET` ainda não é usado nesta feature, mas deve existir no ambiente antes da RN-085.
- Build falha se `tsc --noEmit`, `eslint` ou `prisma validate` falharem.
- Não expor versão de dependência no healthcheck.

---

### RN-001-6. Implementar testes de fundação e gates de qualidade

| Campo | Valor |
|---|---|
| **Título** | `[ProjetoInvest] RN-001-6 — Implementar testes de fundação e gates de qualidade` |
| **Activity** | Development |
| **RNs** | RN-069, RN-072, RN-083 |

**Descrição:**
Configurar Vitest, Testing Library e Playwright; criar os primeiros testes do núcleo (Result, mapeamento de erro, serialização decimal, registry de provedores) e o workflow de CI com lint, typecheck, testes, cobertura mínima e `npm audit`. Criar as fixtures base descritas em `TEST_STRATEGY.md` §6.

**Validações / Erros:**
- Cobertura abaixo do gate bloqueia merge.
- Teste que depende de relógio real falha (usar data fixa).

**Critério de Aceitação:**
- Dado o repositório, Quando executo `npm run test`, Então todos os testes do núcleo passam.
- Dado um PR que reduz a cobertura de `src/modules/**` abaixo de 90%, Quando o CI roda, Então o merge é bloqueado.
- Dado um teste que usa data dinâmica, Quando executo duas vezes, Então o resultado é idêntico.

**Dependências:** RN-001-3, RN-001-4

**Notas técnicas:**
- Meta de cobertura e casos de ouro estão em `quality/TEST_STRATEGY.md`.
- Usar banco Postgres local no CI, não branch do Neon.
