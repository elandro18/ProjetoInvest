---
project: INVESTMENT CONTROL
module: aportes
audience: [tecnica]
status: draft
---

# RN-052 — Histórico de sugestões

> Gerado por rdd-doc em 10/11/2026. Edite para revisar.
> Análise: ../../analysis/RN-052 — Histórico de sugestões/
> Após revisão, use o workflow de issues para criar as tarefas no sistema de tracking.

## Issue principal

| Campo | Valor |
|---|---|
| Título | `RN-052 — Histórico de sugestões` |
| Tracking ID | — (a criar) |
| Módulo | InvestmentControl |
| Milestone | Fase 2 |
| Repositórios | `elandro18/ProjetoInvest` |

## Resumo das tasks

| Task | Tipo | Repo | Descrição |
|---|---|---|---|
| RN-052-1 | Backend | ProjetoInvest | Implementar listagem paginada e detalhe do histórico |
| RN-052-2 | Frontend | ProjetoInvest | Implementar tela de histórico e detalhe da sugestão |
| RN-052-3 | Backend | ProjetoInvest | Testes unitários e E2E do histórico |

## Ordem de Execução

**Wave 1 — Backend:**
RN-052-1

**Wave 2 — Frontend:**
RN-052-2

**Wave 3 — Qualidade:**
RN-052-3

---

### RN-052-1. Implementar listagem e detalhe do histórico

| Campo | Valor |
|---|---|
| **Título** | `[ProjetoInvest] RN-052-1 — Implementar listagem e detalhe do histórico` |
| **Activity** | Development |
| **RNs** | RN-052, RN-053 |

**Descrição:**
Expor o histórico persistido pela RN-025 em modo somente leitura: listagem paginada com filtros e detalhe completo de uma sugestão, sempre filtrado pelo usuário da sessão.

**Contrato:**

```
GET /api/aportes/historico?page=&pageSize=&de=&ate=&decisao=
Response 200: {
  "data": [ { "id": "uuid", "data": "...", "valorDisponivel": "1000.00", "decisaoUsuario": "ACEITA", "decisaoEm": "...", "resumo": { "classe": [ { "codigo": "RENDA_FIXA", "valor": "1000.00" } ] } } ],
  "meta": { "page": 1, "pageSize": 20, "total": 3, "totalPages": 1 }
}

GET /api/aportes/{id}
Response 200: { "id", "data", "valorDisponivel", "distribuicaoAtual", "distribuicaoSugerida", "ativosAvaliados", "justificativas", "alertas", "decisaoUsuario", "decisaoEm", "observacoes" }
Response 404: { "error": { "code": "APORTE_NAO_ENCONTRADO" } }
```

**Validações / Erros:**
- `APORTE_NAO_ENCONTRADO` 404 para id inexistente ou de outro usuário.
- Filtros inválidos → `VALIDACAO` 422.
- Ordenação fixa por `data` desc (histórico).

**Critério de Aceitação:**
- Dado três sugestões de A, Quando consulto o histórico, Então vejo as três, da mais recente para a mais antiga, com decisão.
- Dado filtro `decisao=IGNORADA`, Quando consulto, Então só as ignoradas aparecem.
- Dado id de B, Quando consulto o detalhe como A, Então recebo 404.
- Dado o detalhe, Quando inspeciono, Então o snapshot é idêntico ao persistido.

**Dependências:** RN-025-4, RN-025-5

---

### RN-052-2. Implementar tela de histórico e detalhe

| Campo | Valor |
|---|---|
| **Título** | `[ProjetoInvest] RN-052-2 — Implementar tela de histórico e detalhe` |
| **Activity** | Development |
| **RNs** | RN-052 |

**Descrição:**
Criar `/aportes/historico` com lista paginada (data, valor, decisão, resumo), filtros de período e decisão, e detalhe em diálogo ou página com distribuição, ativos, checklist, justificativas, alertas, decisão e observação. Adicionar o link "Ver histórico" em `/aportes`.

**Critério de Aceitação:**
- Dado histórico com sugestões, Quando abro, Então vejo a lista com decisão e posso filtrar.
- Dado clique em uma linha, Quando o detalhe abre, Então mostro o snapshot e a decisão registrada.
- Dado 360 px, Quando abro, Então não há overflow.

**Dependências:** RN-052-1

---

### RN-052-3. Testes unitários e E2E do histórico

| Campo | Valor |
|---|---|
| **Título** | `[ProjetoInvest] RN-052-3 — Testes unitários e E2E do histórico` |
| **Activity** | Development |
| **RNs** | RN-052 |

**Descrição:**
Cobrir listagem (ordem, paginação, filtros), detalhe (snapshot e decisão), 404 para outro usuário e isolamento. E2E: gerar sugestões, decidir, abrir o histórico, filtrar e conferir o detalhe.

**Critério de Aceitação:**
- Dado o conjunto de testes, Quando executo, Então os filtros, a paginação e o isolamento são exercitados.
- Dado E2E, Quando A abre o histórico, Então não vê sugestões de B.

**Dependências:** RN-052-1, RN-052-2
