# Núcleo Contábil

SaaS multi-tenant para escritório contábil. Projeto de portfólio construído com Next.js 16, tRPC v11, Drizzle ORM, Auth.js v5 e PostgreSQL.

## Demo

> **[nucleo-contabil.vercel.app](https://nucleo-contabil.vercel.app)**

### Contas de teste

| Papel | E-mail | Senha |
|---|---|---|
| Sócio (acesso total) | `socio@nucleo.com` | `senha123` |
| Contador | `contador@nucleo.com` | `senha123` |
| Assistente | `assistente@nucleo.com` | `senha123` |
| Cliente — Padaria Pão Quente | `cliente@paoquente.com` | `senha123` |
| Cliente — TechNuvem | `cliente@technuvem.com` | `senha123` |

Cada papel tem visibilidade e permissões diferentes. O cliente só enxerga a própria empresa.

---

## Stack

- **Next.js 16** — App Router, Server Components, Route Handlers
- **tRPC v11** — API type-safe end-to-end
- **Drizzle ORM** — queries tipadas, migrations, isolamento multi-tenant
- **Auth.js v5** — autenticação com Credentials provider, sessão JWT
- **PostgreSQL** (Neon em produção)
- **Tailwind CSS v4**

## Funcionalidades

- **Multi-tenant** — isolamento por `escritorioId` em todas as queries; cliente isolado por `empresaId`
- **RBAC** — sócio / contador / assistente / cliente com permissões granulares
- **Pipeline de obrigações** — kanban com estágios pendente → classificação → gerada → entregue
- **Documentos** — envio e vínculo de documentos às obrigações fiscais
- **Relatórios PDF** — exportação por competência com gráfico de progresso, tabela e assinatura
- **Revisão IA** — classificação de lançamentos com confiança e fila de revisão
- **Billing** — planos por faixa de empresas com controle de limite

## Rodando localmente

```bash
# 1. Instalar dependências
npm install

# 2. Configurar variáveis de ambiente
cp .env.example .env
# Preencher DATABASE_URL e AUTH_SECRET

# 3. Aplicar schema e seed
npm run db:push
npm run db:seed

# 4. Iniciar
npm run dev
```
