# INVESTMENT CONTROL — Gestão Inteligente de Investimentos

## 1. Objetivo do projeto

Desenvolver uma aplicação web para controle e acompanhamento de investimentos pessoais, com foco inicial em:

- Fundos de Investimento Imobiliário (FIIs).
- Renda fixa.
- Controle patrimonial.
- Distribuição dos investimentos por classe e segmento.
- Pesquisa de ativos por ticker.
- Análise de indicadores fundamentalistas.
- Planejamento mensal de aportes.
- Sugestão de alocação dos novos investimentos com base em regras previamente definidas.

O sistema deve funcionar como uma ferramenta de apoio à tomada de decisão, não como uma plataforma que recomenda compras automaticamente.

### Objetivo financeiro principal

Construir patrimônio no longo prazo, com horizonte inicial de 10 anos, reinvestindo integralmente os rendimentos.

**Alocação estratégica desejada:**

| Classe | Alocação |
|---|---:|
| Renda fixa | 50% |
| FIIs | 50% |
| Total | 100% |

A aplicação deverá comparar constantemente a carteira atual com essa distribuição.

---

# 2. Premissas técnicas

## 2.1 Arquitetura sugerida

- Frontend: aplicação web responsiva.
- Backend: API REST.
- Banco de dados: PostgreSQL.
- Hospedagem: Vercel.
- Banco hospedado: Neon.
- ORM: Prisma ou equivalente.
- Integrações externas: APIs públicas e provedores de dados financeiros.
- Autenticação: login individual.
- Moeda padrão: BRL.
- Idioma: português brasileiro.

A arquitetura deverá separar a interface, as regras de negócio, o acesso ao banco e as integrações externas.

Evitar chamadas de APIs financeiras diretamente pelo frontend. Toda integração deverá passar pelo backend, protegendo chaves de acesso e permitindo padronização dos dados.

## 2.2 Regras de arquitetura

- Não acoplar a aplicação a um único fornecedor de dados.
- Criar uma camada de integração por provedor.
- Registrar a origem e a data de referência de cada informação.
- Diferenciar dados atualizados, históricos, indisponíveis e estimados.
- Não substituir informações oficiais por valores estimados sem identificação.
- Permitir atualização manual e automática dos dados.
- Armazenar histórico de preços, indicadores e rendimentos quando disponível.
- Não realizar operações de compra ou venda de ativos.

---

# 3. ÉPICO 01 — Estrutura inicial e infraestrutura

### TASK 01.01 — Criar estrutura do projeto

- Criar estrutura inicial da aplicação.
- Separar frontend e backend, caso sejam projetos independentes.
- Configurar variáveis de ambiente.
- Configurar scripts de desenvolvimento e produção.
- Criar documentação inicial do projeto.

**Critérios de aceite:**
- Aplicação executa localmente.
- Estrutura organizada por módulos.
- Configurações de ambiente não ficam versionadas.

### TASK 01.02 — Configurar PostgreSQL no Neon

- Criar banco PostgreSQL.
- Configurar conexão.
- Configurar ORM e migrations.
- Criar estratégia de backup e recuperação compatível com o plano contratado.

**Critérios de aceite:**
- Backend conecta ao Neon.
- Migrations executam corretamente.
- Aplicação consegue persistir e consultar informações.

### TASK 01.03 — Configurar deploy na Vercel

- Configurar projeto na Vercel.
- Configurar variáveis de ambiente.
- Configurar integração com repositório Git.
- Configurar ambiente de produção.
- Validar conexão entre aplicação e Neon.

**Critérios de aceite:**
- Aplicação acessível por URL pública.
- Deploy automático após alterações na branch configurada.
- Banco acessível em produção.

---

# 4. ÉPICO 02 — Cadastro e controle de ativos

### TASK 02.01 — Criar cadastro de ativos

Criar cadastro genérico para suportar diferentes classes de investimentos.

Campos sugeridos:

- Código/ticker.
- Nome do ativo.
- Classe do ativo.
- Subclasse ou segmento.
- CNPJ, quando aplicável.
- Administrador ou emissor.
- Gestor, quando aplicável.
- Fonte dos dados.
- Status do ativo.
- Observações.

Classes iniciais:

- FII.
- Renda fixa.

Segmentos iniciais de FIIs:

- Logística.
- Shopping centers.
- Recebíveis imobiliários.
- Lajes corporativas.
- Renda urbana.
- Híbridos.
- Agronegócio.
- Outros.

### TASK 02.02 — Cadastro de movimentações

Permitir registrar:

- Compra.
- Venda.
- Recebimento de dividendos.
- Juros e rendimentos.
- Aplicação em renda fixa.
- Resgate de renda fixa.
- Taxas e custos.

Campos:

- Ativo.
- Tipo de movimentação.
- Data.
- Quantidade.
- Valor unitário.
- Valor total.
- Custos.
- Observações.

**Critérios de aceite:**
- O sistema calcula a posição atual com base nas movimentações.
- O preço médio é calculado considerando compras e vendas.
- Os rendimentos recebidos ficam registrados separadamente.
- Não permitir que uma movimentação inválida gere posição negativa sem confirmação e regra específica.

### TASK 02.03 — Criar carteira consolidada

Exibir:

- Patrimônio total.
- Patrimônio em renda fixa.
- Patrimônio em FIIs.
- Percentual por classe.
- Quantidade de ativos.
- Rendimentos mensais.
- Rendimentos acumulados.
- Evolução patrimonial.
- Distribuição por segmento.

---

# 5. ÉPICO 03 — Estratégia de alocação

Este módulo será responsável por aplicar as regras da estratégia de investimentos.

### TASK 03.01 — Configurar alocação estratégica

Criar configuração editável de alocação.

Configuração inicial:

| Classe | Meta |
|---|---:|
| Renda fixa | 50% |
| FIIs | 50% |

Permitir alterar os percentuais futuramente.

A soma das metas deverá ser sempre 100%.

### TASK 03.02 — Configurar distribuição dos FIIs por segmento

Meta inicial sugerida:

| Segmento | Meta |
|---|---:|
| Logística | 25% |
| Shopping centers | 15% |
| Renda urbana e híbridos | 15% |
| Recebíveis imobiliários | 25% |
| Lajes corporativas | 10% |
| Agronegócio | 5% |
| Caixa e oportunidades | 5% |
| Total | 100% |

As metas deverão ser editáveis.

### TASK 03.03 — Calcular desvios de alocação

O sistema deverá:

- Calcular o percentual atual de cada classe.
- Calcular o percentual atual de cada segmento.
- Comparar o percentual atual com a meta.
- Identificar classes abaixo da meta.
- Identificar segmentos abaixo da meta.
- Apresentar o valor necessário para atingir cada objetivo.

Exemplo:

| Classe | Atual | Meta | Situação |
|---|---:|---:|---|
| Renda fixa | 35% | 50% | Abaixo |
| FIIs | 65% | 50% | Acima |

### TASK 03.04 — Planejamento dos aportes mensais

Criar funcionalidade para informar o valor disponível para investimento no mês.

Exemplo:

- Aporte mensal: R$ 1.000.
- Meta renda fixa: 50%.
- Meta FIIs: 50%.

O sistema deverá considerar a carteira atual antes de sugerir a distribuição.

**Regra importante:** não dividir automaticamente o aporte em R$ 500 para cada classe. A sugestão deverá priorizar a classe que estiver mais distante da meta.

O sistema deverá apresentar:

- Valor sugerido para renda fixa.
- Valor sugerido para FIIs.
- Segmentos prioritários.
- Ativos que podem ser estudados.
- Justificativa da sugestão.

Não realizar compras automaticamente.

### TASK 03.05 — Simulador de aportes

Permitir simular diferentes valores de aporte:

- R$ 500.
- R$ 1.000.
- R$ 1.500.
- R$ 2.000.
- Valor personalizado.

Exibir como a carteira ficaria depois do aporte simulado.

---

# 6. ÉPICO 04 — Pesquisa de ativos e integração com APIs

### TASK 04.01 — Criar tela de pesquisa de ativos

Criar campo de pesquisa por ticker ou nome.

Exemplo:

Pesquisar: HGLG11

O sistema deverá consultar o provedor de dados e apresentar uma ficha detalhada do ativo.

A pesquisa não deverá exigir que o ativo já esteja cadastrado na carteira.

### TASK 04.02 — Criar camada de provedores financeiros

Criar uma interface padronizada para integração com diferentes fontes.

Exemplo conceitual:

- FiiDataProvider.
- CvmDataProvider.
- B3DataProvider.
- FixedIncomeDataProvider.

Cada provedor deverá implementar apenas as operações que realmente disponibiliza.

A aplicação deverá conseguir trocar o provedor sem alterar as regras de negócio.

### TASK 04.03 — Integrar dados públicos da CVM

Investigar e implementar a consulta aos dados abertos da CVM.

Priorizar:

- Cadastro do fundo.
- Informes mensais.
- Informes trimestrais.
- Demonstrações financeiras.
- Patrimônio líquido.
- Valor patrimonial por cota.
- Número de cotistas.
- Quantidade de cotas.
- Composição de ativos e passivos.
- Taxas informadas.
- Informações sobre imóveis e recebíveis, conforme disponibilidade.

Criar rotina de importação e armazenamento dos dados históricos.

### TASK 04.04 — Integrar dados de mercado

Investigar provedores para obter:

- Cotação atual ou último fechamento.
- Histórico de preços.
- Volume negociado.
- Dividendos distribuídos.
- Datas de pagamento.
- Dividend yield.
- P/VP.
- Patrimônio líquido.
- Valor patrimonial por cota.

Avaliar alternativas como brapi.dev e outros provedores compatíveis.

Não assumir que todos os endpoints são gratuitos. Registrar limites, autenticação, custos e condições de uso.

### TASK 04.05 — Criar ficha detalhada do FII

A ficha deverá apresentar:

**Identificação**
- Ticker.
- Nome.
- CNPJ.
- Segmento.
- Administrador.
- Gestor.
- Data de início, quando disponível.

**Indicadores**
- Preço atual ou último fechamento.
- Valor patrimonial por cota.
- P/VP.
- Patrimônio líquido.
- Número de cotistas.
- Dividend yield de 12 meses.
- Dividendos por cota.
- Histórico de distribuição.

**Riscos e características**
- Vacância física e financeira, quando disponível.
- Concentração de imóveis.
- Concentração de inquilinos.
- Exposição por região.
- Alavancagem.
- Qualidade e diversificação dos recebíveis.
- Inadimplência, quando aplicável.
- Prazo e indexadores dos contratos ou créditos.

**Histórico**
- Evolução dos preços.
- Evolução dos dividendos.
- Evolução do patrimônio líquido.
- Histórico de P/VP.

Cada informação deverá exibir sua data de referência e sua fonte.

### TASK 04.06 — Armazenar histórico das consultas

- Registrar quando o ativo foi consultado.
- Armazenar indicadores históricos.
- Evitar consultas repetidas desnecessárias.
- Criar política de cache.
- Permitir atualização manual.

Não tratar dados em cache como cotações em tempo real.

---

# 7. ÉPICO 05 — Análise e avaliação de FIIs

Criar módulo de avaliação dos fundos com critérios configuráveis.

### TASK 05.01 — Criar critérios de qualidade

Critérios iniciais para avaliação:

1. Segmento resiliente.
2. Patrimônio líquido superior a R$ 1 bilhão como referência inicial.
3. Histórico operacional superior a cinco anos.
4. Taxas de administração e gestão competitivas.
5. Gestora com histórico e reputação.
6. Diversificação de imóveis, inquilinos ou devedores.
7. Qualidade dos ativos.
8. Transparência dos relatórios.
9. Endividamento e alavancagem controlados.
10. Histórico de distribuição de rendimentos.

Os critérios deverão ser configuráveis.

### TASK 05.02 — Criar sistema de pontuação

Criar uma pontuação de 0 a 100 para facilitar a comparação.

Sugestão inicial de pesos:

| Critério | Peso |
|---|---:|
| Qualidade dos ativos | 20 |
| Diversificação | 15 |
| Saúde financeira | 15 |
| Histórico e gestão | 15 |
| Segmento e resiliência | 10 |
| Preço e valuation | 15 |
| Rendimentos e sustentabilidade | 10 |
| Total | 100 |

Cada avaliação deverá apresentar:

- Nota.
- Critérios atendidos.
- Critérios não atendidos.
- Informações indisponíveis.
- Justificativa.
- Data da análise.

**Regra:** não atribuir nota máxima quando não houver dados suficientes. Dados ausentes devem ser identificados, nunca presumidos.

### TASK 05.03 — Analisar P/VP corretamente

O sistema deverá apresentar o P/VP, mas não poderá considerar automaticamente que um fundo descontado é uma oportunidade.

Exemplos de fatores que podem justificar desconto:

- Vacância elevada.
- Imóveis deteriorados.
- Risco de crédito.
- Dificuldade financeira.
- Distribuição de rendimentos não sustentável.
- Problemas de gestão.
- Deterioração do patrimônio.

A análise deverá considerar o segmento e a qualidade dos ativos.

### TASK 05.04 — Avaliar sustentabilidade dos dividendos

Comparar:

- Rendimentos distribuídos.
- Resultado recorrente.
- Reservas acumuladas.
- Resultado não recorrente.
- Histórico de distribuição.
- Eventual distribuição superior ao resultado.

Criar alertas para possíveis distribuições não sustentáveis.

Não projetar dividendos futuros simplesmente repetindo o último pagamento.

### TASK 05.05 — Criar lista de observação

Permitir adicionar ativos à watchlist.

Informações:

- Ticker.
- Data de inclusão.
- Motivo do interesse.
- Preço de referência.
- P/VP de referência.
- Nota de qualidade.
- Status: estudar, acompanhar, aprovado, descartado.
- Observações pessoais.

---

# 8. ÉPICO 06 — Regras de decisão e controle de risco

### TASK 06.01 — Controle de concentração

Criar alertas para:

- Concentração excessiva em um único FII.
- Concentração excessiva em uma gestora.
- Concentração excessiva em um segmento.
- Concentração em um único emissor ou devedor.
- Exposição elevada a um mesmo imóvel ou inquilino.

Os limites deverão ser configuráveis.

### TASK 06.02 — Regras para novos investimentos

Antes de sugerir um novo investimento, verificar:

- A classe está abaixo da meta?
- O segmento está abaixo da meta?
- O ativo já existe na carteira?
- O ativo aumentará a concentração?
- O ativo possui dados suficientes?
- O ativo atende aos critérios mínimos de qualidade?
- Existe algum alerta relevante?
- O preço atual está dentro dos parâmetros de avaliação?

O sistema deverá diferenciar:

- Abaixo da meta e apto para estudo.
- Abaixo da meta, mas com riscos.
- Dentro da meta.
- Acima da meta.
- Sem dados suficientes.

### TASK 06.03 — Criar histórico das recomendações

Registrar cada sugestão gerada pelo sistema:

- Data.
- Valor disponível.
- Distribuição atual.
- Distribuição sugerida.
- Ativos avaliados.
- Justificativas.
- Alertas.
- Decisão do usuário.

O usuário poderá aceitar, ignorar ou alterar a sugestão.

---

# 9. ÉPICO 07 — Controle de renda fixa

### TASK 07.01 — Cadastrar investimentos em renda fixa

Permitir cadastro de:

- Tesouro Selic.
- Tesouro IPCA+.
- Tesouro Prefixado.
- CDB.
- LCI.
- LCA.
- Debêntures.
- Outros títulos.

Campos:

- Instituição emissora.
- Produto.
- Indexador.
- Taxa contratada.
- Data da aplicação.
- Vencimento.
- Valor aplicado.
- Saldo atualizado.
- Liquidez.
- Carência.
- Cobertura do FGC, quando aplicável.
- Observações.

### TASK 07.02 — Acompanhar vencimentos e liquidez

Criar alertas de:

- Vencimentos próximos.
- Períodos de carência.
- Produtos sem liquidez diária.
- Concentração por instituição.
- Limites de cobertura do FGC.

### TASK 07.03 — Atualizar valores da renda fixa

Permitir atualização manual inicialmente.

Futuramente, avaliar integração com fontes de indicadores econômicos para auxiliar na atualização de rendimentos.

Diferenciar saldo informado, saldo estimado e saldo confirmado.

---

# 10. ÉPICO 08 — Dashboard

### TASK 08.01 — Criar painel principal

Exibir:

- Patrimônio total.
- Total investido.
- Valor atual.
- Resultado acumulado.
- Renda mensal recebida.
- Rendimentos acumulados no ano.
- Percentual em renda fixa.
- Percentual em FIIs.
- Comparação com meta 50/50.

### TASK 08.02 — Criar gráficos

- Distribuição por classe.
- Distribuição por segmento.
- Evolução patrimonial.
- Evolução dos rendimentos.
- Histórico de aportes.
- Histórico de dividendos.

### TASK 08.03 — Criar painel de oportunidades

Exibir:

- Segmentos abaixo da meta.
- Classes abaixo da meta.
- Ativos da watchlist.
- Fundos com alertas.
- Sugestão de distribuição do aporte mensal.

---

# 11. ÉPICO 09 — Projeções de longo prazo

### TASK 09.01 — Criar simulador patrimonial

Parâmetros:

- Patrimônio inicial.
- Aporte mensal.
- Prazo.
- Inflação estimada.
- Retorno real estimado.
- Reinvestimento dos rendimentos.

Permitir simular cenários conservador, moderado e otimista.

### TASK 09.02 — Projetar renda futura

Apresentar estimativas de renda mensal futura com diferentes taxas de distribuição.

Deixar explícito que retorno total, valorização e distribuição de rendimentos são conceitos diferentes.

Exibir valores em reais de hoje e valores nominais projetados.

### TASK 09.03 — Comparar cenários

Comparar:

- 5 anos.
- 10 anos.
- 15 anos.
- 20 anos.

Apresentar patrimônio estimado e renda mensal potencial.

---

# 12. ÉPICO 10 — Qualidade, segurança e observabilidade

### TASK 10.01 — Segurança

- Proteger rotas privadas.
- Proteger credenciais.
- Validar entradas.
- Implementar controle de acesso.
- Evitar exposição de dados pessoais.
- Nunca armazenar senhas em texto puro.

### TASK 10.02 — Tratamento de erros de provedores

- Timeout.
- Limite de requisições.
- Indisponibilidade.
- Dados incompletos.
- Respostas inválidas.
- Falha de autenticação.

A indisponibilidade de uma API não deverá impedir o usuário de consultar seus dados já armazenados.

### TASK 10.03 — Rastreabilidade

Registrar:

- Fonte dos dados.
- Data de consulta.
- Data de referência.
- Última atualização.
- Eventuais inconsistências.

---

# 13. Modelo inicial de dados

Entidades sugeridas:

- USUARIO
- ATIVO
- CLASSE_ATIVO
- SEGMENTO_ATIVO
- MOVIMENTACAO
- POSICAO_ATIVO
- RENDIMENTO
- INVESTIMENTO_RENDA_FIXA
- ALOCACAO_META
- CRITERIO_AVALIACAO
- AVALIACAO_ATIVO
- HISTORICO_INDICADOR
- HISTORICO_PRECO
- WATCHLIST
- SUGESTAO_APORTE
- PROVEDOR_DADOS
- LOG_INTEGRACAO

O modelo deverá ser normalizado e evitar duplicação de dados entre carteira, movimentações e histórico.

---

# 14. Ordem de implementação

## FASE 1 — MVP: controle patrimonial

1. Estrutura do projeto.
2. Banco Neon.
3. Deploy Vercel.
4. Cadastro de ativos.
5. Cadastro de movimentações.
6. Cadastro de renda fixa.
7. Carteira consolidada.
8. Dashboard.
9. Configuração da meta 50/50.

**Resultado esperado:** conseguir controlar todo o patrimônio em um único lugar.

## FASE 2 — Planejamento de aportes

1. Distribuição por segmento.
2. Cálculo de desvios.
3. Simulador de aportes.
4. Regras de concentração.
5. Sugestões de alocação.

**Resultado esperado:** saber onde direcionar os próximos R$ 1.000.

## FASE 3 — Pesquisa de FIIs

1. Camada de provedores.
2. Integração CVM.
3. Integração de dados de mercado.
4. Pesquisa por ticker.
5. Ficha detalhada do fundo.
6. Histórico de indicadores.
7. Watchlist.

**Resultado esperado:** pesquisar HGLG11, por exemplo, e consultar seus principais dados sem precisar acessar vários sites.

## FASE 4 — Inteligência e análise

1. Critérios de qualidade.
2. Pontuação dos fundos.
3. Avaliação de riscos.
4. Sustentabilidade dos dividendos.
5. Alertas.
6. Histórico de recomendações.

**Resultado esperado:** comparar ativos usando regras consistentes e transparentes.

## FASE 5 — Projeções e evolução

1. Simulador de longo prazo.
2. Projeção de renda futura.
3. Comparação de cenários.
4. Histórico de evolução patrimonial.
5. Melhorias de interface e experiência.

---

# 15. Regras fundamentais do sistema

1. A meta estratégica inicial é 50% renda fixa e 50% FIIs.
2. O sistema deve priorizar o rebalanceamento por novos aportes, evitando vendas desnecessárias.
3. Não comprar um ativo apenas porque seu P/VP está abaixo de 1.
4. Não comprar um ativo apenas porque apresenta dividend yield elevado.
5. Qualidade e sustentabilidade devem ter prioridade sobre rendimento imediato.
6. Evitar concentração excessiva em um único ativo, gestor, segmento ou devedor.
7. Não sugerir investimentos sem apresentar os motivos.
8. Dados ausentes não podem ser tratados como indicadores positivos.
9. Todo dado externo deverá ter fonte e data de referência.
10. O usuário sempre terá a decisão final.
11. Dividendos serão registrados e poderão ser considerados como recursos disponíveis para reinvestimento.
12. As projeções deverão considerar inflação e distinguir retorno real de retorno nominal.
13. O sistema não deverá prometer rentabilidade nem tratar projeções como garantias.
14. Regras e pesos deverão ser configuráveis, sem necessidade de alterar código.

---

# 16. Diretriz para o agente de IA

Antes de implementar qualquer funcionalidade:

- Ler este documento integralmente.
- Analisar a estrutura existente do projeto.
- Identificar tecnologias e padrões já adotados.
- Não recriar funcionalidades existentes.
- Propor alterações de arquitetura antes de mudanças estruturais.
- Implementar uma task por vez.
- Não avançar para a próxima task sem validar a anterior.
- Criar migrations para alterações no banco.
- Criar testes para regras financeiras.
- Manter documentação técnica atualizada.
- Não inventar informações financeiras.
- Não utilizar valores simulados como se fossem dados reais.

**Importante:** a primeira entrega deverá contemplar somente a FASE 1. As demais fases devem permanecer documentadas e aguardando implementação.

O objetivo é construir uma aplicação confiável, evolutiva e simples de manter, que funcione como o centro de controle da carteira de investimentos pessoais.