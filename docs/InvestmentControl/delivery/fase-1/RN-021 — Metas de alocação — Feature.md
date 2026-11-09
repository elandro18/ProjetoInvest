---
project: INVESTMENT CONTROL
module: alocacao
audience: [tecnica]
status: draft
---

# RN-021 — Metas de alocação

> Gerado por rdd-doc em 07/11/2026. Edite para revisar.
> Análise: ../../analysis/RN-021 — Metas de alocação/
> Após revisão, use o workflow de issues para criar as tarefas no sistema de tracking.
> **✅ Implementado em 09/11/2026** (Fase 1).

## Issue principal

| Campo | Valor |
|---|---|
| Título | `RN-021 — Metas de alocação` |
| Tracking ID | — (a criar) |
| Módulo | InvestmentControl |
| Milestone | Fase 1 |
| Repositórios | `elandro18/ProjetoInvest` |

## Resumo das tasks

| Task | Tipo | Repo | Descrição |
|---|---|---|---|
| RN-021-1 | Database | ProjetoInvest | Criar `alocacao_meta` e seeds 50/50 + segmentos |
| RN-021-2 | Backend | ProjetoInvest | Implementar leitura e substituição de metas com vigência |
| RN-021-3 | Backend | ProjetoInvest | Implementar cálculo de desvios |
| RN-021-4 | Frontend | ProjetoInvest | Implementar tela de alocação |
| RN-021-5 | Backend | ProjetoInvest | Testes de soma, vigência e desvio |

## Ordem de Execução

**Wave 1 — Banco:**
RN-021-1

**Wave 2 — Backend:**
RN-021-2 → RN-021-3

**Wave 3 — Frontend:**
RN-021-4

**Wave 4 — Qualidade:**
RN-021-5

---

### RN-021-1. Criar tabela de metas e seeds

| Campo | Valor |
|---|---|
| **Título** | `[Database] RN-021-1 — Criar alocacao_meta e seeds da estratégia 50/50` |
| **Activity** | Development |
| **RNs** | RN-021, RN-022, RN-082 |

**Descrição:**
Criar `alocacao_meta` com escopo, referência exclusiva (classe ou segmento), percentual e vigência; e o seed da estratégia inicial (50/50 e distribuição de segmentos).

**Tabelas de referência:**

| Tabela | Coluna alvo | Uso |
|---|---|---|
| `alocacao_meta` | `escopo`, `classe_id`, `segmento_id`, `percentual`, `vigencia_inicio`, `vigencia_fim` | Estratégia versionada |

```sql
CREATE TYPE escopo_meta AS ENUM ('CLASSE','SEGMENTO');

CREATE TABLE alocacao_meta (
  id uuid PRIMARY KEY,
  usuario_id uuid NOT NULL REFERENCES usuario(id) ON DELETE RESTRICT,
  escopo escopo_meta NOT NULL,
  classe_id uuid REFERENCES classe_ativo(id),
  segmento_id uuid REFERENCES segmento_ativo(id),
  percentual numeric(9,6) NOT NULL CHECK (percentual >= 0 AND percentual <= 100),
  vigencia_inicio date NOT NULL,
  vigencia_fim date,
  criado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_meta_referencia CHECK (
    (escopo = 'CLASSE' AND classe_id IS NOT NULL AND segmento_id IS NULL) OR
    (escopo = 'SEGMENTO' AND segmento_id IS NOT NULL AND classe_id IS NULL)
  )
);
CREATE INDEX ix_meta_usuario_escopo ON alocacao_meta (usuario_id, escopo, vigencia_inicio DESC);
```

Seed: Renda Fixa 50%, FII 50%; segmentos Logística 25, Shopping 15, Renda Urbana e Híbridos 15, Recebíveis 25, Lajes 10, Agro 5, Caixa e Oportunidades 5.

**Validações / Erros:**
- `ALO_META_DUPLICADA` → 422.
- `ALO_SOMA_METAS_INVALIDA` → 422 (domínio).

**Critério de Aceitação:**
- Dado o seed, Quando consulto as metas, Então a soma por escopo é 100.
- Dado escopo CLASSE com `segmento_id`, Quando insiro, Então o CHECK falha.

**Dependências:** RN-001-2, RN-085-1

---

### RN-021-2. Implementar leitura e substituição de metas

| Campo | Valor |
|---|---|
| **Título** | `[ProjetoInvest] RN-021-2 — Implementar leitura e substituição de metas` |
| **Activity** | Development |
| **RNs** | RN-021, RN-022, RN-082 |

**Descrição:**
Implementar `GET /api/alocacao/metas` (vigente + histórico) e `PUT /api/alocacao/metas` que encerra a vigência anterior e grava o novo conjunto em transação, validando soma 100 por escopo e referências ativas.

**Contrato:**

```
GET /api/alocacao/metas
Response 200: { "vigente": { "classe": [...], "segmento": [...], "vigenciaInicio": "date" }, "historico": [] }

PUT /api/alocacao/metas
Request: { "classe": [ { "referenciaId": "uuid", "percentual": "50.000000" } ], "segmento": [ { "referenciaId": "uuid", "percentual": "25.000000" } ] }
Response 200: { "vigente": { ... } }
```

**Validações / Erros:**
- `ALO_SOMA_METAS_INVALIDA` → 422 com `details.escopo` e `details.soma`.
- `ALO_REFERENCIA_INVALIDA` → 422.
- `ALO_META_DUPLICADA` → 422.

**Critério de Aceitação:**
- Dado 60% + 30%, Quando salvo, Então recebo 422 com soma 90.
- Dado um novo conjunto válido, Quando salvo, Então o anterior recebe `vigencia_fim` e o histórico o mantém.
- Dado referência inexistente, Quando salvo, Então recebo 422.

**Dependências:** RN-021-1, RN-085-4

---

### RN-021-3. Implementar cálculo de desvios

| Campo | Valor |
|---|---|
| **Título** | `[ProjetoInvest] RN-021-3 — Implementar cálculo de desvios de alocação` |
| **Activity** | Development |
| **RNs** | RN-023, RN-024, RN-089 |

**Descrição:**
Implementar `GET /api/alocacao/desvios` calculando percentual atual por classe e segmento sobre o patrimônio total, classificação (ABAIXO/ACIMA/DENTRO) com tolerância configurável e valor em reais para atingir a meta.

**Contrato:**

```
GET /api/alocacao/desvios
Response 200: { "baseCalculo": "PATRIMONIO_TOTAL", "itens": [ { "escopo", "codigo", "percentualAtual", "percentualMeta", "desvioPontos", "valorParaMeta", "situacao" } ] }
```

**Validações / Erros:**
- Sem metas → `ALO_METAS_AUSENTES` (409).
- Sem patrimônio → itens com `situacao: "SEM_DADOS"`, sem inventar −100%.

**Critério de Aceitação:**
- Dado G8 (40% RF / 60% FII), Quando calculo, Então RF está ABAIXO com −10 p.p. e FII ACIMA com +10 p.p.
- Dado meta de segmento, Quando calculo, Então a base é o patrimônio total (RN-089).
- Dado tolerância de 0,5 p.p., Quando o desvio é 0,3, Então a situação é DENTRO.

**Dependências:** RN-021-2, RN-014-4, RN-057-2

---

### RN-021-4. Implementar tela de alocação

| Campo | Valor |
|---|---|
| **Título** | `[ProjetoInvest] RN-021-4 — Implementar tela de alocação` |
| **Activity** | Development |
| **RNs** | RN-021 a RN-024, RN-082 |

**Descrição:**
Implementar `/alocacao` conforme `UI_SPEC.md` §9: dois blocos de metas com soma em tempo real, botão desabilitado quando a soma ≠ 100 e tabela de desvios com badge de situação.

**Critério de Aceitação:**
- Dado que edito uma meta para 60%, Quando a soma fica 110%, Então o botão desabilita e informa "Excede 10,0 p.p.".
- Dado desvio negativo, Quando exibo, Então há texto "abaixo" além da cor.
- Dado alteração de meta em uso, Quando salvo, Então há confirmação explicando o impacto.

**Dependências:** RN-021-2, RN-021-3

---

### RN-021-5. Testes de soma, vigência e desvio

| Campo | Valor |
|---|---|
| **Título** | `[ProjetoInvest] RN-021-5 — Testes de soma, vigência e desvio` |
| **Activity** | Development |
| **RNs** | RN-021 a RN-024, RN-089 |

**Descrição:**
Cobrir soma inválida por escopo, versionamento, substituição atômica, classificação e base de cálculo do segmento, além de G8 e G11.

**Critério de Aceitação:**
- Dado G11 (60% + 30%), Quando salvo, Então recebo erro com soma 90 e nada é gravado.
- Dado duas configurações sucessivas, Quando consulto o histórico, Então ambas estão presentes com vigência correta.
- Dado RN-089, Quando calculo segmento, Então o denominador é o patrimônio total.

**Dependências:** RN-021-2, RN-021-3, RN-021-4
