---
project: INVESTMENT CONTROL
module: conta
audience: [negocio]
status: draft
---

# RN-085 — Conta e autenticação — Análise Funcional

> Gerado por rdd-doc em 07/11/2026 a partir de REQUIREMENTS.md (RN-âncora + RNs do escopo).

## O que esta entrega faz

Permite que uma pessoa crie a própria conta, confirme que o e-mail é dela e entre no sistema com segurança. Também permite recuperar o acesso quando esquece a senha e encerrar a conta quando quiser, com garantia de que ninguém mais acessa os dados depois disso.

## Comportamento esperado

- Qualquer pessoa pode criar uma conta informando nome, e-mail e senha, aceitando os termos e a política de privacidade.
- A conta só passa a funcionar depois que a pessoa confirma o e-mail.
- Se o e-mail já estiver cadastrado, o sistema avisa sem revelar informações de outra conta.
- A pessoa pode pedir um novo link de confirmação se o primeiro expirar.
- Quem esqueceu a senha pode pedir um link de redefinição; a resposta é sempre a mesma, exista ou não o e-mail.
- Ao entrar, a pessoa vê apenas os próprios dados — nunca os de outra conta.
- Ao encerrar a conta, o acesso é bloqueado imediatamente e os dados pessoais são eliminados ou descaracterizados.
- Tentativas repetidas de acesso são limitadas para dificultar ataques.

## Regras de negócio

| Regra | O que garante |
|---|---|
| 1 | O cadastro é aberto, mas depende de confirmação de e-mail. |
| 2 | Cada e-mail só pode estar em uma conta. |
| 3 | A senha precisa ser forte e nunca é guardada de forma legível. |
| 4 | O cadastro só termina com aceite dos termos e da política de privacidade, registrado com data e versão. |
| 5 | O link de confirmação expira e só pode ser usado uma vez. |
| 6 | O pedido de redefinição não revela se o e-mail existe. |
| 7 | O link de redefinição expira em uma hora, só pode ser usado uma vez e cancela os anteriores. |
| 8 | Toda consulta de dados é limitada ao dono da conta. |
| 9 | O encerramento da conta invalida os acessos e descaracteriza os dados pessoais. |
| 10 | Tentativas de acesso, cadastro e redefinição têm limite e espera progressiva. |

## O que fica de fora

- Login com Google, Apple ou outro provedor externo.
- Perfis de administrador ou permissões diferentes para o mesmo dado.
- Autenticação em dois fatores.
