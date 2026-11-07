---
project: INVESTMENT CONTROL
module: qualidade
audience: [tecnica, negocio]
status: draft
---

# Critérios de Aceitação — Investment Control

> **Derivado de:** `REQUIREMENTS.md` (RN-001 a RN-088).
> **Formato:** Dado / Quando / Então. Um critério por regra; eventos críticos têm critérios adicionais.

---

## 1. Como usar

- Cada `AC-NNN` é verificável por teste automatizado (Vitest/Playwright) ou por roteiro manual documentado.
- Uma entrega só é aceita quando **todos** os AC das RNs do seu escopo estão verdes.
- AC derivado de RN `[derivado]` só vale após o aceite da RN correspondente.

---

## 2. Critérios

| AC | RN | Dado | Quando | Então |
|---|---|---|---|---|
| AC-001 | RN-001 | Uma tela precisa de cotação externa | o navegador faz a requisição | a chamada parte do backend; nenhuma URL de provedor aparece no bundle do cliente |
| AC-002 | RN-002 | Dois provedores implementam a mesma capacidade | o provedor preferido é desativado por configuração | a operação continua funcionando sem alteração de código de domínio |
| AC-003 | RN-003 | Um dado de mercado foi coletado | ele é persistido ou exibido | `fonte` e `data_referencia` estão preenchidos e visíveis |
| AC-004 | RN-004 | Um valor é estimado | ele aparece na tela | há identificação textual e visual de "estimado" |
| AC-005 | RN-005 | Existe dado atualizável | o titular aciona atualização manual | o valor é recoletado e o histórico recebe novo registro |
| AC-006 | RN-006 | A fonte disponibiliza série | uma coleta ocorre | os pontos históricos são gravados com data de referência |
| AC-007 | RN-007 | Qualquer sessão | se procura endpoint de compra/venda | nenhum endpoint de ordem existe (404) |
| AC-008 | RN-008 | O sistema está em uso | um valor ou data é exibido | o formato é BRL/DD-MM-AAAA e o texto está em PT-BR |
| AC-009 | RN-009 | Um visitante não autenticado | acessa `/carteira` | é redirecionado ao login e nenhum dado é retornado |
| AC-010 | RN-010 | Cadastro de ativo | todos os campos obrigatórios estão preenchidos | o ativo é criado e listado na carteira |
| AC-011 | RN-011 | Nova classe de ativo é necessária | é inserida na tabela `classe_ativo` | o cadastro aceita a nova classe sem alteração de schema |
| AC-012 | RN-012 | Cadastro de FII | o segmento é escolhido | apenas os segmentos iniciais estão disponíveis |
| AC-013 | RN-013 | Ativo marcado como inativo | é gerada uma sugestão de aporte | o ativo não aparece como candidato, mas continua na carteira |
| AC-014 | RN-014 | Registro de movimentação | cada tipo é selecionado | os campos exigidos mudam conforme o tipo e são validados |
| AC-015 | RN-015 | Existem movimentações | a carteira é consultada | a posição corresponde à soma das movimentações não canceladas |
| AC-016 | RN-016 | Há compras e vendas | uma nova compra é registrada | o preço médio é recalculado ponderando quantidade e custo |
| AC-017 | RN-017 | Um dividendo é recebido | a carteira é exibida | o rendimento aparece separado do resultado de capital |
| AC-018 | RN-018 | Posição atual é 10 cotas | uma venda de 15 é registrada | o sistema bloqueia e pede confirmação explícita + motivo |
| AC-019 | RN-019 | Quantidade 10 e unitário 100 | o valor total informado é 1005,00 | o sistema alerta a diferença e exige observação |
| AC-020 | RN-020 | Há FII e renda fixa | a carteira consolidada abre | os nove indicadores de RN-020 são exibidos |
| AC-021 | RN-021 | Metas 60% e 30% | o titular tenta salvar | o sistema recusa com "soma deve ser 100%" |
| AC-022 | RN-022 | Metas de segmento somam 95% | o titular tenta salvar | o sistema recusa e informa quanto falta |
| AC-023 | RN-023 | Carteira com 40% em RF | o cálculo roda | o percentual por classe e por segmento é exibido |
| AC-024 | RN-024 | RF está em 40% e a meta é 50% | a tela de desvios abre | aparece "abaixo", desvio de −10 p.p. e o valor para atingir |
| AC-025 | RN-025 | O titular informa R$ 1.000 | a sugestão é solicitada | o cálculo considera a carteira atual antes do aporte |
| AC-026 | RN-026 | RF está a −10 p.p. e FII a +10 p.p. | a sugestão é gerada | o valor total é direcionado à classe mais distante, não dividido 50/50 |
| AC-027 | RN-027 | Uma sugestão foi gerada | a tela é exibida | contém valores por classe, segmentos prioritários, ativos e justificativa |
| AC-028 | RN-028 | Simulação com R$ 1.500 | o resultado é exibido | a carteira "depois" reflete o aporte e nada é persistido na carteira real |
| AC-029 | RN-029 | Ticker não cadastrado | a pesquisa é feita | a ficha é apresentada sem exigir cadastro |
| AC-030 | RN-030 | Provedor sem dados de dividendos | a operação é solicitada | retorna "não disponível", nunca zero |
| AC-031 | RN-031 | Dados CVM disponíveis | a importação roda | informes e indicadores prioritários são armazenados |
| AC-032 | RN-032 | Importação CVM concluída | o histórico é consultado | cada registro tem competência e arquivo de origem |
| AC-033 | RN-033 | Provedor de mercado disponível | a ficha é aberta | cotação, histórico, dividendos e indicadores são exibidos com fonte |
| AC-034 | RN-034 | Provedor cadastrado | as configurações abrem | limite, autenticação e custo estão documentados |
| AC-035 | RN-035 | Ficha de FII | a tela abre | identificação, indicadores, riscos e histórico estão presentes |
| AC-036 | RN-036 | Qualquer valor na ficha | é exibido | fonte e data de referência acompanham o valor |
| AC-037 | RN-037 | Ativo consultado duas vezes em 5 min | a segunda consulta ocorre | usa cache e registra apenas uma chamada ao provedor |
| AC-038 | RN-038 | Valor veio do cache | é exibido | há indicação do instante da coleta; não é rotulado "tempo real" |
| AC-039 | RN-039 | Avaliação solicitada | os critérios são carregados | os 10 critérios da especificação estão disponíveis |
| AC-040 | RN-040 | Pesos configurados | a nota é calculada | a soma dos pesos é 100 e a nota fica entre 0 e 100 |
| AC-041 | RN-041 | Avaliação concluída | é exibida | mostra nota, atendidos, não atendidos, indisponíveis, justificativa e data |
| AC-042 | RN-042 | Faltam dados de vacância | a nota é calculada | o critério é marcado indisponível e não recebe pontuação máxima |
| AC-043 | RN-043 | P/VP = 0,70 | a análise é exibida | há P/VP e nenhuma conclusão automática de "oportunidade" |
| AC-044 | RN-044 | P/VP < 1 e vacância alta | a análise roda | o desconto é contextualizado com os fatores de risco |
| AC-045 | RN-045 | Histórico de distribuição existe | a análise roda | distribuições são comparadas a resultado recorrente e reservas |
| AC-046 | RN-046 | Distribuição acima do resultado | a análise roda | é gerado alerta com os componentes que o motivaram |
| AC-047 | RN-047 | Projeção de dividendos | o cálculo roda | não usa simplesmente o último pagamento como projeção |
| AC-048 | RN-048 | Ativo na watchlist | é consultado | todos os campos e o status estão registrados |
| AC-049 | RN-049 | Limite de 20% por ativo | a concentração chega a 25% | é gerado alerta de concentração |
| AC-050 | RN-050 | Sugestão de novo investimento | o checklist roda | as oito verificações são registradas no resultado |
| AC-051 | RN-051 | Ativo candidato | é classificado | recebe exatamente uma das cinco classificações previstas |
| AC-052 | RN-052 | Sugestão emitida | o histórico é consultado | data, valor, distribuições, ativos, justificativas e alertas estão gravados |
| AC-053 | RN-053 | Sugestão exibida | o titular escolhe "ignorar" | a decisão é registrada e a sugestão original permanece |
| AC-054 | RN-054 | Carteira desbalanceada | a sugestão é gerada | prioriza aporte e não propõe venda |
| AC-055 | RN-055 | Ativo com P/VP 0,80 e dados ruins | a sugestão roda | não é recomendado apenas pelo P/VP |
| AC-056 | RN-056 | Ativo com DY 15% | a sugestão roda | não é recomendado apenas pelo DY |
| AC-057 | RN-057 | Cadastro de CDB | o formulário é enviado | todos os campos de RN-057 são persistidos |
| AC-058 | RN-058 | Título vence em 20 dias | a tela abre | há alerta de vencimento próximo |
| AC-059 | RN-059 | Saldo atualizado | é salvo | o status é `INFORMADO`, `ESTIMADO` ou `CONFIRMADO` |
| AC-060 | RN-060 | Fase 1 em produção | a integração de indicadores é procurada | não existe; atualização manual funciona |
| AC-061 | RN-061 | Dashboard aberto | os dados carregam | os nove indicadores de RN-061 são exibidos |
| AC-062 | RN-062 | Existem dados históricos | os gráficos carregam | os seis gráficos previstos estão disponíveis |
| AC-063 | RN-063 | Painel de oportunidades | é acessado | exibe classes/segmentos abaixo da meta, watchlist, alertas e sugestão |
| AC-064 | RN-064 | Parâmetros informados | a simulação roda | três cenários são calculados com reinvestimento |
| AC-065 | RN-065 | Projeção de renda | o resultado abre | valores reais e nominais são exibidos e os conceitos são distinguidos |
| AC-066 | RN-066 | Comparador aberto | os prazos são exibidos | 5, 10, 15 e 20 anos aparecem com patrimônio e renda |
| AC-067 | RN-067 | Requisição sem sessão | acessa rota privada | recebe 401 e nenhum dado |
| AC-068 | RN-068 | Repositório clonado | é inspecionado | não há segredo versionado; `.env.example` sem valores |
| AC-069 | RN-069 | Payload com data inválida | é enviado | recebe 422 com erro no campo `data` |
| AC-070 | RN-070 | Usuário A autenticado | solicita ativo do usuário B | recebe 404 e nenhum dado é exposto |
| AC-071 | RN-071 | Usuário cadastrado | o banco é inspecionado | `senha_hash` é Argon2id e não há senha em texto |
| AC-072 | RN-072 | Provedor retorna timeout | a ficha é aberta | erro é registrado, a tela degrada e o titular vê mensagem amigável |
| AC-073 | RN-073 | Provedor indisponível | a carteira é consultada | dados armazenados continuam visíveis |
| AC-074 | RN-074 | Integração executada | o log é consultado | fonte, consulta, referência, atualização e inconsistências estão registrados |
| AC-075 | RN-075 | Ativo com DY alto e qualidade baixa | a avaliação roda | qualidade/sustentabilidade pesam mais que o rendimento imediato |
| AC-076 | RN-076 | Sugestão exibida | é lida | toda linha possui motivo associado |
| AC-077 | RN-077 | Campo ausente na fonte | a avaliação roda | ausência é exibida como tal e não eleva a nota |
| AC-078 | RN-078 | Sugestão gerada | o titular não age | nada é alterado na carteira |
| AC-079 | RN-079 | Dividendos registrados | o planejamento do mês abre | o valor pode ser considerado recurso para reinvestimento |
| AC-080 | RN-080 | Projeção calculada | o resultado abre | há valor real e nominal, com inflação informada |
| AC-081 | RN-081 | Projeção exibida | a tela abre | há aviso de que não é garantia de rentabilidade |
| AC-082 | RN-082 | Metas e pesos | são alterados | a mudança vale sem deploy e fica versionada por vigência |
| AC-083 | RN-083 | Fase 1 entregue | os épicos 3 a 9 são procurados | nenhuma funcionalidade fora da Fase 1 está implementada |
| AC-084 | RN-084 | Modelo implantado | é inspecionado | não há duplicação de posição/movimentação/histórico como fonte primária |
| AC-085 | RN-085 | Visitante envia cadastro válido | o formulário é submetido | conta criada como `PENDENTE_VERIFICACAO`; login recusado até verificar |
| AC-086 | RN-086 | Pedido de redefinição | o e-mail não existe | a resposta é idêntica à de e-mail existente |
| AC-087 | RN-087 | Cadastro sem aceite da privacidade | o formulário é enviado | é recusado com `AUTH_ACEITE_OBRIGATORIO` |
| AC-088 | RN-088 | Titular solicita encerramento | confirma a senha | sessões são invalidadas e dados pessoais são anonimizados |
| AC-089 | RN-089 | Carteira com patrimônio total de 100.000 e 15.000 em logística | o percentual por segmento é calculado | logística aparece com 15% (base = patrimônio total), e "Caixa e Oportunidades" entra na mesma base |
| AC-090 | RN-090 | Classe com desvio de +0,4 p.p. | a classificação é calculada | a situação é "dentro"; com +0,6 p.p. a situação é "acima" |
| AC-091 | RN-091 | Ativo sem preço de mercado | a carteira é consolidada | a posição entra pelo custo e é marcada como "valor indisponível", nunca zero |

---

## 3. Critérios adicionais (eventos críticos)

| AC | RN | Dado | Quando | Então |
|---|---|---|---|---|
| AC-018b | RN-018 | Posição negativa confirmada | a movimentação é gravada | auditoria registra motivo, usuário e instante |
| AC-021b | RN-021 | Metas vigentes existem | nova configuração é salva | a anterior recebe `vigencia_fim` e o histórico é preservado |
| AC-037b | RN-037 | Cache expirado | a consulta ocorre | provedor é chamado e o histórico recebe novo ponto |
| AC-049b | RN-049 | Limite de gestora configurado | a gestora ultrapassa o limite | o alerta identifica a gestora e o percentual excedido |
| AC-072b | RN-072 | Provedor responde 429 | a integração roda | erro é classificado como `INT_LIMITE_EXCEDIDO` e há backoff |
| AC-085b | RN-085 | Token de verificação expirado | o link é aberto | retorna 410 e oferece reenvio |
| AC-086b | RN-086 | Token de redefinição já usado | o link é reaberto | retorna 409 e não permite nova troca |
| AC-088b | RN-088 | Conta encerrada | login é tentado | retorna `AUTH_CREDENCIAIS_INVALIDAS` sem revelar exclusão |

---

## 4. Cobertura

| Faixa | Critérios | Situação |
|---|---|---|
| RN-001 a RN-084 | AC-001 a AC-084 | especificados |
| RN-085 a RN-088 | AC-085 a AC-088 | especificados |
| RN-089 | AC-089 | especificado |
| RN-090, RN-091 | AC-090, AC-091 | especificados |
| Eventos críticos | 8 critérios adicionais | especificados |
| **Total** | **99 critérios** | — |
