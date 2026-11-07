---
project: INVESTMENT CONTROL
module: ativos
audience: [negocio]
status: draft
---

# RN-010 — Cadastro de ativos — Análise Funcional

> Gerado por rdd-doc em 07/11/2026 a partir de REQUIREMENTS.md (RN-âncora + RNs do escopo).

## O que esta entrega faz

Permite cadastrar qualquer investimento que a pessoa acompanha — um fundo imobiliário ou um título de renda fixa — e manter esse cadastro organizado por classe e segmento. É a base de tudo que vem depois: sem o ativo cadastrado, não há movimentação, posição nem carteira.

## Comportamento esperado

- A pessoa cadastra um ativo informando código, nome, classe e situação; dados como CNPJ, administrador e gestor são opcionais.
- Ao escolher a classe "FII", o sistema exige um segmento; para renda fixa, o segmento não se aplica.
- O mesmo código não pode ser cadastrado duas vezes para a mesma pessoa.
- Um ativo pode ser inativado sem desaparecer do histórico: ele sai das sugestões futuras, mas continua na carteira.
- A lista permite buscar por código ou nome e filtrar por classe, segmento e situação.
- A ficha do ativo mostra os dados cadastrais e a posição atual.

## Regras de negócio

| Regra | O que garante |
|---|---|
| 1 | O cadastro exige código, nome, classe e situação. |
| 2 | O código é único por pessoa e sempre em maiúsculas. |
| 3 | FII exige segmento; renda fixa não usa segmento. |
| 4 | As classes iniciais são Renda Fixa e FIIs, e novas classes podem ser cadastradas. |
| 5 | Os segmentos iniciais de FIIs estão disponíveis desde o primeiro uso. |
| 6 | CNPJ, quando informado, precisa ser válido. |
| 7 | Ativo inativado não entra em novas sugestões, mas permanece na carteira e no histórico. |
| 8 | A classe de um ativo com movimentações não pode ser alterada. |
| 9 | É possível buscar e filtrar a lista de ativos. |

## O que fica de fora

- Importação automática de cadastro a partir de fonte externa (fase posterior).
- Exclusão definitiva de ativo com histórico.
- Cadastro de ações, criptoativos ou fundos não imobiliários.
