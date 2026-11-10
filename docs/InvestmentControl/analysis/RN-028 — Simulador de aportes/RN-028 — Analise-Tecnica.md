---
project: INVESTMENT CONTROL
module: aportes
audience: [tecnica]
status: draft
---

# RN-028 — Simulador de aportes

> Gerado por rdd-doc em 10/11/2026. Edite para revisar.

## Contexto técnico

Operação **stateless**: reutiliza o motor de priorização da RN-025 para calcular a distribuição de um valor hipotético e devolve o comparativo antes/depois por classe e segmento. Não cria `sugestao_aporte` nem altera a carteira. A base é o patrimônio atual (custo dos FIIs + saldo da RF) e as metas vigentes.

## Mapa RN → repositórios/endpoints/telas

| RN | Repositório | Endpoints / Telas |
|---|---|---|
| RN-028 | ProjetoInvest | `POST /api/aportes/simulacao`, `/aportes` (seção Simulador) |

## Decisões técnicas

| # | Decisão | Justificativa |
|---|---|---|
| 1 | Reutilizar o motor da RN-025 | Evita divergência entre sugestão e simulação |
| 2 | Sem persistência | Simulação é exploratória; histórico é só da sugestão (RN-052) |
| 3 | Resposta com `antes`, `depois` e `delta` | Atende a leitura de comparação da UI_SPEC §10 |
| 4 | `delta.pontosPercentuais = depois − antes` | Mostra o efeito real do aporte |
| 5 | Validação de valor > 0 | Evita simulação vazia |

## Contratos e tabelas envolvidos

- **Contratos de API:** `specs/API_CONTRACTS.md` §8.2
- **Modelo de dados:** nenhuma tabela nova; lê `posicao_ativo`, `investimento_renda_fixa`, `alocacao_meta`
- **UI:** `specs/UI_SPEC.md` §10 (seção Simulador)
- **Erros:** `specs/ERROR_CATALOG.md` §8 (`APORTE_VALOR_INVALIDO`)

## Riscos e pré-requisitos

- Depende de RN-025-2 (motor) e da carteira/desvios.
- Sem cotação, FII entra pelo custo (RN-091); o simulador não promete rentabilidade.
- Carteira vazia: distribui conforme a meta.
- Segmentos sem aporte não aparecem no `depois`.
