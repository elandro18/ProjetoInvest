---
project: INVESTMENT CONTROL
module: howto
audience: [suporte, usuario_final]
status: draft
---

# How-to: Cadastrar um ativo

> **Feature:** RN-010 — Cadastro de ativos
> **Disponível desde:** Fase 1 (primeira entrega)
> **Nota:** documento escrito a partir da especificação; validar o passo a passo quando a feature estiver implementada.

---

## Objetivo

Registrar no sistema um investimento que você acompanha — um fundo imobiliário ou um título de renda fixa — para que ele possa receber movimentações e aparecer na sua carteira.

## Antes de começar

- Tenha em mãos o código do ativo (ticker, como `HGLG11`) ou o nome do título.
- Para FIIs, saiba o segmento (logística, shopping, recebíveis, lajes, renda urbana, híbridos, agronegócio ou outros).

## Passo a Passo

1. No menu, abra **Ativos** e clique em **Novo ativo**.
2. Informe o **código** do ativo (4 a 20 letras ou números, em maiúsculas).
3. Preencha o **nome** do ativo como você quer vê-lo na carteira.
4. Escolha a **classe**: Fundos Imobiliários ou Renda Fixa.
5. Se escolheu Fundos Imobiliários, escolha também o **segmento**.
6. Preencha os campos opcionais que fizerem sentido: CNPJ, administrador, gestor, fonte dos dados e observações.
7. Deixe a **situação** como "Ativo".
8. Clique em **Salvar**.

O ativo passa a aparecer na lista e na carteira — ainda com posição zerada, até que você registre a primeira movimentação.

## Dicas

- Use o mesmo código que a corretora usa. Isso facilita a conferência do extrato.
- Preencha o administrador e o gestor quando forem relevantes para a sua análise de concentração.
- Você pode inativar um ativo depois. Ele sai das sugestões futuras, mas continua no histórico e na carteira.

## Erros Comuns

| Problema | Causa | Solução |
|---|---|---|
| "Já existe um ativo com este ticker" | Você já cadastrou esse código | Procure o ativo na lista e edite o existente |
| "Informe o segmento para um FII" | Classe Fundos Imobiliários sem segmento | Escolha um dos segmentos disponíveis |
| "Ticker inválido" | Código com espaço, acento ou menos de 4 caracteres | Use apenas letras e números, sem espaços |
| "CNPJ inválido" | Número digitado errado | Confira os 14 dígitos e o dígito verificador |
| "A classe não pode ser alterada após movimentações" | O ativo já tem histórico | Cadastre um novo ativo com a classe correta |
