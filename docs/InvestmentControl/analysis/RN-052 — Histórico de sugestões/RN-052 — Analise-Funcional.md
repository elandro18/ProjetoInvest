---
project: INVESTMENT CONTROL
module: aportes
audience: [negocio]
status: draft
---

# RN-052 — Histórico de sugestões — Análise Funcional

> Gerado por rdd-doc em 10/11/2026 a partir de REQUIREMENTS.md (RN-âncora + RNs do escopo).

## O que esta entrega faz

Permite consultar tudo o que o sistema já sugeriu e o que a pessoa decidiu em cada ocasião. É a memória da estratégia: com o tempo, mostra se as decisões seguiram as metas e por quê.

## Comportamento esperado

- A pessoa vê a lista das sugestões já geradas, com data, valor e decisão.
- Pode filtrar por período e por decisão (aceita, ignorada ou alterada).
- Ao abrir uma sugestão, vê a distribuição proposta, os ativos avaliados, as justificativas, os alertas e a decisão registrada.
- O histórico é somente leitura: não altera carteira nem recria a sugestão.
- Cada pessoa vê apenas o próprio histórico.

## Regras de negócio

| Regra | O que garante |
|---|---|
| 1 | Toda sugestão gerada aparece no histórico. |
| 2 | A lista mostra data, valor e decisão. |
| 3 | É possível filtrar por período e por decisão. |
| 4 | O detalhe mostra a distribuição, os ativos, as justificativas e os alertas do momento. |
| 5 | A decisão e a observação registradas aparecem no detalhe. |
| 6 | O histórico é somente leitura. |
| 7 | Cada usuário acessa apenas o próprio histórico. |
| 8 | A lista é paginada. |

## O que fica de fora

- Editar ou apagar sugestões passadas.
- Reexecutar uma sugestão antiga.
- Comparação entre sugestões.
