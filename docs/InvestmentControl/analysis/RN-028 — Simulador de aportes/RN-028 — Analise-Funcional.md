---
project: INVESTMENT CONTROL
module: aportes
audience: [negocio]
status: draft
---

# RN-028 — Simulador de aportes — Análise Funcional

> Gerado por rdd-doc em 10/11/2026 a partir de REQUIREMENTS.md (RN-âncora).

## O que esta entrega faz

Permite testar **"e se eu aportasse R$ 1.500?"** antes de decidir. A pessoa escolhe um valor (ou digita outro), e o sistema mostra como a carteira ficaria depois do aporte — comparando o antes e o depois por classe e por segmento.

## Comportamento esperado

- A pessoa escolhe um valor predefinido (R$ 500, 1.000, 1.500, 2.000) ou digita um valor personalizado.
- O sistema aplica a mesma lógica de priorização da sugestão de aporte.
- A tela mostra o antes e o depois: valor e percentual por classe e por segmento, com a diferença em pontos percentuais.
- Nada é aplicado à carteira: é apenas simulação.
- A simulação não fica registrada no histórico de sugestões.
- Se a carteira estiver vazia, a simulação mostra a distribuição a partir das metas.

## Regras de negócio

| Regra | O que garante |
|---|---|
| 1 | O valor simulado é escolhido ou digitado pelo usuário e precisa ser maior que zero. |
| 2 | A simulação usa a mesma priorização da sugestão de aporte. |
| 3 | O resultado mostra antes, depois e a diferença em pontos percentuais. |
| 4 | Nada é gravado na carteira nem no histórico de sugestões. |
| 5 | Carteira vazia simula a partir das metas. |

## O que fica de fora

- Aplicar a simulação como movimentação.
- Projeção de rentabilidade.
- Sugestão de venda para rebalancear.
