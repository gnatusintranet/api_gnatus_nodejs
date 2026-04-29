# Manual Técnico — Intranet GNATUS 2026

Documento de referência técnico do projeto. Para cada módulo, descreve **o que faz**, **como funciona**, **quais tabelas/serviços usa** e **regras de negócio importantes**.

> Este manual é mantido junto ao código (vive no repo do backend). Atualizar quando mexer em qualquer módulo.

---

## 1. Visão geral

A Intranet GNATUS substitui processos manuais (planilhas, sistemas legados, formulários) por uma aplicação web única, integrada ao ERP **Protheus** (TOTVS) e ao **Microsoft 365**.

**Dois repositórios** (github.com/gnatusintranet, branch `master`):
- **Backend**: `api_ecopower_nodejs` — Node.js + Express, porta 3000
- **Frontend**: `frontend_intranet_react` — Vite + React 18 + TypeScript, porta 5173 (dev)

**Produção**: `https://intranew.gnatus.com.br` (VPS Hostinger Boston, IP `177.7.37.251`).

**Bancos**:
- **PostgreSQL 16** (`intranet`) — todos os dados próprios da intranet (usuários, perms, cofre, cobrança, equipamentos, atribuições)
- **MSSQL Protheus** (read-only) — leitura do ERP via VPN/NAT (SE1, SA1, SC5, SF2, SD1, SX5, SB1/SB2, SG1, etc.)
- **MySQL** — apenas autenticação de tipos legados (`motorista`, `eco_camarote`)

---

## 2. Arquitetura

### 2.1 Backend

**Entry point**: [`index.js`](index.js) carrega `dotenv` → cria express → injeta `cors` + `body-parser` → carrega services via `config/loader.js` → registra rotas via `config/resources.js` → sobe socket.io.

**Auto-discovery de rotas** ([`config/resources.js`](config/resources.js)): varre `resources/**/*.js`. Cada arquivo exporta:
```js
module.exports = (app) => ({
  verb: 'get',         // método HTTP
  route: '/foo',       // path relativo
  handler: async (req, res) => { ... },
  anonymous: false,    // se true, pula middleware de auth
  middlewares: [...]   // opcionais
});
```
A pasta vira prefixo: `resources/cobranca/cobranca.dashboard.js` com `route: '/dashboard'` → `GET /cobranca/dashboard`.

**Autenticação** ([`middlewares/authentication.js`](middlewares/authentication.js)): valida Bearer JWT, popula `req.user` consultando o banco apropriado conforme `decoded.type`:
- `usuario` (default) → `tab_intranet_usr` (Postgres)
- `motorista`, `eco_camarote` → MySQL legado
- `franqueado` → tabela específica (não usada na intranet web atual)

**Padrão de query**: SQL parametrizado via [`services/pg.js`](services/pg.js) com tradução de sintaxe MSSQL→PG (`@param` → `$N`, `GETDATE()` → `NOW()`). Retornos sempre RTRIM em strings do Protheus.

### 2.2 Frontend

- **Roteamento**: [`src/Routes.tsx`](../frontend_intranet_react/src/Routes.tsx) com `react-router-dom v6`. Cada rota envolve `<Protect requiredPerms={[code, 0]}>...`
- **Proteção** ([`src/services/Protect.tsx`](../frontend_intranet_react/src/services/Protect.tsx)): valida JWT, busca perms via `/users/me`, redireciona pra `/login` ou `/` conforme acesso
- **Sidebar dinâmica** ([`src/utils/GetSidebar.tsx`](../frontend_intranet_react/src/utils/GetSidebar.tsx)): filtra itens por perm do user
- **Cliente HTTP**: [`src/services/Api.tsx`](../frontend_intranet_react/src/services/Api.tsx) (axios + Bearer JWT)
- **MSAL** ([`src/utils/msalConfig.ts`](../frontend_intranet_react/src/utils/msalConfig.ts)): Azure AD pra Reserva de Sala (Microsoft Graph)

### 2.3 Padrão de permissões

Cada item de menu / rota tem array `perm: [N, 0]`:
- **`[]`** → qualquer usuário logado vê (Dashboard, Alterar Senha)
- **`[0]`** → admin universal
- **`[N, 0]`** → quem tem perm N OU quem é admin
- Lógica em [`Protect.tsx`](../frontend_intranet_react/src/services/Protect.tsx) e [`GetSidebar.tsx`](../frontend_intranet_react/src/utils/GetSidebar.tsx)

⚠️ **Bug histórico** (já corrigido): código antigo usava `requiredPerms.includes(0)` o que liberava qualquer rota com `0` na lista pra todos. Hoje usa `userPerms.includes(0)` (admin é o usuário, não a rota).

---

## 3. Módulos do sistema

### 3.1 Tecnologia

#### Gestão de Usuários · `/tecnologia/usuarios` · perm 1028
- **Página**: [GestaoUsuarios.tsx](../frontend_intranet_react/src/pages/GestaoUsuarios/GestaoUsuarios.tsx)
- **Endpoints**: `/users/all`, `/users/create` (aceita `permissoes[]` no body), `/users/:id/update`, `/users/:id/toggle-active`
- **Modal de criação**: tabs **Dados** + **Permissões**. Permissões selecionadas vão junto no payload (batch insert em `tab_intranet_usr_permissoes` com `ON CONFLICT DO NOTHING`).
- **Modal de edição**: toggle individual por perm (chamada otimista que reverte em erro)
- Inclui campos `codigoProtheus` (USR_ID em SYS_USR — necessário pra aprovações SC/PC) e `ramal` (PABX click-to-call)
- Mostra usuários inativos (filtro removido em `users.all.js` pra permitir reativar)

#### Gerenciamento de Permissões · `/permissoes` · perm 1026
- **Página**: [Permissoes.tsx](../frontend_intranet_react/src/pages/Permissoes/Permissoes.tsx)
- CRUD do catálogo (`tab_intranet_permissoes`) e atribuição em massa
- Aceita `id_permissao = 0` (admin universal) — corrigido em backend (validação antiga rejeitava com `!idPerm`)

#### Termo de Responsabilidade · `/tecnologia/termo-equipamento` · perm 1027
- **Página**: [TermoEquipamento.tsx](../frontend_intranet_react/src/pages/TermoEquipamento/TermoEquipamento.tsx)
- Formulário CLT/PJ → preview do termo → `window.print()` (CSS `@media print`)
- Salva log em `tab_termo_equipamento` E **automaticamente** registra equipamento ATIVO em `tab_equipamento_atual` (idempotente via `id_termo_origem`)
- CSS print força `visibility/opacity/color` em `.termo__doc *` pra evitar branco-em-branco

#### Equipamentos com Colaboradores · `/tecnologia/equipamentos` · perm 1027
- **Página**: [Equipamentos.tsx](../frontend_intranet_react/src/pages/Equipamentos/Equipamentos.tsx)
- Visão consolidada de quem tem o quê. KPIs: colaboradores, ativos, defeitos, devoluções
- **Tabela `tab_equipamento_atual`** ([migration 12](database/postgres/12-tecnologia-equipamento-atual.sql)):
  - status: `ATIVO` | `SUBSTITUIDO` | `REMOVIDO`
  - motivo: `DEFEITO` | `PERDA` | `FIM_CONTRATO` | `UPGRADE` | `OUTRO`
  - `id_substituicao` aponta pro novo registro quando há troca
  - calcula `diasDeUso = data_remocao - data_entrega` (ou `today - data_entrega` se ATIVO)
- Drawer ao clicar no colaborador: equipamentos ativos + histórico (com tempo de uso)
- Ações por equipamento: **Adicionar** / **Substituir** (registra motivo + cria novo) / **Remover** (com motivo)
- Checkbox "Gerar termo após salvar" → redireciona pra `/tecnologia/termo-equipamento` com query params pré-preenchidos

#### Provisionamento (AD + M365) · `/tecnologia/provisionamento` · perm 1029
- **Página**: [Provisionamento.tsx](../frontend_intranet_react/src/pages/Provisionamento/Provisionamento.tsx)
- Cria usuário no AD local (`gnt.local`) + M365 (Graph API) numa só ação
- **Backend service**: [services/ad.js](services/ad.js) (`ldapts`) + [services/m365.js](services/m365.js) (Graph SDK)
- Endpoints em `/provisionamento`: `ous`, `grupos`, `licencas-m365`, `criar`, `desligar`, `buscar-usuarios`
- Requer `.env`: `AD_URL`, `AD_BASE_DN`, `AD_BIND_USER`, `AD_BIND_PASSWORD`, `M365_TENANT_ID`, `M365_CLIENT_ID`, `M365_CLIENT_SECRET`
- Em produção, AD é acessado via **VIP do FortiGate** (200.15.18.119:36363 → 172.31.255.100:636 LDAPS)

---

### 3.2 Faturamento

#### Ranking de Vendedores · `/vendas/ranking` · perm 2001
- **Página**: [VendasRanking.tsx](../frontend_intranet_react/src/pages/VendasRanking/VendasRanking.tsx)
- Pódio top 3 (medalhas) + lista. Avatares em `public/avatars/vendedores/{cod}.png` com fallback.

#### Relatório de Faturamento · `/vendas/faturamento` · perm 2002
- **Página**: [FaturamentoRelatorio.tsx](../frontend_intranet_react/src/pages/FaturamentoRelatorio/FaturamentoRelatorio.tsx)
- 73 colunas via `exceljs`. Preview paginado + export `.xlsx`.

---

### 3.3 Compras

#### Solicitações de Compra · `/compras/solicitacoes` · perm 4001
- **Página**: [SolicitacoesCompra.tsx](../frontend_intranet_react/src/pages/Compras/SolicitacoesCompra.tsx)
- SC1010 do Protheus, decoders de status, auto-refresh 30s

#### Pedidos de Compra · `/compras/pedidos` · perm 4002
- **Página**: [PedidosCompra.tsx](../frontend_intranet_react/src/pages/Compras/PedidosCompra.tsx)
- SC7010, chips filtráveis, drawer com itens

#### Minhas Aprovações · `/compras/aprovacoes` · perm 13001
- **Página**: [Aprovacoes.tsx](../frontend_intranet_react/src/pages/Compras/Aprovacoes.tsx)
- Pega documentos pendentes pra aprovador logado (cruza `req.user.codigoProtheus` com `SC1_USERAPRO`/`C7_USERAPRO`)
- Aprova/rejeita via API REST custom Gnatus do Protheus (não TOTVS REST padrão)
- Anexos via TOTVS Documents (base64 EncodeDocument)

---

### 3.4 SAC

#### Consulta de Cliente · `/sac/cliente` · perm 6001
- **Página**: [SAC.tsx](../frontend_intranet_react/src/pages/SAC/SAC.tsx)
- Busca por nome/código → 360° (cadastro + histórico de NF + drawer de NF)
- Click-to-call via PABX FALEmais (precisa `ramal` do user)

#### Supervisão SAC · `/sac/supervisao` · perm 6002
- **Página**: [SupervisaoSAC.tsx](../frontend_intranet_react/src/pages/SAC/SupervisaoSAC.tsx)
- Lista chamadas de todos os ramais + player de áudio das gravações
- Backend [services/falemais.js](services/falemais.js) usa Sigma API + Gravacoes API

---

### 3.5 Financeiro

#### Contas a Pagar · `/financeiro/contas-pagar` · perm 8001
- **Página**: [ContasPagar.tsx](../frontend_intranet_react/src/pages/Financeiro/ContasPagar.tsx)
- SE2010 do Protheus, filtros por base (emissão/vencimento) + fornecedor + status

#### Contas a Receber · `/financeiro/contas-receber` · perm 8002
- **Página**: [ContasReceber.tsx](../frontend_intranet_react/src/pages/Financeiro/ContasReceber.tsx)
- SE1010 análogo, com cálculo de multa/juros

---

### 3.6 Cobrança (módulo dedicado)

> Reescrito recentemente pra substituir a planilha operacional de inadimplência. Ver [intranet_cobranca.md](https://github.com/anthropics/claude-code) na auto-memória pra histórico.

**Tabelas próprias** (Postgres):
- `tab_cobranca_acao` — cada interação registrada (ligação, email, acordo, etc.)
- `tab_cobranca_comentario` — notas internas (não vão pro cliente)
- `tab_cobranca_status_cliente` — status comercial atual (REGULAR/NEGOCIANDO/PROMESSA/PROTESTO/JURIDICO/PERDA)
- `tab_cobranca_atribuicao` — carteira manual por cliente (NORMAL/JURIDICO/NEGOCIACAO/OUTROS) [migration 10]
- `tab_cobranca_bu_equipe` — mapeamento BU → Equipe (substitui aba "apoio" da planilha) [migration 11]

**Regras importantes**:
- Sempre exclui `E1_TIPO IN ('RA','NCC')` (adiantamentos e créditos do cliente — não são títulos cobráveis)
- Faturado = `E1_NUM <> ''` (tem número de NF)
- Equipe deriva do BU via mapeamento (não manual por cliente)
- Carteira é manual por cliente (depende de relação comercial)
- Aging: A vencer | 1-30 | 31-60 | 61-90 | 91-180 | 181-360 | 360+

#### Dashboard / Carteira de Cobrança · `/cobranca/dashboard` · perm 9001
- **Página**: [DashboardCobranca.tsx](../frontend_intranet_react/src/pages/Cobranca/DashboardCobranca.tsx)
- **Endpoint**: [GET /cobranca/dashboard](resources/cobranca/cobranca.dashboard.js)
- 5 KPIs (em aberto, a vencer, vencido, % inadimplência, ABC)
- 5 tabs: **Aging** (barras coloridas) · **Carteira/Equipe/BU** (3 cards) · **Curva ABC** (Pareto 80/15/5) · **Clientes** · **Títulos**
- Drawer ao clicar no cliente: editar carteira/observação + ver última ação + abrir página completa
- Filtros completos (cliente, UF, BU, formaPgto, carteira, equipe, aging, ação)
- Exporta CSV com 32 colunas

#### Painel de Cobrança · `/cobranca/painel` · perm 9001
- **Página**: [PainelCobranca.tsx](../frontend_intranet_react/src/pages/Cobranca/PainelCobranca.tsx)
- Visão antiga (vai ser deprecada eventualmente) — só vencidos com `diasMinimos` configurável
- Cliente/Título tabs

#### Cliente Cobrança · `/cobranca/cliente/:cod/:loja` · perm 9001 (não está no menu)
- **Página**: [ClienteCobranca.tsx](../frontend_intranet_react/src/pages/Cobranca/ClienteCobranca.tsx)
- 360°: dados, títulos abertos, timeline de ações, comentários, status
- Modais pra registrar/editar ação e atualizar status
- Só autor ou admin pode editar/excluir ação/comentário

#### BU ↔ Equipe · `/cobranca/bu-equipe` · perm 9001
- **Página**: [BuEquipe.tsx](../frontend_intranet_react/src/pages/Cobranca/BuEquipe.tsx)
- Tela de gestão dos 64 mapeamentos (substitui aba "apoio")
- Adicionar / editar inline / remover
- Endpoints: `GET/POST/DELETE /cobranca/bu-equipe`
- Quando aparecer "Sem equipe" no dashboard, adicionar aqui

#### Minhas Ações · `/cobranca/minhas-acoes` · perm 9003
- **Página**: [MinhasAcoes.tsx](../frontend_intranet_react/src/pages/Cobranca/MinhasAcoes.tsx)
- Fila do analista logado. Scope `pendentes` (promessas em aberto) ou `todas`

---

### 3.7 Gerência

#### DRE Gerencial · `/gerencia/dre` · perm 10001
- **Página**: [DRE.tsx](../frontend_intranet_react/src/pages/Gerencia/DRE.tsx)
- **Endpoint**: [GET /gerencia/dre](resources/gerencia/gerencia.dre.js)
- Demonstrativo em regime competência por **emissão**
- **Receita bruta**: SF2+SD2 com CFOPs de venda
- **Deduções**: ICMS + PIS + COFINS + IPI (do D2_VAL*) + devoluções (SD1+SF1 CFOPs entrada)
- **CMV**: `SUM(D2_CUSTO1)` nas linhas de venda
- **Despesas operacionais** (entram em EBIT): naturezas SE2 com prefixos:
  - 204 Serviços Tomados · 205 Despesas com Pessoal · 206 Despesas Gerais · 207 Despesas Administrativas · 210 Investimentos · 212 Sócios · 213 Imobilizado/Consórcio
- **Compras de insumos** (NÃO entram em EBIT — informativo): 201 MP Nacional · 202 MP Importada · 203 Desembaraço (esses custos são absorvidos via CMV quando o produto é vendido)
- **Resultado financeiro** (perm 211): heurística por palavra-chave do histórico:
  - `JUROS|IOF|TAXA|TARIFA|CUSTAS|MULTA|MORA|CORRETAGEM` → entra como JUROS no DRE
  - `AMORTIZ|FINIMP|PRINCIPAL|INVOICE|RECOMPRA` → AMORTIZACAO (não impacta DRE — é redução de passivo)
  - sem padrão → PENDENTE (fica de fora até reclassificação contábil)
- Drill-down lazy de lançamentos por natureza (`/gerencia/dre/lancamentos?natureza=...`)
- Botão "Auditoria 211" gera CSV pra contabilidade reclassificar (`/gerencia/dre/auditoria-211`)

---

### 3.8 Controladoria

#### Estoque · `/controladoria/estoque` · perm 11001
- **Página**: [Estoque.tsx](../frontend_intranet_react/src/pages/Controladoria/Estoque.tsx)
- Valorização: `SB2.B2_QATU * SB2.B2_CM1` por armazém + tipo
- Filtro **dinâmico** de tipo (populado da própria resposta — pega tipos que realmente existem na base)
- Labels conhecidos: MP, MR, PA, PI, MC, EM, GN, SV, AI, DE, BN, OT, FE, UT (códigos extras aparecem só com o código)

#### Custo de Produto · `/controladoria/custo-produto` · perm 11002
- **Página**: [CustoProduto.tsx](../frontend_intranet_react/src/pages/Controladoria/CustoProduto.tsx)
- **Endpoint**: [GET /controladoria/custo/:produto](resources/controladoria/controladoria.custo-produto.js)
- Explosão recursiva da estrutura SG1010 (até 5 níveis) com validade `G1_INI <= hoje <= G1_FIM`
- Por componente: última compra (SD1+SF1), rateio de impostos por unidade × qtd do BOM, histórico paginado, variação %
- Coluna **Custo Médio** vem de `SB2.B2_CM1` (não `B1_CM1` que não existe na SB1 da Gnatus)
- KPIs: custo padrão (B1_CUSTD), custo médio (B2_CM1 max), custo calculado, Δ vs padrão
- Gráfico de linha mostra variação mensal do vunit pros top 5 componentes mais comprados

#### Poder de Terceiros · `/controladoria/poder-terceiros` · perm 11003
- **Página**: [PoderTerceiros.tsx](../frontend_intranet_react/src/pages/Controladoria/PoderTerceiros.tsx)
- Quem detém poder/crédito comercial sobre clientes (CDS)

---

### 3.9 Expedição

> Substitui o legado PHP. Bordero em tabela `TAB_EXP_BORDERO` (1 linha por volume, formato "001/003"). Ao confirmar, gera XLSX pro **configurador da impressora Zebra**.

#### Notas a Expedir · `/expedicao/notas` · perm 12001
- **Página**: [NotasExpedir.tsx](../frontend_intranet_react/src/pages/Expedicao/NotasExpedir.tsx)
- SF2010 série 1 filial 01 com `z1_expedic IS NULL` e CFOPs de venda
- Linha verde quando NF já está no bordero. Botão "Adicionar/Remover" alterna inline

#### Bordero de Etiquetagem · `/expedicao/bordero` · perm 12002
- **Página**: [BorderoEtiquetagem.tsx](../frontend_intranet_react/src/pages/Expedicao/BorderoEtiquetagem.tsx)
- Visualiza linhas atuais agrupadas por NF (1 linha por volume)
- "Exportar XLSX" gera arquivo no formato Zebra via `exceljs`

---

### 3.10 Perfil (todos usuários logados)

#### Alterar Senha · `/alterar-senha` · perm `[]`
- Sem restrição. Bcrypt hash em `tab_intranet_usr.senha`

#### Reserva de Sala · `/perfil/reserva-sala` · perm 5001
- **Página**: [ReservaSala.tsx](../frontend_intranet_react/src/pages/ReservaSala/ReservaSala.tsx)
- Microsoft Graph API (não usa backend pra isso). Login via `loginRedirect` (popup quebra com BrowserRouter)
- Scopes: `User.Read`, `Calendars.ReadWrite`, `Place.Read.All`, `OnlineMeetings.ReadWrite`, `MailboxSettings.Read`
- Cria reunião no calendário do user com sala como `type: resource`

#### Cofre de Senhas · `/perfil/cofre` · perm 7001
- **Página**: [Cofre.tsx](../frontend_intranet_react/src/pages/Cofre/Cofre.tsx)
- **Zero-knowledge**: chave mestra derivada da senha do user (PBKDF2 600k iterations) — nunca sai do browser
- Cifragem **AES-GCM** por item (título, URL, usuário, senha, notas — todos criptografados separadamente)
- **Recovery key** (32 chars formato `A3FR-7K2P-...`) entregue na configuração inicial
- **Backup IT** em `tab_sys_audit_meta` (nome obfuscado): blob criptografado com `COFRE_BACKUP_KEY` do `.env` — permite recuperação por admin se user esquecer senha + recovery key
- ⚠️ Se vazar `COFRE_BACKUP_KEY` junto com o DB, quebra zero-knowledge

---

## 4. Integrações

### 4.1 Microsoft 365 / Entra ID
- App Registration: `Intranet GNATUS - Reserva de Salas`
- Tenant: `58aad519-4be3-424e-ac16-0ecc35a70418`
- Client ID: `6e235550-207c-46a9-9ee3-28e8bca82376`
- Plataforma: **Single-page application (SPA)** — usa PKCE (não Implicit nem Web)
- Redirect URIs: `http://localhost:5173`, `https://intranew.gnatus.com.br`
- Frontend `.env.local` / `.env.production`: `VITE_MS_CLIENT_ID`, `VITE_MS_TENANT_ID`
- ⚠️ **Vite `VITE_*` são compile-time** — precisa rebuild a cada mudança

### 4.2 Active Directory local
- DC: `SRV-GNT-ADDS01.gnt.local` em `172.31.255.100`
- Acesso da VPS via VIP NAT do FortiGate: `200.15.18.119:36363` → `172.31.255.100:636` (LDAPS)
- DC tem regra `New-NetFirewallRule LDAPS-VPN-VPS-Intranet` permitindo source `177.7.37.251/32`
- Backend `.env`: `AD_URL=ldaps://200.15.18.119:36363`, `AD_BASE_DN=DC=gnt,DC=local`, etc.
- Cliente: [`ldapts`](https://www.npmjs.com/package/ldapts) com `tlsOptions: { rejectUnauthorized: false }` (cert self-signed)

### 4.3 SAP Protheus
- Host (interno): `192.168.1.140:1433` — acessível da VPS via NAT do FortiGate (`179.108.181.12:1433`)
- Backend `.env`: `PROTHEUS_SERVER=ddns.gnatus.com.br` (continua usando NAT, VPN tunnel não foi adotada por complexidade)
- DB: `protheus`. Filial padrão: `'01'`
- Tabelas mais usadas em [protheus_schema.md](../../.claude/.../memory/protheus_schema.md)
- ⚠️ Sempre `WITH (NOLOCK)` (read-only) e `RTRIM(...)` em strings (Protheus armazena padded)

### 4.4 PostgreSQL (local da intranet)
- Local dev: `localhost:5432` via Docker container `intranet-pg` (postgres:16-alpine)
- Prod (VPS): `localhost:5432` (instalado direto, não Docker)
- DB: `intranet` / user: `intranet` / senha: `jgZqJ57GExNXtBvAdT6tuiFV` (prod) ou `intranet_dev_2026` (dev)
- ⚠️ Migrations devem ser aplicadas como user `intranet` (não `postgres`) — senão o backend não tem permissão pras tabelas. Se erro, rodar `GRANT ALL ON tab_xxx TO intranet`

### 4.5 FALEmais (PABX)
- Sigma API + Gravacoes API
- Token fixo no `.env`: `FALEMAIS_TOKEN`
- Click-to-call: `POST sigma/v1/...` com ramal do user e número do cliente

### 4.6 SMTP
- Prod: config completa em `.env` (`SMTP_HOST/PORT/USER/PASS/FROM`)
- Dev: MailHog em `localhost:1025`
- Uso: reset de senha + (futuro) notificações de aprovação/cobrança

---

## 5. Deploy

### 5.1 Infra
- **VPS**: Hostinger KVM 4 (Boston/US), Ubuntu 24.04, IP `177.7.37.251`
- **Domínio**: `intranew.gnatus.com.br` via Cloudflare (registro A direto, não proxy)
- **SSL**: Let's Encrypt via certbot (auto-renew via systemd timer)
- **Web server**: Nginx 1.24 reverse proxy `/api/*` → `localhost:3000`, frontend estático em `/home/intranet/frontend/dist`
- **Process manager**: PM2 (`pm2 startup systemd` pra autostart) — process name `api` em cluster mode
- **Firewall**: UFW + perfil "Gnatus" no painel Hostinger (SSH 22, HTTP 80, HTTPS 443)

### 5.2 Pasta de produção
```
/home/intranet/
├── backend/   (git: api_gnatus_nodejs)
│   ├── .env
│   └── pm2.config.js
└── frontend/  (git: frontend_intranet_react)
    ├── .env.production  (VITE_API_URL, VITE_MS_*)
    └── dist/            (gerado por npm run build)
```

### 5.3 Deploy fluxo

**Backend** (Node, hot-reload manual):
```bash
sudo -u intranet git -C /home/intranet/backend pull
# Se tiver migration nova:
sudo -u postgres psql -U intranet -d intranet -f /home/intranet/backend/database/postgres/NN-xxx.sql
# Reload pm2 com env atualizado:
sudo -u intranet pm2 restart api --update-env
```

**Frontend** (rebuild estático):
```bash
sudo -u intranet git -C /home/intranet/frontend pull
cd /home/intranet/frontend
sudo -u intranet npm run build --legacy-peer-deps
# Nginx serve dist/ direto, não precisa restart
```

⚠️ Após qualquer mudança de frontend, fazer **Ctrl+Shift+R** no browser (force reload sem cache).

⚠️ Migrations precisam ser aplicadas como user `intranet`. Se aplicou como `postgres`, dar grants:
```sql
GRANT ALL PRIVILEGES ON tab_xxx TO intranet;
GRANT USAGE, SELECT ON SEQUENCE tab_xxx_id_seq TO intranet;
```

### 5.4 Rede / FortiGate
- VPN IPsec site-to-site existe entre Gnatus FortiGate (200.15.18.119) e VPS (177.7.37.251), mas o **tráfego de aplicação usa NAT VIP** porque o FortiGate teve issues complexos com reply traffic via tunnel
- VIPs ativas:
  - **Protheus SQL Server**: `179.108.181.12:1433` → `192.168.1.140:1433` (Policy 62, source `VPS-Hostinger-Intranet`)
  - **AD LDAPS**: `200.15.18.119:36363` → `172.31.255.100:636` (Policy `VPS-to-AD-LDAPS`, mesma source)
- Mapeamento BU↔Equipe usa `SX5010 X5_TABELA = 'Z1'` (não 'ZA' como inicialmente)

---

## 6. Comandos úteis

### Backend local
```bash
cd .../api_ecopower_nodejs
node index.js              # iniciar (sem hot-reload)
npm start                  # idem
npm run dev                # com nodemon (hot-reload)
```

### PG local (Docker)
```bash
docker exec -i intranet-pg psql -U intranet -d intranet      # shell interativo
docker exec -i intranet-pg psql -U intranet -d intranet -f arquivo.sql  # rodar script
```

### Git
```bash
# Sempre commit nos 2 repos quando mexe nas duas pontas
cd .../api_ecopower_nodejs && git add . && git commit -m "..." && git push
cd .../frontend_intranet_react && git add . && git commit -m "..." && git push
```

### Verificar produção
```bash
# Backend
sudo -u intranet pm2 list
sudo -u intranet pm2 logs api --lines 30 --nostream
sudo -u intranet pm2 logs api --err --lines 30 --nostream  # só erros

# Nginx
sudo systemctl status nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# DB
sudo -u postgres psql -d intranet -c "\dt"
```

---

## 7. Convenções de código

- **SQL**: 100% parametrizado (`@param` no MSSQL, `$N` ou `@param` no PG via `services/pg.js`). Jamais concatenar strings.
- **Strings do Protheus**: sempre `RTRIM()` no SELECT (são padded com espaços).
- **Nomes de tabelas PG**: snake_case prefixo `tab_`. Ex: `tab_cobranca_atribuicao`.
- **Endpoints**: pasta = recurso, arquivo = ação. `cobranca/cobranca.dashboard.js` → `GET /cobranca/dashboard`.
- **Permissões**: array `perm: [N, 0]` em rota e sidebar, sempre os 2 lugares.
- **Commits**: mensagem clara em português, footer `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.
- **TypeScript**: build prod tem `noUnusedLocals` strict — não deixar imports/states unused.
- **Branch**: `master` em ambos repos. Sem feature branches no momento (deploy direto).

---

## 8. Pontos de atenção / armadilhas conhecidas

Ver [intranet_gotchas.md](file://../../.claude/.../memory/intranet_gotchas.md) na auto-memória.

Resumo dos principais:
- **`B1_CM1` não existe** na SB1 da Gnatus — usar `SB2.B2_CM1` agregado
- **`SX5 X5_TABELA = 'Z1'`** pra BUs (não 'ZA')
- **`E1_TIPO IN ('RA','NCC')`** sempre excluído nas queries de cobrança
- **MSAL precisa SPA platform** no Azure (não Web) — senão `AADSTS9002326`
- **Vite `VITE_*` é build-time** — precisa rebuild
- **PG migrations como user `intranet`** ou dar grants depois
- **Build frontend tem noUnusedLocals strict** — limpar imports não usados
- **CSS print** precisa força `visibility/opacity/color` em conteúdo do `.termo__doc`
- **VIP estática preserva source IP** — DC vê tráfego vindo do VPS público (177.7.37.251)
- **Vencido/saldo** usa `E1_VENCREA` (vencimento real) não `E1_VENCTO` (original) — porque negociações alteram

---

## 9. Roadmap conhecido / pendências

- Tela dedicada de gestão de carteira por cliente em lote (atualmente só individual no drawer do dashboard cobrança)
- Eficiência por ação (acordo cumprido vs total) em /cobranca
- Filtros temporais no Dashboard de Cobrança (hoje só mostra estado atual)
- Adaptar `TermoEquipamento.tsx` pra ler query params auto-preenchendo formulário (atualmente só link, não preenche)
- Notificações em tempo real (Socket.IO já carregado mas não usado)
- Assinatura digital nos termos (substituir o print)

---

## 10. Histórico de migrations (ordem de aplicação)

| # | Arquivo | O que faz |
|---|---------|-----------|
| 01 | `01-schema.sql` | Schema base (tab_intranet_usr, perms, cofre, etc.) |
| 02 | `02-migrate-data.js` | Migra dados MSSQL → PG (script JS conectando ambos) |
| 03 | `03-refactor-mssql-to-pg.js` | Validação pós-migração |
| 05 | `05-sac-pabx.sql` | Histórico PABX/ligações |
| 06 | `06-controladoria-poder-terceiros.sql` | Tabela poder de terceiros |
| 07 | `07-tecnologia-provisionamento.sql` | Log de provisioning AD/M365 |
| 08 | `08-tecnologia-termo-equipamento.sql` | `tab_termo_equipamento` |
| 09 | `09-seed-permissoes-base.sql` | Seed de 27 permissões iniciais |
| 10 | `10-cobranca-atribuicao.sql` | `tab_cobranca_atribuicao` (carteira por cliente) |
| 11 | `11-cobranca-bu-equipe.sql` | `tab_cobranca_bu_equipe` + 64 mapeamentos seedados |
| 12 | `12-tecnologia-equipamento-atual.sql` | `tab_equipamento_atual` (estado de equips) |

⚠️ Migrations são **idempotentes** (`CREATE TABLE IF NOT EXISTS`, `ON CONFLICT DO NOTHING`). Pode rodar de novo sem quebrar.
