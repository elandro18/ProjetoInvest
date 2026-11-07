---
project: INVESTMENT CONTROL
module: movimentacoes
audience: [negocio]
status: draft
---

# RN-014 — Movimentações e posição — Análise Funcional

> Gerado por rdd-doc em 07/11/2026 a partir de REQUIREMENTS.md (RN-âncora + RNs do escopo).

## O que esta entrega faz

Registra tudo o que acontece com um investimento — compra, venda, dividendo, juro, aplicação, resgate e taxa — e calcula, a partir desse histórico, quanto a pessoa tem e quanto pagou por cota. É o coração da confiabilidade do sistema: se esse número estiver errado, todo o resto está errado.

## Comportamento esperado

- A pessoa registra a movimentação escolhendo o ativo, o tipo, a data, a quantidade, o valor unitário e os custos.
- O sistema confere se o valor total informado corresponde à quantidade multiplicada pelo valor unitário, mais os custos.
- A posição e o preço médio são sempre calculados a partir das movimentações, nunca digitados.
- Uma venda reduz a quantidade sem alterar o preço médio; um dividendo não altera o preço médio.
- Uma venda maior que a posição é bloqueada e só acontece com confirmação explícita e justificativa.
- Movimentações não são apagadas: um erro é corrigido por cancelamento, que mantém o registro.
- O histórico pode ser filtrado por ativo, tipo e período.

## Regras de negócio

| Regra | O que garante |
|---|---|
| 1 | Existem sete tipos de movimentação previstos. |
| 2 | A posição é sempre resultado das movimentações, nunca um valor digitado. |
| 3 | O preço médio é ponderado e recalculado a cada compra ou venda. |
| 4 | Dividendos e juros ficam separados do ganho de capital. |
| 5 | Venda acima da posição exige confirmação e justificativa. |
| 6 | O valor total precisa ser coerente com quantidade, valor unitário e custos. |
| 7 | A data não pode estar no futuro. |
| 8 | Ativo inativo não recebe nova movimentação. |
| 9 | Movimentação não é excluída: é cancelada com motivo. |
| 10 | Cada movimentação tem um comprovante de envio que evita registro duplicado. |

## O que fica de fora

- Integração com extrato de corretora.
- Cálculo de imposto de renda.
- Transferência entre contas ou custódia.
