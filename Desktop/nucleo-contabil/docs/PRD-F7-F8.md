# PRD — F7: Empresas + F8: Documentos
**Núcleo Contabilidade · versão 1.0 · 2026-07-01**

---

## Contexto

F0–F6 estão completas e em produção (`nucleo-contabil.vercel.app`). O nav lateral exibe "Empresas" e "Documentos" com badge "em breve". Este PRD especifica a remoção desse estado e a implementação dos dois módulos.

---

## F7 — Empresas

### Objetivo
Permitir que o escritório gerencie o cadastro das suas empresas-cliente: criar, editar dados cadastrais e desativar. A criação dispara geração automática de obrigações para a competência corrente.

### RBAC

| Operação | Papéis autorizados |
|---|---|
| Listar | todos os papéis internos (já existe) |
| Criar | `socio`, `contador` |
| Editar | `socio`, `contador` |
| Desativar (soft-delete) | `socio` apenas |

O `assistente` e o `cliente` não acessam esta rota. O `cliente` já tem isolamento próprio via `/cliente`.

### Campos do formulário

Mapeados 1:1 com o schema existente — nenhuma migração necessária.

| Campo | Tipo | Obrigatório |
|---|---|---|
| Razão Social | text | sim |
| Nome Fantasia | text | não |
| CNPJ | text (máscara XX.XXX.XXX/XXXX-XX) | sim |
| Regime Tributário | select: `simples` / `presumido` | sim |

### Regra de negócio: limite do plano

Antes de inserir, verificar `empresas.verificarLimite` (já implementado). Se o limite for atingido, bloquear com mensagem e link para `/billing`.

### Regra de negócio: geração automática de obrigações

Ao criar uma empresa, o servidor executa a mesma lógica do seed para a **competência corrente** (ano/mês de `new Date()`):
- Itera o `CATALOGO_OBRIGACOES` filtrando pelo regime da empresa.
- Respeita periodicidade (trimestral/anual: pula se não for o mês certo).
- Insere em `obrigacoes` com `status = "pendente_documentos"`.
- Usa `INSERT ... ON CONFLICT DO NOTHING` para idempotência.

### Regra de negócio: desativação

`ativa = false` — soft-delete. A empresa some da listagem padrão (filtro `ativa = true`) e deixa de contar no limite do plano. As obrigações e documentos existentes são preservados (auditoria).

### Rotas

| Rota | Descrição |
|---|---|
| `GET /empresas` | Listagem com tabela + botão "Nova empresa" |
| `GET /empresas/nova` | Formulário de criação |
| `GET /empresas/[id]` | Detalhe + formulário de edição inline |

### tRPC — novos endpoints

```
empresas.criar        → comPapel("socio", "contador")  mutation
empresas.editar       → comPapel("socio", "contador")  mutation
empresas.desativar    → comPapel("socio")               mutation
empresas.buscarPorId  → tenantProcedure                 query
```

### UI — tela `/empresas`

- Tabela com colunas: Nome Fantasia / Razão Social · CNPJ · Regime · Nº obrigações ativas · Status (badge Ativa / Inativa).
- Botão "Nova empresa" no header (visível para `socio`/`contador`).
- Linha clicável → abre detalhe/edição.
- Linha com empresa inativa: opacidade reduzida, sem botão de editar.
- Empty state quando não há empresas.

### UI — formulário (criação e edição)

- Page separada `/empresas/nova` e `/empresas/[id]`.
- Validação client-side com Zod (mesmo schema do tRPC).
- Erro de CNPJ duplicado: mensagem inline no campo.
- Erro de limite atingido: toast + link para `/billing`.
- Ao salvar com sucesso: redirect para `/empresas`.

---

## F8 — Documentos

### Objetivo

Permitir que o staff e o cliente façam "upload" de documentos fiscais (metadados apenas — sem storage real), vinculando-os a uma obrigação. O vínculo avança o status da obrigação de `pendente_documentos` → `em_classificacao`.

### RBAC

| Operação | Papéis autorizados | Escopo |
|---|---|---|
| Listar documentos | todos os papéis internos + `cliente` | staff: escritório inteiro; cliente: própria empresa |
| Fazer upload | `socio`, `contador`, `assistente`, `cliente` | staff: qualquer empresa; cliente: própria empresa |
| Excluir | `socio`, `contador` | própria empresa do escritório |

### Fluxo principal (upload simulado)

1. Usuário acessa `/documentos`.
2. Seleciona empresa (staff) — cliente vê apenas a própria.
3. Seleciona competência (ano + mês).
4. Preenche: tipo do documento, nome do arquivo.
5. Seleciona obrigação vinculada (lista filtrável pelas obrigações da empresa/competência — opcional).
6. Confirma → `documentos.enviar` mutation → insere linha em `documentos`.
7. Se `obrigacaoId` informado e status atual = `pendente_documentos` → muda para `em_classificacao`.
8. Redirect para listagem com toast de sucesso.

### Campos do formulário de upload

| Campo | Tipo | Obrigatório |
|---|---|---|
| Empresa | select (staff) / fixo (cliente) | sim |
| Competência (ano + mês) | select mês + input ano | sim |
| Tipo | select: NFe / Extrato / Recibo / Outro | sim |
| Nome do arquivo | text (simula nome do arquivo enviado) | sim |
| Obrigação vinculada | select (obrigações da empresa/competência) | não |

### Regra de negócio: avanço de status

A transição `pendente_documentos → em_classificacao` acontece **dentro da mesma transaction** que insere o documento. Se a obrigação já está em status mais avançado, não regride.

### tRPC — novos endpoints

```
documentos.listar       → tenantProcedure          query   (filtro: empresaId, ano, mes)
documentos.enviar       → tenantProcedure           mutation
documentos.excluir      → comPapel("socio","contador") mutation
```

O isolamento de tenant no `documentos.enviar` para o cliente é feito comparando `input.empresaId === ctx.empresaId` — rejeita com `FORBIDDEN` se diferente.

### Rotas

| Rota | Descrição |
|---|---|
| `GET /documentos` | Listagem com filtros empresa + competência |
| `GET /documentos/novo` | Formulário de upload |

### UI — tela `/documentos`

- Filtros no topo: empresa (select) + competência (mês/ano).
- Tabela: Empresa · Tipo · Nome do arquivo · Competência · Obrigação vinculada · Data de envio.
- Botão "Enviar documento" no header.
- Badge colorido no tipo (NFe = azul, Extrato = verde, Recibo = amarelo, Outro = cinza).
- Linha com obrigação vinculada mostra o nome do tipo de obrigação como chip clicável.
- Empty state quando não há documentos para os filtros selecionados.

### Portal do cliente (`/cliente`)

- Adicionar seção "Meus documentos" no `cliente-board.tsx` listando documentos da competência selecionada.
- Botão "Enviar documento" que leva para `/documentos/novo` (com empresa pré-fixada).

---

## Dependências entre F7 e F8

F8 depende de F7: o formulário de upload precisa da listagem de empresas ativas do escritório. Implementar F7 primeiro.

---

## Critérios de aceite

### F7
- [ ] Sócio e contador conseguem criar empresa com CNPJ único por escritório.
- [ ] Ao criar, obrigações da competência corrente aparecem no painel.
- [ ] Criar empresa quando limite atingido retorna erro com link para `/billing`.
- [ ] Somente sócio consegue desativar; empresa desativada some da listagem e do limite.
- [ ] Assistente e cliente não enxergam a rota `/empresas` (redirect pelo proxy).

### F8
- [ ] Staff consegue enviar documento para qualquer empresa do escritório.
- [ ] Cliente consegue enviar documento apenas para a própria empresa; tentativa para outra retorna 403.
- [ ] Ao vincular documento a obrigação `pendente_documentos`, status muda para `em_classificacao`.
- [ ] Obrigação já em status mais avançado não regride.
- [ ] Listagem respeita filtros de empresa e competência.
- [ ] Portal do cliente exibe documentos da competência selecionada.

---

## Fora de escopo (explicitamente)

- Upload real de arquivo (S3, Vercel Blob) — metadados apenas.
- Geração de obrigações retroativas para empresas já existentes — apenas competência corrente no ato da criação.
- Lucro Real — schema já tem o campo, não será exposto na UI por ora.
- Preview ou download de documento.
