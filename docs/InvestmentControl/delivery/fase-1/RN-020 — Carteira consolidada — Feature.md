---
project: INVESTMENT CONTROL
module: carteira
audience: [tecnica]
status: draft
---

# RN-020 — Carteira consolidada

> Gerado por rdd-doc em 07/11/2026. Edite para revisar.
> Análise: ../../analysis/RN-020 — Carteira consolidada/
> Após revisão, use o workflow de issues para criar as tarefas no sistema de tracking.

## Issue principal

| Campo | Valor |
|---|---|
| Título | `RN-020 — Carteira consolidada` |
| Tracking ID | — (a criar) |
| Módulo | InvestmentControl |
| Milestone | Fase 1 |
| Repositórios | `elandro18/ProjetoInvest` |

## Resumo das tasks

| Task | Tipo | Repo | Descrição |
|---|---|---|---|
| RN-020-1 | Backend | ProjetoInvest | Implementar agregador de carteira por classe e segmento |
| RN-020-2 | Backend | ProjetoInvest | Implementar endpoints de carteira e evolução |
| RN-020-3 | Frontend | ProjetoInvest | Implementar tela de carteira |
| RN-020-4 | Backend | ProjetoInvest | Testes de consolidação, consistência e performance |

## Ordem de Execução

**Wave 1 — Domínio:**
RN-020-1

**Wave 2 — API:**
RN-020-2

**Wave 3 — Frontend:**
RN-020-3

**Wave 4 — Qualidade:**
RN-020-4

---

### RN-020-1. Implementar agregador de carteira

| Campo | Valor |
|---|---|
| **Título** | `[ProjetoInvest] RN-020-1 — Implementar agregador de carteira` |
| **Activity** | Development |
| **RNs** | RN-015, RN-020, RN-023, RN-038 |

**Descrição:**
Implementar em `src/modules/carteira` a agregação que produz: patrimônio total, por classe, por segmento, quantidade de ativos, rendimentos do mês e do ano, e metadados de proveniência. Valor atual usa último preço; sem preço, usa custo com flag `valorIndisponivel: true`.

**Validações / Erros:**
- Soma das classes deve ser igual ao total (tolerância 0,01) — divergência gera erro de consistência logado.
- Sem posição e sem renda fixa → carteira vazia, não erro.

**Critério de Aceitação:**
- Dado um ativo sem preço, Quando calculo, Então ele entra pelo custo e a resposta marca `valorIndisponivel`.
- Dado um ativo com preço, Quando calculo, Então `valorAtual = quantidade × preço`.
- Dado renda fixa e FII, Quando calculo, Então a soma dos percentuais é 100.

**Dependências:** RN-014-4, RN-057-2

---

### RN-020-2. Implementar endpoints de carteira e evolução

| Campo | Valor |
|---|---|
| **Título** | `[ProjetoInvest] RN-020-2 — Implementar endpoints de carteira e evolução` |
| **Activity** | Development |
| **RNs** | RN-020, RN-023, RN-062 |

**Descrição:**
Implementar `GET /api/carteira` e `GET /api/carteira/evolucao` com paginação de pontos por granularidade e metadados de cotação.

**Contrato:**

```
GET /api/carteira
Response 200: { "resumo": { "patrimonioTotal", "rendaFixa", "fiis", "percentualRendaFixa", "percentualFiis", "quantidadeAtivos", "rendimentosMes", "rendimentosAcumuladosAno" }, "porClasse": [], "porSegmento": [], "atualizadoEm", "cotacoes": { "statusDado", "dataReferencia" } }

GET /api/carteira/evolucao?de=&ate=&granularidade=mes
Response 200: { "pontos": [ { "data", "patrimonio", "rendaFixa", "fiis" } ] }
```

**Validações / Erros:**
- `de` > `ate` → 422.
- Granularidade inválida → 422.

**Critério de Aceitação:**
- Dado um usuário com carteira, Quando consulto, Então os nove indicadores de RN-020 estão presentes.
- Dado outro usuário, Quando consulto pelo ID, Então não há vazamento (filtro por sessão).
- Dado 12 meses, Quando consulto com `granularidade=mes`, Então há até 12 pontos.

**Dependências:** RN-020-1, RN-085-4

---

### RN-020-3. Implementar tela de carteira

| Campo | Valor |
|---|---|
| **Título** | `[ProjetoInvest] RN-020-3 — Implementar tela de carteira` |
| **Activity** | Development |
| **RNs** | RN-020, RN-038 |

**Descrição:**
Implementar `/carteira` conforme `UI_SPEC.md` §5: filtros, tabela de posições com preço e proveniência, resumo por classe e segmento e comportamento mobile em cartões.

**Critério de Aceitação:**
- Dado ativo sem preço, Quando a linha é exibida, Então "Preço atual" mostra "Indisponível" com motivo.
- Dado tela < 768 px, Quando abro, Então a tabela vira cartões.
- Dado carteira vazia, Quando abro, Então vejo CTA para cadastrar ativo.

**Dependências:** RN-020-2

---

### RN-020-4. Testes de consolidação, consistência e performance

| Campo | Valor |
|---|---|
| **Título** | `[ProjetoInvest] RN-020-4 — Testes de consolidação e performance` |
| **Activity** | Development |
| **RNs** | RN-020, RN-023, RN-089 |

**Descrição:**
Cobrir consistência (soma por classe = total), ausência de preço, isolamento por usuário e o tempo de resposta da carteira com volume representativo (500 movimentações, 50 ativos).

**Critério de Aceitação:**
- Dado o teste de consistência, Quando somo as classes, Então o resultado é igual ao total ao centavo.
- Dado 50 ativos, Quando consulto a carteira, Então a resposta fica abaixo de 500 ms no ambiente de teste.
- Dado um ativo sem preço, Quando consulto, Então o valor é o custo e há marcação de indisponibilidade.

**Dependências:** RN-020-1, RN-020-2, RN-020-3
