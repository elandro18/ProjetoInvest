---
project: INVESTMENT CONTROL
module: api
audience: [tecnica]
status: draft
---

# Catálogo de Erros — Investment Control

> **Derivado de:** `specs/API_CONTRACTS.md`, `REQUIREMENTS.md`.
> Código de erro é **contrato público**: nunca muda de significado e nunca é reutilizado.

---

## 1. Convenções

| Item | Regra |
|---|---|
| Formato | `<DOMINIO>_<MOTIVO>` em `SCREAMING_SNAKE_CASE` |
| Estabilidade | Código publicado não muda; correção de semântica exige código novo |
| Envelope | `{ "error": { "code", "message", "details"? } }` |
| `message` | PT-BR, orientada à ação, sem detalhe interno |
| `details` | Dados de apoio (campo inválido, valores atuais/esperados) — nunca token, senha ou chave |
| HTTP | Derivado do catálogo; a mesma condição sempre devolve o mesmo status |
| Log | Erro 5xx registra `traceId`; o cliente recebe o `traceId` em `details.traceId` |
| Segurança | Falha de autenticação não revela se o e-mail existe; mensagem genérica |

Faixas de status:

| Status | Uso |
|---|---|
| 400 | Requisição malformada ou token inválido |
| 401 | Não autenticado / credencial inválida |
| 403 | Autenticado sem permissão ou conta não verificada |
| 404 | Recurso inexistente ou de outro usuário |
| 409 | Conflito de estado (duplicidade, posição negativa, token já usado) |
| 410 | Recurso expirado (token) |
| 422 | Validação de regra de negócio |
| 429 | Limite de requisições |
| 500 | Erro interno |
| 503 | Dependência indisponível |

---

## 2. Erros gerais

| Código | HTTP | Mensagem | Quando ocorre | Ação do cliente | RN |
|---|---|---|---|---|---|
| `VALIDACAO` | 422 | "Um ou mais campos são inválidos." | Falha de schema Zod | Corrigir `details.errors[]` | RN-069 |
| `REQUISICAO_MALFORMADA` | 400 | "Requisição inválida." | JSON inválido ou Content-Type incorreto | Reenviar payload válido | RN-069 |
| `NAO_AUTENTICADO` | 401 | "Sessão necessária." | Ausência de sessão em rota privada | Redirecionar para login | RN-067 |
| `AUTH_SESSAO_EXPIRADA` | 401 | "Sua sessão expirou. Entre novamente." | Sessão vencida | Renovar login | RN-067 |
| `SEM_PERMISSAO` | 403 | "Você não tem permissão para esta operação." | Recurso de outro usuário | Não repetir | RN-070 |
| `RECURSO_NAO_ENCONTRADO` | 404 | "Recurso não encontrado." | ID inexistente | Corrigir referência | RN-070 |
| `RATE_LIMIT_EXCEDIDO` | 429 | "Muitas tentativas. Aguarde e tente novamente." | Limite por IP/e-mail | Respeitar `Retry-After` | RN-067 |
| `ERRO_INTERNO` | 500 | "Erro inesperado. Tente novamente." | Exceção não tratada | Reportar `traceId` | RN-072 |
| `BANCO_INDISPONIVEL` | 503 | "Serviço temporariamente indisponível." | Falha de conexão com o banco | Retentar com backoff | RN-072 |
| `MIGRATION_PENDENTE` | 500 | "Serviço em atualização." | Schema divergente em produção | Aguardar deploy | — |

---

## 3. Autenticação e conta

| Código | HTTP | Mensagem | Quando ocorre | Ação do cliente | RN |
|---|---|---|---|---|---|
| `AUTH_CREDENCIAIS_INVALIDAS` | 401 | "E-mail ou senha inválidos." | Login incorreto | Corrigir dados | RN-071 |
| `AUTH_EMAIL_NAO_VERIFICADO` | 403 | "Confirme seu e-mail para entrar." | Conta `PENDENTE_VERIFICACAO` | Oferecer reenvio (`details.podeReenviar: true`) | RN-085 |
| `AUTH_CONTA_SUSPENSA` | 403 | "Conta suspensa. Fale com o suporte." | `status_conta = SUSPENSA` | Contatar suporte | RN-085 |
| `AUTH_EMAIL_JA_CADASTRADO` | 409 | "Este e-mail já está cadastrado." | Cadastro com e-mail existente | Fazer login ou recuperar senha | RN-085 |
| `AUTH_SENHA_FRACA` | 422 | "A senha não atende aos requisitos mínimos." | < 10 caracteres ou senha vazada conhecida | Informar requisitos | RN-071 |
| `AUTH_ACEITE_OBRIGATORIO` | 422 | "É necessário aceitar os termos e a política de privacidade." | Aceite ausente/falso | Exibir termos | RN-087 |
| `AUTH_TOKEN_INVALIDO` | 400 | "Link inválido." | Token não encontrado ou hash divergente | Solicitar novo link | RN-086 |
| `AUTH_TOKEN_EXPIRADO` | 410 | "Este link expirou." | `expira_em` no passado | Solicitar novo link | RN-086 |
| `AUTH_TOKEN_JA_USADO` | 409 | "Este link já foi utilizado." | `usado_em` preenchido | Fazer login | RN-086 |
| `AUTH_VERSAO_TERMOS_DESATUALIZADA` | 422 | "Os termos foram atualizados. Revise e aceite novamente." | Versão enviada ≠ vigente | Recarregar termos | RN-087 |
| `CONTA_EXCLUSAO_BLOQUEADA` | 409 | "Não é possível encerrar a conta agora." | Operação pendente | Tentar depois | RN-088 |

---

## 4. Ativos

| Código | HTTP | Mensagem | Quando ocorre | Ação do cliente | RN |
|---|---|---|---|---|---|
| `ATIVO_NAO_ENCONTRADO` | 404 | "Ativo não encontrado." | ID inexistente ou de outro usuário | Corrigir referência | RN-010 |
| `ATIVO_TICKER_DUPLICADO` | 409 | "Já existe um ativo com este ticker." | Ticker repetido para o usuário | Editar o existente | RN-010 |
| `ATIVO_TICKER_INVALIDO` | 422 | "Ticker inválido. Use de 4 a 20 caracteres alfanuméricos." | Regex não atendida | Corrigir ticker | RN-010 |
| `ATIVO_SEGMENTO_OBRIGATORIO` | 422 | "Informe o segmento para um FII." | Classe FII sem segmento | Selecionar segmento | RN-010 |
| `ATIVO_SEGMENTO_INVALIDO` | 422 | "Segmento não pertence à classe informada." | Segmento de outra classe | Corrigir | RN-012 |
| `ATIVO_CLASSE_INVALIDA` | 422 | "Classe de ativo inválida ou inativa." | Classe inexistente/inativa | Corrigir | RN-011 |
| `ATIVO_CNPJ_INVALIDO` | 422 | "CNPJ inválido." | DV incorreto | Corrigir | RN-010 |
| `ATIVO_CLASSE_IMUTAVEL` | 422 | "A classe não pode ser alterada após movimentações." | PATCH em `classeId` com histórico | Criar novo ativo | RN-015 |
| `ATIVO_EM_USO` | 409 | "Ativo possui movimentações e não pode ser excluído." | Tentativa de exclusão | Inativar | RN-013 |

---

## 5. Movimentações

| Código | HTTP | Mensagem | Quando ocorre | Ação do cliente | RN |
|---|---|---|---|---|---|
| `MOV_NAO_ENCONTRADA` | 404 | "Movimentação não encontrada." | ID inexistente | — | RN-014 |
| `MOV_POSICAO_NEGATIVA` | 409 | "A movimentação deixaria a posição negativa." | Venda > posição | Confirmar ou corrigir (`details.requerConfirmacao`) | RN-018 |
| `MOV_VALOR_INCONSISTENTE` | 422 | "O valor total não confere com quantidade × valor unitário + custos." | Diferença > R$ 0,01 sem justificativa | Informar observação | RN-019 |
| `MOV_DATA_FUTURA` | 422 | "A data não pode ser superior a amanhã." | Data fora da faixa | Corrigir data | RN-014 |
| `MOV_ATIVO_INATIVO` | 422 | "Ativo inativo não aceita nova movimentação." | Ativo `INATIVO` | Reativar antes | RN-013 |
| `MOV_TIPO_INVALIDO` | 422 | "Tipo de movimentação inválido para o ativo." | Ex.: dividendo em renda fixa | Corrigir tipo | RN-014 |
| `MOV_QTD_OBRIGATORIA` | 422 | "Informe quantidade e valor unitário." | Compra/venda sem quantidade | Preencher | RN-014 |
| `MOV_JA_CANCELADA` | 409 | "Movimentação já cancelada." | Cancelamento repetido | — | RN-084 |
| `MOV_CANCELAMENTO_SEM_MOTIVO` | 422 | "Informe o motivo do cancelamento." | Motivo vazio | Preencher | RN-084 |

---

## 6. Renda fixa

| Código | HTTP | Mensagem | Quando ocorre | Ação do cliente | RN |
|---|---|---|---|---|---|
| `RF_NAO_ENCONTRADA` | 404 | "Investimento não encontrado." | ID inexistente | — | RN-057 |
| `RF_VENCIMENTO_INVALIDO` | 422 | "O vencimento deve ser posterior à aplicação." | Data inválida | Corrigir | RN-057 |
| `RF_TAXA_INVALIDA` | 422 | "Taxa inválida." | < 0 ou > 100 | Corrigir | RN-057 |
| `RF_SALDO_INVALIDO` | 422 | "Saldo atual inválido." | < 0 | Corrigir | RN-059 |
| `RF_CAMPO_IMUTAVEL` | 422 | "Produto, indexador e data de aplicação não podem ser alterados." | PATCH nesses campos | Criar novo registro | RN-057 |

---

## 7. Alocação

| Código | HTTP | Mensagem | Quando ocorre | Ação do cliente | RN |
|---|---|---|---|---|---|
| `ALO_SOMA_METAS_INVALIDA` | 422 | "A soma das metas deve ser 100%." | Soma ≠ 100 no escopo | Ajustar (`details.escopo`, `details.soma`) | RN-021 / RN-022 |
| `ALO_REFERENCIA_INVALIDA` | 422 | "Classe ou segmento inválido." | ID inexistente/inativo | Corrigir | RN-021 |
| `ALO_META_DUPLICADA` | 422 | "Referência repetida na mesma configuração." | Duplicidade no payload | Remover duplicata | RN-021 |
| `ALO_METAS_AUSENTES` | 409 | "Configure as metas antes de calcular aportes." | Sem configuração vigente | Configurar metas | RN-025 |

---

## 8. Aportes

| Código | HTTP | Mensagem | Quando ocorre | Ação do cliente | RN |
|---|---|---|---|---|---|
| `APORTE_VALOR_INVALIDO` | 422 | "Informe um valor de aporte maior que zero." | ≤ 0 | Corrigir | RN-025 |
| `APORTE_SEM_METAS` | 409 | "Não há metas configuradas." | Sem `alocacao_meta` vigente | Configurar | RN-021 |
| `APORTE_DADOS_INSUFICIENTES` | 409 | "Não há dados suficientes para sugerir uma distribuição." | Carteira vazia e sem metas | Cadastrar ativos/metas | RN-050 |
| `APORTE_NAO_ENCONTRADO` | 404 | "Sugestão não encontrada." | ID inexistente | — | RN-052 |
| `APORTE_DECISAO_INVALIDA` | 422 | "Decisão inválida." | Valor fora do enum | Corrigir | RN-053 |

---

## 9. Avaliação, risco e projeção

| Código | HTTP | Mensagem | Quando ocorre | Ação do cliente | RN |
|---|---|---|---|---|---|
| `AVAL_DADOS_INSUFICIENTES` | 409 | "Dados insuficientes para avaliar o ativo." | Sem indicadores mínimos | Consultar dados antes | RN-042 |
| `AVAL_PESO_INVALIDO` | 422 | "A soma dos pesos deve ser 100." | Configuração inválida | Ajustar | RN-040 |
| `AVAL_CRITERIO_INVALIDO` | 422 | "Critério inválido." | Código desconhecido | Corrigir | RN-039 |
| `RISCO_LIMITE_INVALIDO` | 422 | "Limite de concentração inválido." | ≤ 0 ou > 100 | Corrigir | RN-049 |
| `PROJ_PARAMETRO_INVALIDO` | 422 | "Parâmetros de projeção inválidos." | Prazo ≤ 0, inflação/retorno fora da faixa | Corrigir | RN-064 |

---

## 10. Integrações externas

| Código | HTTP | Mensagem | Quando ocorre | Ação do cliente | RN |
|---|---|---|---|---|---|
| `INT_PROVEDOR_INDISPONIVEL` | 503 | "Fonte de dados indisponível. Exibindo dados armazenados." | Timeout/5xx do provedor | Usar dado histórico (`details.dadosEmCache`) | RN-072 / RN-073 |
| `INT_TIMEOUT` | 504 | "A fonte de dados não respondeu a tempo." | Timeout configurado | Retentar depois | RN-072 |
| `INT_LIMITE_EXCEDIDO` | 429 | "Limite de consultas da fonte atingido." | 429 do provedor | Aguardar janela | RN-034 |
| `INT_RESPOSTA_INVALIDA` | 502 | "A fonte retornou dados inválidos." | Payload fora do contrato | Registrar inconsistência | RN-072 |
| `INT_OPERACAO_NAO_SUPORTADA` | 422 | "Operação não disponível nesta fonte." | Capacidade ausente | Escolher outro provedor | RN-030 |
| `INT_FALHA_AUTENTICACAO_PROVEDOR` | 502 | "Falha de autenticação com a fonte de dados." | Chave inválida/expirada | Operador deve rotacionar chave | RN-034 |
| `INT_ATIVO_NAO_ENCONTRADO` | 404 | "Ativo não encontrado na fonte consultada." | Ticker inexistente | Verificar ticker | RN-029 |
| `INT_DADOS_INCOMPLETOS` | 206 | "Resposta parcial da fonte." | Campos ausentes | Exibir indisponíveis | RN-030 |

---

## 11. Tratamento no cliente

| Status | Comportamento da UI |
|---|---|
| 400/422 | Marcar campos em erro; manter dados digitados |
| 401 | Redirecionar para login preservando destino |
| 403 | Tela de estado (e-mail não verificado / conta suspensa / sem permissão) |
| 404 | Estado "não encontrado" com link de retorno |
| 409 | Exibir diálogo explicando o conflito e a ação possível |
| 429 | Contador regressivo baseado em `Retry-After` |
| 500/502/503/504 | Mensagem amigável + `traceId`; nunca exibir stack |
| 206 | Exibir badge "dados parciais" e fontes ausentes |

---

## 12. Erros removidos

| Código | Motivo | Substituto |
|---|---|---|
| — | Nenhum erro foi removido nesta versão. | — |
