---
project: INVESTMENT CONTROL
module: renda-fixa
audience: [tecnica]
status: draft
---

# RN-057 — Renda fixa

> Gerado por rdd-doc em 07/11/2026. Edite para revisar.
> Análise: ../../analysis/RN-057 — Renda fixa/
> Após revisão, use o workflow de issues para criar as tarefas no sistema de tracking.
> **✅ Implementado em 09/11/2026** (Fase 1).

## Issue principal

| Campo | Valor |
|---|---|
| Título | `RN-057 — Renda fixa` |
| Tracking ID | — (a criar) |
| Módulo | InvestmentControl |
| Milestone | Fase 1 |
| Repositórios | `elandro18/ProjetoInvest` |

## Resumo das tasks

| Task | Tipo | Repo | Descrição |
|---|---|---|---|
| RN-057-1 | Database | ProjetoInvest | Criar `investimento_renda_fixa` e enums |
| RN-057-2 | Backend | ProjetoInvest | Implementar CRUD de renda fixa |
| RN-057-3 | Backend | ProjetoInvest | Implementar cálculo de alertas |
| RN-057-4 | Frontend | ProjetoInvest | Implementar tela de renda fixa |
| RN-057-5 | Backend | ProjetoInvest | Testes de renda fixa e alertas |

## Ordem de Execução

**Wave 1 — Banco:**
RN-057-1

**Wave 2 — Backend:**
RN-057-2 → RN-057-3

**Wave 3 — Frontend:**
RN-057-4

**Wave 4 — Qualidade:**
RN-057-5

---

### RN-057-1. Criar tabela de renda fixa

| Campo | Valor |
|---|---|
| **Título** | `[Database] RN-057-1 — Criar tabela investimento_renda_fixa e enums` |
| **Activity** | Development |
| **RNs** | RN-057, RN-059, RN-070 |

**Descrição:**
Criar a tabela com enums de produto, indexador, liquidez e status do saldo, constraints de data e valor, e índices por usuário/vencimento e usuário/instituição.

**Tabelas de referência:**

| Tabela | Coluna alvo | Uso |
|---|---|---|
| `investimento_renda_fixa` | `instituicao`, `produto`, `indexador`, `taxa`, `data_aplicacao`, `vencimento`, `valor_aplicado`, `saldo_atual`, `status_saldo`, `liquidez`, `cobertura_fgc` | Cadastro e saldo |

```sql
CREATE TYPE produto_renda_fixa AS ENUM ('TESOURO_SELIC','TESOURO_IPCA','TESOURO_PREFIXADO','CDB','LCI','LCA','DEBENTURE','OUTRO');
CREATE TYPE indexador_renda_fixa AS ENUM ('PRE','POS_CDI','IPCA','SELIC','OUTRO');
CREATE TYPE liquidez_renda_fixa AS ENUM ('DIARIA','NO_VENCIMENTO','PRAZO');
CREATE TYPE status_saldo AS ENUM ('INFORMADO','ESTIMADO','CONFIRMADO');

CREATE TABLE investimento_renda_fixa (
  id uuid PRIMARY KEY,
  usuario_id uuid NOT NULL REFERENCES usuario(id) ON DELETE RESTRICT,
  instituicao varchar(120) NOT NULL,
  produto produto_renda_fixa NOT NULL,
  indexador indexador_renda_fixa NOT NULL,
  taxa numeric(9,6) NOT NULL CHECK (taxa >= 0 AND taxa <= 100),
  data_aplicacao date NOT NULL,
  vencimento date,
  valor_aplicado numeric(18,2) NOT NULL CHECK (valor_aplicado > 0),
  saldo_atual numeric(18,2) NOT NULL CHECK (saldo_atual >= 0),
  status_saldo status_saldo NOT NULL DEFAULT 'INFORMADO',
  liquidez liquidez_renda_fixa NOT NULL,
  carencia_ate date,
  cobertura_fgc boolean NOT NULL DEFAULT false,
  observacoes text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_rf_vencimento CHECK (vencimento IS NULL OR vencimento > data_aplicacao)
);
CREATE INDEX ix_rf_usuario_vencimento ON investimento_renda_fixa (usuario_id, vencimento);
CREATE INDEX ix_rf_usuario_instituicao ON investimento_renda_fixa (usuario_id, instituicao);
```

**Validações / Erros:**
- `RF_VENCIMENTO_INVALIDO` → 422.
- `RF_TAXA_INVALIDA` → 422.

**Critério de Aceitação:**
- Dado vencimento anterior à aplicação, Quando insiro, Então o CHECK falha.
- Dado taxa 120, Quando insiro, Então o CHECK falha.

**Dependências:** RN-010-1, RN-085-1

---

### RN-057-2. Implementar CRUD de renda fixa

| Campo | Valor |
|---|---|
| **Título** | `[ProjetoInvest] RN-057-2 — Implementar CRUD de renda fixa` |
| **Activity** | Development |
| **RNs** | RN-057, RN-059, RN-069 |

**Descrição:**
Implementar `GET /api/renda-fixa`, `POST /api/renda-fixa` e `PATCH /api/renda-fixa/{id}`. Derivar `cobertura_fgc` do produto quando não informada. Bloquear alteração de produto, indexador e data de aplicação.

**Contrato:**

```
GET /api/renda-fixa?instituicao=&produto=&vencimentoAte=&page=&pageSize=
Response 200: { "data": [ { "id", "instituicao", "produto", "indexador", "taxa", "vencimento", "saldoAtual", "statusSaldo", "liquidez", "coberturaFgc" } ], "meta": {...} }

POST /api/renda-fixa
Request: { "instituicao": "Banco X", "produto": "CDB", "indexador": "POS_CDI", "taxa": "12.000000", "dataAplicacao": "2026-01-10", "vencimento": "2028-01-10", "valorAplicado": "10000.00", "saldoAtual": "10450.00", "liquidez": "NO_VENCIMENTO" }
Response 201: { "id": "uuid", ... }

PATCH /api/renda-fixa/{id}
Request: { "saldoAtual": "10600.00", "statusSaldo": "CONFIRMADO" }
Response 200: { "id", "saldoAtual", "statusSaldo" }
```

**Validações / Erros:**
- `RF_NAO_ENCONTRADA` → 404.
- `RF_CAMPO_IMUTAVEL` → 422.
- `RF_SALDO_INVALIDO` → 422.

**Critério de Aceitação:**
- Dado cadastro de CDB, Quando envio, Então `cobertura_fgc` é `true`.
- Dado título de outro usuário, Quando consulto, Então recebo 404.
- Dado PATCH em `produto`, Quando envio, Então recebo 422.

**Dependências:** RN-057-1, RN-085-4

---

### RN-057-3. Implementar cálculo de alertas

| Campo | Valor |
|---|---|
| **Título** | `[ProjetoInvest] RN-057-3 — Implementar cálculo de alertas de renda fixa` |
| **Activity** | Development |
| **RNs** | RN-058 |

**Descrição:**
Implementar `GET /api/renda-fixa/alertas` com cinco tipos: vencimento próximo (30 dias), carência vigente, ausência de liquidez diária, concentração por instituição (limite configurável) e limite de FGC (parâmetro, PEND-012).

**Contrato:**

```
GET /api/renda-fixa/alertas
Response 200: { "alertas": [ { "tipo": "VENCIMENTO_PROXIMO", "tituloFixoId": "uuid", "mensagem": "string", "severidade": "INFO|ATENCAO|CRITICO" } ] }
```

**Validações / Erros:**
- Nenhum alerta → `{ "alertas": [] }` com 200.
- Limite não configurado → não gerar alerta de concentração/FGC.

**Critério de Aceitação:**
- Dado título que vence em 20 dias, Quando consulto, Então há alerta `VENCIMENTO_PROXIMO`.
- Dado título em carência, Quando consulto, Então há alerta `CARENCIA`.
- Dado limite de FGC não configurado, Quando consulto, Então nenhum alerta de FGC é inventado.

**Dependências:** RN-057-2

---

### RN-057-4. Implementar tela de renda fixa

| Campo | Valor |
|---|---|
| **Título** | `[ProjetoInvest] RN-057-4 — Implementar tela de renda fixa` |
| **Activity** | Development |
| **RNs** | RN-057, RN-058, RN-059 |

**Descrição:**
Implementar `/renda-fixa` conforme `UI_SPEC.md` §8: tabela, formulário, faixa de alertas e filtro "somente com alerta". Exibir badge de status do saldo.

**Critério de Aceitação:**
- Dado saldo estimado, Quando a linha é exibida, Então há badge âmbar com texto "estimado".
- Dado título vencendo, Quando abro a tela, Então o alerta aparece na faixa superior.
- Dado formulário com taxa inválida, Quando envio, Então o campo é marcado.

**Dependências:** RN-057-2, RN-057-3

---

### RN-057-5. Testes de renda fixa e alertas

| Campo | Valor |
|---|---|
| **Título** | `[ProjetoInvest] RN-057-5 — Testes de renda fixa e alertas` |
| **Activity** | Development |
| **RNs** | RN-057 a RN-059 |

**Descrição:**
Cobrir criação, campos imutáveis, derivação de FGC, isolamento por usuário e os cinco alertas.

**Critério de Aceitação:**
- Dado o conjunto de testes, Quando executo, Então todos os erros do catálogo de renda fixa são exercitados.
- Dado dois usuários, Quando um consulta o título do outro, Então recebe 404.

**Dependências:** RN-057-2, RN-057-3, RN-057-4
