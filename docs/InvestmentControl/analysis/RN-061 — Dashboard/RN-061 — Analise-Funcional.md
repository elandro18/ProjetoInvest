---
project: INVESTMENT CONTROL
module: dashboard
audience: [negocio]
status: draft
---

# RN-061 — Dashboard — Análise Funcional

> Gerado por rdd-doc em 07/11/2026 a partir de REQUIREMENTS.md (RN-âncora + RNs do escopo).

## O que esta entrega faz

Entrega o painel de entrada do sistema: a primeira coisa que a pessoa vê ao entrar. Resume o patrimônio, o resultado, os rendimentos, a aderência à meta 50/50 e o que merece atenção hoje.

## Comportamento esperado

- A tela mostra patrimônio total, total investido, valor atual, resultado acumulado, renda mensal recebida e rendimentos do ano.
- Mostra o percentual em renda fixa e em FIIs, comparando com a meta.
- Apresenta gráficos de distribuição por classe, por segmento, evolução patrimonial, evolução dos rendimentos, histórico de aportes e histórico de dividendos.
- Exibe um painel de oportunidades com classes e segmentos abaixo da meta, ativos em observação, fundos com alerta e a sugestão de distribuição do aporte do mês.
- Cada bloco carrega e falha de forma independente: se um gráfico não puder ser carregado, o restante da tela continua útil.
- Nenhum número aparece sem indicar a data de referência.

## Regras de negócio

| Regra | O que garante |
|---|---|
| 1 | O painel mostra os nove indicadores principais da carteira. |
| 2 | A comparação com a meta 50/50 é sempre visível. |
| 3 | Os seis gráficos previstos estão disponíveis. |
| 4 | O painel de oportunidades reúne desvios, observação, alertas e sugestão de aporte. |
| 5 | Falha em um bloco não derruba a tela inteira. |
| 6 | Toda informação de mercado tem data de referência visível. |
| 7 | Carteira vazia orienta o primeiro cadastro em vez de mostrar zeros. |

## O que fica de fora

- Personalização de layout pelo usuário.
- Notificações por e-mail ou push.
- Comparação com benchmarks externos.
