---
project: INVESTMENT CONTROL
module: aportes
audience: [negocio]
status: draft
---

# RN-025 — Sugestão de aporte — Análise Funcional

> Gerado por rdd-doc em 10/11/2026 a partir de REQUIREMENTS.md (RN-âncora + RNs do escopo).

## O que esta entrega faz

Responde à pergunta central do produto: **"onde eu coloco os próximos R$ 1.000?"** A pessoa informa o valor disponível, e o sistema compara a carteira atual com as metas, prioriza o que está mais distante e apresenta uma distribuição justificada — com os riscos conhecidos e os ativos que valem a pena estudar.

## Comportamento esperado

- A pessoa informa o valor do aporte (com atalhos de R$ 500 a R$ 2.000).
- O sistema calcula a distribuição considerando a carteira antes do aporte.
- A classe mais distante da meta recebe primeiro, até fechar a diferença; **nunca divide igualmente por padrão**.
- Se todas as classes já estão na meta, o valor é distribuído conforme a própria meta.
- Dentro dos FIIs, os segmentos abaixo da meta são priorizados.
- A sugestão mostra valores por classe e por segmento, ativos que podem ser estudados e a justificativa de cada linha.
- Antes de sugerir um ativo, o sistema verifica classe, segmento, se o ativo já está na carteira, se aumenta a concentração, se há dados suficientes, se atende à qualidade, se há alerta e se o preço está dentro dos parâmetros — marcando com transparência o que ainda não está disponível.
- Cada ativo recebe uma classificação: abaixo da meta e apto para estudo, abaixo com riscos, dentro da meta, acima da meta ou sem dados suficientes.
- Toda sugestão fica registrada com data, valor e distribuição.
- A pessoa pode aceitar, ignorar ou alterar; a decisão fica registrada.
- O sistema **não compra nada** — apenas sugere.

## Regras de negócio

| Regra | O que garante |
|---|---|
| 1 | O aporte é informado pelo usuário e precisa ser maior que zero. |
| 2 | A distribuição considera a carteira atual antes do aporte. |
| 3 | A classe mais distante da meta é priorizada, até fechar a diferença. |
| 4 | O aporte não é dividido igualmente entre as classes por padrão. |
| 5 | Se nenhuma classe está abaixo, o valor segue a proporção da meta. |
| 6 | Os segmentos abaixo da meta são priorizados dentro dos FIIs. |
| 7 | A sugestão apresenta valores, segmentos, ativos e justificativa. |
| 8 | O checklist verifica as oito condições antes de sugerir um ativo. |
| 9 | O que não pode ser avaliado é exibido como indisponível, nunca como positivo. |
| 10 | Cada ativo é classificado em uma das cinco situações previstas. |
| 11 | A sugestão é registrada com data, valor e distribuição. |
| 12 | A decisão do usuário (aceitar, ignorar ou alterar) é registrada sem apagar a sugestão. |
| 13 | O sistema nunca executa compra ou venda. |

## O que fica de fora

- Execução de ordens e integração com corretora.
- Avaliação de qualidade dos FIIs e preço de mercado (Fases 3 e 4) — aparecem como indisponíveis.
- Sugestão de venda.
- Projeção de rentabilidade.
