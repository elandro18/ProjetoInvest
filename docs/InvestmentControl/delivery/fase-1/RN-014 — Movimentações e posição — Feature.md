---
project: INVESTMENT CONTROL
module: movimentacoes
audience: [tecnica]
status: draft
---

# RN-014 — Movimentações e posição

> Gerado por rdd-doc em 07/11/2026. Edite para revisar.
> Análise: ../../analysis/RN-014 — Movimentações e posição/
> Após revisão, use o workflow de issues para criar as tarefas no sistema de tracking.

## Issue principal

| Campo | Valor |
|---|---|
| Título | `RN-014 — Movimentações e posição` |
| Tracking ID | — (a criar) |
| Módulo | InvestmentControl |
| Milestone | Fase 1 |
| Repositórios | `elandro18/ProjetoInvest` |

## Resumo das tasks

| Task | Tipo | Repo | Descrição |
|---|---|---|---|
| RN-014-1 | Database | ProjetoInvest | Criar `movimentacao`, `posicao_ativo`, `rendimento` e constraints |
| RN-014-2 | Backend | ProjetoInvest | Implementar domínio de posição e preço médio |
| RN-014-3 | Backend | ProjetoInvest | Implementar criação de movimentação com validações |
| RN-014-4 | Backend | ProjetoInvest | Implementar listagem e cancelamento de movimentação |
| RN-014-5 | Frontend | ProjetoInvest | Implementar telas de movimentação |
| RN-014-6 | Backend | ProjetoInvest | Implementar testes de regra financeira (G1–G7) |

## Ordem de Execução

**Wave 1 — Banco:**
RN-014-1

**Wave 2 — Domínio:**
RN-014-2

**Wave 3 — API:**
RN-014-3 → RN-014-4

**Wave 4 — Frontend:**
RN-014-5

**Wave 5 — Qualidade:**
RN-014-6

---

### RN-014-1. Criar tabelas de movimentação, posição e rendimento

| Campo | Valor |
|---|---|
| **Título** | `[Database] RN-014-1 — Criar tabelas movimentacao, posicao_ativo e rendimento` |
| **Activity** | Development |
| **RNs** | RN-014, RN-015, RN-017, RN-018, RN-019, RN-084 |

**Descrição:**
Criar as três tabelas com enums, constraints de sinal, unicidade de idempotência e índice por usuário/data. `posicao_ativo` tem PK composta `(usuario_id, ativo_id)`.

**Tabelas de referência:**

| Tabela | Coluna alvo | Uso |
|---|---|---|
| `movimentacao` | `tipo`, `data`, `quantidade`, `valor_unitario`, `valor_total`, `custos`, `cancelada_em`, `idempotency_key` | Razão |
| `posicao_ativo` | `usuario_id`, `ativo_id`, `quantidade`, `preco_medio`, `custo_total` | Cache derivado |
| `rendimento` | `ativo_id`, `tipo`, `data_pagamento`, `competencia`, `valor`, `origem` | Proventos |

```sql
CREATE TYPE tipo_movimentacao AS ENUM ('COMPRA','VENDA','DIVIDENDO','JUROS','APLICACAO_RF','RESGATE_RF','TAXA');
CREATE TYPE tipo_rendimento AS ENUM ('DIVIDENDO','JURO','AMORTIZACAO');
CREATE TYPE origem_dado AS ENUM ('MANUAL','PROVEDOR','IMPORTACAO_CVM');

CREATE TABLE movimentacao (
  id uuid PRIMARY KEY,
  usuario_id uuid NOT NULL REFERENCES usuario(id) ON DELETE RESTRICT,
  ativo_id uuid NOT NULL REFERENCES ativo(id) ON DELETE RESTRICT,
  tipo tipo_movimentacao NOT NULL,
  data date NOT NULL,
  quantidade numeric(18,8),
  valor_unitario numeric(18,2),
  valor_total numeric(18,2) NOT NULL CHECK (valor_total > 0),
  custos numeric(18,2) NOT NULL DEFAULT 0 CHECK (custos >= 0),
  observacoes text,
  cancelada_em timestamptz,
  cancelamento_motivo text,
  idempotency_key varchar(64),
  criado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_mov_qtd_positiva CHECK (quantidade IS NULL OR quantidade > 0),
  CONSTRAINT chk_mov_qtd_obrigatoria CHECK (
    tipo NOT IN ('COMPRA','VENDA') OR (quantidade IS NOT NULL AND valor_unitario IS NOT NULL)
  )
);
CREATE INDEX ix_mov_usuario_data ON movimentacao (usuario_id, data DESC);
CREATE INDEX ix_mov_ativo_data ON movimentacao (ativo_id, data);
CREATE UNIQUE INDEX ux_mov_idempotency ON movimentacao (usuario_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE TABLE posicao_ativo (
  usuario_id uuid NOT NULL REFERENCES usuario(id) ON DELETE RESTRICT,
  ativo_id uuid NOT NULL REFERENCES ativo(id) ON DELETE RESTRICT,
  quantidade numeric(18,8) NOT NULL CHECK (quantidade >= 0),
  preco_medio numeric(18,6) NOT NULL CHECK (preco_medio >= 0),
  custo_total numeric(18,2) NOT NULL CHECK (custo_total >= 0),
  ultima_movimentacao_id uuid REFERENCES movimentacao(id),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (usuario_id, ativo_id)
);

CREATE TABLE rendimento (
  id uuid PRIMARY KEY,
  usuario_id uuid NOT NULL REFERENCES usuario(id) ON DELETE RESTRICT,
  ativo_id uuid NOT NULL REFERENCES ativo(id) ON DELETE RESTRICT,
  tipo tipo_rendimento NOT NULL,
  data_pagamento date NOT NULL,
  competencia char(7),
  valor numeric(18,2) NOT NULL CHECK (valor > 0),
  origem origem_dado NOT NULL,
  movimentacao_id uuid REFERENCES movimentacao(id),
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_rend_usuario_data ON rendimento (usuario_id, data_pagamento);
CREATE INDEX ix_rend_ativo_competencia ON rendimento (ativo_id, competencia);
```

**Validações / Erros:**
- `MOV_QTD_OBRIGATORIA` → 422.
- `MOV_VALOR_INCONSISTENTE` → 422 (regra de aplicação).
- `MOV_POSICAO_NEGATIVA` → 409.

**Critério de Aceitação:**
- Dado `tipo = COMPRA` sem `quantidade`, Quando insiro, Então o CHECK falha.
- Dado duas movimentações com a mesma `idempotency_key` do mesmo usuário, Quando insiro, Então a segunda é rejeitada.
- Dado `valor_total = 0`, Quando insiro, Então o CHECK falha.

**Dependências:** RN-010-1

---

### RN-014-2. Implementar domínio de posição e preço médio

| Campo | Valor |
|---|---|
| **Título** | `[ProjetoInvest] RN-014-2 — Implementar domínio de posição e preço médio` |
| **Activity** | Development |
| **RNs** | RN-015, RN-016, RN-017, RN-018 |

**Descrição:**
Implementar em `src/modules/posicao` funções puras: aplicação de uma movimentação sobre a posição, cálculo de preço médio ponderado, baixa proporcional na venda, validação de posição negativa e reconstrução completa a partir da lista de movimentações. Sem banco e sem `next/*`.

**Validações / Erros:**
- `MOV_POSICAO_NEGATIVA` quando `quantidade < 0` após aplicação.
- Venda com posição zero é negativa.
- Ordenação por `(data, criado_em)` antes de aplicar.

**Critério de Aceitação:**
- Dado G1 (10 @ 100 + 10 @ 120), Quando aplico, Então preço médio é 110,00 e custo 2.200,00.
- Dado G2 (venda de 5 a 130), Quando aplico, Então quantidade 15, preço médio 110,00, custo 1.650,00 e resultado realizado 100,00.
- Dado G3 (compra de 5 @ 100 após G2), Quando aplico, Então preço médio 107,50 sobre 20 cotas.
- Dado G4 (posição zerada), Quando aplico venda total, Então quantidade 0 e preço médio 0.
- Dado G7 (dividendo), Quando aplico, Então preço médio não muda e o rendimento é registrado à parte.

**Dependências:** RN-014-1

**Notas técnicas:**
- Isolar o método de baixa em uma estratégia (`custoMedio`) para permitir PEPS sem reescrever (PEND-005).
- Arredondar apenas na borda de apresentação; manter precisão interna.

---

### RN-014-3. Implementar criação de movimentação com validações

| Campo | Valor |
|---|---|
| **Título** | `[ProjetoInvest] RN-014-3 — Implementar criação de movimentação` |
| **Activity** | Development |
| **RNs** | RN-014, RN-015, RN-018, RN-019, RN-084 |

**Descrição:**
Implementar `POST /api/movimentacoes` em transação: validar payload, validar consistência do valor total, checar ativo do usuário e status, aplicar no domínio, persistir movimentação e atualizar `posicao_ativo`. Suportar `Idempotency-Key` e confirmação explícita de posição negativa.

**Contrato:**

```
POST /api/movimentacoes
Headers: Idempotency-Key: uuid (opcional)
Request: { "ativoId": "uuid", "tipo": "COMPRA", "data": "2026-11-05", "quantidade": "10.00000000", "valorUnitario": "160.00", "valorTotal": "1603.00", "custos": "3.00", "observacoes": null }
Response 201: { "movimentacao": { "id", "tipo", "valorTotal" }, "posicao": { "quantidade", "precoMedio", "custoTotal" } }
```

**Validações / Erros:**
- `MOV_VALOR_INCONSISTENTE` → 422 (diferença > 0,01 sem observação).
- `MOV_DATA_FUTURA` → 422.
- `MOV_ATIVO_INATIVO` → 422.
- `MOV_POSICAO_NEGATIVA` → 409 com `details.requerConfirmacao`.
- `MOV_TIPO_INVALIDO` → 422.

**Critério de Aceitação:**
- Dado o mesmo `Idempotency-Key` enviado duas vezes, Quando repito a chamada, Então recebo o mesmo recurso e não há duplicidade.
- Dado venda maior que a posição, Quando envio sem confirmação, Então recebo 409 e nada é gravado.
- Dado venda com confirmação e motivo, Quando envio, Então a posição é atualizada e a exceção fica auditada.
- Dado valor total divergente, Quando envio, Então recebo 422.

**Dependências:** RN-014-2

---

### RN-014-4. Implementar listagem e cancelamento de movimentação

| Campo | Valor |
|---|---|
| **Título** | `[ProjetoInvest] RN-014-4 — Implementar listagem e cancelamento de movimentação` |
| **Activity** | Development |
| **RNs** | RN-014, RN-015, RN-084 |

**Descrição:**
Implementar `GET /api/movimentacoes` com filtros e paginação e `POST /api/movimentacoes/{id}/cancelamento` com motivo obrigatório, recálculo da posição e sem exclusão física.

**Contrato:**

```
GET /api/movimentacoes?ativoId=&tipo=&de=&ate=&incluirCanceladas=false&page=&pageSize=
Response 200: { "data": [ { "id", "ativo": {...}, "tipo", "data", "valorTotal", "canceladaEm" } ], "meta": {...} }

POST /api/movimentacoes/{id}/cancelamento
Request: { "motivo": "string" }
Response 200: { "movimentacao": {...}, "posicao": {...} }
```

**Validações / Erros:**
- `MOV_NAO_ENCONTRADA` → 404.
- `MOV_JA_CANCELADA` → 409.
- `MOV_CANCELAMENTO_SEM_MOTIVO` → 422.

**Critério de Aceitação:**
- Dado cancelamento válido, Quando confirmo, Então a posição é recalculada e o registro permanece listado como cancelado.
- Dado movimentação de outro usuário, Quando tento cancelar, Então recebo 404.

**Dependências:** RN-014-3

---

### RN-014-5. Implementar telas de movimentação

| Campo | Valor |
|---|---|
| **Título** | `[ProjetoInvest] RN-014-5 — Implementar telas de movimentação` |
| **Activity** | Development |
| **RNs** | RN-014, RN-018, RN-019, RN-084 |

**Descrição:**
Implementar `/movimentacoes` conforme `UI_SPEC.md` §7: lista filtrável, formulário em drawer, cálculo do total em tempo real, diálogo de confirmação de posição negativa e ação de cancelamento.

**Critério de Aceitação:**
- Dado quantidade 10 e unitário 100 com custo 3, Quando digito total 1005, Então a tela sinaliza divergência antes de salvar.
- Dado conflito 409, Quando o diálogo abre, Então mostra impacto e exige motivo.
- Dado cancelamento, Quando confirmo, Então o item permanece visível como cancelado.

**Dependências:** RN-014-3, RN-014-4

---

### RN-014-6. Implementar testes de regra financeira

| Campo | Valor |
|---|---|
| **Título** | `[ProjetoInvest] RN-014-6 — Implementar testes de regra financeira (G1–G7)` |
| **Activity** | Development |
| **RNs** | RN-015 a RN-019, RN-084 |

**Descrição:**
Implementar os casos de ouro G1–G7 e os testes de integração de criação, cancelamento, idempotência e posição negativa. Cobertura de `src/modules/posicao` ≥ 95%.

**Critério de Aceitação:**
- Dado G1–G7, Quando executo a suíte, Então todos passam com os valores exatos.
- Dado o teste de decimal, Quando somo 0,1 + 0,2, Então o resultado é 0,30.
- Dado uma sequência aleatória de compras e vendas válidas, Quando reconstruo a posição, Então o resultado é igual ao cálculo incremental.

**Dependências:** RN-014-2, RN-014-3, RN-014-4
