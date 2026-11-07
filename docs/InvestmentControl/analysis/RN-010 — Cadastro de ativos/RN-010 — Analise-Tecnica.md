---
project: INVESTMENT CONTROL
module: ativos
audience: [tecnica]
status: draft
---

# RN-010 — Cadastro de ativos

> Gerado por rdd-doc em 07/11/2026. Edite para revisar.

## Contexto técnico

CRUD de ativos com validação de classe/segmento e unicidade por usuário. Depende dos dados de referência criados na RN-001 (`classe_ativo`, `segmento_ativo`) e da sessão da RN-085. É pré-requisito de movimentações, renda fixa, carteira e dashboard.

A restrição "FII exige segmento" depende de outra tabela, portanto é validada no caso de uso dentro de transação — não como CHECK simples.

## Mapa RN → repositórios/endpoints/telas

| RN | Repositório | Endpoints / Telas |
|---|---|---|
| RN-010 | ProjetoInvest | `GET/POST /api/ativos`, `GET/PATCH /api/ativos/{id}`, `/ativos`, `/ativos/novo`, `/ativos/[id]` |
| RN-011 | ProjetoInvest | `GET /api/ativos` (lista de classes) |
| RN-012 | ProjetoInvest | `GET /api/ativos` (lista de segmentos) |
| RN-013 | ProjetoInvest | `PATCH /api/ativos/{id}` (`status`) |

## Decisões técnicas

| # | Decisão | Justificativa |
|---|---|---|
| 1 | `ticker` normalizado para maiúsculas na borda | Evita duplicidade por diferença de caixa |
| 2 | Unicidade por `(usuario_id, ticker)` | O mesmo ticker pode existir para usuários diferentes |
| 3 | Classe imutável após existir movimentação | Evita recalcular histórico com semântica diferente |
| 4 | Inativação via `PATCH` de status, nunca delete | Preserva integridade da posição |
| 5 | Segmento obrigatório validado em domínio + transação | Depende de `classe_ativo.codigo` |

## Contratos e tabelas envolvidos

- **Contratos de API:** `specs/API_CONTRACTS.md` §3.1–§3.4
- **Modelo de dados:** `specs/DATA_MODEL.md` §4.4 (`ativo`), §4.2, §4.3
- **UI:** `specs/UI_SPEC.md` §6.1–§6.3
- **Erros:** `specs/ERROR_CATALOG.md` §4
- **Legado:** não aplicável

## Riscos e pré-requisitos

- Depende de RN-001-2 (classes/segmentos) e RN-085-4 (`requireUsuario`).
- Não permitir `classeId` de classe inativa.
- A ficha do ativo na Fase 1 não tem cotação: exibir "Indisponível" com motivo, nunca zero.
