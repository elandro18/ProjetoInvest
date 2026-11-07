---
project: INVESTMENT CONTROL
module: renda-fixa
audience: [tecnica]
status: draft
---

# RN-057 — Renda fixa

> Gerado por rdd-doc em 07/11/2026. Edite para revisar.

## Contexto técnico

CRUD de títulos de renda fixa e cálculo de alertas operacionais. O saldo é manual e classificado; não há cálculo de rendimento nesta fase (PEND-009 / RN-060). A renda fixa entra na carteira como uma posição de classe `RENDA_FIXA`, sem quantidade de cota.

Restrições: campos de identificação do título são imutáveis após criação; cobertura FGC é derivada do produto com possibilidade de sobrescrita; alertas são calculados, não persistidos.

## Mapa RN → repositórios/endpoints/telas

| RN | Repositório | Endpoints / Telas |
|---|---|---|
| RN-057 | ProjetoInvest | `GET/POST /api/renda-fixa`, `PATCH /api/renda-fixa/{id}`, `/renda-fixa` |
| RN-058 | ProjetoInvest | `GET /api/renda-fixa/alertas` |
| RN-059 | ProjetoInvest | `status_saldo` no cadastro e na atualização |
| RN-060 | ProjetoInvest | Fora do escopo da Fase 1 (apenas documentado) |

## Decisões técnicas

| # | Decisão | Justificativa |
|---|---|---|
| 1 | Saldo e status separados (`saldo_atual` + `status_saldo`) | Permite exibir confiança do número (RN-059) |
| 2 | Alertas calculados sob demanda | Evita tabela de alerta e inconsistência temporal |
| 3 | `cobertura_fgc` derivada por produto com override | Regra muda por produto e por legislação (PEND-012) |
| 4 | Produto/indexador/data de aplicação imutáveis | Evita reescrever a natureza do título |
| 5 | Renda fixa não gera `posicao_ativo` | Não há cota; consolidação soma `saldo_atual` |

## Contratos e tabelas envolvidos

- **Contratos de API:** `specs/API_CONTRACTS.md` §6.1–§6.4
- **Modelo de dados:** `specs/DATA_MODEL.md` §4.8 (`investimento_renda_fixa`)
- **UI:** `specs/UI_SPEC.md` §8
- **Erros:** `specs/ERROR_CATALOG.md` §6
- **Legado:** não aplicável

## Riscos e pré-requisitos

- Depende de RN-010 (classe renda fixa) e RN-085-4 (sessão).
- Limite de FGC por CPF/instituição não definido (`PEND-012`): implementar parâmetro configurável, sem valor fixo escondido.
- Sem cálculo de rendimento, o saldo desatualizado é responsabilidade do titular — a UI precisa deixar isso explícito.
