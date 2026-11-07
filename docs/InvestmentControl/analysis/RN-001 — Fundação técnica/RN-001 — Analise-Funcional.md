---
project: INVESTMENT CONTROL
module: fundacao
audience: [negocio]
status: draft
---

# RN-001 — Fundação técnica — Análise Funcional

> Gerado por rdd-doc em 07/11/2026 a partir de REQUIREMENTS.md (RN-âncora + RNs do escopo).

## O que esta entrega faz

Coloca o sistema de pé: a aplicação passa a existir em um endereço acessível, com banco de dados, padrões de registro de erro e uma base de dados de referência (classes e segmentos de investimento). Sem essa entrega, nenhuma outra funciona.

## Comportamento esperado

- A aplicação abre no navegador, em endereço público, e informa que está no ar.
- O sistema sabe distinguir uma falha passageira de uma falha definitiva e informa o usuário sem expor detalhe interno.
- Toda informação vinda de fora carrega fonte e data de referência.
- Se uma fonte externa cair, o sistema continua mostrando o que já tem guardado.
- A base já vem com as classes Renda Fixa e FIIs e com os segmentos de FIIs definidos.
- O valor é sempre apresentado em reais e o texto em português do Brasil.

## Regras de negócio

| Regra | O que garante |
|---|---|
| 1 | O sistema está disponível em endereço público e responde a uma verificação de saúde. |
| 2 | Toda informação externa guardada ou mostrada tem fonte e data de referência. |
| 3 | Informação estimada é identificada como estimada, nunca como oficial. |
| 4 | Se uma fonte externa estiver fora do ar, os dados já guardados continuam acessíveis. |
| 5 | Falha de fonte externa é registrada para consulta posterior, sem expor segredo ao usuário. |
| 6 | A moeda é o real e o idioma é o português do Brasil. |
| 7 | Nenhuma chave de acesso fica visível para quem usa o sistema. |
| 8 | As classes e os segmentos iniciais já existem quando o sistema começa a operar. |
| 9 | Esta entrega não implementa nada além do necessário para as demais funcionalidades da primeira fase. |

## O que fica de fora

- Cadastro de ativos, movimentações, carteira, renda fixa, metas e dashboard — cada um tem sua própria entrega.
- Integração real com qualquer provedor de dados de mercado (fase posterior).
- Qualquer compra, venda ou recomendação automática.
