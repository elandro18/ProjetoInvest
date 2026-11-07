---
project: INVESTMENT CONTROL
module: qualidade
audience: [tecnica, negocio]
status: draft
---

# Definição de Pronto (DoD) — Investment Control

> Uma entrega só é "pronta" quando atende ao nível correspondente. DoD de task é cumulativo com o de feature; DoD de release é cumulativo com os dois.

---

## 1. DoD de task

- [ ] A task está vinculada a pelo menos uma RN (`RN-NNN`) e a um critério de aceitação (`AC-NNN`).
- [ ] A mudança está restrita ao escopo da task; nada fora foi alterado.
- [ ] Teste automatizado cobre o caso feliz e ao menos um caso de borda.
- [ ] `npm run lint` e `npm run typecheck` passam.
- [ ] `npm run test` passa; cobertura de `src/modules/**` não caiu.
- [ ] Migration criada quando houve alteração de schema.
- [ ] Contrato de API atualizado em `specs/API_CONTRACTS.md` quando endpoint mudou.
- [ ] Erro novo registrado em `specs/ERROR_CATALOG.md`.
- [ ] Tela documentada em `specs/UI_SPEC.md` quando houve mudança de UI.
- [ ] Nenhum segredo, dado real de titular ou `console.log` de payload financeiro.
- [ ] Revisão de código aprovada (quando houver PR).
- [ ] Registro da task atualizado no arquivo de feature.

---

## 2. DoD de feature

- [ ] Todas as tasks da feature concluídas e seus AC verdes.
- [ ] Critérios de aceitação da RN-âncora verificados ponta a ponta.
- [ ] Análise (`analysis/RN-NNN — <título>/`) atualizada se a implementação divergiu do previsto.
- [ ] `quality/TRACEABILITY.md` atualizado (RN → artefato → teste).
- [ ] E2E do fluxo principal da feature passando.
- [ ] Estados de tela implementados: carregando, vazio, erro, parcial e sucesso.
- [ ] Acessibilidade mínima: teclado, foco visível, contraste e rótulos.
- [ ] Documentação de uso (`docs/howto/`) quando a feature altera o modo de operar.
- [ ] Nenhum item de `PEND` foi resolvido por suposição: pendência tocada virou RN (IMP-094) ou CR.

---

## 3. DoD de release — Fase 1

### 3.1 Funcional

- [ ] Cadastro aberto, verificação de e-mail, login, recuperação e encerramento de conta funcionando.
- [ ] Cadastro de ativos (FII e renda fixa) com classe, segmento e status.
- [ ] Movimentações com cálculo de posição e preço médio (casos G1–G7 verdes).
- [ ] Renda fixa com saldo, status, vencimento e alertas.
- [ ] Carteira consolidada com os nove indicadores.
- [ ] Dashboard com os nove indicadores e os seis gráficos.
- [ ] Configuração de meta 50/50 (e por segmento) com validação de soma.
- [ ] Cálculo de desvios em pontos percentuais e em reais.

### 3.2 Qualidade

- [ ] Cobertura de domínio ≥ 90% linhas e ≥ 85% branches.
- [ ] Suíte unitária, de integração e E2E verdes no CI.
- [ ] Nenhum bug crítico ou alto aberto.
- [ ] `npm audit --audit-level=high` limpo.

### 3.3 Segurança

- [ ] Checklist de `specs/SECURITY.md` §13 completo.
- [ ] Teste de IDOR verde (usuário A não acessa dado de B).
- [ ] Cookie de sessão com `httpOnly`, `secure` e `sameSite` em produção.
- [ ] Rate limit validado nos endpoints de autenticação.
- [ ] Nenhum segredo no repositório.

### 3.4 Dados e operação

- [ ] Migrations aplicadas em produção de forma idempotente.
- [ ] Backup do Neon configurado e **restauração testada** (`PEND-003`).
- [ ] Deploy automático a partir da branch principal funcionando.
- [ ] `/api/health` respondendo e monitorado.
- [ ] Log de integração com retenção definida (`PEND-014`).

### 3.5 Conformidade

- [ ] Termos de Uso e Política de Privacidade publicados e versionados (C1).
- [ ] Base legal confirmada (C2).
- [ ] Encarregado designado e canal publicado (C3, `PEND-016`).
- [ ] Procedimento de resposta a incidente documentado (C8).
- [ ] `specs/COMPLIANCE.md` sem pendência bloqueante.

### 3.6 Documentação

- [ ] `README.md` com setup local, variáveis e comandos.
- [ ] `docs/howto/` com "como cadastrar ativo", "como registrar movimentação", "como configurar metas".
- [ ] `CHANGELOG.md` atualizado.
- [ ] `quality/TRACEABILITY.md` sem RN da Fase 1 órfã.
- [ ] `INDEX.md` e `CONSTITUTION.md` refletindo o estado real.

---

## 4. Definição de NÃO pronto

A entrega **não** está pronta quando, em qualquer nível:

- O número aparece na tela sem fonte ou data de referência.
- Um dado ausente foi substituído por zero, traço ou estimativa silenciosa.
- A regra só existe no código e não está em `REQUIREMENTS.md`.
- O teste passa apenas porque o mock foi ajustado ao comportamento observado.
- A funcionalidade está fora da Fase 1 e foi implementada sem decisão registrada (viola RN-083).
- A pendência foi "resolvida" sem registro (viola RN-077 e IMP-094).

---

## 5. Responsabilidades

| Papel | Verifica |
|---|---|
| Executor | DoD de task |
| Orquestrador de dev | DoD de feature e revisão pré-PR |
| QA | Suíte, cobertura e AC |
| Proprietário | DoD de release e aceite de negócio |
