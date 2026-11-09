---
project: INVESTMENT CONTROL
module: requisitos
audience: [tecnica, negocio]
status: draft
---

# Investment Control — Gestão Inteligente de Investimentos

> **Última atualização:** 07/11/2026
> **Objetivo:** Consolidar o patrimônio pessoal (FIIs e renda fixa), comparar a carteira com a estratégia 50/50 e apoiar a decisão de onde aportar, com dados rastreáveis e regras explícitas.
> **Fonte:** `docs/expecificaçoes.md` (documento do proprietário, 07/11/2026).

**Legenda de status das RNs:**

| Marca | Significado |
|---|---|
| `[confirmado]` | Regra declarada explicitamente no documento de especificação |
| `[derivado]` | Regra inferida por necessidade de consistência — **requer validação do proprietário** |
| `[confirmado]` + `[derivado]` | Núcleo declarado, detalhamento inferido |

> **Atenção:** as RNs `[derivado]` foram marcadas para revisão. Nenhuma delas deve orientar código antes do aceite — ver `PEND` correspondente quando houver.

---

## 1. Escopo

Dentro do escopo:

- Cadastro genérico de ativos (FII e renda fixa) com classe, segmento e status.
- Registro de movimentações (compra, venda, dividendos, juros/rendimentos, aplicação, resgate, taxas) e cálculo de posição e preço médio.
- Carteira consolidada, dashboard e evolução patrimonial.
- Metas de alocação por classe (default 50% RF / 50% FII) e por segmento de FII, editáveis.
- Cálculo de desvios, sugestão de distribuição do aporte mensal e simulador de aportes.
- Pesquisa de FIIs por ticker/nome com ficha detalhada e camada de provedores de dados.
- Critérios e pontuação de qualidade de FII, watchlist e histórico de recomendações.
- Controle de renda fixa (vencimentos, liquidez, concentração, FGC).
- Regras de concentração e alertas.
- Projeções patrimoniais e de renda futura.
- Segurança, tratamento de erro de provedores e rastreabilidade de dados.
- Cadastro aberto de conta com verificação de e-mail, redefinição de senha e aceite legal.

> Fora do escopo:
> - Execução de ordens, integração com corretoras e custódia.
> - Recomendação automática de compra/venda.
> - Apuração fiscal (IR, DARF) e obrigações acessórias.
> - Aplicativo mobile nativo.
> - Cotação em tempo real.
> - Criptoativos, ações e fundos não imobiliários na primeira versão.
> - Multiusuário com contas independentes na primeira versão (`PEND-002`).

---

## 2. Atores e Permissões

| Papel | Pode fazer | Não pode fazer |
|---|---|---|
| Titular (usuário autenticado) | Cadastrar ativos e movimentações; consultar carteira, dashboards e projeções; pesquisar ativos; configurar metas, critérios, pesos e limites; aceitar, ignorar ou alterar sugestões; encerrar a própria conta | Acessar dados de outro usuário; executar ordens; alterar histórico de movimentação sem registro de correção |
| Visitante (não autenticado) | Criar conta, verificar e-mail, solicitar redefinição de senha | Acessar qualquer dado de carteira, ativo, movimentação ou configuração |
| Sistema (automático) | Importar dados de provedores; calcular posição, desvio, nota e sugestão; gerar alertas e registrar proveniência | Decidir aporte pelo usuário; comprar ou vender ativos; tratar dado estimado como oficial |

---

## 3. Estrutura da Aplicação

Aplicação web responsiva em português brasileiro, organizada em quatro camadas (ver `specs/ARCHITECTURE.md`):

1. **Apresentação** — telas de dashboard, carteira, ativos, movimentações, renda fixa, pesquisa, avaliação, configurações e projeções.
2. **Domínio** — casos de uso e cálculos financeiros (posição, preço médio, alocação, desvio, pontuação, projeção), sem dependência de framework.
3. **Persistência** — PostgreSQL (Neon) via Prisma, com migrations versionadas.
4. **Integrações** — camada de provedores de dados (CVM, mercado, renda fixa), com cache, normalização e log de integração.

Regra estrutural: a interface nunca consome API financeira externa diretamente (`RN-001`).

---

## 4. Conceitos de Domínio

| Termo | API | Descrição |
|---|---|---|
| Ativo | `Ativo` | Instrumento financeiro identificado por ticker/código; pertence a uma classe e, quando FII, a um segmento |
| Classe de ativo | `ClasseAtivo` | Agrupamento de alocação: Renda Fixa ou FII (extensível) |
| Segmento | `SegmentoAtivo` | Subdivisão de FII (logística, shopping, recebíveis, lajes, renda urbana/híbrido, agro, outros) |
| Movimentação | `Movimentacao` | Evento que altera posição, caixa ou rendimento (compra, venda, dividendo, juros, aplicação, resgate, taxa) |
| Posição | `PosicaoAtivo` | Quantidade e custo médio de um ativo em uma data, derivados das movimentações |
| Preço médio | `preco_medio` | Custo médio ponderado por quantidade, atualizado a cada compra/venda |
| Rendimento | `Rendimento` | Valor recebido sem contrapartida de venda (dividendo, juro, amortização) |
| Patrimônio | — | Soma do valor atual das posições de FII e do saldo da renda fixa |
| Meta de alocação | `AlocacaoMeta` | Percentual alvo por classe ou segmento, com vigência |
| Desvio | — | Diferença entre percentual atual e meta, em pontos percentuais e em reais |
| Aporte | — | Valor novo destinado a investimento em um mês |
| Provedor | `ProvedorDados` | Fonte externa de dados financeiros com capacidades, limites e custo declarados |
| Status do dado | `StatusDado` | `OFICIAL`, `MERCADO`, `ESTIMADO`, `HISTORICO`, `INDISPONIVEL` |
| Nota de qualidade | `AvaliacaoAtivo.nota` | Pontuação 0–100 de um FII segundo critérios e pesos configurados |
| Conta | `Usuario` | Identidade do titular: e-mail único, senha e estado de verificação |
| Token de conta | `TokenConta` | Token de uso único para verificação de e-mail ou redefinição de senha |
| Aceite legal | `AceiteLegal` | Evidência versionada de aceite dos Termos de Uso e da Política de Privacidade |

---

## 5. Regras de Negócio

### 5.1 Arquitetura de dados e integrações

- **RN-001** `[confirmado]` (07/11/2026) — `[indesejado]` Se uma tela precisar de dado financeiro externo, então a requisição SHALL passar pelo backend; o frontend MUST NOT chamar API financeira diretamente nem receber chave de acesso.
- **RN-002** `[confirmado]` (07/11/2026) — `[ubíquo]` Toda fonte externa SHALL ser acessada por uma camada de provedor com contrato padronizado, e a troca de provedor MUST NOT exigir alteração de regra de negócio.
- **RN-003** `[confirmado]` (07/11/2026) — `[ubíquo]` Todo dado externo armazenado ou exibido SHALL registrar a fonte e a data de referência.
- **RN-004** `[confirmado]` (07/11/2026) — `[ubíquo]` O sistema SHALL classificar cada dado como atualizado, histórico, indisponível ou estimado, e MUST NOT apresentar valor estimado como oficial sem identificação visual.
- **RN-005** `[confirmado]` (07/11/2026) — `[opcional]` Onde o dado puder ser atualizado, o sistema SHALL permitir atualização manual e automática.
- **RN-006** `[confirmado]` (07/11/2026) — `[evento]` Quando um preço, indicador ou rendimento for coletado, o sistema SHALL armazenar o histórico quando a fonte disponibilizar série.
- **RN-007** `[confirmado]` (07/11/2026) — `[indesejado]` O sistema MUST NOT executar, intermediar ou instruir compra e venda de ativos.
- **RN-008** `[confirmado]` (07/11/2026) — `[ubíquo]` A moeda padrão SHALL ser BRL e o idioma da interface SHALL ser português brasileiro.
- **RN-009** `[confirmado]` (07/11/2026) — `[ubíquo]` O acesso SHALL ser individual e autenticado; dados de carteira, movimentação e configuração MUST NOT ser acessíveis sem sessão válida.
- **RN-084** `[derivado]` (07/11/2026) — `[ubíquo]` O modelo de dados SHALL ser normalizado, e posição, movimentação e histórico MUST NOT duplicar o mesmo fato em tabelas diferentes.

### 5.2 Cadastro de ativos

- **RN-010** `[confirmado]` (07/11/2026) — `[evento]` Quando o titular cadastrar um ativo, o sistema SHALL exigir código/ticker, nome, classe e status, e SHALL aceitar subclasse/segmento, CNPJ, administrador/emissor, gestor, fonte dos dados e observações.
- **RN-011** `[confirmado]` (07/11/2026) — `[ubíquo]` As classes iniciais SHALL ser FII e Renda Fixa, e o cadastro SHALL suportar novas classes sem alteração de esquema.
- **RN-012** `[confirmado]` (07/11/2026) — `[ubíquo]` Os segmentos iniciais de FII SHALL ser Logística, Shopping Centers, Recebíveis Imobiliários, Lajes Corporativas, Renda Urbana, Híbridos, Agronegócio e Outros.
- **RN-013** `[derivado]` (07/11/2026) — `[estado]` Enquanto um ativo estiver inativo, ele SHALL permanecer no histórico e na carteira, mas MUST NOT ser candidato em novas sugestões de aporte.

### 5.3 Movimentações e posição

- **RN-014** `[confirmado]` (07/11/2026) — `[ubíquo]` O sistema SHALL registrar os tipos de movimentação: compra, venda, recebimento de dividendos, juros/rendimentos, aplicação em renda fixa, resgate de renda fixa e taxas/custos.
- **RN-015** `[confirmado]` (07/11/2026) — `[ubíquo]` A posição atual SHALL ser calculada a partir das movimentações registradas, e MUST NOT ser editada manualmente como fonte primária.
- **RN-016** `[confirmado]` (07/11/2026) — `[evento]` Quando houver compra ou venda, o sistema SHALL recalcular o preço médio ponderado considerando o custo das compras e a baixa proporcional das vendas.
- **RN-017** `[confirmado]` (07/11/2026) — `[ubíquo]` Rendimentos recebidos SHALL ser registrados separadamente do resultado de capital (valorização e realização).
- **RN-018** `[confirmado]` (07/11/2026) — `[indesejado]` Se uma movimentação resultar em posição negativa, então o sistema MUST NOT gravá-la sem confirmação explícita do titular e sem regra específica documentada.
- **RN-019** `[derivado]` (07/11/2026) — `[evento]` Quando o titular informar quantidade, valor unitário, custos e valor total, o sistema SHALL validar `valor_total = quantidade × valor_unitário + custos` (tolerância de R$ 0,01) e SHALL exigir justificativa quando a diferença for maior.

### 5.4 Carteira consolidada

- **RN-020** `[confirmado]` (07/11/2026) — `[ubíquo]` A carteira consolidada SHALL exibir patrimônio total, patrimônio em renda fixa, patrimônio em FIIs, percentual por classe, quantidade de ativos, rendimentos do mês, rendimentos acumulados, evolução patrimonial e distribuição por segmento.
- **RN-091** `[confirmado]` (07/11/2026) — `[estado]` Enquanto não houver cotação disponível para um ativo, sua posição SHALL ser avaliada pelo custo de aquisição e SHALL ser marcada como "valor indisponível", nunca como zero.
  > Confirmada na revisão das features da Fase 1 em 07/11/2026.

### 5.5 Estratégia de alocação e aportes

- **RN-021** `[confirmado]` (07/11/2026) — `[evento]` Quando o titular salvar a alocação estratégica, o sistema SHALL validar que a soma das metas por classe é exatamente 100%; a configuração inicial SHALL ser 50% renda fixa e 50% FIIs.
- **RN-022** `[confirmado]` (07/11/2026) — `[evento]` Quando o titular salvar a distribuição de FIIs por segmento, o sistema SHALL validar soma de 100%; a meta inicial SHALL ser Logística 25%, Shopping Centers 15%, Renda Urbana e Híbridos 15%, Recebíveis Imobiliários 25%, Lajes Corporativas 10%, Agronegócio 5%, Caixa e Oportunidades 5%.
- **RN-023** `[confirmado]` (07/11/2026) — `[ubíquo]` O sistema SHALL calcular o percentual atual de cada classe e de cada segmento sobre o patrimônio total (conforme RN-089).
- **RN-089** `[confirmado]` (07/11/2026) — `[ubíquo]` O percentual por segmento SHALL ser calculado sobre o patrimônio total, e "Caixa e Oportunidades" SHALL ser tratado como segmento da carteira, como os demais.
  > Promovida de PEND-011 em 07/11/2026.
- **RN-024** `[confirmado]` (07/11/2026) — `[estado]` Enquanto houver diferença entre percentual atual e meta, o sistema SHALL classificar a classe/segmento como "abaixo", "acima" ou "dentro" e SHALL apresentar o valor financeiro necessário para atingir a meta.
- **RN-090** `[confirmado]` (07/11/2026) — `[ubíquo]` Uma classe ou segmento SHALL ser classificado como "dentro da meta" quando o módulo do desvio for menor ou igual a 0,5 ponto percentual; caso contrário, como "abaixo" ou "acima".
  > Confirmada na revisão das features da Fase 1 em 07/11/2026.
- **RN-025** `[confirmado]` (07/11/2026) — `[evento]` Quando o titular informar o valor disponível para aporte no mês, o sistema SHALL calcular a sugestão de distribuição considerando a carteira atual antes do aporte.
- **RN-026** `[confirmado]` (07/11/2026) — `[indesejado]` O sistema MUST NOT dividir o aporte em partes iguais entre as classes; a sugestão SHALL priorizar a classe mais distante da meta.
- **RN-027** `[confirmado]` (07/11/2026) — `[ubíquo]` A sugestão de aporte SHALL apresentar valor sugerido por classe, segmentos prioritários, ativos que podem ser estudados e a justificativa da sugestão.
- **RN-028** `[confirmado]` (07/11/2026) — `[opcional]` Onde o titular quiser simular, o sistema SHALL permitir aportes de R$ 500, R$ 1.000, R$ 1.500, R$ 2.000 e valor personalizado, exibindo a carteira resultante após o aporte simulado.

### 5.6 Pesquisa de ativos e integrações

- **RN-029** `[confirmado]` (07/11/2026) — `[evento]` Quando o titular pesquisar por ticker ou nome, o sistema SHALL consultar o provedor e apresentar a ficha do ativo, sem exigir que ele já esteja cadastrado na carteira.
- **RN-030** `[confirmado]` (07/11/2026) — `[ubíquo]` Cada provedor SHALL implementar apenas as operações que efetivamente disponibiliza, e uma operação não suportada SHALL ser tratada como "não disponível" — nunca como zero ou valor vazio.
- **RN-031** `[confirmado]` (07/11/2026) — `[opcional]` Onde houver dados abertos da CVM, o sistema SHALL priorizar cadastro do fundo, informes mensais e trimestrais, demonstrações financeiras, patrimônio líquido, valor patrimonial por cota, número de cotistas, quantidade de cotas, composição de ativos e passivos, taxas e informações sobre imóveis e recebíveis.
- **RN-032** `[confirmado]` (07/11/2026) — `[evento]` Quando a rotina de importação CVM executar, o sistema SHALL armazenar os dados históricos importados com identificação da competência e do arquivo de origem.
- **RN-033** `[confirmado]` (07/11/2026) — `[opcional]` Onde houver provedor de mercado, o sistema SHALL obter cotação ou último fechamento, histórico de preços, volume negociado, dividendos distribuídos, datas de pagamento, dividend yield, P/VP, patrimônio líquido e valor patrimonial por cota.
- **RN-034** `[confirmado]` (07/11/2026) — `[ubíquo]` Para cada provedor, o sistema SHALL registrar limites de requisição, forma de autenticação, custo e condições de uso, e MUST NOT assumir que o acesso é gratuito.
- **RN-035** `[confirmado]` (07/11/2026) — `[ubíquo]` A ficha do FII SHALL apresentar identificação (ticker, nome, CNPJ, segmento, administrador, gestor, data de início), indicadores, riscos e características e histórico.
- **RN-036** `[confirmado]` (07/11/2026) — `[ubíquo]` Cada informação da ficha SHALL exibir sua data de referência e sua fonte.
- **RN-037** `[confirmado]` (07/11/2026) — `[evento]` Quando um ativo for consultado, o sistema SHALL registrar a consulta, armazenar os indicadores históricos e evitar consultas repetidas dentro da política de cache.
- **RN-038** `[confirmado]` (07/11/2026) — `[indesejado]` O sistema MUST NOT tratar dado em cache como cotação em tempo real; todo valor de cache SHALL exibir o instante da coleta.

### 5.7 Avaliação de FIIs

- **RN-039** `[confirmado]` (07/11/2026) — `[ubíquo]` O sistema SHALL avaliar FIIs pelos critérios: segmento resiliente; patrimônio líquido acima de R$ 1 bilhão (referência inicial); histórico operacional acima de 5 anos; taxas competitivas; gestora com histórico e reputação; diversificação de imóveis, inquilinos ou devedores; qualidade dos ativos; transparência dos relatórios; endividamento e alavancagem controlados; histórico de distribuição de rendimentos.
- **RN-040** `[confirmado]` (07/11/2026) — `[ubíquo]` Cada critério e seu peso SHALL ser configuráveis; a pontuação final SHALL variar de 0 a 100 com os pesos iniciais: qualidade dos ativos 20, diversificação 15, saúde financeira 15, histórico e gestão 15, segmento e resiliência 10, preço e valuation 15, rendimentos e sustentabilidade 10.
- **RN-041** `[confirmado]` (07/11/2026) — `[ubíquo]` Toda avaliação SHALL apresentar nota, critérios atendidos, critérios não atendidos, informações indisponíveis, justificativa e data da análise.
- **RN-042** `[confirmado]` (07/11/2026) — `[indesejado]` Se não houver dados suficientes para um critério, então o sistema MUST NOT atribuir nota máxima nem presumir o dado; a ausência SHALL ser explicitada.
- **RN-043** `[confirmado]` (07/11/2026) — `[indesejado]` O sistema SHALL apresentar o P/VP, mas MUST NOT concluir automaticamente que um fundo descontado é oportunidade.
- **RN-044** `[confirmado]` (07/11/2026) — `[evento]` Quando o P/VP estiver abaixo de 1, a análise SHALL considerar vacância, deterioração dos imóveis, risco de crédito, dificuldade financeira, sustentabilidade da distribuição, problemas de gestão, deterioração patrimonial, segmento e qualidade dos ativos.
- **RN-045** `[confirmado]` (07/11/2026) — `[ubíquo]` A sustentabilidade dos dividendos SHALL ser avaliada comparando rendimentos distribuídos, resultado recorrente, reservas acumuladas, resultado não recorrente, histórico de distribuição e eventual distribuição superior ao resultado.
- **RN-046** `[confirmado]` (07/11/2026) — `[evento]` Quando a distribuição indicar insustentabilidade, o sistema SHALL gerar alerta identificando os componentes que motivaram o alerta.
- **RN-047** `[confirmado]` (07/11/2026) — `[indesejado]` O sistema MUST NOT projetar dividendos futuros simplesmente repetindo o último pagamento.
- **RN-048** `[confirmado]` (07/11/2026) — `[ubíquo]` A watchlist SHALL registrar ticker, data de inclusão, motivo do interesse, preço de referência, P/VP de referência, nota de qualidade, status (estudar, acompanhar, aprovado, descartado) e observações.

### 5.8 Controle de risco e decisão

- **RN-049** `[confirmado]` (07/11/2026) — `[evento]` Quando um limite de concentração for ultrapassado, o sistema SHALL gerar alerta para concentração em FII único, gestora, segmento, emissor/devedor e imóvel/inquilino; os limites SHALL ser configuráveis.
- **RN-050** `[confirmado]` (07/11/2026) — `[evento]` Antes de sugerir um novo investimento, o sistema SHALL verificar: classe abaixo da meta, segmento abaixo da meta, ativo já existente na carteira, impacto na concentração, suficiência de dados, atendimento aos critérios mínimos de qualidade, alertas existentes e preço dentro dos parâmetros de avaliação.
- **RN-051** `[confirmado]` (07/11/2026) — `[ubíquo]` Cada ativo candidato SHALL ser classificado como: abaixo da meta e apto para estudo; abaixo da meta com riscos; dentro da meta; acima da meta; sem dados suficientes.
- **RN-052** `[confirmado]` (07/11/2026) — `[evento]` Quando uma sugestão for gerada, o sistema SHALL registrar data, valor disponível, distribuição atual, distribuição sugerida, ativos avaliados, justificativas, alertas e decisão do usuário.
- **RN-053** `[confirmado]` (07/11/2026) — `[evento]` Quando o titular aceitar, ignorar ou alterar uma sugestão, o sistema SHALL registrar a decisão sem apagar a sugestão original.
- **RN-054** `[confirmado]` (07/11/2026) — `[ubíquo]` O rebalanceamento SHALL priorizar novos aportes, evitando vendas desnecessárias.
- **RN-055** `[confirmado]` (07/11/2026) — `[indesejado]` O sistema MUST NOT recomendar um ativo apenas por P/VP abaixo de 1.
- **RN-056** `[confirmado]` (07/11/2026) — `[indesejado]` O sistema MUST NOT recomendar um ativo apenas por dividend yield elevado.

### 5.9 Renda fixa

- **RN-057** `[confirmado]` (07/11/2026) — `[evento]` Quando o titular cadastrar renda fixa, o sistema SHALL suportar Tesouro Selic, Tesouro IPCA+, Tesouro Prefixado, CDB, LCI, LCA, debêntures e outros títulos, com instituição emissora, produto, indexador, taxa contratada, data de aplicação, vencimento, valor aplicado, saldo atualizado, liquidez, carência, cobertura do FGC e observações.
- **RN-058** `[confirmado]` (07/11/2026) — `[evento]` Quando um título estiver próximo do vencimento, em carência, sem liquidez diária, concentrado por instituição ou acima do limite de FGC, o sistema SHALL gerar alerta correspondente.
- **RN-059** `[confirmado]` (07/11/2026) — `[ubíquo]` A atualização de saldo SHALL ser manual na primeira versão, e todo saldo SHALL ser classificado como informado, estimado ou confirmado.
- **RN-060** `[confirmado]` (07/11/2026) — `[opcional]` Onde houver integração futura com indicadores econômicos, ela SHALL ser avaliada apenas após a Fase 1 e MUST NOT bloquear a atualização manual.

### 5.10 Dashboard

- **RN-061** `[confirmado]` (07/11/2026) — `[ubíquo]` O painel principal SHALL exibir patrimônio total, total investido, valor atual, resultado acumulado, renda mensal recebida, rendimentos acumulados no ano, percentual em renda fixa, percentual em FIIs e comparação com a meta 50/50.
- **RN-062** `[confirmado]` (07/11/2026) — `[ubíquo]` O sistema SHALL apresentar gráficos de distribuição por classe, distribuição por segmento, evolução patrimonial, evolução dos rendimentos, histórico de aportes e histórico de dividendos.
- **RN-063** `[confirmado]` (07/11/2026) — `[ubíquo]` O painel de oportunidades SHALL exibir segmentos abaixo da meta, classes abaixo da meta, ativos da watchlist, fundos com alertas e sugestão de distribuição do aporte mensal.

### 5.11 Projeções de longo prazo

- **RN-064** `[confirmado]` (07/11/2026) — `[opcional]` Onde o titular simular patrimônio, o sistema SHALL aceitar patrimônio inicial, aporte mensal, prazo, inflação estimada, retorno real estimado e reinvestimento dos rendimentos, com cenários conservador, moderado e otimista.
- **RN-065** `[confirmado]` (07/11/2026) — `[ubíquo]` A projeção de renda SHALL usar diferentes taxas de distribuição, SHALL distinguir retorno total, valorização e distribuição de rendimentos e SHALL exibir valores em reais de hoje e nominais.
- **RN-066** `[confirmado]` (07/11/2026) — `[ubíquo]` O comparador SHALL apresentar patrimônio estimado e renda mensal potencial para 5, 10, 15 e 20 anos.

### 5.12 Segurança, erro e rastreabilidade

- **RN-067** `[confirmado]` (07/11/2026) — `[ubíquo]` Rotas privadas SHALL ser protegidas por autenticação; requisição sem sessão válida SHALL ser rejeitada com 401.
- **RN-068** `[confirmado]` (07/11/2026) — `[ubíquo]` Credenciais e chaves de API SHALL residir em variáveis de ambiente; nenhuma chave, senha ou token MUST NOT ser versionado nem exposto ao cliente.
- **RN-069** `[confirmado]` (07/11/2026) — `[evento]` Quando uma entrada for recebida, o sistema SHALL validá-la (tipo, faixa, obrigatoriedade, formato) antes de persistir, rejeitando payload inválido com mensagem por campo.
- **RN-070** `[confirmado]` (07/11/2026) — `[ubíquo]` O controle de acesso SHALL garantir que toda consulta e escrita filtre pelo usuário autenticado, impedindo leitura de dados de outro titular.
- **RN-071** `[confirmado]` (07/11/2026) — `[indesejado]` O sistema MUST NOT armazenar senha em texto puro ou com hash reversível; SHALL usar algoritmo de hash com salt.
- **RN-072** `[confirmado]` (07/11/2026) — `[evento]` Quando um provedor falhar por timeout, limite de requisições, indisponibilidade, dados incompletos, resposta inválida ou falha de autenticação, o sistema SHALL registrar o erro, degradar a funcionalidade afetada e informar o titular sem expor detalhe interno.
- **RN-073** `[confirmado]` (07/11/2026) — `[estado]` Enquanto um provedor estiver indisponível, o titular SHALL continuar acessando os dados já armazenados.
- **RN-074** `[confirmado]` (07/11/2026) — `[evento]` Quando uma integração executar, o sistema SHALL registrar fonte, data de consulta, data de referência, última atualização e inconsistências detectadas.

### 5.13 Princípios de decisão

- **RN-075** `[confirmado]` (07/11/2026) — `[ubíquo]` Qualidade e sustentabilidade SHALL ter prioridade sobre rendimento imediato.
- **RN-076** `[confirmado]` (07/11/2026) — `[indesejado]` O sistema MUST NOT sugerir investimento sem apresentar os motivos da sugestão.
- **RN-077** `[confirmado]` (07/11/2026) — `[indesejado]` Dado ausente MUST NOT ser tratado como indicador positivo, nem convertido em nota, ranking ou recomendação.
- **RN-078** `[confirmado]` (07/11/2026) — `[ubíquo]` O titular SHALL ter a decisão final; nenhuma sugestão SHALL ser aplicada automaticamente à carteira.
- **RN-079** `[confirmado]` (07/11/2026) — `[opcional]` Onde houver dividendos registrados, eles SHALL poder ser considerados recursos disponíveis para reinvestimento.
- **RN-080** `[confirmado]` (07/11/2026) — `[ubíquo]` As projeções SHALL considerar inflação e distinguir retorno real de retorno nominal.
- **RN-081** `[confirmado]` (07/11/2026) — `[indesejado]` O sistema MUST NOT prometer rentabilidade nem apresentar projeção como garantia.
- **RN-082** `[confirmado]` (07/11/2026) — `[ubíquo]` Regras, metas, critérios, pesos e limites SHALL ser configuráveis sem alteração de código.
- **RN-083** `[confirmado]` (07/11/2026) — `[ubíquo]` A primeira entrega SHALL contemplar somente a Fase 1; os demais épicos SHALL permanecer documentados e não implementados.

### 5.14 Conta e cadastro

- **RN-085** `[confirmado]` (07/11/2026) — `[evento]` Quando um visitante criar conta, o sistema SHALL aceitar cadastro aberto com nome, e-mail e senha, SHALL exigir e-mail único e SHALL manter a conta em `PENDENTE_VERIFICACAO` até a confirmação do e-mail.
  > Promovida de PEND-002 em 07/11/2026 (decisão do proprietário: cadastro aberto).
- **RN-086** `[confirmado]` (07/11/2026) — `[evento]` Quando o titular solicitar redefinição de senha, o sistema SHALL emitir token de uso único com expiração de 1 hora, SHALL invalidar os tokens anteriores do mesmo tipo e MUST NOT revelar se o e-mail existe.
- **RN-087** `[confirmado]` (07/11/2026) — `[indesejado]` O sistema MUST NOT concluir o cadastro sem aceite explícito dos Termos de Uso e da Política de Privacidade; o aceite SHALL ser registrado com versão e data.
- **RN-088** `[confirmado]` (07/11/2026) — `[evento]` Quando o titular solicitar o encerramento da conta, o sistema SHALL eliminar ou anonimizar os dados pessoais, preservando apenas o que a legislação exigir, e SHALL invalidar as sessões ativas.

---

## 6. Dados e Campos

> Modelo completo, tipos e índices em `specs/DATA_MODEL.md`. Aqui ficam os campos com regra de negócio associada.

### 6.1 Usuário (`usuario`)

| Campo | Obrigatório | Formato | Comportamento |
|---|---|---|---|
| `id` | Sim | UUID | Chave primária |
| `nome` | Sim | texto 3–120 | — |
| `email` | Sim | e-mail único | Normalizado para minúsculas; usado no login |
| `senha_hash` | Sim | texto | Argon2id; nunca retornado pela API |
| `status_conta` | Sim | enum | `PENDENTE_VERIFICACAO`, `ATIVA`, `SUSPENSA`, `EXCLUIDA`; default `PENDENTE_VERIFICACAO` |
| `email_verificado_em` | Não | timestamp | Preenchido na verificação (RN-085) |
| `criado_em` | Sim | timestamp | UTC |

### 6.2 Classe de ativo (`classe_ativo`) e Segmento (`segmento_ativo`)

| Campo | Obrigatório | Formato | Comportamento |
|---|---|---|---|
| `nome` | Sim | texto único | `RENDA_FIXA`, `FII` (seed inicial); novas classes permitidas |
| `segmento.nome` | Sim | texto único | Logística, Shopping, Recebíveis, Lajes, Renda Urbana, Híbridos, Agro, Outros |
| `segmento.classe_id` | Sim | FK | Segmento pertence a uma classe (FII) |

### 6.3 Ativo (`ativo`)

| Campo | Obrigatório | Formato | Comportamento |
|---|---|---|---|
| `ticker` | Sim | texto 4–20 único | Maiúsculas; identificador de busca |
| `nome` | Sim | texto 3–160 | — |
| `classe_id` | Sim | FK | — |
| `segmento_id` | Condicional | FK | Obrigatório quando a classe for FII |
| `cnpj` | Não | 14 dígitos | Validar dígito verificador quando informado |
| `administrador` / `emissor` | Não | texto 160 | — |
| `gestor` | Não | texto 160 | — |
| `status` | Sim | enum | `ATIVO`, `INATIVO`, `EM_ANALISE`; default `ATIVO` |
| `fonte_dados` | Não | texto 60 | Deve corresponder a um provedor cadastrado |
| `observacoes` | Não | texto 1000 | — |

### 6.4 Movimentação (`movimentacao`)

| Campo | Obrigatório | Formato | Comportamento |
|---|---|---|---|
| `ativo_id` | Sim | FK | — |
| `tipo` | Sim | enum | `COMPRA`, `VENDA`, `DIVIDENDO`, `JUROS`, `APLICACAO_RF`, `RESGATE_RF`, `TAXA` |
| `data` | Sim | data | Não pode ser futura além de 1 dia |
| `quantidade` | Condicional | numeric(18,8) | Obrigatório em compra/venda |
| `valor_unitario` | Condicional | numeric(18,2) | Obrigatório em compra/venda |
| `valor_total` | Sim | numeric(18,2) | Validado contra quantidade × unitário + custos |
| `custos` | Não | numeric(18,2) | Default 0 |
| `observacoes` | Não | texto 1000 | Obrigatório quando a validação de RN-019 falhar |

### 6.5 Posição (`posicao_ativo`)

| Campo | Obrigatório | Formato | Comportamento |
|---|---|---|---|
| `ativo_id` | Sim | FK único | Uma posição corrente por ativo |
| `quantidade` | Sim | numeric(18,8) | Derivada; ≥ 0 |
| `preco_medio` | Sim | numeric(18,6) | Derivado; ≥ 0 |
| `custo_total` | Sim | numeric(18,2) | quantidade × preco_medio |
| `atualizado_em` | Sim | timestamp | Recalculado a cada movimentação |

### 6.6 Rendimento (`rendimento`)

| Campo | Obrigatório | Formato | Comportamento |
|---|---|---|---|
| `ativo_id` | Sim | FK | — |
| `tipo` | Sim | enum | `DIVIDENDO`, `JURO`, `AMORTIZACAO` |
| `data_pagamento` | Sim | data | — |
| `competencia` | Não | `YYYY-MM` | Mês de referência do rendimento |
| `valor` | Sim | numeric(18,2) | > 0 |
| `origem` | Sim | enum | `MANUAL`, `PROVEDOR` |

### 6.7 Renda fixa (`investimento_renda_fixa`)

| Campo | Obrigatório | Formato | Comportamento |
|---|---|---|---|
| `instituicao` | Sim | texto 120 | — |
| `produto` | Sim | enum | Tesouro Selic/IPCA+/Prefixado, CDB, LCI, LCA, Debênture, Outro |
| `indexador` | Sim | enum | `PRE`, `POS_CDI`, `IPCA`, `SELIC`, `OUTRO` |
| `taxa` | Sim | numeric(9,6) | Percentual ao ano |
| `data_aplicacao` | Sim | data | — |
| `vencimento` | Não | data | > data_aplicacao |
| `valor_aplicado` | Sim | numeric(18,2) | > 0 |
| `saldo_atual` | Sim | numeric(18,2) | ≥ 0 |
| `status_saldo` | Sim | enum | `INFORMADO`, `ESTIMADO`, `CONFIRMADO` |
| `liquidez` | Sim | enum | `DIARIA`, `NO_VENCIMENTO`, `PRAZO` |
| `carencia_ate` | Não | data | — |
| `cobertura_fgc` | Não | booleano | Default calculado por produto |

### 6.8 Metas (`alocacao_meta`)

| Campo | Obrigatório | Formato | Comportamento |
|---|---|---|---|
| `escopo` | Sim | enum | `CLASSE`, `SEGMENTO` |
| `referencia_id` | Sim | FK | Classe ou segmento |
| `percentual` | Sim | numeric(9,6) | ≥ 0; soma do escopo = 100 |
| `vigencia_inicio` | Sim | data | — |
| `vigencia_fim` | Não | data | Nula = vigente |

### 6.9 Avaliação (`criterio_avaliacao`, `avaliacao_ativo`)

| Campo | Obrigatório | Formato | Comportamento |
|---|---|---|---|
| `criterio.nome` / `peso` | Sim | texto / int | Peso somando 100 na configuração inicial |
| `criterio.regra` | Sim | JSON | Parâmetros de avaliação (ex.: PL mínimo, anos de histórico) |
| `avaliacao.nota` | Sim | numeric(5,2) | 0–100; nula quando dados insuficientes |
| `avaliacao.criterios_atendidos` | Sim | JSON | Lista de critérios com evidência |
| `avaliacao.criterios_nao_atendidos` | Sim | JSON | Lista com motivo |
| `avaliacao.dados_indisponiveis` | Sim | JSON | Lista de campos ausentes |
| `avaliacao.justificativa` | Sim | texto 2000 | — |
| `avaliacao.data_analise` | Sim | timestamp | — |

### 6.10 Histórico (`historico_preco`, `historico_indicador`)

| Campo | Obrigatório | Formato | Comportamento |
|---|---|---|---|
| `ativo_id` | Sim | FK | — |
| `data_referencia` | Sim | data | Único por ativo + tipo |
| `valor` | Sim | numeric(18,6) | Preço ou indicador |
| `fonte` / `provedor_id` | Sim | texto / FK | Proveniência |
| `status_dado` | Sim | enum | `OFICIAL`, `MERCADO`, `ESTIMADO`, `HISTORICO`, `INDISPONIVEL` |
| `coletado_em` | Sim | timestamp | Instante da coleta |

### 6.11 Watchlist (`watchlist`)

| Campo | Obrigatório | Formato | Comportamento |
|---|---|---|---|
| `ativo_id` | Sim | FK único | — |
| `data_inclusao` | Sim | data | Default hoje |
| `motivo` | Sim | texto 500 | — |
| `preco_referencia` | Não | numeric(18,2) | — |
| `pvp_referencia` | Não | numeric(9,6) | — |
| `nota_referencia` | Não | numeric(5,2) | Cópia da avaliação no momento da inclusão |
| `status` | Sim | enum | `ESTUDAR`, `ACOMPANHAR`, `APROVADO`, `DESCARTADO` |
| `observacoes` | Não | texto 1000 | — |

### 6.12 Sugestão de aporte (`sugestao_aporte`)

| Campo | Obrigatório | Formato | Comportamento |
|---|---|---|---|
| `data` | Sim | timestamp | — |
| `valor_disponivel` | Sim | numeric(18,2) | > 0 |
| `distribuicao_atual` | Sim | JSON | Snapshot da carteira no momento |
| `distribuicao_sugerida` | Sim | JSON | Valores por classe e segmento |
| `ativos_avaliados` | Sim | JSON | Lista com classificação (RN-051) |
| `justificativas` | Sim | JSON | Uma por recomendação |
| `alertas` | Sim | JSON | Alertas aplicáveis |
| `decisao_usuario` | Não | enum | `ACEITA`, `IGNORADA`, `ALTERADA` |
| `decisao_em` | Não | timestamp | — |

### 6.13 Provedor e log (`provedor_dados`, `log_integracao`)

| Campo | Obrigatório | Formato | Comportamento |
|---|---|---|---|
| `provedor.nome` | Sim | texto único | Ex.: `brapi`, `cvm` |
| `provedor.capacidades` | Sim | JSON | Operações suportadas |
| `provedor.autenticacao` | Sim | enum | `NENHUMA`, `API_KEY`, `OAUTH` |
| `provedor.limite_requisicoes` | Não | texto | Ex.: "15 req/min" |
| `provedor.custo` | Não | texto | Ex.: "gratuito até X" |
| `log.provedor_id` / `operacao` | Sim | FK / texto | — |
| `log.status` | Sim | enum | `SUCESSO`, `ERRO`, `TIMEOUT`, `LIMITE`, `DADOS_INCOMPLETOS` |
| `log.data_consulta` / `data_referencia` | Sim | timestamp / data | — |
| `log.mensagem` | Não | texto 1000 | Sem segredo ou dado pessoal |

### 6.14 Token de conta (`token_conta`)

| Campo | Obrigatório | Formato | Comportamento |
|---|---|---|---|
| `usuario_id` | Sim | FK | — |
| `tipo` | Sim | enum | `VERIFICACAO_EMAIL`, `REDEFINICAO_SENHA` |
| `token_hash` | Sim | texto | Hash do token; o valor puro só existe no link enviado |
| `expira_em` | Sim | timestamp | Verificação 24 h; redefinição 1 h |
| `usado_em` | Não | timestamp | Uso único; reutilização é rejeitada |
| `criado_em` | Sim | timestamp | Emissão de novo token invalida o anterior do mesmo tipo |

### 6.15 Aceite legal (`aceite_legal`)

| Campo | Obrigatório | Formato | Comportamento |
|---|---|---|---|
| `usuario_id` | Sim | FK | — |
| `tipo` | Sim | enum | `TERMOS_USO`, `POLITICA_PRIVACIDADE` |
| `versao` | Sim | texto 20 | Versão do documento aceita |
| `aceito_em` | Sim | timestamp | Evidência do consentimento |
| `ip_hash` | Não | texto | Hash do IP no momento do aceite; não armazenar IP puro |

---

## 7. Casos de Uso / Fluxos

### UC-001 — Registrar movimentação

1. Titular seleciona ativo cadastrado e tipo de movimentação.
2. Informa data, quantidade, valor unitário, custos e observações.
3. Sistema valida campos, consistência do valor total (RN-019) e posição resultante (RN-018).
4. Sistema grava a movimentação e recalcula posição e preço médio (RN-015, RN-016).
5. Sistema atualiza carteira, dashboard e desvios.

### UC-002 — Consultar carteira consolidada

1. Titular abre a carteira.
2. Sistema carrega posições, renda fixa e rendimentos.
3. Sistema calcula patrimônio por classe e por segmento e compara com as metas.
4. Tela exibe os indicadores de RN-020, com status e data de referência de cada valor de mercado.

### UC-003 — Planejar aporte do mês

1. Titular informa o valor disponível.
2. Sistema calcula desvio por classe e por segmento (RN-023, RN-024).
3. Sistema prioriza a classe mais distante da meta (RN-026).
4. Sistema verifica checklist de RN-050 e classifica candidatos (RN-051).
5. Tela apresenta distribuição sugerida, segmentos prioritários, ativos para estudo e justificativa (RN-027).
6. Titular aceita, ignora ou altera; decisão é registrada (RN-053).

### UC-004 — Pesquisar FII por ticker

1. Titular digita ticker ou nome (ativo não precisa estar cadastrado).
2. Sistema consulta cache; se expirado, aciona o provedor com capacidade para a operação.
3. Sistema normaliza e grava histórico com proveniência.
4. Tela apresenta ficha com identificação, indicadores, riscos, histórico e, em cada bloco, fonte e data de referência.
5. Em falha de provedor, sistema mostra dado armazenado e sinaliza indisponibilidade (RN-073).

### UC-005 — Avaliar FII

1. Titular solicita avaliação de um ativo.
2. Sistema carrega critérios e pesos vigentes.
3. Para cada critério, avalia com o dado disponível; ausência é registrada como indisponível.
4. Sistema calcula nota 0–100, lista atendidos e não atendidos e gera justificativa.
5. Titular pode adicionar o ativo à watchlist com nota e P/VP de referência.

### UC-006 — Cadastrar renda fixa

1. Titular informa instituição, produto, indexador, taxa, datas, valor e liquidez.
2. Sistema valida datas, taxa e valores e calcula cobertura de FGC conforme produto.
3. Sistema grava, inclui o saldo no patrimônio e agenda alertas (RN-058).

### UC-007 — Simular projeção patrimonial

1. Titular informa patrimônio inicial, aporte mensal, prazo, inflação e retorno real.
2. Sistema calcula cenários conservador, moderado e otimista com reinvestimento.
3. Tela exibe patrimônio e renda potencial em 5, 10, 15 e 20 anos, em valores nominais e reais.
4. Tela exibe aviso de que a projeção não é garantia de rentabilidade.

### UC-008 — Criar conta e verificar e-mail

1. Visitante informa nome, e-mail, senha e aceita Termos de Uso e Política de Privacidade.
2. Sistema valida unicidade do e-mail, força da senha e registro do aceite (RN-085, RN-087).
3. Sistema cria a conta em `PENDENTE_VERIFICACAO` e envia token de verificação.
4. Visitante confirma o e-mail pelo link; sistema ativa a conta e invalida o token.
5. Enquanto não verificado, o login é recusado com orientação de reenvio.

### UC-009 — Redefinir senha e encerrar conta

1. Visitante solicita redefinição informando o e-mail; sistema responde sempre de forma neutra (RN-086).
2. Sistema emite token de 1 hora e invalida os anteriores; visitante define a nova senha.
3. Titular autenticado pode solicitar encerramento da conta, confirmando com senha.
4. Sistema invalida sessões, anonimiza dados pessoais e preserva apenas o exigido por lei (RN-088).

---

## 8. Saídas e Integrações

| Saída / Integração | Direção | Dados | Regra |
|---|---|---|---|
| API REST interna (`/api/**`) | UI → backend | Ativos, movimentações, carteira, metas, sugestões, projeções | Autenticada; JSON; erros em `ERROR_CATALOG` |
| Dados abertos da CVM | backend → CVM | Cadastro, informes, demonstrações, PL, VPC, cotistas, composição, taxas | Importação periódica com registro de competência e arquivo |
| Provedor de mercado | backend → provedor | Cotação, histórico, volume, dividendos, DY, P/VP, PL, VPC | Com cache, limites e custo declarados |
| Indicadores econômicos (futuro) | backend → fonte | CDI, IPCA, Selic | Fora da Fase 1 (RN-060) |
| Dashboard e gráficos | backend → UI | Séries patrimoniais e de rendimento | Valores em decimal serializados como string |
| Exportação de carteira | backend → arquivo | CSV/JSON da posição | Opcional — não especificado (`PEND-015`) |

---

## 9. Persistência e Auditoria

| Entidade | Tabela | Finalidade | Rastreabilidade |
|---|---|---|---|
| Usuário | `usuario` | Autenticação e isolamento | `criado_em`, `atualizado_em` |
| Classe de ativo | `classe_ativo` | Agrupamento de alocação | Seed versionado |
| Segmento de ativo | `segmento_ativo` | Subdivisão de FII | Seed versionado |
| Ativo | `ativo` | Cadastro e identificação | `criado_em`, `origem_dados` |
| Movimentação | `movimentacao` | Fato que altera posição | `criado_em`; nunca excluída fisicamente |
| Posição | `posicao_ativo` | Estado derivado por ativo | `atualizado_em` |
| Rendimento | `rendimento` | Provento recebido | `origem`, `criado_em` |
| Renda fixa | `investimento_renda_fixa` | Título e saldo | `status_saldo`, `atualizado_em` |
| Meta de alocação | `alocacao_meta` | Estratégia com vigência | `vigencia_inicio`/`vigencia_fim` |
| Critério de avaliação | `criterio_avaliacao` | Regra e peso configurável | `vigencia_inicio` |
| Avaliação de ativo | `avaliacao_ativo` | Nota e justificativa | `data_analise` |
| Histórico de preço | `historico_preco` | Série de preços | `fonte`, `data_referencia`, `coletado_em` |
| Histórico de indicador | `historico_indicador` | Série de indicadores | `fonte`, `data_referencia`, `coletado_em` |
| Watchlist | `watchlist` | Acompanhamento | `data_inclusao` |
| Sugestão de aporte | `sugestao_aporte` | Histórico de recomendações | `data`, `decisao_usuario` |
| Provedor de dados | `provedor_dados` | Capacidades e limites | `atualizado_em` |
| Log de integração | `log_integracao` | Auditoria de chamadas externas | `data_consulta`, `status` |
| Token de conta | `token_conta` | Verificação de e-mail e redefinição de senha | `criado_em`, `expira_em`, `usado_em` |
| Aceite legal | `aceite_legal` | Evidência de consentimento | `tipo`, `versao`, `aceito_em` |

Regras de auditoria:

- Movimentação e sugestão não são excluídas fisicamente; correção gera novo registro ou marcação de estorno.
- Log de integração nunca armazena chave de API, token ou dado pessoal desnecessário.
- Retenção de log a definir (`PEND-014`).

---

## 10. Decisões e Fora do Escopo

| Item | Decisão | Motivo |
|---|---|---|
| Stack | Next.js + TypeScript + Prisma + Neon, monolito modular (ADR-001) | Um deploy, tipos compartilhados, simplicidade operacional |
| Autenticação | Credenciais com Argon2id (ADR-003) | Uso pessoal; sem dependência de provedor externo |
| Dinheiro | `numeric`/`Decimal`, jamais float (ADR-006) | Evitar erro de centavos |
| Configuração | Metas, pesos e limites em banco (ADR-008) | Exigência de configurabilidade sem deploy |
| Escopo | Primeira entrega = Fase 1 (ADR-009) | Evitar 10 épicos antes do núcleo confiável |
| Recomendação | Sistema sugere, usuário decide (RN-078) | Produto de apoio, não de execução |
| Tempo real | Fora do escopo; cotações de fechamento com cache | Custo e complexidade desproporcionais |
| Fiscal | Fora do escopo | Não especificado e sem fonte de verdade |
| Multiusuário | Fora da primeira versão (`PEND-002`) | Escopo pessoal |
| Conta | Cadastro aberto com verificação de e-mail e aceite legal (ADR-011, RN-085 a RN-088) | Decisão do proprietário em 07/11/2026 |
| Multiusuário | Dados isolados por usuário desde a primeira versão | Cadastro aberto exige isolamento real (RN-070) |
| Mobile nativo | Fora do escopo; web responsiva | Especificação pede aplicação web |
| Cripto/ações | Fora do escopo inicial | Foco em FII e renda fixa |
| Exclusão de dados | Direito do titular previsto na LGPD a implementar na Fase 1 | `compliance: true` |

---

## 11. Pendências e Dúvidas em Aberto

- **PEND-001** (07/11/2026) — Provedor de dados de mercado definitivo não escolhido. `brapi.dev` é candidato citado na especificação; custo, limites e cobertura (FII, dividendos, histórico) precisam ser validados antes da Fase 3.
- **PEND-002** (07/11/2026) — Modelo de conta: usuário único com cadastro fechado, convite ou cadastro aberto? Impacta `RN-009`, `RN-070`, recuperação de senha e LGPD. `**Promovida a RN-085 em 07/11/2026 — decisão: cadastro aberto.**`
- **PEND-003** (07/11/2026) — Estratégia de backup e recuperação do Neon conforme plano contratado (frequência, retenção, teste de restauração).
- **PEND-004** (07/11/2026) — Valores default dos limites de concentração (ativo, gestora, segmento, emissor e imóvel/inquilino) não definidos.
- **PEND-005** (07/11/2026) — Método de baixa em venda: custo médio, PEPS ou outro? Como tratar prejuízo realizado e o efeito no preço médio.
- **PEND-006** (07/11/2026) — Regra de arredondamento e precisão por tipo de valor (preço, cota, percentual, nota).
- **PEND-007** (07/11/2026) — Metodologia de conversão de cada critério qualitativo em nota 0–100 (ex.: "gestora com histórico e reputação").
- **PEND-008** (07/11/2026) — Definição operacional de "segmento resiliente" e de "gestora com histórico e reputação".
- **PEND-009** (07/11/2026) — Fonte oficial para atualização de renda fixa (Tesouro Direto, ANBIMA) e se será integrada após a Fase 1.
- **PEND-010** (07/11/2026) — Valores default de inflação e retorno real por cenário nas projeções (conservador, moderado, otimista).
- **PEND-011** (07/11/2026) — "Caixa e oportunidades" é segmento de FII ou reserva fora da carteira? Define a base de cálculo do percentual de segmento (`RN-023`). `**Promovida a RN-089 em 07/11/2026 — decisão: segmento da carteira, base = patrimônio total.**`
- **PEND-012** (07/11/2026) — Regras de cobertura do FGC: limite por CPF/instituição e como o sistema deve alertar (informativo ou bloqueante).
- **PEND-013** (07/11/2026) — Política de cache por tipo de dado (TTL para cotação, dividendos, indicadores CVM) e comportamento em fim de semana/feriado.
- **PEND-014** (07/11/2026) — Política de retenção de `log_integracao` e de dados históricos.
- **PEND-015** (07/11/2026) — Necessidade de exportação de carteira (CSV/JSON/PDF) não foi especificada; confirmar se entra na Fase 1.
- **PEND-016** (07/11/2026) — Designação do encarregado (DPO) e publicação do canal de comunicação com titulares, exigidos pelo art. 41 da LGPD. Bloqueia o go-live conforme `specs/COMPLIANCE.md` §6.
- **PEND-017** (09/11/2026) — Vínculo entre movimentações de renda fixa (`APLICACAO_RF`/`RESGATE_RF`) e `investimento_renda_fixa`: o modelo atual exige `ativo_id`, mas a renda fixa não é um ativo de carteira. Até a definição, a API rejeita esses dois tipos com orientação para usar o cadastro de renda fixa.

---

## Anexo A — Matriz de rastreabilidade Épico → RN

| Épico da especificação | Fase | RNs |
|---|---|---|
| 01 — Estrutura inicial e infraestrutura | 1 | RN-001, RN-008, RN-067, RN-068, RN-083 |
| 02 — Cadastro e controle de ativos | 1 | RN-010 a RN-020 |
| 03 — Estratégia de alocação | 2 | RN-021 a RN-028, RN-054, RN-089 |
| 04 — Pesquisa e integração com APIs | 3 | RN-029 a RN-038, RN-074 |
| 05 — Análise e avaliação de FIIs | 4 | RN-039 a RN-048 |
| 06 — Regras de decisão e risco | 2/4 | RN-049 a RN-056 |
| 07 — Controle de renda fixa | 1 | RN-057 a RN-060 |
| 08 — Dashboard | 1 | RN-061 a RN-063 |
| 09 — Projeções de longo prazo | 5 | RN-064 a RN-066, RN-080, RN-081 |
| 10 — Qualidade, segurança e observabilidade | 1 | RN-069, RN-071 a RN-073 |
| Conta e cadastro (decisão de 07/11/2026) | 1 | RN-085 a RN-088 |
| Revisão das features (07/11/2026) | 1 | RN-090, RN-091 |
| §15 — Regras fundamentais | todas | RN-075 a RN-082 |
| §13 — Modelo de dados | 1 | RN-084 |
