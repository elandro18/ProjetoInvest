---
project: INVESTMENT CONTROL
module: dashboard
audience: [tecnica]
status: draft
---

# RN-061 — Dashboard

> Gerado por rdd-doc em 07/11/2026. Edite para revisar.
> Análise: ../../analysis/RN-061 — Dashboard/
> Após revisão, use o workflow de issues para criar as tarefas no sistema de tracking.

## Issue principal

| Campo | Valor |
|---|---|
| Título | `RN-061 — Dashboard` |
| Tracking ID | — (a criar) |
| Módulo | InvestmentControl |
| Milestone | Fase 1 |
| Repositórios | `elandro18/ProjetoInvest` |

## Resumo das tasks

| Task | Tipo | Repo | Descrição |
|---|---|---|---|
| RN-061-1 | Backend | ProjetoInvest | Implementar serviço de indicadores do dashboard |
| RN-061-2 | Backend | ProjetoInvest | Implementar endpoint agregado do dashboard |
| RN-061-3 | Frontend | ProjetoInvest | Implementar componentes de gráfico e resumo |
| RN-061-4 | Frontend | ProjetoInvest | Implementar painel de oportunidades |
| RN-061-5 | Frontend | ProjetoInvest | Implementar tela de dashboard e testes |

## Ordem de Execução

**Wave 1 — Backend:**
RN-061-1 → RN-061-2

**Wave 2 — Frontend (paralelizável):**
RN-061-3, RN-061-4

**Wave 3 — Integração e qualidade:**
RN-061-5

---

### RN-061-1. Implementar serviço de indicadores do dashboard

| Campo | Valor |
|---|---|
| **Título** | `[ProjetoInvest] RN-061-1 — Implementar serviço de indicadores do dashboard` |
| **Activity** | Development |
| **RNs** | RN-061, RN-062 |

**Descrição:**
Montar o objeto de indicadores reutilizando carteira e rendimentos: patrimônio total, total investido (custo), valor atual, resultado acumulado, renda mensal, rendimentos do ano, percentuais por classe e comparação com a meta.

**Critério de Aceitação:**
- Dado carteira com FII e renda fixa, Quando monto, Então os nove indicadores estão preenchidos.
- Dado rendimento do mês anterior, Quando monto, Então ele não entra em "renda mensal" do mês atual.
- Dado carteira vazia, Quando monto, Então o objeto sinaliza `vazio: true`.

**Dependências:** RN-020-1, RN-021-3

---

### RN-061-2. Implementar endpoint agregado do dashboard

| Campo | Valor |
|---|---|
| **Título** | `[ProjetoInvest] RN-061-2 — Implementar endpoint agregado do dashboard` |
| **Activity** | Development |
| **RNs** | RN-061, RN-062, RN-063, RN-073 |

**Descrição:**
Implementar `GET /api/dashboard` com blocos independentes (`indicadores`, `graficos`, `oportunidades`) e campo `erros` por bloco, sem derrubar a resposta inteira.

**Contrato:**

```
GET /api/dashboard
Response 200: {
  "indicadores": { "patrimonioTotal", "totalInvestido", "valorAtual", "resultadoAcumulado", "rendaMensal", "rendimentosAno", "percentualRendaFixa", "percentualFiis", "meta": {...} },
  "graficos": { "porClasse": [], "porSegmento": [], "evolucaoPatrimonial": [], "evolucaoRendimentos": [], "aportes": [], "dividendos": [] },
  "oportunidades": { "classesAbaixo": [], "segmentosAbaixo": [], "watchlist": [], "comAlerta": [], "sugestaoAporte": null },
  "erros": []
}
```

**Validações / Erros:**
- Bloco indisponível → `erros[]` com código e bloco; status 200.
- Todas as fontes indisponíveis → 503.

**Critério de Aceitação:**
- Dado falha no bloco de watchlist, Quando consulto, Então os outros blocos vêm preenchidos e `erros` lista apenas aquele.
- Dado usuário sem dados, Quando consulto, Então `vazio: true` e nenhum valor zero enganoso.

**Dependências:** RN-061-1, RN-085-4

---

### RN-061-3. Implementar componentes de gráfico e resumo

| Campo | Valor |
|---|---|
| **Título** | `[ProjetoInvest] RN-061-3 — Implementar componentes de gráfico e resumo` |
| **Activity** | Development |
| **RNs** | RN-061, RN-062 |

**Descrição:**
Implementar os cards de resumo, `AllocationBar`, donut por classe, barras por segmento e linhas de evolução, com tabela acessível equivalente e legenda textual.

**Critério de Aceitação:**
- Dado um gráfico, Quando navego por teclado, Então existe tabela equivalente acessível.
- Dado valor formatado no servidor, Quando hidrato no cliente, Então não há divergência visual.
- Dado percentual, Quando exibo, Então há texto além da cor.

**Dependências:** RN-061-2

---

### RN-061-4. Implementar painel de oportunidades

| Campo | Valor |
|---|---|
| **Título** | `[ProjetoInvest] RN-061-4 — Implementar painel de oportunidades` |
| **Activity** | Development |
| **RNs** | RN-063 |

**Descrição:**
Implementar o bloco com classes e segmentos abaixo da meta, ativos da watchlist, fundos com alerta e sugestão de aporte. Quando a funcionalidade de origem não existir (Fase 2/4), exibir estado "disponível em breve" em vez de erro.

**Critério de Aceitação:**
- Dado que a sugestão de aporte não está implementada, Quando abro, Então o bloco mostra estado informativo sem quebrar a tela.
- Dado segmento abaixo da meta, Quando abro, Então ele aparece com o valor necessário.

**Dependências:** RN-061-2

---

### RN-061-5. Implementar tela de dashboard e testes

| Campo | Valor |
|---|---|
| **Título** | `[ProjetoInvest] RN-061-5 — Implementar tela de dashboard e testes` |
| **Activity** | Development |
| **RNs** | RN-061 a RN-063 |

**Descrição:**
Montar a rota `/dashboard`, aplicar estados de carregamento (skeleton), vazio, erro parcial e completo; cobrir E2E de primeiro acesso e de carteira com dados.

**Critério de Aceitação:**
- Dado o primeiro acesso, Quando abro o dashboard, Então vejo CTA de primeiro cadastro e nenhum zero enganoso.
- Dado que um bloco falha, Quando abro, Então vejo o bloco isolado com "tentar novamente".
- Dado leitor de tela, Quando navego, Então todos os cards têm rótulo e valor acessíveis.

**Dependências:** RN-061-3, RN-061-4
