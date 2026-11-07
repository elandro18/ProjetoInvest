---
project: INVESTMENT CONTROL
module: alocacao
audience: [negocio]
status: draft
---

# RN-021 — Metas de alocação — Análise Funcional

> Gerado por rdd-doc em 07/11/2026 a partir de REQUIREMENTS.md (RN-âncora + RNs do escopo).

## O que esta entrega faz

Permite definir a estratégia da carteira — quanto deve estar em renda fixa e quanto em FIIs, e como os FIIs devem se distribuir entre segmentos — e mostra, a cada momento, o quanto a carteira está longe dessa estratégia.

## Comportamento esperado

- A configuração inicial vem com 50% em renda fixa e 50% em FIIs.
- A pessoa pode alterar os percentuais, mas a soma precisa fechar exatamente 100%.
- A mesma lógica vale para os segmentos de FIIs, com metas iniciais sugeridas.
- O sistema mostra o percentual atual de cada classe e segmento, a diferença em pontos percentuais e quanto falta em reais para atingir a meta.
- Cada classe ou segmento é classificado como abaixo, acima ou dentro da meta.
- O percentual por segmento é calculado sobre o patrimônio total, e "caixa e oportunidades" é um segmento como os outros.
- Ao salvar uma nova configuração, a anterior é preservada como histórico.

## Regras de negócio

| Regra | O que garante |
|---|---|
| 1 | A meta inicial é 50% renda fixa e 50% FIIs. |
| 2 | A soma das metas de classe precisa ser 100%. |
| 3 | A soma das metas de segmento precisa ser 100%. |
| 4 | As metas são editáveis a qualquer momento. |
| 5 | A configuração anterior permanece registrada com sua vigência. |
| 6 | O percentual atual é comparado com a meta e classificado como abaixo, acima ou dentro. |
| 7 | O sistema informa o valor em reais necessário para atingir a meta. |
| 8 | O percentual por segmento usa o patrimônio total como base. |
| 9 | "Caixa e oportunidades" entra na conta como segmento. |
| 10 | Metas e pesos são configuração, não código: mudam sem nova versão do sistema. |

## O que fica de fora

- Sugestão de qual ativo comprar (fase seguinte).
- Rebalanceamento automático da carteira.
- Múltiplas estratégias simultâneas por usuário.
