# dlrow cast — Transmissão e Compartilhamento de Tela Ultra-Baixa Latência

Aplicação moderna para transmissão e compartilhamento de tela com WebRTC, áudio com cancelamento de ruído, moderação em tempo real, chat e suporte para alta taxa de quadros (60 FPS).

---

## 🚀 Como hospedar gratuitamente (Deploy Grátis)

Esta aplicação é um **Full-Stack Node.js (Express + WebSocket + Vite React)**. Para que as salas em tempo real e WebSockets funcionem perfeitamente entre pessoas diferentes, você precisa de um host que suporte Node.js e WebSockets com HTTPS/WSS.

Abaixo estão as **3 melhores opções gratuitas**:

### 1. Render.com (Recomendado — Mais Fácil e Estável)
- **Custo**: 100% Gratuito (Free Web Service)
- **Vantagem**: Suporte nativo completo a WebSocket e HTTPS/WSS sem custos.
- **Passo a passo**:
  1. Crie uma conta gratuita em [Render.com](https://render.com).
  2. Suba este código para o seu repositório no **GitHub** (via menu de exportação do AI Studio ou `git push`).
  3. No painel do Render, clique em **"New +" -> "Web Service"** e selecione o repositório.
  4. Configure:
     - **Name**: `dlrow-cast`
     - **Runtime**: `Node`
     - **Build Command**: `npm install && npm run build`
     - **Start Command**: `npm start`
     - **Instance Type**: `Free`
  5. Clique em **"Deploy Web Service"**.
  6. Seu site estará online com um link público HTTPS como `https://dlrow-cast.onrender.com`. Ao compartilhar qualquer sala, qualquer pessoa do mundo conseguirá abrir e assistir instantaneamente!

---

### 2. Railway.app
- **Custo**: Plano inicial gratuito com créditos mensais.
- **Passo a passo**:
  1. Acesse [Railway.app](https://railway.app).
  2. Conecte seu GitHub e crie um novo projeto importando este repositório.
  3. O Railway detecta o Node.js automaticamente.
  4. Em "Settings" -> "Networking", clique em **"Generate Domain"**.
  5. Pronto!

---

### 3. Fly.io
- **Custo**: Free Tier gratuito (até 3 instâncias compartilhadas).
- **Passo a passo**:
  1. Instale o CLI do Fly (`curl -L https://fly.io/install.sh | sh`).
  2. Execute `fly launch` na raiz do projeto.
  3. O Fly gerencia a porta 3000 e HTTPS com certificados gratuitos.

---

### 4. Deploy Direto no Google Cloud Run (Via AI Studio)
- No menu superior direito do Google AI Studio, clique em **Deploy to Cloud Run** ou **Share**.
- O Google Cloud Run fornece hospedagem gerenciada com SSL e suporte a WebSockets nativo.

---

## 🛠️ Comandos Locais

```bash
# Instalar dependências
npm install

# Iniciar em modo de desenvolvimento
npm run dev

# Compilar para produção
npm run build

# Iniciar servidor de produção compilado
npm start
```
