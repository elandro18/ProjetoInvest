---
project: INVESTMENT CONTROL
module: qualidade
audience: [tecnica]
status: draft
---

# Matriz de Rastreabilidade — Investment Control

> **Atualizado em:** 07/11/2026
> **Escopo:** RN-001 a RN-091 · 91 regras.
> **Legenda:** ✅ coberto por artefato existente · ⏳ previsto, artefato ainda não gerado · — não se aplica

Situação atual da DAG: `DATA_MODEL.md`, `ARCHITECTURE.md`, `API_CONTRACTS.md`, `ERROR_CATALOG.md`, `UI_SPEC.md`, `SECURITY.md`, `COMPLIANCE.md`, `ACCEPTANCE_CRITERIA.md`, `TEST_STRATEGY.md` e `DEFINITION_OF_DONE.md` gerados. Falta a camada de entrega: features e tasks da Fase 1 (`analysis/` + `delivery/`), que é a fila declarada da próxima etapa.

| RN | Tema | DATA_MODEL | API | UI | Situação |
|---|---|---|---|---|---|
| RN-001 | Integração só via backend | ✅ provedor/log | ⏳ todas as rotas | — | ✅ |
| RN-002 | Camada de provedores | ✅ `provedor_dados` | ⏳ `/api/pesquisa` | ⏳ ficha | ✅ |
| RN-003 | Fonte + data de referência | ✅ `historico_*` | ⏳ `/api/pesquisa` | ⏳ ficha | ✅ |
| RN-004 | Status do dado | ✅ `status_dado` | ⏳ | ⏳ badge de status | ✅ |
| RN-005 | Atualização manual/automática | ✅ `log_integracao` | ⏳ refresh | ⏳ botão atualizar | ✅ |
| RN-006 | Histórico armazenado | ✅ `historico_preco`, `historico_indicador` | ⏳ | ⏳ gráficos | ✅ |
| RN-007 | Não executa ordens | — (restrição de escopo) | — | — | ✅ fora do escopo |
| RN-008 | BRL e PT-BR | — | — | ⏳ global | ⏳ |
| RN-009 | Login individual | ✅ `usuario` | ⏳ `/api/auth` | ⏳ `/login` | ✅ |
| RN-010 | Cadastro de ativos | ✅ `ativo` | ⏳ `/api/ativos` | ⏳ `/ativos` | ✅ |
| RN-011 | Classes extensíveis | ✅ `classe_ativo` | ⏳ `/api/ativos` | ⏳ | ✅ |
| RN-012 | Segmentos de FII | ✅ `segmento_ativo` | ⏳ `/api/ativos` | ⏳ | ✅ |
| RN-013 | Ativo inativo | ✅ `ativo.status` | ⏳ `/api/aportes` | ⏳ | ✅ |
| RN-014 | Tipos de movimentação | ✅ `movimentacao.tipo` | ⏳ `/api/movimentacoes` | ⏳ | ✅ |
| RN-015 | Posição derivada | ✅ `posicao_ativo` | ⏳ `/api/carteira` | ⏳ | ✅ |
| RN-016 | Preço médio ponderado | ✅ `posicao_ativo.preco_medio` | ⏳ `/api/carteira` | ⏳ | ✅ |
| RN-017 | Rendimento separado | ✅ `rendimento` | ⏳ `/api/rendimentos` | ⏳ | ✅ |
| RN-018 | Posição negativa | ✅ `movimentacao` | ⏳ validação | ⏳ confirmação | ✅ |
| RN-019 | Consistência do valor total | ✅ CHECKs | ⏳ validação | ⏳ | ✅ |
| RN-020 | Carteira consolidada | ✅ `posicao_ativo` + `investimento_renda_fixa` | ⏳ `/api/carteira` | ⏳ `/carteira` | ✅ |
| RN-021 | Meta por classe = 100% | ✅ `alocacao_meta` | ⏳ `/api/alocacao/metas` | ⏳ `/alocacao` | ✅ |
| RN-022 | Meta por segmento = 100% | ✅ `alocacao_meta` | ⏳ `/api/alocacao/metas` | ⏳ `/alocacao` | ✅ |
| RN-023 | Percentual atual | ✅ derivado de posição | ⏳ `/api/alocacao/desvios` | ⏳ | ✅ |
| RN-024 | Desvio e valor para meta | ✅ derivado | ⏳ `/api/alocacao/desvios` | ⏳ | ✅ |
| RN-025 | Aporte mensal | ✅ `sugestao_aporte` | ⏳ `/api/aportes/sugestao` | ⏳ `/aportes` | ✅ |
| RN-026 | Prioriza classe distante | ✅ `sugestao_aporte` | ⏳ sugestão | ⏳ | ✅ |
| RN-027 | Conteúdo da sugestão | ✅ JSON de sugestão | ⏳ | ⏳ | ✅ |
| RN-028 | Simulador de aportes | — (stateless) | ⏳ `/api/aportes/simulacao` | ⏳ | ⏳ |
| RN-029 | Pesquisa por ticker | ✅ `ativo`, `historico_*` | ⏳ `/api/pesquisa` | ⏳ `/pesquisa` | ✅ |
| RN-030 | Capacidades do provedor | ✅ `provedor_dados.capacidades` | ⏳ | ⏳ | ✅ |
| RN-031 | Dados CVM | ✅ `historico_indicador` | ⏳ importação | ⏳ | ✅ |
| RN-032 | Importação histórica CVM | ✅ `historico_*` | ⏳ job | ⏳ | ✅ |
| RN-033 | Dados de mercado | ✅ `historico_preco` | ⏳ | ⏳ | ✅ |
| RN-034 | Limites e custo do provedor | ✅ `provedor_dados` | ⏳ | ⏳ configurações | ✅ |
| RN-035 | Ficha do FII | ✅ `historico_*`, `ativo` | ⏳ | ⏳ `/ativos/[ticker]` | ✅ |
| RN-036 | Fonte e data na ficha | ✅ `coletado_em` | ⏳ | ⏳ | ✅ |
| RN-037 | Histórico de consultas e cache | ✅ `log_integracao` | ⏳ | ⏳ | ✅ |
| RN-038 | Cache não é tempo real | ✅ `coletado_em` | ⏳ | ⏳ | ✅ |
| RN-039 | Critérios de qualidade | ✅ `criterio_avaliacao` | ⏳ `/api/avaliacoes` | ⏳ | ✅ |
| RN-040 | Pontuação e pesos | ✅ `criterio_avaliacao` | ⏳ | ⏳ | ✅ |
| RN-041 | Conteúdo da avaliação | ✅ `avaliacao_ativo` | ⏳ | ⏳ | ✅ |
| RN-042 | Sem nota sem dado | ✅ `nota` nullable | ⏳ | ⏳ | ✅ |
| RN-043 | P/VP sem inferência | ✅ `avaliacao_ativo` | ⏳ | ⏳ | ✅ |
| RN-044 | Fatores de desconto | ✅ `justificativa` | ⏳ | ⏳ | ✅ |
| RN-045 | Sustentabilidade dos dividendos | ✅ `historico_indicador` | ⏳ | ⏳ | ✅ |
| RN-046 | Alerta de distribuição | ✅ JSON de sugestão/avaliação | ⏳ | ⏳ | ⏳ |
| RN-047 | Não repetir último dividendo | — (regra de cálculo) | — | ⏳ projeções | ⏳ |
| RN-048 | Watchlist | ✅ `watchlist` | ⏳ `/api/watchlist` | ⏳ | ✅ |
| RN-049 | Concentração | ✅ `limite_concentracao` (extensão) | ⏳ `/api/risco` | ⏳ | ✅ |
| RN-050 | Checklist antes de sugerir | ✅ `sugestao_aporte` | ⏳ sugestão | ⏳ | ✅ |
| RN-051 | Classificação do candidato | ✅ `ativos_avaliados` | ⏳ | ⏳ | ✅ |
| RN-052 | Histórico de sugestões | ✅ `sugestao_aporte` | ⏳ | ⏳ | ✅ |
| RN-053 | Decisão do usuário | ✅ `decisao_usuario` | ⏳ | ⏳ | ✅ |
| RN-054 | Rebalancear por aporte | — (regra) | ⏳ | ⏳ | ⏳ |
| RN-055 | Não recomendar por P/VP | — (regra) | ⏳ | ⏳ | ⏳ |
| RN-056 | Não recomendar por DY | — (regra) | ⏳ | ⏳ | ⏳ |
| RN-057 | Cadastro de renda fixa | ✅ `investimento_renda_fixa` | ⏳ `/api/renda-fixa` | ⏳ | ✅ |
| RN-058 | Alertas de renda fixa | ✅ `investimento_renda_fixa` | ⏳ `/api/renda-fixa/alertas` | ⏳ | ⏳ |
| RN-059 | Status do saldo | ✅ `status_saldo` | ⏳ | ⏳ | ✅ |
| RN-060 | Integração futura de indicadores | — (fase posterior) | — | — | ✅ fora da Fase 1 |
| RN-061 | Painel principal | ✅ derivado | ⏳ `/api/dashboard` | ⏳ `/dashboard` | ⏳ |
| RN-062 | Gráficos | ✅ derivado | ⏳ `/api/carteira/evolucao` | ⏳ | ⏳ |
| RN-063 | Painel de oportunidades | ✅ derivado | ⏳ | ⏳ | ⏳ |
| RN-064 | Simulador patrimonial | — (stateless) | ⏳ `/api/projecoes` | ⏳ `/projecoes` | ⏳ |
| RN-065 | Projeção de renda | — (stateless) | ⏳ | ⏳ | ⏳ |
| RN-066 | Comparação de cenários | — (stateless) | ⏳ | ⏳ | ⏳ |
| RN-067 | Rotas privadas | ✅ `usuario` | ⏳ middleware | ⏳ | ✅ |
| RN-068 | Segredos em ambiente | — (config) | — | — | ✅ |
| RN-069 | Validação de entrada | — | ⏳ Zod em todas as rotas | ⏳ | ⏳ |
| RN-070 | Isolamento por usuário | ✅ `usuario_id` | ⏳ | — | ✅ |
| RN-071 | Hash de senha | ✅ `senha_hash` | — | — | ✅ |
| RN-072 | Erro de provedor | ✅ `log_integracao` | ⏳ | ⏳ | ✅ |
| RN-073 | Dados locais na indisponibilidade | ✅ `historico_*` | ⏳ | ⏳ | ✅ |
| RN-074 | Rastreabilidade de integração | ✅ `log_integracao` | ⏳ | ⏳ | ✅ |
| RN-075 | Qualidade > rendimento | — (regra de avaliação) | — | ⏳ | ⏳ |
| RN-076 | Toda sugestão com motivo | ✅ `justificativas` | ⏳ | ⏳ | ✅ |
| RN-077 | Dado ausente não é positivo | ✅ `dados_indisponiveis` | ⏳ | ⏳ | ✅ |
| RN-078 | Decisão final do usuário | ✅ `decisao_usuario` | ⏳ | ⏳ | ✅ |
| RN-079 | Dividendos para reinvestimento | ✅ `rendimento` | ⏳ | ⏳ | ⏳ |
| RN-080 | Inflação e real/nominal | — (cálculo) | ⏳ | ⏳ | ⏳ |
| RN-081 | Sem promessa de rentabilidade | — | — | ⏳ aviso | ⏳ |
| RN-082 | Regras configuráveis | ✅ `alocacao_meta`, `criterio_avaliacao`, `limite_concentracao` | ⏳ | ⏳ configurações | ✅ |
| RN-083 | Fase 1 apenas | — (escopo) | — | — | ✅ |
| RN-084 | Modelo normalizado | ✅ modelo | — | — | ✅ |
| RN-085 | Cadastro aberto com verificação | ✅ `usuario.status_conta`, `token_conta` | ✅ `/api/auth/cadastro`, `/verificar-email` | ✅ `/cadastro`, `/verificar-email` | ✅ |
| RN-086 | Redefinição de senha | ✅ `token_conta` | ✅ `/api/auth/esqueci-senha`, `/redefinir-senha` | ✅ `/esqueci-senha`, `/redefinir-senha` | ✅ |
| RN-087 | Aceite legal versionado | ✅ `aceite_legal` | ✅ `/api/auth/cadastro` | ✅ `/cadastro` | ✅ |
| RN-088 | Encerramento de conta | ✅ `usuario.status_conta`, `excluido_em` | ✅ `DELETE /api/conta` | ✅ `/conta` | ✅ |
| RN-089 | Base de cálculo da alocação | ✅ derivado (patrimônio total) | ✅ `/api/alocacao/desvios` | ✅ `/alocacao` | ✅ |
| RN-090 | Tolerância de 0,5 p.p. | ✅ derivado | ✅ `/api/alocacao/desvios` | ✅ `/alocacao` | ✅ |
| RN-091 | Ativo sem cotação | ✅ derivado (custo) | ✅ `/api/carteira` | ✅ `/carteira` | ✅ |

---

## Cobertura por artefato

| Artefato | Cobertura | Observação |
|---|---|---|
| `specs/DATA_MODEL.md` | 69 de 91 RNs com tabela/coluna associada | 22 RNs são regras de cálculo, escopo ou apresentação sem reflexo direto de schema |
| `specs/ARCHITECTURE.md` | 12 RNs estruturais | Camadas, provedores, autenticação, deploy |
| `specs/API_CONTRACTS.md` | 68 de 91 RNs com endpoint associado | 23 RNs são restrições de cálculo/escopo sem superfície própria |
| `specs/ERROR_CATALOG.md` | 28 RNs com erro mapeado | Cobertura por condição de falha |
| `specs/UI_SPEC.md` | 80 de 91 RNs com tela/componente | Todas as telas da Fase 1 a Fase 5 especificadas |
| `specs/SECURITY.md` | 11 RNs de segurança | Inclui RN-085 a RN-088 |
| `specs/COMPLIANCE.md` | 10 eixos LGPD | 2 eixos ainda pendentes (base legal, governança) |
| `quality/ACCEPTANCE_CRITERIA.md` | 91 de 91 RNs + 8 eventos críticos | 99 critérios |
| `quality/TEST_STRATEGY.md` | 11 grupos de RN | Casos de ouro G1–G15 |
| `quality/DEFINITION_OF_DONE.md` | — | DoD de task, feature e release |
| `delivery/` (features e tasks) | 52 de 91 | 8 features da Fase 1 geradas; fases 2–5 ainda sem feature (fora do escopo aprovado) |

> **Portão de cobertura (IMP-046):** o lote de 91 RNs está coberto pela camada de tradução técnica e as RNs da Fase 1 têm feature e tasks. Permanecem sem entrega apenas as RNs das fases 2–5, por decisão de escopo (RN-083), não por lacuna documental.

---

## Estado de implementação — Fase 1 (09/11/2026)

| Feature | Tasks | Situação | Evidência |
|---|---:|---|---|
| RN-001 — Fundação técnica | 7 | ✅ exceto `RN-001-5` (deploy, sem credenciais) | 3 migrations base, CI com 2 jobs, audit com allowlist |
| RN-085 — Conta e autenticação | 9 | ✅ | 2 migrations, 9 rotas, E2E de conta |
| RN-010 — Cadastro de ativos | 7 | ✅ | migration `ativos`, 4 endpoints, E2E de ativos |
| RN-014 — Movimentações e posição | 6 | ✅ | 2 migrations, G1–G7 verdes, E2E de movimentações |
| RN-057 — Renda fixa | 5 | ✅ | migration `renda_fixa`, 4 endpoints, E2E de renda fixa |
| RN-021 — Metas de alocação | 5 | ✅ | migration `alocacao_meta`, 3 endpoints, E2E de alocação |
| RN-020 — Carteira consolidada | 5 | ✅ | 2 endpoints + `posicoes`, E2E com carga de 50×500 |
| RN-061 — Dashboard | 5 | ✅ | endpoint agregado, 4 gráficos, E2E de dashboard |
| **Total** | **49** | **48 concluídas, 1 pendente** | 763 testes · 52 E2E · cobertura 86,17% |

> Implementação consolidada na branch `feature/fase-1` (26 commits, 320 arquivos). Não publicada: sem PR, merge ou deploy em 09/11/2026.
> Pendências de produção em `delivery/HANDOVER_LOG.md` §5.
