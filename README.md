# 🚀 Módulo Twitter/X Dashboard (Agendamento & Analytics com MCP)

Dashboard full-stack para agendamento de posts/threads no Twitter/X, publicação automatizada via **Model Context Protocol (MCP)** e painel de resultados com ranking de engajamento, evolução temporal e melhores horários de postagem.

---

## 🏛️ Arquitetura do Sistema

```text
[Frontend (React + Vite + Tailwind)]
              │
              ▼ (HTTP / REST com JWT Bearer)
[Backend API (Node.js + Express + TypeScript)]
              │
              ├── SQLite (Prisma ORM)
              │     ├── scheduled_posts
              │     ├── tweet_metrics_snapshots
              │     ├── accounts
              │     └── app_settings
              │
              ├── Workers de Segundo Plano
              │     ├── SchedulerWorker (node-cron a cada 1 min - Lock, Retry & Recovery)
              │     └── AnalyticsWorker (node-cron a cada 30 min - Coleta de Métricas)
              │
              ▼ (StdioClientTransport - JSON-RPC sobre stdio)
[twitter-mcp-server (Processo Filho Persistente)]
              │
              ▼ (Scraping ou API Oficial v2)
         [Twitter / X]
```

### 🔒 Princípios de Segurança e Isolamento
1. **Frontend Desacoplado**: O front **nunca** fala com o MCP e nunca armazena senhas ou segredos de API.
2. **Autenticação em Todas as Rotas**: Middleware JWT protege todos os endpoints `/api/*`.
3. **Resiliência e Reconexão Automática**: Se o processo filho do MCP for derrubado, o backend reconecta automaticamente com backoff.
4. **Inspeção Dinâmica de Tools**: Ao conectar, o backend executa `listTools()` no MCP e mapeia dinamicamente os schemas reais (`post_tweet`, `create_thread`, `get_tweets`, `get_profile`).

---

## 📁 Estrutura do Repositório

```text
├── backend/
│   ├── prisma/schema.prisma     # Modelos do SQLite
│   ├── src/
│   │   ├── config/              # Variáveis de ambiente, TZ America/Sao_Paulo, Scoring
│   │   ├── providers/           # TwitterProvider, McpTwitterProvider, OfficialXApiProvider, MockTwitterProvider
│   │   ├── mcp/                 # McpClientManager, StdioClientTransport, Tool Inspector
│   │   ├── modules/
│   │   │   ├── accounts/        # Conexão e autorização de contas
│   │   │   ├── posts/           # Validação (280 chars, URLs, emojis), agendamento, upload de mídia
│   │   │   ├── analytics/       # Ranking, Score de engajamento, Overview, Evolução
│   │   │   └── settings/        # Configuração dinâmica de pesos e status MCP
│   │   ├── workers/             # SchedulerWorker e AnalyticsWorker
│   │   └── tests/               # Suíte unificada de testes (14 testes automatizados)
│   ├── uploads/                 # Armazenamento local de mídias enviadas
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/          # Navbar, Sidebar, Form, Calendário, Fila, Ranking, Gráficos Recharts
│   │   ├── pages/               # Visão Geral, Agendar, Resultados, Configurações
│   │   └── services/api.ts      # Cliente Axios com interceptor JWT
│   └── package.json
│
├── twitter-mcp-server/          # Servidor MCP compilado rodando via stdio
└── README.md
```

---

## ⚙️ Pré-requisitos

- **Node.js**: v18+ (recomendado v20 ou v22+)
- **NPM**: v9+
- **Git**

---

## 🛠️ Passo a Passo de Instalação e Execução

### 1. Compilar o Servidor MCP Twitter

```bash
cd twitter-mcp-server
npm install
npm run build
cd ..
```
*O arquivo executável do servidor será gerado em `twitter-mcp-server/build/index.js`.*

---

### 2. Configurar e Iniciar o Backend

```bash
cd backend
npm install

# Copie as variáveis de ambiente
cp .env.example .env

# Crie e sincronize as tabelas do banco SQLite
npx prisma generate
npx prisma db push
```

#### Variáveis do arquivo `.env` (`backend/.env`):
```env
PORT=3001
NODE_ENV=development
DATABASE_URL="file:./twitter_dash.db"
TZ="America/Sao_Paulo"
JWT_SECRET="seu-jwt-secret-super-seguro-aqui-123456"

# Credenciais Twitter (opcional no .env; podem ser adicionadas diretamente pela tela do dashboard):
TWITTER_USERNAME=""
TWITTER_PASSWORD=""
TWITTER_EMAIL=""

# Credenciais opcionais da API oficial:
TWITTER_API_KEY=""
TWITTER_API_SECRET_KEY=""
TWITTER_ACCESS_TOKEN=""
TWITTER_ACCESS_TOKEN_SECRET=""

MCP_SERVER_PATH="../twitter-mcp-server/build/index.js"
MIN_POST_INTERVAL_SECONDS=60
SCHEDULER_ENABLED=true
ANALYTICS_CRON_ENABLED=true
```

Inicie o backend em modo desenvolvimento:
```bash
npm run dev
```
*API rodando em `http://localhost:3001`.*

---

### 3. Configurar e Iniciar o Frontend

Em outro terminal:
```bash
cd frontend
npm install
npm run dev
```
*Acesse no navegador: `http://localhost:3000`.*

---

## 🧪 Como Rodar os Testes Automatizados

Para executar a suíte completa de testes unitários e de integração (validação de 280 caracteres, emojis, lock do scheduler, retry exponencial, recuperação pós-crash e cálculo de score):

```bash
cd backend
npm test
```
Saída esperada:
```text
================================================================================
   SUÍTE DE TESTES UNITÁRIOS E INTEGRAÇÃO - TWITTER/X DASHBOARD
================================================================================
  ✅ SUCESSO: Texto simples deve ser válido
  ✅ SUCESSO: Texto com URL e emojis multi-codepoint deve ser válido
  ✅ SUCESSO: URL deve ser ponderada com 23 caracteres
  ✅ SUCESSO: Texto com 281 caracteres deve ser rejeitado
  ✅ SUCESSO: Score calculado (44) deve ser exatamente 44.0
  ✅ SUCESSO: Score com views nulas não deve quebrar e somar 13.0
  ✅ SUCESSO: Post com data passada deve ser publicado pelo scheduler
  ✅ SUCESSO: Post publicado deve possuir tweetId gerado
  ✅ SUCESSO: Tentativa 1 deve reagendar o post
  ✅ SUCESSO: Tentativa 2 deve reagendar com backoff
  ✅ SUCESSO: Após 3 tentativas o status deve ser 'falhou'
  ✅ SUCESSO: Mensagem de erro deve ser gravada em lastError
  ✅ SUCESSO: Scheduler deve detectar post travado no boot
  ✅ SUCESSO: Post travado deve ser recuperado para 'agendado'
================================================================================
   RESULTADO: 14/14 TESTES EXECUTADOS COM SUCESSO! 100% OK
================================================================================
```

---

## 🔎 Como Testar Manualmente os Critérios de Aceite

### Critério 1: Agendamento e Publicação Automática
1. Acesse o dashboard em `http://localhost:3000`.
2. Vá até a aba **Agendar**.
3. Digite um tweet (ex: `Testando agendamento automático 🚀`).
4. Selecione uma data/hora no seletor para daqui a 2 minutos (ou use o atalho **+15 min**).
5. Clique em **Agendar Publicação**. O post aparecerá na **Fila de Publicações** com status azul `Agendado`.
6. Aguarde o worker rodar no minuto programado: o status mudará automaticamente para `Publicando...` e em seguida `Publicado`, com o link para abrir no X.
7. Se preferir testar imediatamente, clique no botão **Publicar Agora**.

### Critério 2: Tratamento de Falhas e Retentativa Manual
1. Se as credenciais estiverem incorretas ou houver bloqueio de rede, o post tentará até 3 vezes com backoff exponencial.
2. Após as 3 tentativas, o status muda para vermelho `Falhou` e exibe o motivo detalhado em `lastError`.
3. Um botão **Tentar de novo** aparecerá no post falho, permitindo reiniciar a tentativa a qualquer momento.

### Critério 3: Resultados e Ranking
1. Acesse a aba **Resultados**.
2. Visualize os cards com o total de posts, curtidas, retweets e score médio.
3. Na **Tabela de Ranking**, ordene por qualquer coluna (Score, Curtidas, RTs, Respostas).
4. Clique em qualquer post da tabela para abrir o **Gráfico de Linha (Recharts)** com a evolução temporal de métricas.
5. Veja no gráfico de barras os **Melhores dias e horários para postar**.

### Critério 4: Conectar Conta do Twitter/X
1. Na aba **Configurações** ou no botão do topo **+ Conectar Conta**, informe seu usuário e senha (ou chaves de API).
2. O servidor MCP testará a autenticação em tempo real via stdio e vinculará a conta ao dashboard.

---

## 🚀 Guia de Deploy em Produção

Como o servidor MCP comunica por **stdio** (processo filho contínuo), o backend precisa rodar em um ambiente que suporte processos persistentes com Node.js (não serverless efêmero puro como AWS Lambda básico).

### Opção 1: VPS (Ubuntu / Debian com PM2)
1. Conecte na sua VPS via SSH e clone o repositório.
2. Compile o MCP e o backend:
   ```bash
   cd twitter-mcp-server && npm install && npm run build && cd ..
   cd backend && npm install && npx prisma db push && npm run build
   ```
3. Inicie com o PM2 para reiniciar automaticamente em caso de falha:
   ```bash
   npm install -g pm2
   pm2 start dist/server.js --name "twitter-dash-api"
   pm2 save
   pm2 startup
   ```
4. Build do frontend e sirva via Nginx:
   ```bash
   cd ../frontend && npm install && npm run build
   ```
   Aponte o Nginx para a pasta `frontend/dist` com proxy reverso em `/api` para `http://localhost:3001`.

### Opção 2: Render ou Railway
1. Utilize o tipo de serviço **Web Service** (Railway ou Render Web Service com Dockerfile ou Node).
2. Configure o build command:
   ```bash
   cd twitter-mcp-server && npm install && npm run build && cd ../backend && npm install && npx prisma db push && npm run build
   ```
3. Start command:
   ```bash
   cd backend && npm start
   ```
4. Configure as variáveis de ambiente no painel do Render/Railway.
