# 🚀 Guia de Deploy do Backend FocusLift na Nuvem (Gratuito)

Este guia orienta o deploy da **API REST FocusLift (Java 21 + Spring Boot 3 + PostgreSQL 16)** na nuvem para que seu aplicativo Android conecte de qualquer lugar via 4G/Wi-Fi.

---

## 🌟 Opção 1: Deploy com 1 Clique no Render (Recomendado via `render.yaml`)

O repositório já conta com o arquivo `render.yaml` (Blueprint de Infraestrutura como Código). O Render provisiona automaticamente o **banco de dados PostgreSQL** e o **Web Service Docker**.

### Passo a Passo:
1. Acesse **[dashboard.render.com](https://dashboard.render.com/)** e faça login com sua conta do **GitHub**.
2. No menu superior direito, clique em **New +** e selecione **Blueprint**.
3. Conecte o repositório **`Igor8818/focuslift`**.
4. O Render detectará automaticamente o arquivo `render.yaml`:
   - Banco de dados gerenciado: `focuslift-db` (PostgreSQL 16)
   - Serviço web da API: `focuslift-api` (Docker com Java 21)
   - Injeção automática da `DATABASE_URL`
   - Geração automática da chave segura `JWT_SECRET_KEY`
5. *(Opcional)* Se desejar ativar o AI Coach com o Gemini na nuvem, adicione o valor da sua `GEMINI_API_KEY` nas variáveis de ambiente. Caso não coloque, o backend usará o motor determinístico em Java sem falhas.
6. Clique em **Apply**.
7. O Render compilará a imagem Docker e executará as migrações do Flyway.
8. Ao finalizar, você receberá a URL pública HTTPS da sua API:
   👉 **`https://focuslift-api.onrender.com`**

---

## 🚂 Opção 2: Deploy no Railway (Alternativa Rápida)

Se preferir o **Railway**:
1. Acesse **[railway.com](https://railway.com/)** e faça login com o GitHub.
2. Clique em **New Project** -> **Deploy from GitHub repo**.
3. Selecione o repositório `Igor8818/focuslift`.
4. No painel do projeto, clique em **+ New** -> **Database** -> **Add PostgreSQL**.
5. Clique no card do serviço da API do FocusLift -> **Settings**:
   - **Root Directory:** selecione `backend`.
   - Em **Variables**, adicione a referência:
     `DATABASE_URL` = `${{Postgres.DATABASE_URL}}`
6. O Railway iniciará o build com Docker automaticamente e fornecerá um domínio público HTTPS em **Networking**.

---

## 📱 Conectando o Aplicativo Android ao Backend na Nuvem

Após o deploy no Render ou Railway:
1. Abra o **FocusLift** no seu celular Android.
2. Toque no ícone do **AI Coach** (ícone de cérebro/robô).
3. Toque no botão de edição de URL (ícone de engrenagem ou lápis).
4. Cole a sua URL da nuvem gerada pelo Render (exemplo):
   ```text
   https://focuslift-api.onrender.com
   ```
5. Clique em **Salvar URL** e depois em **Testar Conexão**.
6. O indicador ficará **🟢 Conectado**!

A partir desse momento, qualquer treino salvo, histórico ou análise de sobrecarga progressiva sincronizará com seu banco de dados PostgreSQL na nuvem através de 4G, 5G ou Wi-Fi.

---

## 🔍 Verificando os Endpoints Públicos

Você e qualquer recrutador podem testar a API diretamente no navegador:
- **Swagger UI Interativo:** `https://focuslift-api.onrender.com/swagger-ui.html`
- **Health Check:** `https://focuslift-api.onrender.com/api/v1/health`
- **OpenAPI JSON Spec:** `https://focuslift-api.onrender.com/v3/api-docs`
