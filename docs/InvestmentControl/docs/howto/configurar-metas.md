---
project: INVESTMENT CONTROL
module: howto
audience: [suporte, usuario_final]
status: draft
---

# How-to: Configurar metas de alocação

> **Feature:** RN-021 — Metas de alocação
> **Disponível desde:** Fase 1 (primeira entrega)
> **Nota:** documento escrito a partir da especificação; validar o passo a passo quando a feature estiver implementada.

---

## Objetivo

Definir quanto você quer ter em cada classe de investimento e em cada segmento de FII, para que o sistema mostre o quanto a sua carteira está longe da estratégia definida.

## Antes de começar

- Não é necessário ter ativos cadastrados para configurar metas, mas o desvio só aparece quando houver patrimônio.

## Passo a Passo

1. Abra **Alocação**.
2. No bloco **Metas por classe**, ajuste os percentuais de Renda Fixa e FIIs.
3. Confira o contador de soma: ele precisa fechar em 100%.
4. No bloco **Metas por segmento**, ajuste os percentuais de logística, shopping, recebíveis, lajes, renda urbana/híbridos, agronegócio e caixa/oportunidades.
5. Confira novamente a soma: também precisa fechar em 100%.
6. Clique em **Salvar**.
7. Confirme a alteração quando o sistema avisar que a configuração anterior será substituída.

A configuração anterior fica registrada no histórico, com a data em que valeu.

## Como ler o resultado

- **Abaixo**: você tem menos do que a meta.
- **Acima**: você tem mais do que a meta.
- **Dentro**: a diferença é de até 0,5 ponto percentual.
- A coluna **Valor para meta** mostra quanto falta, em reais, para chegar ao percentual definido.

## Dicas

- A meta inicial já vem configurada em 50% renda fixa e 50% FIIs.
- Os percentuais podem ser alterados a qualquer momento; o histórico preserva o que valia antes.
- O percentual por segmento é calculado sobre o patrimônio total — "caixa e oportunidades" entra na conta como um segmento.
- Mudar a meta não muda a carteira: apenas muda a comparação.

## Erros Comuns

| Problema | Causa | Solução |
|---|---|---|
| "A soma das metas deve ser 100%" | Percentuais somam mais ou menos que 100 | Ajuste até o contador fechar |
| Botão Salvar desabilitado | A soma do bloco está incorreta | Veja a mensagem "faltam X p.p." ou "excede X p.p." |
| "Classe ou segmento inválido" | Referência removida ou inativa | Recarregue a tela e escolha novamente |
| Desvio não aparece | Carteira sem patrimônio | Cadastre ativos e movimentações primeiro |
