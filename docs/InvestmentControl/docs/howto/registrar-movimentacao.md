---
project: INVESTMENT CONTROL
module: howto
audience: [suporte, usuario_final]
status: draft
---

# How-to: Registrar uma movimentação

> **Feature:** RN-014 — Movimentações e posição
> **Disponível desde:** Fase 1 (primeira entrega)
> **Nota:** documento escrito a partir da especificação; validar o passo a passo quando a feature estiver implementada.

---

## Objetivo

Registrar uma compra, venda, dividendo, juro, aplicação, resgate ou taxa para que o sistema calcule corretamente a sua posição e o seu preço médio.

## Antes de começar

- O ativo precisa estar cadastrado. Se ainda não estiver, cadastre primeiro.
- Tenha em mãos a nota ou o extrato da operação: data, quantidade, valor unitário e custos.

## Passo a Passo

1. Abra **Movimentações** e clique em **Nova movimentação**.
2. Escolha o **ativo**.
3. Escolha o **tipo**: Compra, Venda, Dividendo, Juros, Aplicação em renda fixa, Resgate de renda fixa ou Taxa.
4. Informe a **data** da operação (não pode ser futura).
5. Para compra ou venda, informe a **quantidade** e o **valor unitário**.
6. Informe os **custos** (corretagem, emolumentos), se houver.
7. Confira o **valor total** sugerido pelo sistema: quantidade × valor unitário + custos.
8. Acrescente uma **observação** se precisar justificar alguma diferença.
9. Clique em **Salvar**.

A posição e o preço médio são recalculados na hora.

## Dicas

- O sistema calcula o valor total automaticamente; se você digitar um valor diferente, ele avisa antes de salvar.
- Dividendo não altera o preço médio. Ele fica registrado como rendimento, separado do resultado de venda.
- Venda não muda o preço médio: ela baixa a quantidade e o custo proporcional.
- Se errou algo, **cancele** a movimentação com um motivo em vez de tentar apagar. O histórico fica preservado.

## Erros Comuns

| Problema | Causa | Solução |
|---|---|---|
| "O valor total não confere" | Total digitado difere de quantidade × valor unitário + custos | Corrija o total ou explique a diferença na observação |
| "A movimentação deixaria a posição negativa" | Venda maior que a quantidade que você possui | Confira a quantidade ou confirme a exceção com justificativa |
| "A data não pode ser superior a amanhã" | Data digitada no futuro | Corrija a data |
| "Ativo inativo não aceita nova movimentação" | O ativo foi inativado | Reative o ativo antes de registrar |
| "Informe quantidade e valor unitário" | Compra ou venda sem quantidade | Preencha os dois campos |
| Movimentação registrada duas vezes | Envio repetido por falha de conexão | O sistema evita duplicidade; se ocorrer, cancele a duplicada com motivo |
