---
project: INVESTMENT CONTROL
module: aportes
audience: [tecnica]
status: draft
---

# RN-025 — Sugestão de aporte

> Gerado por rdd-doc em 10/11/2026. Edite para revisar.

## Contexto técnico

Feature central da Fase 2: compõe carteira, metas, desvios, concentração e ativos para produzir uma distribuição de aporte justificada e persistida. A regra de priorização é o **water-filling por diferença em reais sobre o patrimônio pós-aporte**: a classe com maior gap recebe primeiro, até fechar; o restante passa para a próxima. Não há divisão proporcional ingênua.

Sem cotação (Fase 3) e sem avaliação de qualidade (Fase 4), o checklist marca esses itens como **indisponíveis** e a classificação não os trata como positivos. "Apto para estudo" significa "sem bloqueio conhecido", não "aprovado".

## Mapa RN → repositórios/endpoints/telas

| RN | Repositório | Endpoints / Telas |
|---|---|---|
| RN-025 | ProjetoInvest | `POST /api/aportes/sugestao`, `/aportes` |
| RN-026 | ProjetoInvest | Motor de priorização (domínio) |
| RN-027 | ProjetoInvest | Apresentação da sugestão e justificativas |
| RN-050 | ProjetoInvest | Checklist de oito verificações |
| RN-051 | ProjetoInvest | Classificação do candidato |
| RN-053 | ProjetoInvest | `PATCH /api/aportes/{id}/decisao` |
| RN-054 | ProjetoInvest | Rebalanceamento por aporte (sem venda) |
| RN-049 | ProjetoInvest | Consome concentração e limites |
| RN-055/RN-056 | ProjetoInvest | Não recomendar só por P/VP ou DY (dados indisponíveis na Fase 2) |

## Decisões técnicas

| # | Decisão | Justificativa |
|---|---|---|
| 1 | Gap calculado sobre o patrimônio **pós-aporte** | Evita alocar tudo em uma classe e ultrapassar a meta |
| 2 | Water-filling: maior gap primeiro, limitado ao gap | Cumpre RN-026 sem rateio igual |
| 3 | Nenhum gap positivo → distribui pela proporção da meta | Ainda oferece uma distribuição útil |
| 4 | Segmentos recebem a parcela de FII e são priorizados por gap | Mantém a estratégia por segmento (RN-022/RN-089) |
| 5 | Checklist com estado `SIM`/`NAO`/`INDISPONIVEL` | RN-077: ausência não vira positivo |
| 6 | `ABAIXO_META_APTO_PARA_ESTUDO` não exige qualidade/preço | "Estudar" não é "comprar"; os indisponíveis ficam explícitos |
| 7 | Snapshot completo em `sugestao_aporte` (JSONB) | Histórico imutável para auditoria (RN-052) |
| 8 | Decisão em `PATCH` separado | Permite registrar a decisão sem recriar a sugestão (RN-053) |

## Contratos e tabelas envolvidos

- **Contratos de API:** `specs/API_CONTRACTS.md` §8.1–§8.3
- **Modelo de dados:** `specs/DATA_MODEL.md` §4.15 (`sugestao_aporte`), §4.9 (metas), §4.18 (limites)
- **UI:** `specs/UI_SPEC.md` §10 (`/aportes`)
- **Erros:** `specs/ERROR_CATALOG.md` §8
- **Regras de domínio:** RN-025 a RN-027, RN-050 a RN-056; RN-089/RN-090/RN-091

## Riscos e pré-requisitos

- Depende de metas (RN-021), desvios (RN-023) e concentração (RN-049) — todos implementados.
- Carteira vazia: a sugestão é válida (100% na classe mais distante), mas os candidatos são vazios; a UI orienta o cadastro.
- Limite de concentração não configurado → checklist item `aumentaConcentracao: INDISPONIVEL`.
- `PEND-007`/`PEND-008` (metodologia de avaliação) impedem a dimensão de qualidade; não bloqueiam a sugestão.
- Segmentos sem ativo cadastrado recebem valor sugerido e a nota "sem ativo cadastrado neste segmento".
- Arredondamento: distribuir o valor exato (soma das linhas = aporte) usando o resíduo na última linha.
