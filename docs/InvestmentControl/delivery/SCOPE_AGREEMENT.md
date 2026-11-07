---
project: INVESTMENT CONTROL
module: escopo
audience: [negocio]
status: draft
---

# Acordo de Escopo — Investment Control

> **Cliente:** proprietário do produto
> **Última atualização:** 07/11/2026
> **Status da versão:** proposta

---

## 1. Objetivo do Projeto

Organizar em um único lugar o controle dos investimentos pessoais em fundos imobiliários e renda fixa. Hoje a informação está espalhada entre planilhas, extratos e sites de mercado, e a decisão de onde investir o próximo aporte depende de comparações manuais que não ficam registradas.

O sistema deve permitir saber, a qualquer momento: quanto se tem, quanto se recebe de rendimento, o quanto a carteira está alinhada à estratégia definida e onde faz sentido direcionar o próximo aporte. O sistema apoia a decisão — não compra, não vende e não promete rentabilidade.

## 2. O Que Será Entregue

### 2.1 Primeira fase — comprometida

**Conta e acesso**
- Cadastro aberto com nome, e-mail e senha, com confirmação de e-mail obrigatória antes do primeiro acesso.
- Recuperação de senha por link de uso único.
- Aceite registrado dos Termos de Uso e da Política de Privacidade, com versão e data.
- Encerramento da própria conta, com eliminação ou descaracterização dos dados pessoais.

**Controle patrimonial**
- Cadastro de ativos (fundos imobiliários e títulos de renda fixa), com classe, segmento e situação.
- Registro de compras, vendas, dividendos, juros, aplicações, resgates e taxas.
- Cálculo automático de posição e preço médio a partir das movimentações.
- Cancelamento de movimentação com motivo, preservando o histórico.
- Controle de renda fixa com instituição, produto, indexador, taxa, vencimento, liquidez e saldo classificado.

**Visão consolidada**
- Carteira com patrimônio total, divisão por classe e por segmento, quantidade de ativos, rendimentos do mês e do ano.
- Painel inicial com os principais indicadores, gráficos e comparação com a meta.
- Painel de oportunidades com o que está abaixo da meta e o que exige atenção.

**Estratégia**
- Configuração de metas por classe, com a estratégia inicial de 50% renda fixa e 50% fundos imobiliários.
- Configuração de metas por segmento de fundo imobiliário.
- Cálculo de desvio e do valor necessário para atingir cada meta.

### 2.2 Fases seguintes — planejadas, não comprometidas nesta versão

- Planejamento e sugestão de distribuição do aporte mensal, com simulador.
- Pesquisa de fundos imobiliários por código, com ficha detalhada e dados de fontes públicas.
- Avaliação de qualidade dos fundos com critérios e pesos configuráveis.
- Lista de observação e controle de concentração.
- Projeções de patrimônio e de renda futura.

## 3. O Que Não Está no Escopo

- Compra, venda ou qualquer execução de ordem.
- Integração com corretoras e custódia de ativos.
- Recomendação automática de investimento.
- Cálculo de imposto de renda, DARF ou obrigações fiscais.
- Aplicativo para celular.
- Cotação em tempo real.
- Ações, criptoativos e fundos não imobiliários.
- Múltiplas carteiras independentes para a mesma pessoa.

## 4. Regras de Negócio Confirmadas

| # | Regra | Status |
|---|---|---|
| 1 | A estratégia inicial é 50% em renda fixa e 50% em fundos imobiliários. | ✅ confirmada |
| 2 | A soma das metas precisa ser sempre 100%, tanto por classe quanto por segmento. | ✅ confirmada |
| 3 | O percentual por segmento é calculado sobre o patrimônio total, e "caixa e oportunidades" é um segmento da carteira. | ✅ confirmada |
| 4 | Uma diferença de até 0,5 ponto percentual é considerada "dentro da meta". | ✅ confirmada |
| 5 | A posição é sempre calculada a partir das movimentações, nunca digitada. | ✅ confirmada |
| 6 | O preço médio é ponderado e recalculado a cada compra ou venda. | ✅ confirmada |
| 7 | Dividendos e juros não alteram o preço médio e ficam separados do ganho de capital. | ✅ confirmada |
| 8 | Venda acima da posição só acontece com confirmação explícita e justificativa. | ✅ confirmada |
| 9 | Movimentações não são apagadas; erros são corrigidos por cancelamento com motivo. | ✅ confirmada |
| 10 | Ativo inativado sai das sugestões futuras, mas permanece na carteira e no histórico. | ✅ confirmada |
| 11 | Quando não houver cotação, o ativo entra na carteira pelo custo e é marcado como "valor indisponível", nunca como zero. | ✅ confirmada |
| 12 | Todo dado de mercado exibe a fonte e a data de referência. | ✅ confirmada |
| 13 | Dado estimado é sempre identificado e nunca apresentado como oficial. | ✅ confirmada |
| 14 | Se uma fonte externa estiver indisponível, os dados já guardados continuam acessíveis. | ✅ confirmada |
| 15 | O saldo da renda fixa é sempre classificado como informado, estimado ou confirmado. | ✅ confirmada |
| 16 | Metas, critérios, pesos e limites são configuráveis sem alterar o sistema. | ✅ confirmada |
| 17 | O sistema sugere, mas a decisão final é sempre do usuário. | ✅ confirmada |
| 18 | Nenhum valor é exibido sem indicar de onde veio e a que data se refere. | ✅ confirmada |
| 19 | O cadastro só é concluído com aceite dos termos e da política de privacidade. | ✅ confirmada |
| 20 | Ao encerrar a conta, o acesso é bloqueado e os dados pessoais são descaracterizados. | ✅ confirmada |

> O detalhamento técnico de cada regra está em `REQUIREMENTS.md`.

## 5. Mudanças em Andamento

| # | Mudança | Status | Data |
|---|---|---|---|
| — | Nenhuma mudança pendente | — | — |

## 6. Pendências e Definições Futuras

| Item | Previsão |
|---|---|
| Provedor de dados de mercado a contratar (custo e cobertura a validar) | antes da fase de pesquisa |
| Política de backup e restauração do banco | antes do go-live |
| Limites de concentração por ativo, gestor, segmento e emissor | antes da fase de risco |
| Método de baixa em venda (custo médio ou primeiro que entra, primeiro que sai) | antes da fase de aportes |
| Critério de arredondamento por tipo de valor | antes do go-live |
| Metodologia para transformar cada critério qualitativo em nota | antes da fase de avaliação |
| Definição de "segmento resiliente" e de "gestora com histórico" | antes da fase de avaliação |
| Fonte oficial para atualização de renda fixa | depois da primeira fase |
| Premissas de inflação e retorno por cenário nas projeções | antes da fase de projeções |
| Regra de cobertura do FGC e limites por instituição | antes da fase de risco |
| Política de cache por tipo de dado | antes da fase de pesquisa |
| Prazo de retenção de logs | antes do go-live |
| Necessidade de exportação de carteira | a definir |
| Encarregado de proteção de dados e canal de atendimento ao titular | antes do go-live |

## 7. Riscos e Premissas

**Premissas**
- Uso pessoal, com conta própria e dados isolados por usuário.
- Aplicação web responsiva, em português, com valores em reais.
- Hospedagem na Vercel e banco PostgreSQL no Neon.
- Integrações externas sempre pelo servidor, com chave protegida.
- A primeira entrega contempla apenas a primeira fase.

**Riscos relevantes para o negócio**
- Provedor de dados pode cobrar ou descontinuar acesso; por isso a integração é substituível e sempre há dado histórico guardado.
- Fontes diferentes podem divergir; o sistema registra a origem e sinaliza inconsistência.
- Cálculo de posição errado compromete a confiança; por isso as regras financeiras são testadas antes de qualquer tela.
- O sistema não substitui a decisão do investidor nem garante resultado.

---

> Este documento é enviado ao cliente para leitura e aprovação verbal.
> Não substitui contrato formal — é uma ferramenta de alinhamento contínuo.
