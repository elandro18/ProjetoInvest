---
project: INVESTMENT CONTROL
module: ativos
audience: [tecnica]
status: draft
---

# RN-010 — Cadastro de ativos

> Gerado por rdd-doc em 07/11/2026. Edite para revisar.
> Análise: ../../analysis/RN-010 — Cadastro de ativos/
> Após revisão, use o workflow de issues para criar as tarefas no sistema de tracking.

## Issue principal

| Campo | Valor |
|---|---|
| Título | `RN-010 — Cadastro de ativos` |
| Tracking ID | — (a criar) |
| Módulo | InvestmentControl |
| Milestone | Fase 1 |
| Repositórios | `elandro18/ProjetoInvest` |

## Resumo das tasks

| Task | Tipo | Repo | Descrição |
|---|---|---|---|
| RN-010-1 | Database | ProjetoInvest | Criar tabela `ativo` com unicidade e índices |
| RN-010-2 | Backend | ProjetoInvest | Implementar listagem e criação de ativos |
| RN-010-3 | Backend | ProjetoInvest | Implementar detalhe e atualização de ativo |
| RN-010-4 | Frontend | ProjetoInvest | Implementar listagem e formulário de ativo |
| RN-010-5 | Frontend | ProjetoInvest | Implementar ficha do ativo |
| RN-010-6 | Backend | ProjetoInvest | Testes de cadastro, unicidade e inativação |

## Ordem de Execução

**Wave 1 — Banco:**
RN-010-1

**Wave 2 — Backend:**
RN-010-2 → RN-010-3

**Wave 3 — Frontend:**
RN-010-4 → RN-010-5

**Wave 4 — Qualidade:**
RN-010-6

---

### RN-010-1. Criar tabela de ativo

| Campo | Valor |
|---|---|
| **Título** | `[Database] RN-010-1 — Criar tabela ativo com unicidade e índices` |
| **Activity** | Development |
| **RNs** | RN-010, RN-011, RN-012, RN-013, RN-070 |

**Descrição:**
Criar a tabela `ativo` com chave estrangeira para usuário, classe e segmento; unicidade de ticker por usuário; índices de consulta por usuário/status e por segmento.

**Tabelas de referência:**

| Tabela | Coluna alvo | Uso |
|---|---|---|
| `ativo` | `usuario_id`, `ticker`, `nome`, `classe_id`, `segmento_id`, `status`, `cnpj` | Cadastro |

```sql
CREATE TYPE status_ativo AS ENUM ('ATIVO','INATIVO','EM_ANALISE');

CREATE TABLE ativo (
  id uuid PRIMARY KEY,
  usuario_id uuid NOT NULL REFERENCES usuario(id) ON DELETE RESTRICT,
  ticker varchar(20) NOT NULL,
  nome varchar(160) NOT NULL,
  classe_id uuid NOT NULL REFERENCES classe_ativo(id) ON DELETE RESTRICT,
  segmento_id uuid REFERENCES segmento_ativo(id) ON DELETE RESTRICT,
  cnpj varchar(14),
  administrador varchar(160),
  gestor varchar(160),
  status status_ativo NOT NULL DEFAULT 'ATIVO',
  fonte_dados varchar(60),
  observacoes text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ux_ativo_usuario_ticker UNIQUE (usuario_id, ticker),
  CONSTRAINT chk_ativo_ticker_formato CHECK (ticker ~ '^[A-Z0-9]{4,20}$')
);
CREATE INDEX ix_ativo_usuario_status ON ativo (usuario_id, status);
CREATE INDEX ix_ativo_segmento ON ativo (segmento_id);
```

**Validações / Erros:**
- `ATIVO_TICKER_DUPLICADO` → 409.
- `ATIVO_TICKER_INVALIDO` → 422.

**Critério de Aceitação:**
- Dado o mesmo ticker para o mesmo usuário, Quando insiro duas vezes, Então a constraint falha.
- Dado o mesmo ticker para usuários diferentes, Quando insiro, Então é aceito.
- Dado ticker minúsculo, Quando insiro, Então o CHECK rejeita.

**Dependências:** RN-001-2, RN-085-1

---

### RN-010-2. Implementar listagem e criação de ativos

| Campo | Valor |
|---|---|
| **Título** | `[ProjetoInvest] RN-010-2 — Implementar listagem e criação de ativos` |
| **Activity** | Development |
| **RNs** | RN-010, RN-011, RN-012, RN-069 |

**Descrição:**
Implementar `GET /api/ativos` (filtros, busca, paginação) e `POST /api/ativos` (validação de classe ativa, segmento obrigatório para FII, CNPJ com DV). Retornar classe e segmento aninhados e a posição quando existir.

**Contrato:**

```
GET /api/ativos?q=&classeId=&segmentoId=&status=&page=&pageSize=
Response 200: { "data": [ { "id", "ticker", "nome", "classe": {...}, "segmento": {...}, "status", "posicao": {...} } ], "meta": {...} }

POST /api/ativos
Request: { "ticker": "HGLG11", "nome": "CSHG Logística", "classeId": "uuid", "segmentoId": "uuid", "cnpj": null, "administrador": null, "gestor": null, "fonteDados": null, "observacoes": null }
Response 201: { "id": "uuid", "ticker": "HGLG11", ... }
```

**Validações / Erros:**
- `ATIVO_CLASSE_INVALIDA` → 422.
- `ATIVO_SEGMENTO_OBRIGATORIO` → 422.
- `ATIVO_SEGMENTO_INVALIDO` → 422.
- `ATIVO_CNPJ_INVALIDO` → 422.
- `ATIVO_TICKER_DUPLICADO` → 409.

**Critério de Aceitação:**
- Dado classe FII sem segmento, Quando crio, Então recebo 422.
- Dado classe renda fixa com segmento, Quando crio, Então o segmento é ignorado/rejeitado conforme regra.
- Dado um usuário, Quando lista, Então só vê os próprios ativos.

**Dependências:** RN-010-1, RN-085-4

---

### RN-010-3. Implementar detalhe e atualização de ativo

| Campo | Valor |
|---|---|
| **Título** | `[ProjetoInvest] RN-010-3 — Implementar detalhe e atualização de ativo` |
| **Activity** | Development |
| **RNs** | RN-010, RN-013 |

**Descrição:**
Implementar `GET /api/ativos/{id}` com posição e últimas cotações, e `PATCH /api/ativos/{id}` para dados editáveis e status. Bloquear alteração de classe quando houver movimentação.

**Contrato:**

```
GET /api/ativos/{id}
Response 200: { "id", "ticker", "nome", "classe", "segmento", "status", "posicao", "rendimentosAcumulados", "ultimosPrecos": [] }

PATCH /api/ativos/{id}
Request: { "status": "INATIVO" }
Response 200: { "id", "status": "INATIVO" }
```

**Validações / Erros:**
- `ATIVO_NAO_ENCONTRADO` → 404.
- `ATIVO_CLASSE_IMUTAVEL` → 422.
- `ATIVO_EM_USO` → 409 em tentativa de exclusão.

**Critério de Aceitação:**
- Dado ativo de outro usuário, Quando consulto, Então recebo 404.
- Dado ativo com movimentação, Quando tento mudar a classe, Então recebo 422.
- Dado `status: INATIVO`, Quando salvo, Então a listagem de sugestões futuras deixa de considerá-lo.

**Dependências:** RN-010-2

---

### RN-010-4. Implementar listagem e formulário de ativo

| Campo | Valor |
|---|---|
| **Título** | `[ProjetoInvest] RN-010-4 — Implementar listagem e formulário de ativo` |
| **Activity** | Development |
| **RNs** | RN-010, RN-011, RN-012 |

**Descrição:**
Implementar `/ativos` e `/ativos/novo` conforme `UI_SPEC.md` §6.1–§6.2, com selects dependentes de classe/segmento, máscara de CNPJ e estados de carregamento, vazio e erro.

**Critério de Aceitação:**
- Dado que escolho FII, Quando o select de segmento aparece, Então ele é obrigatório.
- Dado que escolho renda fixa, Quando olho o segmento, Então ele está desabilitado com explicação.
- Dado lista vazia, Quando abro `/ativos`, Então vejo CTA para cadastrar o primeiro ativo.

**Dependências:** RN-010-2

---

### RN-010-5. Implementar ficha do ativo

| Campo | Valor |
|---|---|
| **Título** | `[ProjetoInvest] RN-010-5 — Implementar ficha do ativo` |
| **Activity** | Development |
| **RNs** | RN-010, RN-013 |

**Descrição:**
Implementar `/ativos/[id]` com abas de visão geral, movimentações, rendimentos, histórico de preços e link para a ficha externa. Sem cotação na Fase 1, exibir "Indisponível" com motivo.

**Critério de Aceitação:**
- Dado ativo sem cotação, Quando abro a ficha, Então "Preço atual" mostra indisponível, não zero.
- Dado ativo com movimentações, Quando abro a aba, Então o histórico aparece ordenado por data.
- Dado botão "Editar", Quando a classe é imutável, Então o campo está bloqueado com explicação.

**Dependências:** RN-010-3, RN-010-4

---

### RN-010-6. Testes de cadastro, unicidade e inativação

| Campo | Valor |
|---|---|
| **Título** | `[ProjetoInvest] RN-010-6 — Testes de cadastro, unicidade e inativação` |
| **Activity** | Development |
| **RNs** | RN-010 a RN-013 |

**Descrição:**
Cobrir criação válida, duplicidade, FII sem segmento, CNPJ inválido, isolamento entre usuários e inativação sem perda de histórico.

**Critério de Aceitação:**
- Dado o conjunto de testes, Quando executo, Então todos os cenários de erro do catálogo são exercitados.
- Dado ativo inativado, Quando consulto a carteira, Então ele continua listado.

**Dependências:** RN-010-2, RN-010-3, RN-010-5
