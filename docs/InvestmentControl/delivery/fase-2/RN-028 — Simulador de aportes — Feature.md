---
project: INVESTMENT CONTROL
module: aportes
audience: [tecnica]
status: draft
---

# RN-028 — Simulador de aportes

> Gerado por rdd-doc em 10/11/2026. Edite para revisar.
> Análise: ../../analysis/RN-028 — Simulador de aportes/
> Após revisão, use o workflow de issues para criar as tarefas no sistema de tracking.

## Issue principal

| Campo | Valor |
|---|---|
| Título | `RN-028 — Simulador de aportes` |
| Tracking ID | — (a criar) |
| Módulo | InvestmentControl |
| Milestone | Fase 2 |
| Repositórios | `elandro18/ProjetoInvest` |

## Resumo das tasks

| Task | Tipo | Repo | Descrição |
|---|---|---|---|
| RN-028-1 | Backend | ProjetoInvest | Implementar simulação (antes/depois) e endpoint |
| RN-028-2 | Frontend | ProjetoInvest | Implementar seção de simulador em `/aportes` |
| RN-028-3 | Backend | ProjetoInvest | Testes unitários e E2E da simulação |

## Ordem de Execução

**Wave 1 — Backend:**
RN-028-1

**Wave 2 — Frontend:**
RN-028-2

**Wave 3 — Qualidade:**
RN-028-3

---

### RN-028-1. Implementar simulação e endpoint

| Campo | Valor |
|---|---|
| **Título** | `[ProjetoInvest] RN-028-1 — Implementar simulação (antes/depois) e endpoint` |
| **Activity** | Development |
| **RNs** | RN-028, RN-025, RN-026 |

**Descrição:**
Implementar `POST /api/aportes/simulacao` reutilizando o motor da RN-025: calcula a distribuição do valor hipotético, aplica sobre a carteira atual e devolve `antes`, `depois` e `delta` por classe e segmento. Sem persistência.

**Contrato:**

```
POST /api/aportes/simulacao
Request: { "valorAporte": "1500.00" }
Response 200: {
  "valorAporte": "1500.00",
  "antes": { "patrimonioTotal": "10000.00", "classe": [ { "codigo", "valor", "percentual" } ], "segmento": [...] },
  "depois": { "patrimonioTotal": "11500.00", "classe": [...], "segmento": [...] },
  "delta": { "classe": [ { "codigo", "pontosPercentuais" } ], "segmento": [...] }
}
```

**Validações / Erros:**
- `APORTE_VALOR_INVALIDO` 422 (valor ≤ 0/inválido).
- Metas ausentes → defaults lazy (RN-021), sem 409.

**Critério de Aceitação:**
- Dado RF 35% / FII 65% e simulação de R$ 1.000, Quando simulo, Então o `depois` aplica 100% em RF e o `delta` mostra o ganho em p.p. de RF.
- Dado valor 0, Quando simulo, Então recebo 422.
- Dado simular, Quando consulto o banco, Então nenhuma `sugestao_aporte` foi criada.

**Dependências:** RN-025-2

---

### RN-028-2. Implementar seção de simulador em `/aportes`

| Campo | Valor |
|---|---|
| **Título** | `[ProjetoInvest] RN-028-2 — Implementar seção de simulador em /aportes` |
| **Activity** | Development |
| **RNs** | RN-028 |

**Descrição:**
Adicionar a seção **Simulador** na tela `/aportes`: atalhos R$ 500/1.000/1.500/2.000 e valor personalizado; comparativo antes/depois por classe e segmento com barras e delta em p.p.; aviso de que nada é aplicado à carteira.

**Critério de Aceitação:**
- Dado valor 1.500, Quando simulo, Então vejo antes/depois e a diferença em p.p.
- Dado que simulo, Quando volto para a carteira, Então nada mudou.
- Dado 360 px, Quando abro, Então não há overflow.

**Dependências:** RN-028-1

---

### RN-028-3. Testes unitários e E2E da simulação

| Campo | Valor |
|---|---|
| **Título** | `[ProjetoInvest] RN-028-3 — Testes unitários e E2E da simulação` |
| **Activity** | Development |
| **RNs** | RN-028 |

**Descrição:**
Cobrir o comparativo (antes/depois/delta), carteira vazia, valor inválido e ausência de persistência. E2E: simular valores, conferir o efeito e garantir que a carteira permanece inalterada.

**Critério de Aceitação:**
- Dado o conjunto de testes, Quando executo, Então a soma do `depois` é o patrimônio + aporte.
- Dado E2E, Quando simulo e volto, Então a carteira não mudou.

**Dependências:** RN-028-1, RN-028-2
