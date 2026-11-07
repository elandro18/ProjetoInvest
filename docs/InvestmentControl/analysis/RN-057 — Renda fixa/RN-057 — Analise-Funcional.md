---
project: INVESTMENT CONTROL
module: renda-fixa
audience: [negocio]
status: draft
---

# RN-057 — Renda fixa — Análise Funcional

> Gerado por rdd-doc em 07/11/2026 a partir de REQUIREMENTS.md (RN-âncora + RNs do escopo).

## O que esta entrega faz

Permite controlar os investimentos de renda fixa — Tesouro, CDB, LCI, LCA, debêntures e outros títulos — com instituição, taxa, vencimento, liquidez e saldo. Também avisa quando um título está perto de vencer, preso em carência, sem liquidez ou concentrado em uma instituição.

## Comportamento esperado

- A pessoa cadastra o título informando instituição, produto, indexador, taxa, datas, valor aplicado e saldo.
- O saldo é atualizado manualmente e sempre identificado como informado, estimado ou confirmado.
- O sistema calcula se o produto tem cobertura do FGC.
- A lista mostra vencimento, liquidez e o status do saldo.
- Alertas aparecem para vencimento próximo, carência, ausência de liquidez diária, concentração por instituição e limite de cobertura.
- O valor da renda fixa entra no patrimônio total da carteira.

## Regras de negócio

| Regra | O que garante |
|---|---|
| 1 | Os produtos iniciais são Tesouro Selic, Tesouro IPCA+, Tesouro Prefixado, CDB, LCI, LCA, debêntures e outros. |
| 2 | O vencimento precisa ser posterior à aplicação. |
| 3 | A taxa é informada ao ano e precisa ser válida. |
| 4 | O saldo é sempre classificado como informado, estimado ou confirmado. |
| 5 | A atualização do saldo é manual nesta fase. |
| 6 | O sistema alerta sobre vencimento, carência, liquidez, concentração e FGC. |
| 7 | Produto, indexador e data de aplicação não mudam depois do cadastro. |
| 8 | A integração com indicadores econômicos fica para depois da primeira fase. |

## O que fica de fora

- Cálculo automático de rendimento por CDI/IPCA.
- Integração com Tesouro Direto ou ANBIMA nesta fase.
- Resgate ou aplicação automática.
