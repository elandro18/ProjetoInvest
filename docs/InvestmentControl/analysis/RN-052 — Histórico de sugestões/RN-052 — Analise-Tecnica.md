---
project: INVESTMENT CONTROL
module: aportes
audience: [tecnica]
status: draft
---

# RN-052 — Histórico de sugestões

> Gerado por rdd-doc em 10/11/2026. Edite para revisar.

## Contexto técnico

Leitura do histórico já persistido em `sugestao_aporte` pela RN-025. Não cria tabela nova, não altera dados e não recalcula nada: expõe a lista paginada e o detalhe imutável de uma sugestão. A decisão (RN-053) já está gravada no registro.

## Mapa RN → repositórios/endpoints/telas

| RN | Repositório | Endpoints / Telas |
|---|---|---|
| RN-052 | ProjetoInvest | `GET /api/aportes/historico`, `GET /api/aportes/{id}`, `/aportes/historico` |
| RN-053 | ProjetoInvest | Decisão já persistida; o histórico exibe |

## Decisões técnicas

| # | Decisão | Justificativa |
|---|---|---|
| 1 | Lista paginada com filtros `de`/`ate`/`decisao` | Histórico cresce com o uso |
| 2 | Detalhe devolve o snapshot completo | É a auditoria do momento da sugestão |
| 3 | Somente leitura | A sugestão é fato; mudança seria CR |
| 4 | 404 para sugestão de outro usuário | Não confirmar existência (RN-070) |
| 5 | Resumo na lista (classe + valor) | Evita payload gigante por linha |

## Contratos e tabelas envolvidos

- **Contratos de API:** `specs/API_CONTRACTS.md` §8.3
- **Modelo de dados:** `specs/DATA_MODEL.md` §4.15 (`sugestao_aporte`)
- **UI:** `specs/UI_SPEC.md` §10 (histórico acessível pela tela de aportes)
- **Erros:** `specs/ERROR_CATALOG.md` §8 (`APORTE_NAO_ENCONTRADO`)

## Riscos e pré-requisitos

- Depende da RN-025 (persistência) — concluída.
- O JSONB de `ativos_avaliados` pode ser grande; a lista devolve apenas resumo e o detalhe carrega o snapshot.
- Sem novos códigos de erro.
