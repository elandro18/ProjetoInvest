---
project: INVESTMENT CONTROL
module: glossario
audience: [tecnica]
status: draft
---

# Glossário Técnico — Investment Control

> **Audiência:** desenvolvimento e QA. Termos técnicos e de domínio com classificação DDD.
> **Fonte:** `REQUIREMENTS.md` §4 e §6, `specs/DATA_MODEL.md`.

---

## Ativo

**Definição:** Instrumento financeiro identificado por ticker, pertencente a uma classe e, quando FII, a um segmento. É a raiz de identidade do domínio de carteira: sem ativo não existe movimentação, posição ou rendimento.
**Classificação DDD:** Aggregate Root
**Relações:** Classe de Ativo, Segmento, Movimentação, Posição, Rendimento
**Não confundir com:** Posição (o ativo é o instrumento; a posição é quanto dele se tem)

## Classe de Ativo

**Definição:** Agrupamento de alocação ao qual um ativo pertence. Valores iniciais: `RENDA_FIXA` e `FII`. É dado de referência, não entidade do usuário.
**Classificação DDD:** Entity (catálogo)
**Relações:** Ativo, Segmento, Meta de Alocação
**Não confundir com:** Segmento (segmento é subdivisão de FII)

## Segmento

**Definição:** Subdivisão de uma classe (hoje, de FII): logística, shopping, recebíveis, lajes, renda urbana, híbridos, agronegócio, outros e caixa/oportunidades.
**Classificação DDD:** Entity (catálogo)
**Relações:** Classe de Ativo, Ativo, Meta de Alocação
**Não confundir com:** Classe de Ativo (classe é o nível de alocação 50/50; segmento é o detalhe dentro de FII)

## Movimentação

**Definição:** Fato que altera posição, caixa ou rendimento: compra, venda, dividendo, juros, aplicação em renda fixa, resgate e taxa. É a fonte primária da verdade da posição — nunca é excluída fisicamente, apenas cancelada.
**Classificação DDD:** Aggregate Root / Domain Event (fato registrado)
**Relações:** Ativo, Posição, Rendimento, Cancelamento
**Não confundir com:** Rendimento (dividendo é um tipo de movimentação que também gera um registro de rendimento)

## Posição

**Definição:** Quantidade e custo médio de um ativo em um instante, derivados da aplicação ordenada das movimentações. É cache de leitura `posicao_ativo`, reconstruível — não é fonte primária.
**Classificação DDD:** Entity derivada (Read Model)
**Relações:** Ativo, Movimentação, Preço Médio
**Não confundir com:** Carteira (carteira é a agregação de todas as posições + renda fixa)

## Preço Médio

**Definição:** Custo médio ponderado por quantidade. Recalculado a cada compra; em venda, o custo é baixado proporcionalmente e o preço médio permanece.
**Classificação DDD:** Value Object
**Relações:** Posição, Movimentação, Custo Total
**Não confundir com:** Preço atual (valor de mercado) nem com preço de venda

## Rendimento

**Definição:** Valor recebido sem contrapartida de venda (dividendo, juro, amortização), registrado separadamente do resultado de capital.
**Classificação DDD:** Entity
**Relações:** Ativo, Movimentação, Competência
**Não confundir com:** Resultado de capital (ganho por valorização ou venda)

## Carteira

**Definição:** Agregação de todas as posições de FII e saldos de renda fixa de um usuário, com totais por classe e por segmento, percentuais e rendimentos do período.
**Classificação DDD:** Read Model (agregação)
**Relações:** Posição, Investimento em Renda Fixa, Meta de Alocação, Desvio
**Não confundir com:** Posição (uma posição é um ativo; carteira é o todo)

## Meta de Alocação

**Definição:** Percentual alvo por classe ou por segmento, versionado por vigência (`vigencia_inicio`/`vigencia_fim`). Configuração é dado, não constante de código.
**Classificação DDD:** Entity (configuração versionada)
**Relações:** Classe de Ativo, Segmento, Desvio
**Não confundir com:** Desvio (meta é o alvo; desvio é a distância até ele)

## Desvio

**Definição:** Diferença entre percentual atual e meta, em pontos percentuais e em reais. Classificado como "abaixo", "acima" ou "dentro" — este último com tolerância de 0,5 p.p.
**Classificação DDD:** Value Object
**Relações:** Carteira, Meta de Alocação, Aporte
**Não confundir com:** Erro de cálculo (desvio é informação, não falha)

## Aporte

**Definição:** Valor novo destinado a investimento em um mês. A sugestão de distribuição prioriza a classe mais distante da meta e nunca divide igualmente por padrão.
**Classificação DDD:** Command (intenção) + Value Object
**Relações:** Desvio, Sugestão de Aporte, Simulação
**Não confundir com:** Movimentação (aporte é intenção futura; movimentação é fato registrado)

## Provedor de Dados

**Definição:** Fonte externa de dados financeiros com capacidades declaradas (`cotacao`, `dividendos`, `informes` etc.), autenticação, limite e custo. Implementa o port `ProvedorDados`.
**Classificação DDD:** Adapter (Port/Adapter)
**Relações:** DadoProveniente, Log de Integração, Cache
**Não confundir com:** Fonte oficial (CVM é fonte oficial; provedor de mercado é fonte comercial)

## DadoProveniente

**Definição:** Envelope `{ valor, fonte, dataReferencia, coletadoEm, statusDado }` obrigatório em todo dado de mercado. Garante rastreabilidade mesmo quando o valor vem de cache.
**Classificação DDD:** Value Object
**Relações:** Provedor de Dados, Status do Dado, Histórico
**Não confundir com:** Payload cru do provedor (o envelope é normalizado e independente de fornecedor)

## Status do Dado

**Definição:** Classificação de confiança do dado: `OFICIAL`, `MERCADO`, `ESTIMADO`, `HISTORICO`, `INDISPONIVEL`. Determina o selo visual na UI e impede tratar estimado como oficial.
**Classificação DDD:** Value Object (enum)
**Relações:** DadoProveniente, UI (ProvenanceBadge)
**Não confundir com:** Status de ativo (`ATIVO`, `INATIVO`, `EM_ANALISE`)

## Avaliação de Ativo

**Definição:** Cálculo de nota 0–100 de um FII por critérios e pesos configuráveis, com critérios atendidos, não atendidos, dados indisponíveis e justificativa.
**Classificação DDD:** Aggregate Root
**Relações:** Critério de Avaliação, Nota, Watchlist
**Não confundir com:** Recomendação de compra (avaliação descreve qualidade; não decide)

## Watchlist

**Definição:** Lista de observação de ativos com motivo, preço e P/VP de referência, nota e status (`ESTUDAR`, `ACOMPANHAR`, `APROVADO`, `DESCARTADO`).
**Classificação DDD:** Entity
**Relações:** Ativo, Avaliação, Sugestão de Aporte
**Não confundir com:** Carteira (estar na watchlist não significa ter posição)

## Sugestão de Aporte

**Definição:** Registro imutável de uma recomendação de distribuição de aporte, com snapshot da carteira, valores sugeridos, ativos avaliados, justificativas, alertas e decisão do usuário.
**Classificação DDD:** Aggregate Root
**Relações:** Aporte, Desvio, Concentração, Decisão do Usuário
**Não confundir com:** Movimentação (a sugestão não altera a carteira)

## Investimento em Renda Fixa

**Definição:** Título com instituição, produto, indexador, taxa, datas, valores, liquidez e cobertura de FGC. O saldo é manual e classificado (`INFORMADO`, `ESTIMADO`, `CONFIRMADO`).
**Classificação DDD:** Aggregate Root
**Relações:** Carteira, Alerta, FGC
**Não confundir com:** Ativo de FII (não tem ticker nem quantidade de cota)

## Token de Conta

**Definição:** Token de uso único para verificação de e-mail (24 h) ou redefinição de senha (1 h). Persistido apenas como hash SHA-256.
**Classificação DDD:** Entity (credencial efêmera)
**Relações:** Usuário, Aceite Legal
**Não confundir com:** Sessão (sessão é contínua; token é de uso único e curto)

## Aceite Legal

**Definição:** Evidência versionada de aceite dos Termos de Uso ou da Política de Privacidade, com data e hash de IP.
**Classificação DDD:** Entity
**Relações:** Usuário, Compliance
**Não confundir com:** Consentimento de marketing (não existe na Fase 1)

## RN (Regra de Negócio)

**Definição:** Regra numerada em `REQUIREMENTS.md`, rastreável até artefato técnico e critério de aceite. É a âncora de uma feature.
**Classificação DDD:** (artefato de processo, fora do domínio)
**Relações:** Feature, Task, Critério de Aceite
**Não confundir com:** Task (a RN descreve a regra; a task descreve o trabalho para implementá-la)

## Feature

**Definição:** Unidade de entrega ancorada em uma RN, composta por análise (funcional + técnica) e arquivo de delivery com tasks.
**Classificação DDD:** (artefato de processo)
**Relações:** RN, Task, Análise
**Não confundir com:** RN (uma feature pode realizar várias RNs, mas ancora em uma)

## Task

**Definição:** Trabalho executável identificado como `RN-NNN-M`, com um único repositório/escopo, critério de aceite e dependências.
**Classificação DDD:** (artefato de processo)
**Relações:** Feature, RN, Critério de Aceite
**Não confundir com:** RN (task é execução; RN é regra)
