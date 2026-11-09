# Investment Control

Aplicação web pessoal para controle de investimentos em FIIs e renda fixa: consolidação de patrimônio, metas de alocação e apoio à decisão de aporte.

> **Documentação:** `docs/InvestmentControl/` — charter, requisitos (91 RNs), decisões, specs, critérios de aceite e features.
> **Branch atual:** `feature/rn-001-fundacao-tecnica` (Fase 1).

---

## Stack

| Camada | Tecnologia |
|---|---|
| Aplicação | Next.js 16 (App Router) + TypeScript |
| Estilo | Tailwind CSS 4 |
| Banco | PostgreSQL (Neon em produção) + Prisma |
| Testes | Vitest (unitário/integração) + Playwright (E2E) |
| Deploy | Vercel |

A arquitetura separa apresentação (`app/`), domínio (`src/modules/`), persistência e integrações (`src/infra/`) e utilidades (`src/lib/`). O domínio não importa `next/*`, `@prisma/client` nem SDK de provedor — a regra é aplicada pelo ESLint (ADR-004).

---

## Pré-requisitos

- Node.js 22+
- npm 10+
- Docker (para o PostgreSQL local de desenvolvimento)

## Setup local

```bash
npm install
cp .env.example .env      # preencha os valores locais
```

### Banco local (Docker)

O banco de desenvolvimento sobe em `localhost:5433` com as credenciais abaixo (definidas em `docker-compose.dev.yml`). A porta 5432 fica livre porque uma instância nativa de PostgreSQL ocupa essa porta nesta máquina.

```bash
docker compose -f docker-compose.dev.yml up -d
```

```env
DATABASE_URL="postgresql://invest:invest@localhost:5433/investcontrol?schema=public"
DIRECT_URL="postgresql://invest:invest@localhost:5433/investcontrol?schema=public"
```

### Banco de produção (Neon)

No Neon, use a conexão **pooled** em `DATABASE_URL` e a **direta** em `DIRECT_URL`.

### Migrations e seeds

```bash
npm run db:migrate
npm run db:seed
```

## Scripts

| Script | O que faz |
|---|---|
| `npm run dev` | Sobe o servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run start` | Sobe o build de produção |
| `npm run lint` | ESLint (inclui a regra de dependência do domínio) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Testes unitários e de integração (Vitest) |
| `npm run test:watch` | Testes em modo watch |
| `npm run test:coverage` | Testes com relatório e gates de cobertura |
| `npm run test:e2e` | Testes E2E (Playwright) |
| `npm run db:migrate` | Cria e aplica migration de desenvolvimento |
| `npm run db:seed` | Popula dados de referência |
| `npm run db:studio` | Abre o Prisma Studio |

## Variáveis de ambiente

Todas as variáveis estão documentadas em `.env.example`. Nenhum `.env` é versionado (RN-068).

| Variável | Uso |
|---|---|
| `DATABASE_URL` | Conexão pooled com o PostgreSQL |
| `DIRECT_URL` | Conexão direta para migrations |
| `AUTH_SECRET` | Assinatura de sessão (mínimo 32 bytes) |
| `EMAIL_SERVER` | Conexão SMTP/API para e-mail transacional |
| `EMAIL_FROM` | Remetente das mensagens |
| `PROVIDER_MERCADO_API_KEY` | Chave do provedor de dados de mercado |
| `PROVIDER_CVM_BASE_URL` | Base URL dos dados abertos da CVM |

## Estrutura

```
app/                  Rotas e UI (App Router)
src/modules/          Domínio e casos de uso (TypeScript puro)
src/infra/            Persistência (Prisma) e provedores externos
src/lib/              Utilidades transversais (decimal, datas, resultado)
prisma/               Schema, migrations e seeds
docs/                 Documentação RDD (somente leitura para o código)
```

## Estado da entrega

**Fase 1 concluída** em 09/11/2026 — controle patrimonial completo em oito features:

| Feature | Entrega |
|---|---|
| RN-001 | Fundação técnica (Next 16, Prisma, auth base, CI) |
| RN-085 | Conta, login, verificação de e-mail, reset e encerramento |
| RN-010 | Cadastro de ativos (FII e renda fixa) |
| RN-014 | Movimentações e posição (preço médio) |
| RN-057 | Renda fixa com alertas |
| RN-021 | Metas de alocação e desvios |
| RN-020 | Carteira consolidada e evolução |
| RN-061 | Dashboard e painel de oportunidades |

Rotas: `/login`, `/cadastro`, `/verificar-email`, `/esqueci-senha`, `/redefinir-senha`, `/dashboard`, `/carteira`, `/ativos`, `/movimentacoes`, `/renda-fixa`, `/alocacao`, `/conta`.

Pendente para produção: deploy na Vercel + Neon (RN-001-5), provedor de e-mail real e as páginas legais `/termos` e `/privacidade`.

A Fase 2 (planejamento de aportes: sugestão de distribuição, simulador e concentração) começa a partir de `docs/InvestmentControl/` — as features ainda serão geradas.

## Regras que o código respeita

- Dinheiro em `numeric`/`Decimal`, nunca ponto flutuante (ADR-006).
- Toda integração externa passa pelo backend (RN-001).
- Nenhum segredo versionado (RN-068).
- Nenhuma regra de negócio existe só no código: toda implementação rastreia uma RN (RN-083/RN-084).
