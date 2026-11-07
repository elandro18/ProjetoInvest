---
project: INVESTMENT CONTROL
module: charter
audience: [negocio, tecnica]
status: draft
---

# Termo de Abertura — Investment Control

## 1. Identificação

| Campo | Valor |
|---|---|
| Nome do projeto | Investment Control — Gestão Inteligente de Investimentos |
| Cliente / contratante | Uso pessoal (proprietário do produto) |
| REDMINE | — (não informado) |
| Repositórios | `ProjetoInvest` (github.com/elandro18/ProjetoInvest) — repositório único de documentação e aplicação |
| Data de início | 07/11/2026 |

## 2. Contexto

O proprietário acompanha investimentos em Fundos de Investimento Imobiliários (FIIs) e renda fixa usando planilhas e múltiplos sites. A informação está fragmentada: posição consolidada em um lugar, indicadores fundamentalistas em outro, e a decisão de onde aportar depende de comparações manuais que não ficam registradas.

O objetivo financeiro declarado é construir patrimônio no longo prazo (horizonte inicial de 10 anos), reinvestindo integralmente os rendimentos, com alocação estratégica de 50% em renda fixa e 50% em FIIs.

## 3. Objetivo

Entregar uma aplicação web pessoal que funcione como centro de controle da carteira: registrar ativos e movimentações, consolidar o patrimônio, comparar a carteira com as metas de alocação, pesquisar FIIs com dados de fontes públicas e registrar as decisões de aporte.

Critérios de sucesso:

- O patrimônio total e a divisão por classe/segmento são confiáveis e conferíveis a partir das movimentações.
- A sugestão de aporte é explicável: cada real sugerido tem justificativa rastreável.
- Nenhum dado de mercado é exibido sem fonte e data de referência.
- A primeira entrega (Fase 1) permite controlar todo o patrimônio em um único lugar.

Não é objetivo: recomendar compra ou venda automaticamente, executar ordens, prometer rentabilidade ou substituir a decisão do investidor.

## 4. Escopo

Dentro do escopo:

- Cadastro genérico de ativos (FII e renda fixa), com classe e segmento.
- Registro de movimentações (compra, venda, dividendos, juros, aplicação, resgate, taxas).
- Carteira consolidada e dashboard com evolução patrimonial.
- Configuração de metas de alocação por classe e por segmento de FII.
- Cálculo de desvios e sugestão de distribuição do aporte mensal.
- Simulador de aportes.
- Pesquisa de FIIs por ticker com ficha detalhada e camada de provedores.
- Avaliação de FIIs por critérios e pontuação configuráveis.
- Controle de renda fixa, vencimentos e liquidez.
- Regras de concentração, alertas e histórico de sugestões.
- Projeções de longo prazo (Fase 5).
- Segurança, tratamento de erro de provedores e rastreabilidade de dados.

Fora do escopo:

- Execução de ordens, integração com corretoras ou custódia.
- Recomendação automática de compra/venda.
- Gestão de múltiplos usuários em contas distintas na primeira versão (a definir — `PEND-002`).
- Imposto de renda, apuração de DARF e obrigações fiscais.
- Aplicativo mobile nativo.
- Dados em tempo real (o sistema trabalha com cotações de fechamento e cache identificado).
- Criptoativos, ações e fundos de investimento não imobiliários na primeira versão.

## 5. Tipo de projeto

- [x] Novo sistema (greenfield)
- [ ] Evolutiva / migração de sistema existente
- [ ] Integração com terceiros
- [ ] Documentação de sistema existente (sistema vivo/em produção, sem migração)

**Legado:** ❌ Não — projeto novo, sem sistema anterior
**Sistema existente:** ❌ Não — greenfield puro

**Compliance:** ✅ Sim — `compliance: true` (o produto trata dado pessoal: identificação do titular, credenciais e dados patrimoniais/financeiros — checklist LGPD obrigatório em `specs/COMPLIANCE.md`; finding no `rdd-validate` se ausente)

## 6. Stakeholders

| Papel | Nome | Contato |
|---|---|---|
| PO / Negócio | Proprietário do produto | — |
| Lead técnico | Proprietário do produto | — |
| Desenvolvedor | Proprietário + assistente IA (opencode) | — |

## 7. Premissas

- Aplicação de uso pessoal, com login individual; o titular é o único usuário da primeira versão.
- Deploy na Vercel e banco PostgreSQL hospedado no Neon.
- Moeda padrão BRL e interface em português brasileiro.
- Toda integração externa passa pelo backend; o frontend nunca consome API financeira diretamente.
- Nenhum provedor de dados é assumido como definitivo ou gratuito (`PEND-001`).
- A primeira entrega contempla somente a Fase 1 do documento de especificação.
- Regras, metas, pesos e limites são configuráveis sem alteração de código.
- Dados ausentes são tratados como ausentes — nunca como indicador positivo.

## 8. Riscos iniciais

| # | Risco | Probabilidade | Impacto | Mitigação |
|---|-------|---------------|---------|-----------|
| R1 | Provedor de dados de mercado cobrar ou descontinuar endpoints | Alta | Alto | Camada de provedores por capacidade + cache local + fallback para dado histórico |
| R2 | Divergência entre dados de fontes diferentes (ex.: CVM × provedor de mercado) | Média | Alto | Proveniência obrigatória e tela de inconsistências (`RN-067`) |
| R3 | Cálculo de posição/preço médio incorreto | Média | Alto | Testes unitários obrigatórios das regras financeiras + conferência com extrato da corretora |
| R4 | Vazamento de credenciais ou dados patrimoniais | Baixa | Alto | Hash de senha, segredos em variáveis de ambiente, rotas privadas e isolamento por usuário |
| R5 | Escopo crescer para 10 épicos antes da Fase 1 estar sólida | Alta | Médio | `RN-080` — primeira entrega limitada à Fase 1 |
| R6 | Dependência de dado estimado apresentada como real | Média | Alto | Status de dado obrigatório (`RN-004`) e alerta visual em toda tela |
| R7 | Complexidade da avaliação de FIIs gerar nota enganosa | Média | Alto | `RN-040` — sem dado suficiente não há nota máxima; exibir critérios não atendidos e indisponíveis |
