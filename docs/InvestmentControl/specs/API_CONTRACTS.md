---
project: INVESTMENT CONTROL
module: api
audience: [tecnica]
status: draft
---

# Contratos de API — Investment Control

> **Derivado de:** `REQUIREMENTS.md` (RN-001 a RN-088), `specs/DATA_MODEL.md`, `specs/ARCHITECTURE.md` §6.
> **Formato:** REST/JSON sobre Route Handlers do Next.js.

---

## 1. Convenções gerais

| Aspecto | Regra |
|---|---|
| Base | `/api` |
| Versão | Sem prefixo de versão na Fase 1; mudança incompatível exige `/api/v2` e período de convivência |
| Autenticação | Sessão por cookie `httpOnly`; endpoints públicos marcados como `público` |
| Content-Type | `application/json; charset=utf-8` |
| Datas | `YYYY-MM-DD` para data de negócio; ISO 8601 UTC para timestamp |
| Valores monetários | string decimal com 2 casas (`"1234.56"`) |
| Quantidades | string decimal com até 8 casas (`"150.00000000"`) |
| Percentuais | string decimal com até 6 casas (`"12.500000"` = 12,5%) |
| IDs | UUID v4 |
| Paginação | `?page=1&pageSize=20` (máx. 100); resposta com `meta` |
| Ordenação | `?sort=campo&order=asc\|desc`, allowlist por recurso |
| Erro | `{ "error": { "code", "message", "details"? } }` — catálogo em `ERROR_CATALOG.md` |
| Idempotência | `POST` de movimentação aceita header `Idempotency-Key` (UUID) |
| Rate limit | Cabeçalhos `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`; 429 com `Retry-After` |
| CSRF | Rotas de escrita exigem `Origin` válida e token de sessão; cookies `sameSite=lax` |
| Auditoria | Toda escrita registra `usuario_id`, `criado_em` e, quando aplicável, `atualizado_em` |

### 1.1 Envelope de erro

```json
{
  "error": {
    "code": "MOV_POSICAO_NEGATIVA",
    "message": "A movimentação deixaria a posição do ativo negativa.",
    "details": { "quantidadeAtual": "10.00000000", "quantidadeSolicitada": "15.00000000" }
  }
}
```

### 1.2 Envelope de coleção

```json
{
  "data": [],
  "meta": { "page": 1, "pageSize": 20, "total": 42, "totalPages": 3 }
}
```

### 1.3 Tipo `DadoProveniente<T>`

| Campo | Tipo | Descrição |
|---|---|---|
| `valor` | `T` | Valor normalizado |
| `fonte` | string | Nome da fonte (ex.: `cvm`, `brapi`) |
| `dataReferencia` | date | Data a que o valor se refere |
| `coletadoEm` | datetime | Instante da coleta |
| `statusDado` | enum | `OFICIAL`, `MERCADO`, `ESTIMADO`, `HISTORICO`, `INDISPONIVEL` |

---

## 2. Autenticação e conta

### 2.1 `POST /api/auth/cadastro` — público

Cria conta em `PENDENTE_VERIFICACAO` e dispara e-mail de verificação (RN-085, RN-087).

**Body**

| Campo | Tipo | Obrigatório | Validação |
|---|---|---|---|
| `nome` | string | sim | 3–120 caracteres |
| `email` | string | sim | e-mail válido, ≤ 160, único (case-insensitive) |
| `senha` | string | sim | ≥ 10 caracteres, não presente em lista de senhas vazadas |
| `aceiteTermos` | boolean | sim | deve ser `true` |
| `aceitePrivacidade` | boolean | sim | deve ser `true` |
| `versaoTermos` | string | sim | versão vigente (ex.: `2026-11-01`) |
| `versaoPrivacidade` | string | sim | versão vigente |

**201**

```json
{ "id": "uuid", "email": "titular@exemplo.com", "statusConta": "PENDENTE_VERIFICACAO" }
```

**Erros:** `AUTH_EMAIL_JA_CADASTRADO` (409), `AUTH_SENHA_FRACA` (422), `AUTH_ACEITE_OBRIGATORIO` (422), `RATE_LIMIT_EXCEDIDO` (429), `VALIDACAO` (422).

---

### 2.2 `POST /api/auth/verificar-email` — público

**Body:** `{ "token": "string" }`

**200:** `{ "statusConta": "ATIVA", "emailVerificadoEm": "2026-11-07T12:00:00Z" }`

**Erros:** `AUTH_TOKEN_INVALIDO` (400), `AUTH_TOKEN_EXPIRADO` (410), `AUTH_TOKEN_JA_USADO` (409).

---

### 2.3 `POST /api/auth/reenviar-verificacao` — público

**Body:** `{ "email": "string" }`

**202:** `{ "message": "Se o e-mail estiver cadastrado, enviaremos um novo link." }`

Resposta é sempre neutra (RN-086). **Erros:** `RATE_LIMIT_EXCEDIDO` (429).

---

### 2.4 `POST /api/auth/esqueci-senha` — público

**Body:** `{ "email": "string" }` → **202** com a mesma mensagem neutra. Token de 1 h, uso único, invalida os anteriores.

---

### 2.5 `POST /api/auth/redefinir-senha` — público

**Body:** `{ "token": "string", "novaSenha": "string" }`

**200:** `{ "message": "Senha redefinida." }`

**Erros:** `AUTH_TOKEN_INVALIDO` (400), `AUTH_TOKEN_EXPIRADO` (410), `AUTH_SENHA_FRACA` (422).

---

### 2.6 `POST /api/auth/login` — público

**Body:** `{ "email": "string", "senha": "string" }`

**200:** `{ "usuario": { "id", "nome", "email", "statusConta" } }` + `Set-Cookie` de sessão.

**Erros:** `AUTH_CREDENCIAIS_INVALIDAS` (401 — mensagem genérica), `AUTH_EMAIL_NAO_VERIFICADO` (403, com `details.podeReenviar: true`), `AUTH_CONTA_SUSPENSA` (403), `RATE_LIMIT_EXCEDIDO` (429).

---

### 2.7 `POST /api/auth/logout` — autenticado

**204** e invalidação do cookie de sessão.

### 2.8 `GET /api/auth/sessao` — autenticado

**200:** `{ "usuario": { "id", "nome", "email", "statusConta" }, "expiraEm": "..." }`
**401:** `AUTH_SESSAO_EXPIRADA`.

### 2.9 `DELETE /api/conta` — autenticado

**Body:** `{ "senha": "string" }` — confirmação obrigatória (RN-088).

**200:** `{ "statusConta": "EXCLUIDA", "mensagem": "Conta encerrada. Dados pessoais anonimizados." }`
**Erros:** `AUTH_CREDENCIAIS_INVALIDAS` (401), `CONTA_EXCLUSAO_BLOQUEADA` (409 — dados em processamento).

---

## 3. Ativos

### 3.1 `GET /api/ativos`

**Query:** `classeId`, `segmentoId`, `status` (`ATIVO|INATIVO|EM_ANALISE`), `q` (ticker/nome), `page`, `pageSize`, `sort` (`ticker|nome|status|criadoEm`), `order`.

**200**

```json
{
  "data": [
    {
      "id": "uuid",
      "ticker": "HGLG11",
      "nome": "CSHG Logística FII",
      "classe": { "id": "uuid", "codigo": "FII", "nome": "Fundos Imobiliários" },
      "segmento": { "id": "uuid", "codigo": "LOGISTICA", "nome": "Logística" },
      "status": "ATIVO",
      "posicao": { "quantidade": "100.00000000", "precoMedio": "162.350000" }
    }
  ],
  "meta": { "page": 1, "pageSize": 20, "total": 1, "totalPages": 1 }
}
```

### 3.2 `POST /api/ativos`

**Body**

| Campo | Tipo | Obrigatório | Validação |
|---|---|---|---|
| `ticker` | string | sim | `^[A-Z0-9]{4,20}$`; maiúsculas; único por usuário |
| `nome` | string | sim | 3–160 |
| `classeId` | uuid | sim | deve existir e estar ativa |
| `segmentoId` | uuid | condicional | obrigatório se classe = `FII` |
| `cnpj` | string | não | 14 dígitos com DV válido |
| `administrador` | string | não | ≤ 160 |
| `gestor` | string | não | ≤ 160 |
| `fonteDados` | string | não | deve corresponder a provedor cadastrado |
| `observacoes` | string | não | ≤ 1000 |

**201:** objeto do ativo criado.
**Erros:** `ATIVO_TICKER_DUPLICADO` (409), `ATIVO_SEGMENTO_OBRIGATORIO` (422), `ATIVO_CLASSE_INVALIDA` (422), `ATIVO_CNPJ_INVALIDO` (422).

### 3.3 `GET /api/ativos/{id}`

**200:** ativo + `posicao` + `rendimentosAcumulados` + `ultimosPrecos` (série com proveniência).
**404:** `ATIVO_NAO_ENCONTRADO`.

### 3.4 `PATCH /api/ativos/{id}`

Atualização parcial; `ticker` e `classeId` são imutáveis após existir movimentação (`ATIVO_CLASSE_IMUTAVEL`). Inativar = `{ "status": "INATIVO" }` (RN-013).

### 3.5 `GET /api/referencia/ativos` — autenticado

Retorna os catálogos usados pelos formulários e pelas metas de alocação.

**200**

```json
{
  "classes": [
    { "id": "uuid", "codigo": "RENDA_FIXA", "nome": "Renda Fixa", "segmentos": [] },
    { "id": "uuid", "codigo": "FII", "nome": "Fundos Imobiliários", "segmentos": [
      { "id": "uuid", "codigo": "LOGISTICA", "nome": "Logística" }
    ] }
  ]
}
```

**Erros:** `NAO_AUTENTICADO` 401.

---

## 4. Movimentações

### 4.1 `GET /api/movimentacoes`

**Query:** `ativoId`, `tipo`, `de`, `ate`, `incluirCanceladas` (default `false`), `page`, `pageSize`, `sort` (`data|valorTotal|criadoEm`) + `order`.

**200**

```json
{
  "data": [
    {
      "id": "uuid",
      "ativo": { "id": "uuid", "ticker": "HGLG11" },
      "tipo": "COMPRA",
      "data": "2026-11-05",
      "quantidade": "10.00000000",
      "valorUnitario": "160.00",
      "valorTotal": "1603.00",
      "custos": "3.00",
      "observacoes": null,
      "canceladaEm": null
    }
  ],
  "meta": { "page": 1, "pageSize": 20, "total": 1, "totalPages": 1 }
}
```

### 4.2 `POST /api/movimentacoes`

**Headers:** `Idempotency-Key` (opcional; repetição devolve o mesmo recurso).

**Body**

| Campo | Tipo | Obrigatório | Validação |
|---|---|---|---|
| `ativoId` | uuid | sim | ativo do usuário |
| `tipo` | enum | sim | `COMPRA, VENDA, DIVIDENDO, JUROS, APLICACAO_RF, RESGATE_RF, TAXA` |
| `data` | date | sim | ≤ hoje + 1 dia |
| `quantidade` | decimal | condicional | obrigatório em `COMPRA`/`VENDA`; > 0 |
| `valorUnitario` | decimal | condicional | obrigatório em `COMPRA`/`VENDA`; > 0 |
| `valorTotal` | decimal | sim | > 0; ≠ quantidade × unitário + custos → exige `observacoes` |
| `custos` | decimal | não | ≥ 0, default 0 |
| `observacoes` | string | condicional | obrigatório quando a diferença de valor > R$ 0,01 |

**201**

```json
{
  "movimentacao": { "id": "uuid", "tipo": "COMPRA", "valorTotal": "1603.00" },
  "posicao": { "quantidade": "110.00000000", "precoMedio": "161.400000", "custoTotal": "17754.00" }
}
```

> Em uma venda confirmada que deixa a posição negativa, `posicao.quantidade` na resposta é negativa e o cache `posicao_ativo` é removido (RN-018 + exceção documentada em `DATA_MODEL.md` §4.6).

**Erros:** `MOV_POSICAO_NEGATIVA` (409, com `details.requerConfirmacao`), `MOV_VALOR_INCONSISTENTE` (422), `MOV_DATA_FUTURA` (422), `MOV_ATIVO_INATIVO` (422), `MOV_TIPO_INVALIDO` (422).

> Confirmação de posição negativa: `POST` com `{ "confirmarPosicaoNegativa": true, "motivo": "string" }` e permissão registrada em auditoria (RN-018).

### 4.3 `POST /api/movimentacoes/{id}/cancelamento`

**Body:** `{ "motivo": "string" }` → **200** com a posição recalculada. Nunca há exclusão física (RN-084).
**Erros:** `MOV_JA_CANCELADA` (409), `MOV_CANCELAMENTO_SEM_MOTIVO` (422).

---

## 5. Carteira

### 5.1 `GET /api/carteira`

**200**

```json
{
  "resumo": {
    "patrimonioTotal": "152340.00",
    "rendaFixa": "61000.00",
    "fiis": "91340.00",
    "percentualRendaFixa": "40.041000",
    "percentualFiis": "59.959000",
    "quantidadeAtivos": 7,
    "rendimentosMes": "820.00",
    "rendimentosAcumuladosAno": "7340.00"
  },
  "porClasse": [
    { "codigo": "RENDA_FIXA", "nome": "Renda Fixa", "valor": "61000.00", "percentual": "40.041000" },
    { "codigo": "FII", "nome": "Fundos Imobiliários", "valor": "91340.00", "percentual": "59.959000" }
  ],
  "porSegmento": [
    { "codigo": "LOGISTICA", "nome": "Logística", "valor": "32000.00", "percentual": "35.044000" }
  ],
  "posicoes": [
    {
      "ativoId": "uuid",
      "ticker": "HGLG11",
      "nome": "CSHG Logística",
      "classe": { "codigo": "FII", "nome": "Fundos Imobiliários" },
      "segmento": { "codigo": "LOGISTICA", "nome": "Logística" },
      "quantidade": "100.00000000",
      "precoMedio": "162.350000",
      "custoTotal": "16235.00",
      "valorAtual": "16235.00",
      "valorIndisponivel": true,
      "percentual": "10.656000"
    }
  ],
  "consistente": true,
  "atualizadoEm": "2026-11-07T18:00:00Z",
  "cotacoes": { "statusDado": "INDISPONIVEL", "dataReferencia": null }
}
```

> `consistente: false` sinaliza que a soma das classes não fechou com o total (tolerância R$ 0,01) — a divergência é registrada em log.
> Sem cotação de mercado na Fase 1, `cotacoes.statusDado` é `INDISPONIVEL`; FII entra pelo custo (`valorIndisponivel: true`) e renda fixa pelo saldo.

> Cada item de `porClasse`/`porSegmento` e cada posição em `/api/ativos` pode trazer `valorIndisponivel: true` quando não houver cotação; nesse caso o valor é o custo de aquisição (RN-091).

### 5.2 `GET /api/carteira/evolucao`

**Query:** `de` (default início do ano), `ate` (default hoje), `granularidade` (`dia|mes`, default `mes`).

**200:** `{ "pontos": [ { "data": "2026-01-31", "patrimonio": "120000.00", "rendaFixa": "50000.00", "fiis": "70000.00" } ] }`

**Erros:** `VALIDACAO` (422) quando `de > ate` ou `granularidade` inválida.

> **Limitação da Fase 1:** a série de FII é reconstruída pelo **custo** das movimentações; a renda fixa usa o **saldo atual como constante** porque não há histórico de saldo (`DATA_MODEL.md` §4.8). A série passa a refletir mercado quando `historico_preco` e o histórico de saldo existirem (RN-030/RN-059).

### 5.3 `GET /api/dashboard`

Agregado da tela inicial. Blocos são independentes: falha em um bloco não derruba os demais.

**200**

```json
{
  "indicadores": {
    "patrimonioTotal": "152340.00",
    "totalInvestido": "140000.00",
    "valorAtual": "152340.00",
    "resultadoAcumulado": "19680.00",
    "rendaMensal": "820.00",
    "rendimentosAno": "7340.00",
    "percentualRendaFixa": "40.041000",
    "percentualFiis": "59.959000",
    "vazio": false,
    "meta": [
      { "codigo": "RENDA_FIXA", "atual": "40.041000", "meta": "50.000000", "desvio": "-9.959000", "situacao": "ABAIXO" }
    ]
  },
  "graficos": {
    "porClasse": [],
    "porSegmento": [],
    "evolucaoPatrimonial": [ { "data": "2026-01-31", "patrimonio": "120000.00", "rendaFixa": "50000.00", "fiis": "70000.00" } ],
    "evolucaoRendimentos": [ { "mes": "2026-01", "valor": "0.00" } ],
    "aportes": [],
    "dividendos": [ { "data": "2026-01-15", "ativo": "HGLG11", "valor": "80.00" } ]
  },
  "oportunidades": {
    "classesAbaixo": [],
    "segmentosAbaixo": [],
    "watchlist": [],
    "comAlerta": [],
    "sugestaoAporte": null
  },
  "erros": []
}
```

- `resultadoAcumulado = (valorAtual − totalInvestido) + rendimentos totais (todo o histórico)`.
- `vazio: true` quando o usuário não tem patrimônio nem proventos — a UI mostra o estado de primeiro acesso.
- `totalInvestido` = custo dos FIIs + `valorAplicado` da renda fixa.
- `evolucaoRendimentos` = soma mensal de `rendimento` nos últimos 12 meses.
- `dividendos` = últimos 12 proventos com data + ticker.
- `aportes`, `watchlist`, `comAlerta` e `sugestaoAporte` ficam vazios/`null` até as Fases 2 e 4 — a UI exibe "disponível em breve".
- `erros[]` = `[{ "bloco", "code", "message" }]` para blocos que falharam.

---

## 6. Renda fixa

### 6.1 `GET /api/renda-fixa`

**Query:** `instituicao`, `produto`, `vencimentoAte`, `page`, `pageSize`, `sort` (`instituicao|produto|vencimento|dataAplicacao|saldoAtual|criadoEm`), `order`.
**200:** lista com `saldoAtual`, `statusSaldo`, `vencimento`, `liquidez`, `coberturaFgc`.

### 6.2 `POST /api/renda-fixa`

| Campo | Tipo | Obrigatório | Validação |
|---|---|---|---|
| `instituicao` | string | sim | 2–120 |
| `produto` | enum | sim | `TESOURO_SELIC, TESOURO_IPCA, TESOURO_PREFIXADO, CDB, LCI, LCA, DEBENTURE, OUTRO` |
| `indexador` | enum | sim | `PRE, POS_CDI, IPCA, SELIC, OUTRO` |
| `taxa` | decimal | sim | ≥ 0, ≤ 100 (% a.a.) |
| `dataAplicacao` | date | sim | ≤ hoje |
| `vencimento` | date | não | > `dataAplicacao` |
| `valorAplicado` | decimal | sim | > 0 |
| `saldoAtual` | decimal | sim | ≥ 0 |
| `statusSaldo` | enum | não | default `INFORMADO` |
| `liquidez` | enum | sim | `DIARIA, NO_VENCIMENTO, PRAZO` |
| `carenciaAte` | date | não | ≥ `dataAplicacao` |
| `coberturaFgc` | boolean | não | default derivado do produto |
| `observacoes` | string | não | ≤ 1000 |

**201:** recurso criado. **Erros:** `RF_VENCIMENTO_INVALIDO` (422), `RF_TAXA_INVALIDA` (422), `RF_SALDO_INVALIDO` (422).

### 6.3 `PATCH /api/renda-fixa/{id}`

Atualiza `saldoAtual`, `statusSaldo`, `liquidez`, `carenciaAte`, `coberturaFgc` e `observacoes` (RN-059); `produto`, `indexador`, `taxa`, `dataAplicacao`, `valorAplicado` e `vencimento` são imutáveis (`RF_CAMPO_IMUTAVEL`).

### 6.4 `GET /api/renda-fixa/alertas`

**200:** `{ "alertas": [ { "tipo": "VENCIMENTO_PROXIMO|CARENCIA|SEM_LIQUIDEZ|CONCENTRACAO_INSTITUICAO|LIMITE_FGC", "tituloFixoId", "mensagem", "severidade": "INFO|ATENCAO|CRITICO" } ] }` (RN-058).

---

## 7. Alocação

### 7.1 `GET /api/alocacao/metas`

**200**

```json
{
  "vigente": {
    "classe": [ { "classeId": "uuid", "codigo": "RENDA_FIXA", "percentual": "50.000000" } ],
    "segmento": [ { "segmentoId": "uuid", "codigo": "LOGISTICA", "percentual": "25.000000" } ],
    "vigenciaInicio": "2026-11-07"
  },
  "historico": []
}
```

### 7.2 `PUT /api/alocacao/metas`

Substitui o conjunto vigente em transação (RN-021, RN-022).

**Body:** `{ "classe": [ { "referenciaId": "uuid", "percentual": "50.000000" } ], "segmento": [ ... ] }`

**200:** conjunto vigente. **Erros:** `ALO_SOMA_METAS_INVALIDA` (422, `details.escopo` e `details.soma`), `ALO_REFERENCIA_INVALIDA` (422), `ALO_META_DUPLICADA` (422).

### 7.3 `GET /api/alocacao/desvios`

**200**

```json
{
  "baseCalculo": "PATRIMONIO_TOTAL",
  "itens": [
    {
      "escopo": "CLASSE",
      "codigo": "RENDA_FIXA",
      "percentualAtual": "40.041000",
      "percentualMeta": "50.000000",
      "desvioPontos": "-9.959000",
      "valorParaMeta": "15170.00",
      "situacao": "ABAIXO",
      "valorIndisponivel": false
    }
  ]
}
```

> `valorIndisponivel: true` indica que o valor atual veio do **custo** de aquisição, não de cotação de mercado (RN-091). A base de cálculo é sempre o patrimônio total (RN-089).

> `baseCalculo` de segmento é sempre `PATRIMONIO_TOTAL` e "Caixa e Oportunidades" é um segmento como os demais (RN-089).

---

## 8. Aportes — Fase 2

### 8.1 `POST /api/aportes/sugestao`

**Body:** `{ "valorDisponivel": "1000.00", "data": "2026-11-10" }`

**201**

```json
{
  "id": "uuid",
  "data": "2026-11-10T12:00:00Z",
  "valorDisponivel": "1000.00",
  "distribuicaoAtual": { "classe": [ { "codigo": "RENDA_FIXA", "percentual": "40.041000" } ], "segmento": [] },
  "distribuicaoSugerida": {
    "classe": [ { "codigo": "RENDA_FIXA", "valor": "1000.00", "justificativa": "Classe mais distante da meta." } ],
    "segmento": [ { "codigo": "LOGISTICA", "valor": "250.00", "justificativa": "Segmento abaixo da meta." } ]
  },
  "ativosAvaliados": [
    {
      "ativoId": "uuid",
      "ticker": "HGLG11",
      "nome": "CSHG Logística",
      "classe": "FII",
      "segmento": "LOGISTICA",
      "classificacao": "ABAIXO_META_APTO_PARA_ESTUDO",
      "checklist": {
        "classeAbaixoMeta": true,
        "segmentoAbaixoMeta": true,
        "ativoJaNaCarteira": false,
        "aumentaConcentracao": "INDISPONIVEL",
        "dadosSuficientes": "INDISPONIVEL",
        "atendeQualidade": "INDISPONIVEL",
        "alertaRelevante": false,
        "precoDentroParametros": "INDISPONIVEL"
      },
      "motivos": []
    }
  ],
  "justificativas": [],
  "alertas": []
}
```

- `classificacao`: `ABAIXO_META_APTO_PARA_ESTUDO`, `ABAIXO_META_COM_RISCOS`, `DENTRO_META`, `ACIMA_META`, `SEM_DADOS_SUFICIENTES`.
- Itens do checklist usam `SIM`/`NAO`/`INDISPONIVEL`; ausência de dado nunca vira positivo (RN-077).
- A soma de `distribuicaoSugerida.classe` é exatamente o valor do aporte.

**Erros:** `APORTE_VALOR_INVALIDO` (422), `APORTE_DADOS_INSUFICIENTES` (409).

### 8.2 `POST /api/aportes/simulacao`

**Body:** `{ "valorAporte": "1500.00" }`

**200**

```json
{
  "valorAporte": "1500.00",
  "antes": { "patrimonioTotal": "10000.00", "classe": [ { "codigo": "RENDA_FIXA", "valor": "3500.00", "percentual": "35.000000" } ], "segmento": [] },
  "depois": { "patrimonioTotal": "11500.00", "classe": [ { "codigo": "RENDA_FIXA", "valor": "4500.00", "percentual": "39.130435" } ], "segmento": [] },
  "delta": { "classe": [ { "codigo": "RENDA_FIXA", "pontosPercentuais": "4.130435" } ], "segmento": [] }
}
```

- Stateless: não grava sugestão nem altera a carteira.
- `depois` aplica a mesma distribuição da sugestão (RN-025).
- `delta.pontosPercentuais = depois − antes`.

**Erros:** `APORTE_VALOR_INVALIDO` (422).

### 8.3 `GET /api/aportes/historico` e `PATCH /api/aportes/{id}/decisao`

`GET /api/aportes/historico?page=&pageSize=` → `{ data: [...], meta }` com data, valor, decisão e resumo da distribuição (RN-052).

`PATCH` body `{ "decisao": "ACEITA|IGNORADA|ALTERADA", "observacoes": "string?" }` → **200** `{ "id", "decisaoUsuario", "decisaoEm", "observacoes" }` (RN-053).

**Erros:** `APORTE_NAO_ENCONTRADO` (404), `APORTE_DECISAO_INVALIDA` (422).

---

## 9. Pesquisa e ficha — Fase 3

### 9.1 `GET /api/pesquisa?q=HGLG11`

**200:** `{ "resultados": [ { "ticker", "nome", "classe", "segmento", "fonte", "dataReferencia" } ] }`
**Erros:** `INT_PROVEDOR_INDISPONIVEL` (503 — com `details.dadosEmCache: true` quando houver).

### 9.2 `GET /api/pesquisa/{ticker}`

**200:** ficha composta por blocos, cada um com `fonte`, `dataReferencia`, `coletadoEm`, `statusDado`:

```json
{
  "identificacao": { "ticker": "HGLG11", "cnpj": "...", "segmento": "LOGISTICA", "administrador": "...", "gestor": "...", "inicio": "2010-06-01" },
  "indicadores": {
    "preco": { "valor": "162.35", "fonte": "brapi", "dataReferencia": "2026-11-07", "statusDado": "MERCADO" },
    "pvp": { "valor": "0.98", "fonte": "cvm", "dataReferencia": "2026-10-31", "statusDado": "OFICIAL" },
    "dy12m": { "valor": "9.12", "fonte": "brapi", "dataReferencia": "2026-11-07", "statusDado": "MERCADO" }
  },
  "riscos": { "vacanciaFisica": null, "vacanciaFinanceira": null, "concentracaoImoveis": null, "alavancagem": null },
  "historico": { "precos": [], "dividendos": [], "pl": [], "pvp": [] }
}
```

### 9.3 `POST /api/pesquisa/{ticker}/atualizar`

Força atualização ignorando cache; registra em `log_integracao` (RN-037). **202** com `{ "jobId": "uuid" }`.

---

## 10. Avaliações e watchlist — Fase 4

| Endpoint | Descrição |
|---|---|
| `POST /api/avaliacoes` | Body `{ "ativoId": "uuid" }` → 201 com nota, critérios atendidos/não atendidos, indisponíveis, justificativa (RN-041) |
| `GET /api/avaliacoes?ativoId=` | Histórico de avaliações (RN-041) |
| `GET /api/criterios` | Critérios e pesos vigentes |
| `PUT /api/criterios` | Substitui configuração; valida soma de pesos = 100 (`AVAL_PESO_INVALIDO`) |
| `GET/POST/PATCH /api/watchlist` | Inclusão, listagem e mudança de status (RN-048) |

---

## 11. Projeções — Fase 5

### `POST /api/projecoes/patrimonio`

**Body:** `{ "patrimonioInicial": "150000.00", "aporteMensal": "1000.00", "prazoAnos": 10, "inflacaoAnual": "4.000000", "retornoRealAnual": "6.000000", "reinvestir": true }`

**200:** `{ "cenarios": [ { "nome": "CONSERVADOR", "parametros": {...}, "serie": [ { "ano": 1, "patrimonioNominal": "...", "patrimonioReal": "..." } ] } ] }`

### `POST /api/projecoes/renda`

**Body:** `{ "patrimonio": "300000.00", "taxasDistribuicao": ["6.000000", "8.000000", "10.000000"] }` → renda mensal por taxa, em valor nominal e real.

**Erros:** `PROJ_PARAMETRO_INVALIDO` (422). Toda resposta carrega `aviso: "Projeção não é garantia de rentabilidade."` (RN-081).

---

## 12. Configurações

| Endpoint | Descrição | Erros |
|---|---|---|
| `GET /api/configuracoes/limites` | Limites de concentração vigentes (RN-049) | — |
| `PUT /api/configuracoes/limites` | Substitui limites | `RISCO_LIMITE_INVALIDO` (422) |
| `GET /api/configuracoes/provedores` | Provedores, capacidades, limites e custo (RN-034) | — |
| `PATCH /api/configuracoes/provedores/{id}` | Prioridade e estado | `INT_PROVEDOR_NAO_ENCONTRADO` (404) |
| `GET /api/configuracoes/termos` | Versões vigentes de termos e privacidade | — |
| `GET /api/risco/concentracao` | Concentração atual por dimensão e alertas (RN-049) | — |

### 12.1 `GET /api/risco/concentracao`

**200**

```json
{
  "baseCalculo": "PATRIMONIO_TOTAL",
  "dimensoes": [
    {
      "dimensao": "ATIVO",
      "disponivel": true,
      "itens": [
        { "referencia": "HGLG11", "nome": "CSHG Logística", "valor": "16235.00", "percentual": "10.656000", "limite": "20.000000", "excedido": false, "excessoPontos": "0.000000" }
      ]
    },
    { "dimensao": "IMOVEL", "disponivel": false, "itens": [] }
  ]
}
```

> `limite: null` quando não configurado — nenhum alerta é gerado. `IMOVEL` fica indisponível até a Fase 3/4.

### 12.2 `GET/PUT /api/configuracoes/limites`

**GET 200**

```json
{ "vigente": [ { "dimensao": "ATIVO", "referencia": null, "percentualMax": "20.000000", "vigenciaInicio": "2026-11-09" } ], "historico": [] }
```

**PUT** `{ "limites": [ { "dimensao": "ATIVO", "referencia": null, "percentualMax": "20.000000" } ] }` → **200** com o conjunto vigente.

- `referencia: null` é o **default da dimensão** (ex.: 20% para qualquer ativo); um limite específico da referência vence o default.
- Comparação de referência é case-insensitive e sem espaços.
- **Erros:** `RISCO_LIMITE_INVALIDO` (422) com `details.campo`.

---

## 13. Saúde

### `GET /api/health` — público

**200:** `{ "status": "ok", "banco": "ok", "ultimaImportacaoCvm": "2026-11-06T03:00:00Z" }`
**503:** `{ "status": "degraded", "banco": "erro" }`
Não expõe versão de dependência nem detalhe de conexão.

---

## 14. Matriz endpoint → RN

| Endpoint | RNs |
|---|---|
| `/api/auth/*` | RN-009, RN-067, RN-085, RN-086, RN-087 |
| `DELETE /api/conta` | RN-070, RN-088 |
| `/api/ativos` | RN-010 a RN-013 |
| `/api/movimentacoes` | RN-014 a RN-019, RN-084 |
| `/api/carteira` | RN-015, RN-020, RN-061, RN-062 |
| `/api/renda-fixa` | RN-057 a RN-059 |
| `/api/alocacao/*` | RN-021 a RN-024, RN-082 |
| `/api/aportes/*` | RN-025 a RN-028, RN-050 a RN-056 |
| `/api/pesquisa/*` | RN-002 a RN-006, RN-029 a RN-038, RN-072 a RN-074 |
| `/api/avaliacoes`, `/api/criterios` | RN-039 a RN-047 |
| `/api/watchlist` | RN-048 |
| `/api/configuracoes/limites` | RN-049 |
| `/api/projecoes/*` | RN-064 a RN-066, RN-080, RN-081 |
| `/api/health` | RN-073 |

---

## 15. Compatibilidade e evolução

- Campo novo em resposta é compatível; campo removido ou com tipo alterado exige `/api/v2`.
- Enum novo é compatível apenas para o cliente que ignora valores desconhecidos — a UI deve tratar `default`.
- Erro novo no catálogo não pode reutilizar código existente com significado diferente.
- Toda rota de escrita é idempotente ou protegida por chave de idempotência declarada.
