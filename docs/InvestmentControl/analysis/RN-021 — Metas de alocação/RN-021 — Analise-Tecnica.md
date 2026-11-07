---
project: INVESTMENT CONTROL
module: alocacao
audience: [tecnica]
status: draft
---

# RN-021 — Metas de alocação

> Gerado por rdd-doc em 07/11/2026. Edite para revisar.

## Contexto técnico

Configuração versionada de metas por classe e por segmento, com validação de soma 100 em transação, e cálculo de desvio a partir da carteira consolidada. A base de cálculo do segmento é o patrimônio total (RN-089). A configuração é dado, não constante (ADR-008/RN-082).

Depende de RN-020 (carteira) para o valor atual; nesta feature, o cálculo de desvio pode operar sobre a agregação de posições e renda fixa, mas o endpoint definitivo é o da RN-020.

## Mapa RN → repositórios/endpoints/telas

| RN | Repositório | Endpoints / Telas |
|---|---|---|
| RN-021 | ProjetoInvest | `GET/PUT /api/alocacao/metas`, `/alocacao` |
| RN-022 | ProjetoInvest | Metas por segmento |
| RN-023 | ProjetoInvest | `GET /api/alocacao/desvios` |
| RN-024 | ProjetoInvest | Classificação e valor para meta |
| RN-082 | ProjetoInvest | Configuração em banco com vigência |
| RN-089 | ProjetoInvest | Base de cálculo = patrimônio total |

## Decisões técnicas

| # | Decisão | Justificativa |
|---|---|---|
| 1 | Vigência por data em vez de update destrutivo | Preserva histórico para relatórios retroativos |
| 2 | Validação de soma em transação | Constraint de linha não consegue validar conjunto |
| 3 | `PUT` substitui o conjunto vigente inteiro | Evita estado parcial entre classes e segmentos |
| 4 | Desvio em pontos percentuais e em reais | Atende leitura executiva e operacional |
| 5 | Base de segmento = patrimônio total | Decisão do proprietário (RN-089) |

## Contratos e tabelas envolvidos

- **Contratos de API:** `specs/API_CONTRACTS.md` §7.1–§7.3
- **Modelo de dados:** `specs/DATA_MODEL.md` §4.9 (`alocacao_meta`)
- **UI:** `specs/UI_SPEC.md` §9
- **Erros:** `specs/ERROR_CATALOG.md` §7
- **Legado:** não aplicável

## Riscos e pré-requisitos

- Depende de RN-001-2 (segmentos) e RN-010/RN-014 para existir patrimônio.
- Sem carteira, o desvio é calculado sobre zero: exibir "sem dados" em vez de −100%.
- Alterar meta em uso exige confirmação na UI (impacta sugestões futuras).
- `PEND-004` (limites) não afeta esta feature, mas compartilha o padrão de configuração.
