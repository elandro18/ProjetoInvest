---
project: INVESTMENT CONTROL
module: carteira
audience: [tecnica]
status: draft
---

# RN-020 — Carteira consolidada

> Gerado por rdd-doc em 07/11/2026. Edite para revisar.

## Contexto técnico

Agrega posições de FII (`posicao_ativo`) e saldos de renda fixa em um resumo por classe e por segmento, além de séries de evolução. É a fonte dos indicadores do dashboard. Na Fase 1 não há cotação de mercado: o valor atual de FII usa o último preço disponível — se não houver, a posição entra pelo custo com marcação explícita de indisponibilidade.

A agregação é feita em query única por usuário, com índices existentes, para evitar N+1.

## Mapa RN → repositórios/endpoints/telas

| RN | Repositório | Endpoints / Telas |
|---|---|---|
| RN-020 | ProjetoInvest | `GET /api/carteira`, `/carteira` |
| RN-015 | ProjetoInvest | Usa `posicao_ativo` |
| RN-023 | ProjetoInvest | Percentual por classe e segmento |
| RN-038 | ProjetoInvest | Marca cache/última coleta |
| RN-062 | ProjetoInvest | `GET /api/carteira/evolucao` |

## Decisões técnicas

| # | Decisão | Justificativa |
|---|---|---|
| 1 | Agregação em uma query por escopo, não por ativo | Evita N+1 |
| 2 | `valor_atual` = `quantidade × último preço`; sem preço, usa custo com flag | Nunca inventar zero nem omitir posição |
| 3 | Percentual sempre sobre patrimônio total (RN-089) | Consistência com a alocação |
| 4 | Evolução a partir de snapshots diários derivados de `historico_preco` e movimentações | Reconstruível, sem tabela de snapshot na Fase 1 |
| 5 | Serialização decimal como string | Evita perda de precisão no JSON |

## Contratos e tabelas envolvidos

- **Contratos de API:** `specs/API_CONTRACTS.md` §5.1–§5.2
- **Modelo de dados:** `specs/DATA_MODEL.md` §4.5–§4.8, §4.12
- **UI:** `specs/UI_SPEC.md` §5
- **Erros:** `specs/ERROR_CATALOG.md` §2
- **Legado:** não aplicável

## Riscos e pré-requisitos

- Depende de RN-014 (posição) e RN-057 (renda fixa).
- Sem histórico de preço, a evolução da Fase 1 mostra apenas o patrimônio a custo — deixar explícito.
- Performance: consulta de evolução em 12 meses precisa de índice `(ativo_id, data_referencia)`.
- Requisito de consistência: total por classe deve fechar com o total geral ao centavo.
