---
project: ProjetoInvest
audience: [tecnica, negocio]
status: active
---

# Constituição do Repositório — ProjetoInvest

> **Propósito:** Documentar decisões, requisitos e arquitetura dos produtos mantidos neste repositório de documentação.
> **Última atualização:** 07/11/2026

---

## 1. Produto

### Missão

Construir ferramentas pessoais de controle financeiro com documentação rastreável, onde toda regra de negócio tem origem, decisão registrada e artefato técnico correspondente.

### Visão

Todo requisito de negócio tem um documento de origem, uma decisão registrada e um artefato técnico correspondente. Nenhuma regra implementada existe "só no código".

---

> **Regra de idioma:** CONSTITUTION.md em português brasileiro (PT-BR). Títulos, descrições, princípios e seções em PT-BR. Apenas notação DAG, acrônimos (ADR, RN, DAG, RDD) e termos técnicos universais permanecem no original.

## 2. Objetivo do Produto

Documentar, modelar e especificar os módulos seguindo:

```
PROJECT_CHARTER → REQUIREMENTS → DATA_MODEL → API_CONTRACTS → UI_SPEC → TEST_STRATEGY
```

---

## 3. Convenções de Identificação e Formato (EARS)

### 3.1 Identificadores

| Prefixo | Uso | Exemplo |
|---|---|---|
| `RN-NNN` | Regra de negócio | `RN-014` |
| `PEND-NNN` | Pendência em aberto | `PEND-003` |
| `ADR-NNN` | Architecture Decision Record | `ADR-006` |
| `CR-NNN` | Change Request | `CR-001` |
| `UC-NNN` | Caso de uso | `UC-002` |
| `RN-NNN-M` | Task derivada de uma RN | `RN-014-1` |

Regras:

- Numeração é sequencial e **nunca reutilizada**.
- Itens removidos não são apagados silenciosamente: recebem marcação `[removido]` com motivo.
- Identificadores citados em artefatos externos (issues, PRs) não podem ser renumerados.

### 3.2 Tipos EARS

| Tipo | Uso |
|---|---|
| `[ubíquo]` | Regra sempre válida |
| `[evento]` | Disparada por um evento ("Quando ...") |
| `[estado]` | Válida enquanto um estado persistir ("Enquanto ...") |
| `[opcional]` | Funcionalidade opcional ("Onde ...") |
| `[indesejado]` | Comportamento proibido/proteção ("Se ... então") |

### 3.3 Front matter obrigatório

```yaml
---
project: <NOME_DO_PROJETO>
module: <charter|requisitos|modelo-dados|api|ui|arquitetura|seguranca|qualidade|entrega>
audience: [negocio, tecnica]
status: draft|review|approved|active|superseded|archived
---
```

---

## 4. Princípios

| # | Princípio | Descrição |
|---|-----------|-----------|
| 1 | Rastreabilidade primeiro | Toda RN deve ter um artefato downstream (dado, contrato ou tela) ou justificativa explícita de não aplicação |
| 2 | Decisão registrada | Toda decisão técnica relevante tem um ADR em `DECISIONS.md` |
| 3 | Legado explícito | Sistemas existentes documentados em `support/LEGACY_CONTEXT.md` antes de evoluir |
| 4 | Escopo delimitado | Cada módulo documenta o que está dentro e o que está fora do escopo |
| 5 | Pendência visível | Tudo não definido fica como `PEND-NNN` no `REQUIREMENTS.md` — nunca é inventado |
| 6 | Dado com proveniência | Todo dado externo carrega fonte, data de referência e status (atual/histórico/estimado/indisponível) |
| 7 | Regra configurável | Metas, pesos e limites são dados configuráveis, não constantes no código |
| 8 | Dinheiro é decimal | Valores monetários usam tipo decimal no banco e na aplicação; nunca ponto flutuante |

---

## 5. Grafo de Documentos (DAG)

```
PROJECT_CHARTER.md
    │
    ▼
REQUIREMENTS.md ──▶ DECISIONS.md
    │
    ├──▶ specs/DATA_MODEL.md
    ├──▶ specs/API_CONTRACTS.md ──▶ specs/ERROR_CATALOG.md
    ├──▶ specs/UI_SPEC.md
    └──▶ delivery/SCOPE_AGREEMENT.md
    │
    ├──▶ quality/TEST_STRATEGY.md
    ├──▶ quality/ACCEPTANCE_CRITERIA.md
    └──▶ docs/howto/*.md
```

### Documentos transversais (raiz do módulo)

| Documento | Finalidade |
|-----------|------------|
| PROJECT_CHARTER.md | Termo de abertura do projeto |
| REQUIREMENTS.md | Regras de negócio (raiz da DAG) |
| DECISIONS.md | Decisões arquiteturais (ADR) |
| CHANGELOG.md | Histórico de mudanças |

### 5.1 Estrutura de diretórios do módulo (IMP-011)

```
<produto>/
├── PROJECT_CHARTER.md, REQUIREMENTS.md, DECISIONS.md, CHANGELOG.md
├── analysis/     # RN-NNN — <título>/ (Analise-Funcional.md + Analise-Tecnica.md pura — IMP-092)
├── specs/        # DATA_MODEL, API_CONTRACTS, ERROR_CATALOG, UI_SPEC, ARCHITECTURE, SECURITY, ACCEPTANCE_CRITERIA
├── quality/      # TEST_STRATEGY, DEFINITION_OF_DONE, TRACEABILITY, VALIDATION_REPORT, PROPAGATION_STATUS
├── delivery/     # <grupo-do-estilo>/RN-NNN — <título> — Feature.md (IMP-093), SCOPE_AGREEMENT, CLIENT_*
├── support/      # LEGACY_CONTEXT, KNOWN_ERRORS, MIGRATION, CHANGE_REQUESTS
├── glossaries/   # DEV_GLOSSARY, BUSINESS_GLOSSARY, USER_GLOSSARY
├── docs/         # howto/ e documentos auxiliares
└── meetings/     # checkpoints de intake e clarify
```

> **Duas camadas por feature (IMP-092/IMP-093):** a análise vive em `analysis/RN-NNN — <título>/` com exatamente dois arquivos (`RN-NNN — Analise-Funcional.md` e `RN-NNN — Analise-Tecnica.md`, spec técnica pura, sem tasks). O delivery vive no arquivo direto `delivery/<grupo-do-estilo>/RN-NNN — <título> — Feature.md`, com a linha obrigatória `> Análise: ../../analysis/RN-NNN — <título>/`. A análise nunca cita tasks, sprints ou delivery.

---

## 6. Fonte Primária de Dados

| Fonte | Papel |
|---|---|
| Código-fonte e migrations | Verdade sobre o que está implementado |
| `REQUIREMENTS.md` | Verdade sobre a regra de negócio acordada |
| APIs externas | Verdade sobre dado de mercado — sempre com data de referência |
| Documento de especificação do produto | Insumo inicial de escopo (não é verdade após aprovação das RNs) |

---

## 7. Ciclo de Vida dos Documentos

| Status | Significado |
|--------|-------------|
| draft | Em elaboração, pode mudar |
| review | Aguardando revisão |
| approved | Aprovado pelo stakeholder, aguardando implementação |
| active | Vigente, fonte da verdade |
| superseded | Substituído por versão mais recente |
| archived | Não é mais relevante |

---

## 8. Projetos

| Projeto | Repositórios | Status | Início | Última atualização |
|---------|-------------|--------|--------|-------------------|
| InvestmentControl | `ProjetoInvest` | draft | 07/11/2026 | 07/11/2026 |

---

## 9. Papéis e Responsabilidades

| Papel | Responsável | Responsabilidades |
|-------|-------------|-------------------|
| Patrocinador (sponsor) | Proprietário do produto | Aprovação de escopo e prioridades |
| Lead Técnico | Proprietário do produto | Decisões arquiteturais |
| RDD Docente | opencode (IA) | Geração e manutenção dos documentos RDD |

---

## 10. Glossário do Repositório

| Termo | Definição |
|-------|-----------|
| RDD | Requirements, Documentation, Development |
| RN | Regra de Negócio |
| PEND | Pendência a definir |
| ADR | Architecture Decision Record |
| DAG | Directed Acyclic Graph |
| EARS | Easy Approach to Requirements Syntax |
| FII | Fundo de Investimento Imobiliário |
| P/VP | Preço sobre Valor Patrimonial |
| DY | Dividend Yield |
| FGC | Fundo Garantidor de Créditos |

---

## 11. Organização de Delivery e Análise (IMP-092)

> Define onde vivem a análise e as tasks das features e como o delivery é agrupado.
> Editável por projeto; consultada pelo `rdd-task-spec` e pelo `rdd-restructure`.

| Campo | Valor | Descrição |
|-------|-------|-----------|
| `delivery_style` | `release` | Estilo de agrupamento sob `delivery/`: `monthly` (`YYYY-MM`), `sprint` (`YYYY-MM-DD`), `release` (nome livre), `flow` (`backlog`), `horizon` (`now`/`next`/`later`), `epic` (nome do épico), `custom` (`custom_template`) |
| `sprint_weeks` | — | Duração da sprint em semanas (usado somente quando `delivery_style: sprint`) |
| `custom_template` | — | Template de caminho quando `delivery_style: custom` |
| `tracker` | `github` | Sistema de tracking das issues: `github` ou `azure` |

> **Justificativa do `delivery_style: release`:** a especificação do produto já define cinco fases de entrega (Fase 1 a Fase 5). Agrupar o delivery por release (`fase-1`, `fase-2`, ...) mantém rastreabilidade direta entre a fase aprovada, a feature e a issue, sem inventar uma cadência de calendário para um produto de uso pessoal. As features da Fase 1 vivem em `delivery/fase-1/`.
