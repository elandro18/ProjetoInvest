---
project: INVESTMENT CONTROL
module: carteira
audience: [negocio]
status: draft
---

# RN-020 — Carteira consolidada — Análise Funcional

> Gerado por rdd-doc em 07/11/2026 a partir de REQUIREMENTS.md (RN-âncora + RNs do escopo).

## O que esta entrega faz

Reúne tudo o que a pessoa tem em um único lugar: quanto está em FIIs, quanto está em renda fixa, quanto isso representa do patrimônio, quanto rendeu no mês e no ano, e como essa distribuição evoluiu. É a resposta para "como está minha carteira hoje".

## Comportamento esperado

- A tela mostra o patrimônio total, separado por classe, com percentual de cada uma.
- Mostra a quantidade de ativos, os rendimentos do mês, os rendimentos acumulados no ano e a evolução patrimonial.
- Mostra a distribuição por segmento de FII.
- Cada valor de mercado informa de onde veio e a que data se refere.
- Se a cotação de um ativo não estiver disponível, a linha mostra "indisponível" e o total é calculado com o último valor conhecido, deixando isso claro.
- A pessoa pode filtrar por classe, segmento e situação do ativo.

## Regras de negócio

| Regra | O que garante |
|---|---|
| 1 | O patrimônio total é a soma das posições de FII com o saldo da renda fixa. |
| 2 | O percentual por classe é calculado sobre o patrimônio total. |
| 3 | O percentual por segmento também usa o patrimônio total como base. |
| 4 | Rendimentos do mês e do ano são calculados separadamente do ganho de capital. |
| 5 | A evolução patrimonial é apresentada por período. |
| 6 | Todo valor de mercado exibe fonte e data de referência. |
| 7 | Valor ausente é exibido como indisponível, nunca como zero. |
| 8 | Ativo inativo continua compondo a carteira. |

## O que fica de fora

- Projeção de patrimônio (fase posterior).
- Rentabilidade ajustada por aportes (TWR) — não especificada.
- Exportação de carteira (pendente de decisão).
