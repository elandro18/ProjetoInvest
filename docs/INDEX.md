# INDEX — ProjetoInvest

> **Manifesto de navegação do repositório** (padrão IMP-012).
> Contém apenas invariáveis: identidade, mapa de caminhos e desambiguação.
> Estado volátil (fase, pendências, status) → `@rdd-next` / `HANDOVER_LOG`.
> Atualizar somente quando a estrutura do repositório mudar.

## Identidade

| Campo | Valor |
|---|---|
| Sigla | ProjetoInvest |
| Constituição | CONSTITUTION.md |
| Remote | `elandro18/ProjetoInvest` |
| Cliente | Uso pessoal (proprietário do produto) |

## Mapa de Projetos

| Projeto | Caminho | Repos | Status |
|---------|---------|-------|--------|
| InvestmentControl | `InvestmentControl/` | `ProjetoInvest` | draft |

## Estrutura Padrão por Projeto

```
<projeto>/
├── PROJECT_CHARTER.md      # Termo de abertura
├── REQUIREMENTS.md         # Regras de negócio (raiz da DAG)
├── DECISIONS.md            # Decisões arquiteturais (ADR)
├── CHANGELOG.md            # Histórico de mudanças
├── analysis/               # Análise por feature — analysis/RN-NNN — <título>/
├── specs/                  # Artefatos técnicos (dados, API, UI, arquitetura, segurança)
├── quality/                # Qualidade, rastreabilidade e critérios de aceite
├── delivery/               # Entrega — delivery/<grupo>/RN-NNN — <título> — Feature.md
├── support/                # Suporte, erros conhecidos, migração, change requests
├── glossaries/             # Glossários DEV, BUSINESS e USER
├── docs/                   # Documentação auxiliar (howto/)
└── meetings/               # Checkpoints de sessões
```

## Desambiguação

- **`docs/expecificaçoes.md`** é o documento de especificação original fornecido pelo proprietário. Ele é insumo histórico, **não** é a fonte da verdade após a aprovação das RNs em `InvestmentControl/REQUIREMENTS.md`.
- **`index.html`** na raiz do repositório é um placeholder do GitHub Pages e não faz parte da aplicação.

## Fora da DAG

- `CONSTITUTION.md` — governança compartilhada de todos os projetos
- `INDEX.md` — este manifesto
