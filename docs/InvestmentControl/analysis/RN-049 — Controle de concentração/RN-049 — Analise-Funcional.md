---
project: INVESTMENT CONTROL
module: risco
audience: [negocio]
status: draft
---

# RN-049 — Controle de concentração — Análise Funcional

> Gerado por rdd-doc em 09/11/2026 a partir de REQUIREMENTS.md (RN-âncora + RNs do escopo).

## O que esta entrega faz

Permite definir quanto da carteira pode ficar concentrado em um único ativo, gestora, segmento ou instituição emissora — e mostra, a qualquer momento, onde a carteira passou do limite definido. É a proteção contra "colocar tudo em um lugar só".

## Comportamento esperado

- A pessoa define limites em percentual do patrimônio total para cada dimensão: ativo, gestora, segmento e emissor.
- O sistema mostra o percentual atual de cada item e se ele está dentro ou acima do limite.
- Quando um limite é ultrapassado, o item é sinalizado como excedido, com o quanto passou.
- Limites não têm valor padrão: sem configuração, o sistema informa o percentual atual, mas não inventa alerta.
- A concentração por imóvel ou inquilino fica indisponível enquanto esses dados não existirem (fases seguintes).
- A configuração é por usuário e isolada das demais contas.

## Regras de negócio

| Regra | O que garante |
|---|---|
| 1 | Os limites são configuráveis por ativo, gestora, segmento e emissor. |
| 2 | O percentual é calculado sobre o patrimônio total. |
| 3 | Um item é "excedido" quando o percentual atual é maior que o limite definido. |
| 4 | Sem limite configurado, nenhum alerta é gerado — apenas o percentual atual é exibido. |
| 5 | O limite precisa ser maior que zero e no máximo 100%. |
| 6 | A concentração por imóvel/inquilino fica indisponível até os dados existirem. |
| 7 | Os limites valem por usuário e não vazam entre contas. |
| 8 | A configuração anterior é preservada com vigência quando o limite muda. |

## O que fica de fora

- Bloqueio automático de compra por concentração (o sistema alerta, não impede).
- Concentração por imóvel ou inquilino (depende de dados da Fase 3/4).
- Limites por classe (isso já é papel das metas de alocação).
