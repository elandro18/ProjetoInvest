---
project: INVESTMENT CONTROL
module: compliance
audience: [tecnica, negocio]
status: draft
---

# Conformidade LGPD — Investment Control

> **Gatilho:** `compliance: true` no `PROJECT_CHARTER.md` (o produto trata dado pessoal: identificação, credenciais e dados patrimoniais).
> **Base normativa:** Lei 13.709/2018 (LGPD).
> **Natureza deste documento:** checklist técnico de conformidade. **Não é parecer jurídico.** Base legal, papel de controlador e retenção mínima devem ser confirmados pelo encarregado/jurídico do titular.

---

## 1. Papéis e contexto

| Papel | Quem | Observação |
|---|---|---|
| Controlador | Proprietário do produto | Decide finalidade e forma do tratamento |
| Operador | Provedores de infraestrutura (Vercel, Neon, e-mail transacional, provedor de market data) | Tratam dados em nome do controlador |
| Encarregado (DPO) | A definir (`PEND-016`) | Canal de comunicação com titulares e ANPD |
| Titulares | Usuários cadastrados (cadastro aberto — RN-085) | Podem ser múltiplos |

> **Decisão de arquitetura relevante:** o cadastro aberto (ADR-011) transforma o produto em aplicação multiusuário. Isso torna o isolamento por `usuario_id` (RN-070) um requisito de conformidade, não apenas de segurança.

---

## 2. Inventário de dados pessoais

| Dado | Categoria | Finalidade | Obrigatório? | Onde | Retenção proposta |
|---|---|---|---|---|---|
| Nome | Pessoal comum | Identificação na conta | Sim | `usuario.nome` | Enquanto a conta existir |
| E-mail | Pessoal comum | Login, verificação, redefinição | Sim | `usuario.email` | Enquanto a conta existir |
| Senha (hash) | Credencial | Autenticação | Sim | `usuario.senha_hash` | Enquanto a conta existir |
| Status de verificação | Pessoal | Controle de acesso | Sim | `usuario.status_conta`, `email_verificado_em` | Enquanto a conta existir |
| IP (hash) no aceite | Pessoal | Evidência de consentimento | Não | `aceite_legal.ip_hash` | 5 anos (defesa) |
| Token de conta (hash) | Credencial efêmera | Verificação/redefinição | Sim | `token_conta` | 90 dias após expirar |
| Posição, movimentação, rendimento | Financeiro pessoal | Serviço contratado | Sim | Tabelas com `usuario_id` | Enquanto a conta existir |
| Renda fixa (instituição, saldo) | Financeiro pessoal | Serviço contratado | Sim | `investimento_renda_fixa` | Enquanto a conta existir |
| Sugestões e decisões | Financeiro pessoal | Histórico do serviço | Sim | `sugestao_aporte` | Enquanto a conta existir |
| Log de integração | Técnico (sem PII por design) | Diagnóstico | Automático | `log_integracao` | `PEND-014` |
| E-mail em log de autenticação | Pessoal | Segurança | Automático | Log de aplicação | 90 dias, mascarado |

**Não coletados:** CPF, RG, endereço, telefone, data de nascimento, dados bancários, dados de cartão, geolocalização, biometria.

> Observação: dado financeiro é dado pessoal (art. 5º, I), mas **não** é dado pessoal sensível (art. 5º, II) pela definição legal. Ainda assim, recebe tratamento de confidencialidade alta.

---

## 3. Checklist dos 10 eixos

### 3.1 Levantamento e mapeamento de dados — **Parcial**

| Evidência | Situação |
|---|---|
| Inventário da §2 | ✅ |
| Origem de cada dado documentada | ✅ (formulário de cadastro, movimentação manual, provedores) |
| Fluxo de dados entre camadas mapeado | ✅ (`ARCHITECTURE.md`) |
| Confirmar que nenhum dado é coletado por telemetria de terceiros | ⏳ |

**Ação:** garantir que analytics/telemetria (se adicionados) não capturem payload financeiro. Registrar em `SECURITY.md` §10.

---

### 3.2 Base legal — **Pendente de confirmação jurídica**

| Operação | Base legal proposta | Observação |
|---|---|---|
| Criação e manutenção da conta | Execução de contrato ou procedimentos preliminares (art. 7º, V) | Relação de serviço entre titular e controlador |
| Registro de aceite de termos | Cumprimento de obrigação legal/regulatória e exercício regular de direitos (art. 7º, II/VI) | Evidência de consentimento informado |
| Envio de e-mail de verificação/redefinição | Execução de contrato (art. 7º, V) | Indispensável ao serviço |
| Comunicações de produto (se houver) | Consentimento (art. 7º, I) | Exige opt-in separado e revogável |
| Registro de logs de segurança | Legítimo interesse (art. 7º, IX) | Com teste de balanceamento documentado |

**Ação:** validar a base legal de cada operação com encarregado/jurídico e registrar em `DECISIONS.md` (ADR específico).

---

### 3.3 Consentimento e transparência — **Parcial**

| Item | Situação |
|---|---|
| Aceite explícito de Termos de Uso e Política de Privacidade no cadastro | ✅ especificado (RN-087, `aceite_legal`) |
| Registro de versão e data do aceite | ✅ |
| Re-aceite quando a versão muda | ⏳ (erro `AUTH_VERSAO_TERMOS_DESATUALIZADA` previsto, fluxo de UI a detalhar) |
| Texto dos Termos e da Política redigido | ❌ **pendente** |
| Consentimento separado para comunicação de marketing | ⏳ (não haverá na Fase 1) |
| Revogação de consentimento | ⏳ (a definir para comunicações) |

**Ação:** redigir Termos de Uso e Política de Privacidade antes do go-live; versionar e publicar em `/configuracoes/termos`.

---

### 3.4 Minimização e necessidade — **Atendido no design**

| Item | Situação |
|---|---|
| Campos coletados limitados ao necessário | ✅ (§2) |
| Nenhum campo sensível coletado | ✅ |
| IP armazenado apenas como hash | ✅ |
| Payload de integração não armazena PII desnecessária | ✅ (`log_integracao` sanitizado) |
| Exportação de carteira não inclui dado além do necessário | ⏳ (depende de `PEND-015`) |

---

### 3.5 Retenção e descarte — **Parcial**

| Item | Situação |
|---|---|
| Prazo por tipo de dado definido | ✅ parcial (§2: proposta) |
| Encerramento de conta anonimiza dados pessoais | ✅ especificado (RN-088) |
| Retenção de log definida | ❌ `PEND-014` |
| Rotina de descarte automático após prazo | ⏳ (job a implementar) |
| Backup respeita prazo de retenção | ⏳ (depende de `PEND-003`) |

**Ação:** aprovar prazos da §2, definir `PEND-014`, implementar job de expurgo de token e log. Dados financeiros podem ser mantidos enquanto a conta existir; após encerramento, apenas agregados anonimizados.

---

### 3.6 Direitos do titular — **Parcial**

| Direito (art. 18) | Como o sistema atende | Situação |
|---|---|---|
| Confirmação de tratamento | Área `/conta` e Política de Privacidade | ⏳ |
| Acesso aos dados | `/conta` + exportação (a definir) | ⏳ |
| Correção | Edição de perfil, ativos e movimentações | ✅ |
| Anonimização, bloqueio ou eliminação | `DELETE /api/conta` com anonimização | ✅ especificado |
| Portabilidade | Exportação JSON/CSV | ⏳ `PEND-015` |
| Eliminação de dados tratados com consentimento | Encerramento de conta | ✅ |
| Informação sobre compartilhamento | Política de Privacidade | ⏳ |
| Revogação de consentimento | A definir (comunicações) | ⏳ |

**Ação:** implementar exportação de dados e tela de direitos do titular; prazo de resposta de 15 dias.

---

### 3.7 Segurança e proteção de dados — **Parcial (especificado, não implementado)**

| Controle | Onde | Situação |
|---|---|---|
| Hash de senha Argon2id | `SECURITY.md` §4 | ⏳ implementação |
| Isolamento por usuário | RN-070, `SECURITY.md` §5 | ⏳ |
| Criptografia em trânsito (TLS) | Vercel/Neon | ✅ por padrão do provedor |
| Criptografia em repouso | Neon | ✅ por padrão do provedor — confirmar no plano |
| Rate limit e antiabuso | `SECURITY.md` §4 | ⏳ |
| Log de acesso e auditoria | `SECURITY.md` §10 | ⏳ |
| Backup e restauração | `PEND-003` | ❌ |
| Teste de IDOR | `SECURITY.md` §13 | ⏳ |

---

### 3.8 Registros e governança — **Parcial**

| Item | Situação |
|---|---|
| Registro de operações de tratamento (RTD) | ❌ **pendente** — este documento serve de base, mas o RTD formal não existe |
| Relatório de impacto (RIPD) | ❌ não aplicável na Fase 1 (sem dado sensível nem tratamento de alto risco); reavaliar se houver scoring de crédito ou perfilamento |
| Encarregado (DPO) designado e canal publicado | ❌ `PEND-016` |
| Política de resposta a incidente | ⏳ (`SECURITY.md` §10 cobre detecção; falta procedimento de comunicação à ANPD e ao titular) |
| Treinamento/conscientização | N/A (equipe de uma pessoa) |

---

### 3.9 Terceiros e compartilhamento — **Parcial**

| Terceiro | Dado compartilhado | Papel | Situação |
|---|---|---|---|
| Vercel | Requisições HTTP, logs de execução | Operador | ⏳ confirmar DPA e região |
| Neon | Todo o banco | Operador | ⏳ confirmar DPA e região |
| Provedor de e-mail | Nome, e-mail, token no link | Operador | ⏳ definir provedor |
| Provedor de market data | Ticker consultado (não é PII) | Operador | ⏳ definir provedor (`PEND-001`) |
| CVM (dados abertos) | Nenhum dado pessoal | Fonte pública | ✅ |

**Regra:** nenhum dado pessoal é enviado a provedor de market data. A consulta é por ticker.

---

### 3.10 Transferência internacional — **Parcial**

| Item | Situação |
|---|---|
| Vercel/Neon podem processar fora do Brasil | ⏳ confirmar região contratada |
| Base legal para transferência (art. 33) | ⏳ definir (cláusulas contratuais padrão ou país com adequação) |
| Informação na Política de Privacidade | ⏳ |

**Ação:** priorizar região `sa-east-1` (São Paulo) no Neon e na Vercel quando disponível; caso contrário, documentar a transferência e a base legal.

---

## 4. Direitos do titular — fluxo operacional

| Etapa | Responsável | Prazo |
|---|---|---|
| Recebimento da solicitação | Canal do encarregado | Imediato |
| Verificação de identidade | Titular autenticado | Imediato |
| Atendimento (acesso, correção, exclusão, portabilidade) | Produto + operação | 15 dias |
| Registro da solicitação e resposta | Encarregado | — |

---

## 5. Incidente de segurança

| Etapa | Ação |
|---|---|
| Detecção | Alerta de erro, log anômalo, relato do titular |
| Contenção | Revogar sessões, rotacionar segredos, bloquear conta |
| Avaliação | Dados afetados, titulares, risco |
| Comunicação | ANPD e titulares em prazo razoável quando houver risco relevante (art. 48) |
| Registro | Post-mortem em `support/KNOWN_ERRORS.md` ou documento de incidente |
| Melhoria | Ação corretiva e atualização deste checklist |

> Procedimento detalhado ainda não existe — **lacuna identificada**.

---

## 6. Pendências de conformidade

| # | Pendência | Impacto | Bloqueia go-live? |
|---|---|---|---|
| C1 | Redigir Termos de Uso e Política de Privacidade | Alto | Sim |
| C2 | Confirmar base legal por operação com jurídico | Alto | Sim |
| C3 | Designar encarregado e publicar canal (`PEND-016`) | Alto | Sim |
| C4 | Definir retenção de log (`PEND-014`) | Médio | Não |
| C5 | Implementar exportação/portabilidade (`PEND-015`) | Médio | Não |
| C6 | Confirmar região e DPA de Vercel/Neon | Médio | Não |
| C7 | Criar RTD formal | Médio | Não |
| C8 | Procedimento de resposta a incidente | Alto | Sim (documento) |
| C9 | Implementar job de expurgo de token/log | Baixo | Não |

---

## 7. Status geral

| Eixo | Status |
|---|---|
| 1. Levantamento de dados | 🟡 Parcial |
| 2. Base legal | 🔴 Pendente |
| 3. Consentimento e transparência | 🟡 Parcial |
| 4. Minimização | 🟢 Atendido no design |
| 5. Retenção e descarte | 🟡 Parcial |
| 6. Direitos do titular | 🟡 Parcial |
| 7. Segurança | 🟡 Parcial (especificado) |
| 8. Registros e governança | 🔴 Pendente |
| 9. Terceiros | 🟡 Parcial |
| 10. Transferência internacional | 🟡 Parcial |

**Conclusão:** o produto está **conforme no design** (minimização, isolamento, evidência de consentimento, exclusão de conta), mas **não está pronto para go-live** em conformidade: faltam documentos legais, encarregado, base legal confirmada e procedimento de incidente.
