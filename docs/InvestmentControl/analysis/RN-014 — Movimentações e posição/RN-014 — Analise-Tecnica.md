---
project: INVESTMENT CONTROL
module: movimentacoes
audience: [tecnica]
status: draft
---

# RN-014 — Movimentações e posição

> Gerado por rdd-doc em 07/11/2026. Edite para revisar.

## Contexto técnico

Feature de maior risco do produto: implementa o razão de movimentações e o cálculo derivado de posição e preço médio. Toda regra aqui é testada com os casos de ouro G1–G7 de `quality/TEST_STRATEGY.md` antes de qualquer tela. `posicao_ativo` é cache de leitura reconstruível — nunca fonte primária.

Restrições: dinheiro em `Decimal` (ADR-006); transação obrigatória entre gravar movimentação e recalcular posição; nenhuma exclusão física (RN-084); idempotência por chave enviada pelo cliente.

## Mapa RN → repositórios/endpoints/telas

| RN | Repositório | Endpoints / Telas |
|---|---|---|
| RN-014 | ProjetoInvest | `GET/POST /api/movimentacoes`, `/movimentacoes` |
| RN-015 | ProjetoInvest | Cálculo de posição (`src/modules/posicao`) |
| RN-016 | ProjetoInvest | Cálculo de preço médio |
| RN-017 | ProjetoInvest | `rendimento` separado |
| RN-018 | ProjetoInvest | Confirmação de posição negativa |
| RN-019 | ProjetoInvest | Validação de valor total |
| RN-084 | ProjetoInvest | Cancelamento lógico |

## Decisões técnicas

| # | Decisão | Justificativa |
|---|---|---|
| 1 | Preço médio ponderado; venda baixa custo proporcional e mantém o preço médio | Mínimo de complexidade e aderente à prática do investidor pessoa física |
| 2 | `posicao_ativo` mantida por transação e reconstruível por script | Leitura rápida com fonte primária preservada |
| 3 | `cancelada_em` em vez de delete | Preserva histórico e auditoria |
| 4 | `Idempotency-Key` único por usuário | Evita duplicidade por retry de rede |
| 5 | Validação de total com tolerância de R$ 0,01 | Absorve arredondamento de nota de corretagem |
| 6 | Confirmação de posição negativa exige motivo auditável | Exceção precisa ser rastreável |

## Contratos e tabelas envolvidos

- **Contratos de API:** `specs/API_CONTRACTS.md` §4.1–§4.3
- **Modelo de dados:** `specs/DATA_MODEL.md` §4.5 (`movimentacao`), §4.6 (`posicao_ativo`), §4.7 (`rendimento`)
- **UI:** `specs/UI_SPEC.md` §7
- **Erros:** `specs/ERROR_CATALOG.md` §5
- **Testes:** `quality/TEST_STRATEGY.md` §5 (G1–G7)
- **Legado:** não aplicável

## Riscos e pré-requisitos

- Depende de RN-010 (ativo) e RN-085-4 (sessão).
- Ordem de eventos no mesmo dia: recalcular sempre pela ordem `(data, criado_em)`.
- Venda com preço médio zero (posição zerada) deve ser bloqueada como posição negativa.
- `PEND-005` (método de baixa) ainda aberta: implementar custo médio e isolar a regra para permitir troca por PEPS sem reescrever o domínio.
