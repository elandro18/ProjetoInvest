---
project: INVESTMENT CONTROL
module: risco
audience: [tecnica]
status: draft
---

# RN-049 — Controle de concentração

> Gerado por rdd-doc em 09/11/2026. Edite para revisar.
> Análise: ../../analysis/RN-049 — Controle de concentração/
> Após revisão, use o workflow de issues para criar as tarefas no sistema de tracking.

## Issue principal

| Campo | Valor |
|---|---|
| Título | `RN-049 — Controle de concentração` |
| Tracking ID | — (a criar) |
| Módulo | InvestmentControl |
| Milestone | Fase 2 |
| Repositórios | `elandro18/ProjetoInvest` |

## Resumo das tasks

| Task | Tipo | Repo | Descrição |
|---|---|---|---|
| RN-049-1 | Database | ProjetoInvest | Criar tabela `limite_concentracao` com vigência |
| RN-049-2 | Backend | ProjetoInvest | Implementar leitura e substituição de limites |
| RN-049-3 | Backend | ProjetoInvest | Implementar cálculo e endpoint de concentração |
| RN-049-4 | Frontend | ProjetoInvest | Implementar tela de configurações com limites e painel |
| RN-049-5 | Backend | ProjetoInvest | Testes unitários e E2E da concentração |

## Ordem de Execução

**Wave 1 — Banco:**
RN-049-1

**Wave 2 — Backend:**
RN-049-2 → RN-049-3

**Wave 3 — Frontend:**
RN-049-4

**Wave 4 — Qualidade:**
RN-049-5

---

### RN-049-1. Criar tabela de limites de concentração

| Campo | Valor |
|---|---|
| **Título** | `[Database] RN-049-1 — Criar tabela limite_concentracao com vigência` |
| **Activity** | Development |
| **RNs** | RN-049, RN-082 |

**Descrição:**
Criar a tabela de limites por usuário e dimensão, com referência textual (gestora, segmento ou instituição), percentual máximo e vigência. Dimensões sem referência (ativo) usam `referencia` nula.

**Tabelas de referência:**

| Tabela | Coluna alvo | Uso |
|---|---|---|
| `limite_concentracao` | `usuario_id`, `dimensao`, `referencia`, `percentual_max`, `vigencia_inicio`, `vigencia_fim` | Limite configurável |

```sql
CREATE TYPE dimensao_concentracao AS ENUM ('ATIVO','GESTORA','SEGMENTO','EMISSOR','IMOVEL');

CREATE TABLE limite_concentracao (
  id uuid PRIMARY KEY,
  usuario_id uuid NOT NULL REFERENCES usuario(id) ON DELETE RESTRICT,
  dimensao dimensao_concentracao NOT NULL,
  referencia varchar(120),
  percentual_max numeric(9,6) NOT NULL CHECK (percentual_max > 0 AND percentual_max <= 100),
  vigencia_inicio date NOT NULL,
  vigencia_fim date,
  criado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_limite_vigencia CHECK (vigencia_fim IS NULL OR vigencia_fim >= vigencia_inicio)
);
CREATE UNIQUE INDEX ux_limite_vigente
  ON limite_concentracao (usuario_id, dimensao, COALESCE(referencia, ''));
CREATE INDEX ix_limite_usuario ON limite_concentracao (usuario_id, dimensao);
```

**Validações / Erros:**
- `RISCO_LIMITE_INVALIDO`: percentual ≤ 0 ou > 100 → 422.
- Referência duplicada na mesma dimensão → violação de unicidade.

**Critério de Aceitação:**
- Dado dois limites iguais para o mesmo usuário/dimensão/referência, Quando insiro, Então a unicidade falha.
- Dado percentual 0 ou 101, Quando insiro, Então o CHECK falha.

**Dependências:** RN-001-2

**Notas técnicas:**
- O índice único garante **um limite vigente** por referência; a substituição encerra a vigência anterior.
- `IMOVEL` fica preparada para a Fase 3/4.

---

### RN-049-2. Implementar leitura e substituição de limites

| Campo | Valor |
|---|---|
| **Título** | `[ProjetoInvest] RN-049-2 — Implementar leitura e substituição de limites` |
| **Activity** | Development |
| **RNs** | RN-049, RN-082 |

**Descrição:**
Implementar `GET /api/configuracoes/limites` (vigentes + histórico) e `PUT /api/configuracoes/limites` que substitui o conjunto vigente em transação, validando faixa, duplicidade e dimensões suportadas.

**Contrato:**

```
GET /api/configuracoes/limites
Response 200: { "vigente": [ { "dimensao": "ATIVO", "referencia": null, "percentualMax": "20.000000", "vigenciaInicio": "2026-11-09" } ], "historico": [] }

PUT /api/configuracoes/limites
Request: { "limites": [ { "dimensao": "ATIVO", "referencia": null, "percentualMax": "20.000000" } ] }
Response 200: { "vigente": [ ... ] }
```

**Validações / Erros:**
- `RISCO_LIMITE_INVALIDO` 422 (percentual fora de 0–100, dimensão inválida ou duplicidade).
- `ALO_REFERENCIA_INVALIDA` não se aplica; referência é texto livre.

**Critério de Aceitação:**
- Dado um limite de 20% por ativo, Quando salvo, Então o GET devolve o vigente e o anterior vai para o histórico.
- Dado percentual 0, Quando salvo, Então recebo 422.
- Dado dois limites iguais, Quando salvo, Então recebo 422.

**Dependências:** RN-049-1

---

### RN-049-3. Implementar cálculo e endpoint de concentração

| Campo | Valor |
|---|---|
| **Título** | `[ProjetoInvest] RN-049-3 — Implementar cálculo e endpoint de concentração` |
| **Activity** | Development |
| **RNs** | RN-049, RN-089, RN-091 |

**Descrição:**
Calcular a concentração por dimensão sobre o patrimônio total e expor `GET /api/risco/concentracao`. FII entra pelo custo; RF pelo saldo; gestora/segmento vêm do ativo; emissor vem da instituição do título. `IMOVEL` retorna `disponivel: false`.

**Contrato:**

```
GET /api/risco/concentracao
Response 200: {
  "baseCalculo": "PATRIMONIO_TOTAL",
  "dimensoes": [
    { "dimensao": "ATIVO", "disponivel": true, "itens": [
      { "referencia": "HGLG11", "nome": "CSHG Logística", "valor": "16235.00", "percentual": "10.656000", "limite": "20.000000", "excedido": false, "excessoPontos": "0.000000" }
    ] },
    { "dimensao": "IMOVEL", "disponivel": false, "itens": [] }
  ]
}
```

**Validações / Erros:**
- Carteira vazia → dimensões com `itens: []`, sem divisão por zero.
- Ativo sem gestor não gera item de gestora (ou agrupa em "Não informado" sem alerta — decidir e documentar).

**Critério de Aceitação:**
- Dado um FII com 25% da carteira e limite de 20% por ativo, Quando consulto, Então o item aparece `excedido: true` com excesso de 5 p.p.
- Dado limite não configurado, Quando consulto, Então `limite: null` e `excedido: false`.
- Dado título de RF, Quando consulto, Então ele aparece na dimensão `EMISSOR` pela instituição.
- Dado usuário B, Quando consulto, Então não vê os limites nem a concentração de A.

**Dependências:** RN-049-2, RN-020-1, RN-057-2

**Notas técnicas:**
- Reutilizar o port `ValorCarteira` para a base; não duplicar a regra de patrimônio.
- `excessoPontos = percentual − limite` (0 quando não excedido).

---

### RN-049-4. Implementar tela de configurações com limites e painel

| Campo | Valor |
|---|---|
| **Título** | `[ProjetoInvest] RN-049-4 — Implementar tela de configurações com limites e painel` |
| **Activity** | Development |
| **RNs** | RN-049, RN-082 |

**Descrição:**
Criar `/configuracoes` com a seção **Limites de concentração** (adicionar, editar e remover por dimensão) e o painel **Concentração atual** com percentual e badge de excedido. Incluir a rota na navegação e no middleware.

**Critério de Aceitação:**
- Dado um limite de 20% por ativo e um ativo com 25%, Quando abro `/configuracoes`, Então o painel mostra "excedido" com o excesso.
- Dado que removo todos os limites, Quando salvo, Então o painel mostra os percentuais sem badge de alerta.
- Dado 360 px, Quando abro, Então não há overflow horizontal.

**Dependências:** RN-049-2, RN-049-3

---

### RN-049-5. Testes unitários e E2E da concentração

| Campo | Valor |
|---|---|
| **Título** | `[ProjetoInvest] RN-049-5 — Testes unitários e E2E da concentração` |
| **Activity** | Development |
| **RNs** | RN-049 |

**Descrição:**
Cobrir cálculo por dimensão, limite ausente, excedido e excesso, ativo sem gestor, RF por instituição, carteira vazia e isolamento. E2E: configurar limite, ver alerta, remover limite e conferir o painel.

**Critério de Aceitação:**
- Dado o conjunto de testes, Quando executo, Então os cenários de erro do catálogo e os cinco estados de dimensão são exercitados.
- Dado A e B, Quando B consulta, Então não vê os limites de A.

**Dependências:** RN-049-2, RN-049-3, RN-049-4
