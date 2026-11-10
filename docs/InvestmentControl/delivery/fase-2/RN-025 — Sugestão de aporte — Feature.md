---
project: INVESTMENT CONTROL
module: aportes
audience: [tecnica]
status: draft
---

# RN-025 — Sugestão de aporte

> Gerado por rdd-doc em 10/11/2026. Edite para revisar.
> Análise: ../../analysis/RN-025 — Sugestão de aporte/
> Após revisão, use o workflow de issues para criar as tarefas no sistema de tracking.

## Issue principal

| Campo | Valor |
|---|---|
| Título | `RN-025 — Sugestão de aporte` |
| Tracking ID | — (a criar) |
| Módulo | InvestmentControl |
| Milestone | Fase 2 |
| Repositórios | `elandro18/ProjetoInvest` |

## Resumo das tasks

| Task | Tipo | Repo | Descrição |
|---|---|---|---|
| RN-025-1 | Database | ProjetoInvest | Criar tabela `sugestao_aporte` e enum de decisão |
| RN-025-2 | Backend | ProjetoInvest | Implementar motor de priorização por gap (water-filling) |
| RN-025-3 | Backend | ProjetoInvest | Implementar checklist e classificação dos candidatos |
| RN-025-4 | Backend | ProjetoInvest | Implementar criação e persistência da sugestão |
| RN-025-5 | Backend | ProjetoInvest | Implementar registro da decisão do usuário |
| RN-025-6 | Frontend | ProjetoInvest | Implementar tela de aportes com sugestão e decisões |
| RN-025-7 | Backend | ProjetoInvest | Testes unitários e E2E da sugestão |

## Ordem de Execução

**Wave 1 — Banco:**
RN-025-1

**Wave 2 — Motor:**
RN-025-2 → RN-025-3

**Wave 3 — API:**
RN-025-4 → RN-025-5

**Wave 4 — Frontend:**
RN-025-6

**Wave 5 — Qualidade:**
RN-025-7

---

### RN-025-1. Criar tabela de sugestões de aporte

| Campo | Valor |
|---|---|
| **Título** | `[Database] RN-025-1 — Criar tabela sugestao_aporte e enum de decisão` |
| **Activity** | Development |
| **RNs** | RN-025, RN-052, RN-053 |

**Descrição:**
Criar a tabela de sugestões com snapshot imutável da carteira, distribuição sugerida, ativos avaliados, justificativas, alertas e decisão do usuário.

**Tabelas de referência:**

| Tabela | Coluna alvo | Uso |
|---|---|---|
| `sugestao_aporte` | `usuario_id`, `valor_disponivel`, `distribuicao_atual`, `distribuicao_sugerida`, `ativos_avaliados`, `justificativas`, `alertas`, `decisao_usuario` | Histórico da sugestão |

```sql
CREATE TYPE decisao_usuario AS ENUM ('ACEITA','IGNORADA','ALTERADA');

CREATE TABLE sugestao_aporte (
  id uuid PRIMARY KEY,
  usuario_id uuid NOT NULL REFERENCES usuario(id) ON DELETE RESTRICT,
  data timestamptz NOT NULL DEFAULT now(),
  valor_disponivel numeric(18,2) NOT NULL CHECK (valor_disponivel > 0),
  distribuicao_atual jsonb NOT NULL,
  distribuicao_sugerida jsonb NOT NULL,
  ativos_avaliados jsonb NOT NULL DEFAULT '[]',
  justificativas jsonb NOT NULL DEFAULT '[]',
  alertas jsonb NOT NULL DEFAULT '[]',
  decisao_usuario decisao_usuario,
  decisao_em timestamptz
);
CREATE INDEX ix_sug_usuario_data ON sugestao_aporte (usuario_id, data DESC);
```

**Validações / Erros:**
- `APORTE_VALOR_INVALIDO` 422 (valor ≤ 0).
- `APORTE_DECISAO_INVALIDA` 422 (decisão fora do enum).

**Critério de Aceitação:**
- Dado valor 0, Quando insiro, Então o CHECK falha.
- Dado decisão `ACEITA`, Quando atualizo, Então `decisao_em` é preenchido.

**Dependências:** RN-001-2

---

### RN-025-2. Implementar motor de priorização por gap

| Campo | Valor |
|---|---|
| **Título** | `[ProjetoInvest] RN-025-2 — Implementar motor de priorização por gap` |
| **Activity** | Development |
| **RNs** | RN-025, RN-026, RN-027, RN-054 |

**Descrição:**
Implementar em `src/modules/aportes/` o cálculo puro da distribuição:

- total pós-aporte = total atual + valor;
- gap por classe = `meta% × totalPós − valorAtual` (positivo = abaixo da meta);
- **water-filling**: ordenar por gap desc (desempate por código asc) e alocar `min(restante, gap)` em cada classe;
- se sobrar valor (nenhum gap positivo restante), distribuir proporcionalmente às metas;
- dentro da parcela de FII, repetir o water-filling por segmento usando `meta% × totalPós − valorAtualSegmento`, limitado à parcela de FII;
- arredondar em 2 casas e jogar o resíduo na maior linha, garantindo que a soma das classes e dos segmentos equivale ao valor exato;
- gerar justificativa por linha (ex.: "Renda fixa está 9,96 p.p. abaixo da meta e recebe R$ 1.000,00").

**Critério de Aceitação:**
- Dado RF 35% / FII 65% e aporte de R$ 1.000, Quando calculo, Então 100% vai para RF (não 50/50).
- Dado RF 40% / FII 60% e aporte de R$ 2.000, Quando calculo, Então a soma das classes é exatamente R$ 2.000,00.
- Dado carteira vazia e metas 50/50, Quando calculo, Então a divisão é 50/50.
- Dado todas as classes na meta, Quando calculo, Então a distribuição segue a proporção da meta.
- Dado FII recebendo R$ 500, Quando distribuo segmentos, Então a soma dos segmentos é R$ 500,00.

**Dependências:** RN-025-1, RN-021-3

**Notas técnicas:**
- Domínio puro, sem Prisma/next; usa `Decimal`.
- O motor recebe os valores e metas já carregados (porta separada).

---

### RN-025-3. Implementar checklist e classificação dos candidatos

| Campo | Valor |
|---|---|
| **Título** | `[ProjetoInvest] RN-025-3 — Implementar checklist e classificação dos candidatos` |
| **Activity** | Development |
| **RNs** | RN-050, RN-051, RN-055, RN-056 |

**Descrição:**
Para cada ativo ativo (status `ATIVO`) da carteira, rodar o checklist de oito verificações e classificar:

```json
"checklist": {
  "classeAbaixoMeta": true,
  "segmentoAbaixoMeta": true,
  "ativoJaNaCarteira": false,
  "aumentaConcentracao": "SIM | NAO | INDISPONIVEL",
  "dadosSuficientes": "SIM | NAO | INDISPONIVEL",
  "atendeQualidade": "SIM | NAO | INDISPONIVEL",
  "alertaRelevante": false,
  "precoDentroParametros": "SIM | NAO | INDISPONIVEL"
}
```

- `aumentaConcentracao` usa RN-049; sem limite configurado → `INDISPONIVEL`;
- `dadosSuficientes` e `precoDentroParametros` → `INDISPONIVEL` até a Fase 3;
- `atendeQualidade` → `INDISPONIVEL` até a Fase 4;
- RN-055/RN-056: nunca classificar como apto **apenas** por P/VP ou DY (dados indisponíveis hoje, regra registrada para quando existirem).

Classificação (`RN-051`):
- `ABAIXO_META_APTO_PARA_ESTUDO` — classe e segmento abaixo e sem risco conhecido;
- `ABAIXO_META_COM_RISCOS` — abaixo, mas com alerta de concentração ou ativo inativo;
- `DENTRO_META` — desvio dentro de 0,5 p.p.;
- `ACIMA_META` — acima da meta;
- `SEM_DADOS_SUFICIENTES` — ativo inativo ou sem classe/segmento.

**Critério de Aceitação:**
- Dado FII abaixo da meta e sem limite configurado, Quando avalio, Então `aumentaConcentracao: INDISPONIVEL` e classificação `ABAIXO_META_APTO_PARA_ESTUDO`.
- Dado ativo que ultrapassa o limite, Quando avalio, Então `ABAIXO_META_COM_RISCOS`.
- Dado ativo inativo, Quando avalio, Então `SEM_DADOS_SUFICIENTES`.
- Dado classe dentro de 0,5 p.p., Quando avalio, Então `DENTRO_META`.

**Dependências:** RN-025-2, RN-049-3

---

### RN-025-4. Implementar criação e persistência da sugestão

| Campo | Valor |
|---|---|
| **Título** | `[ProjetoInvest] RN-025-4 — Implementar criação e persistência da sugestão` |
| **Activity** | Development |
| **RNs** | RN-025, RN-027, RN-052 |

**Descrição:**
Implementar `POST /api/aportes/sugestao`, que carrega carteira, metas, desvios, limites e ativos, roda o motor e o checklist, e persiste o snapshot completo.

**Contrato:**

```
POST /api/aportes/sugestao
Request: { "valorDisponivel": "1000.00", "data": "2026-11-10" }
Response 201: {
  "id": "uuid",
  "data": "2026-11-10T12:00:00Z",
  "valorDisponivel": "1000.00",
  "distribuicaoAtual": { "classe": [], "segmento": [] },
  "distribuicaoSugerida": {
    "classe": [ { "codigo": "RENDA_FIXA", "valor": "1000.00", "justificativa": "..." } ],
    "segmento": [ { "codigo": "LOGISTICA", "valor": "250.00", "justificativa": "..." } ]
  },
  "ativosAvaliados": [ { "ativoId": "uuid", "ticker": "HGLG11", "nome": "...", "classe": "FII", "segmento": "LOGISTICA", "classificacao": "ABAIXO_META_APTO_PARA_ESTUDO", "checklist": { }, "motivos": [] } ],
  "justificativas": [ "..." ],
  "alertas": []
}
```

**Validações / Erros:**
- `APORTE_VALOR_INVALIDO` 422 (valor ≤ 0 ou inválido).
- `APORTE_DADOS_INSUFICIENTES` 409 apenas quando não houver nem classes/segmentos no catálogo.
- Metas ausentes: criar os defaults (a RN-021 já faz lazy) — não retornar 409.

**Critério de Aceitação:**
- Dado aporte válido, Quando crio, Então a sugestão é persistida e devolvida com id.
- Dado valor 0, Quando crio, Então recebo 422 e nada é gravado.
- Dado usuário A, Quando crio, Então o registro tem `usuario_id` de A.
- Dado resposta, Quando inspeciono, Então não há `senha`/`token` nem dado de outro usuário.

**Dependências:** RN-025-3

---

### RN-025-5. Implementar registro da decisão do usuário

| Campo | Valor |
|---|---|
| **Título** | `[ProjetoInvest] RN-025-5 — Implementar registro da decisão do usuário` |
| **Activity** | Development |
| **RNs** | RN-053 |

**Descrição:**
Implementar `PATCH /api/aportes/{id}/decisao` com `decisao` (`ACEITA`, `IGNORADA`, `ALTERADA`) e `observacoes` opcional. A sugestão nunca é apagada; a decisão é registrada com data.

**Contrato:**

```
PATCH /api/aportes/{id}/decisao
Request: { "decisao": "ACEITA", "observacoes": "vou aportar metade" }
Response 200: { "id": "uuid", "decisaoUsuario": "ACEITA", "decisaoEm": "2026-11-10T12:05:00Z" }
```

**Validações / Erros:**
- `APORTE_NAO_ENCONTRADO` 404 (inexistente ou de outro usuário).
- `APORTE_DECISAO_INVALIDA` 422 (valor fora do enum).
- Decisão já registrada → permite sobrescrever com `decisao_em` atualizado (documentar).

**Critério de Aceitação:**
- Dado sugestão de A, Quando A registra `ACEITA`, Então o registro é atualizado.
- Dado usuário B, Quando tenta decidir a sugestão de A, Então recebe 404.
- Dado decisão inválida, Quando envio, Então recebo 422.

**Dependências:** RN-025-4

---

### RN-025-6. Implementar tela de aportes

| Campo | Valor |
|---|---|
| **Título** | `[ProjetoInvest] RN-025-6 — Implementar tela de aportes` |
| **Activity** | Development |
| **RNs** | RN-025, RN-026, RN-027, RN-051 |

**Descrição:**
Implementar `/aportes` conforme `UI_SPEC.md` §10: campo de valor com atalhos (500/1.000/1.500/2.000), geração da sugestão, distribuição por classe e segmento, ativos para estudar com classificação e checklist, justificativas e alertas. Ações **Aceitar**, **Ignorar** e **Alterar** registram a decisão. Estado sem metas orienta para `/alocacao`; carteira vazia orienta cadastro.

**Critério de Aceitação:**
- Dado valor 1.000 e RF abaixo da meta, Quando gero, Então a tela mostra 100% para RF com a justificativa.
- Dado ativo sem limite de concentração, Quando exibo o checklist, Então o item aparece "não avaliado", não "ok".
- Dado clique em "Ignorar", Quando confirmo, Então a decisão é registrada e a sugestão permanece.
- Dado 360 px, Quando abro, Então não há overflow.

**Dependências:** RN-025-4, RN-025-5

---

### RN-025-7. Testes unitários e E2E da sugestão

| Campo | Valor |
|---|---|
| **Título** | `[ProjetoInvest] RN-025-7 — Testes unitários e E2E da sugestão` |
| **Activity** | Development |
| **RNs** | RN-025, RN-026, RN-050, RN-051, RN-053, RN-054 |

**Descrição:**
Cobrir o motor (priorização, soma exata, carteira vazia, todas na meta, segmentos), checklist (indisponíveis, concentração, inativo), classificação (5 estados), persistência e decisão. E2E: gerar sugestão, conferir distribuição e justificativa, aceitar/ignorar, isolamento A/B e 360 px.

**Critério de Aceitação:**
- Dado o conjunto de testes, Quando executo, Então os cinco estados de classificação e os oito itens do checklist são exercitados.
- Dado A e B, Quando B tenta decidir a sugestão de A, Então 404.

**Dependências:** RN-025-4, RN-025-5, RN-025-6
