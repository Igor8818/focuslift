# 🏋️ FocusLift — Gym Progression, 1RM Analytics & Recovery Tracker

<p align="center">
  <strong>Aplicativo mobile Offline-First de alta performance para anotação de cargas, sobrecarga progressiva, cálculo de 1RM e controle de hábitos de recuperação.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React_Native-0.85-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React Native" />
  <img src="https://img.shields.io/badge/Expo_SDK-57-000020?style=for-the-badge&logo=expo&logoColor=white" alt="Expo" />
  <img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/SQLite-Offline_First-003B57?style=for-the-badge&logo=sqlite&logoColor=white" alt="SQLite" />
  <img src="https://img.shields.io/badge/Firebase-Auth_%26_Firestore-FFCA28?style=for-the-badge&logo=firebase&logoColor=black" alt="Firebase" />
  <img src="https://img.shields.io/badge/RevenueCat-In_App_Purchases-F2545B?style=for-the-badge" alt="RevenueCat" />
</p>

---

## ✨ Visão Geral

O **FocusLift** foi projetado para resolver o maior problema de quem treina a sério na academia: **anotar cargas rapidamente entre as séries sem depender de sinal de internet**, sabendo exatamente qual carga e quantas repetições superam o treino anterior.

### Principais Funcionalidades

- ⚡ **Sessão de Treino Inteligente (Offline-First):**
  - Comparativo automático com a série equivalente do último treino (`+kg`, `+reps`, detecção instantânea de Recorde Pessoal `🏆 PR`).
  - Botão de **Repetir Séries do Último Treino em 1 Toque** e incremento rápido de carga (`+2.5`, `+5`, `+10`, `+20 kg/lbs`).
  - Modo de carga **Peso Total** ou **Por Lado (Unilateral/Halteres)** com conversão automática.
  - Seletor de tipo de série (**Normal**, **Aquecimento**, **Dropset**, **Falha**) e escala de esforço percebido (**RPE 6–10**).
  - Persistência automática de rascunho em andamento (proteção contra fechamento do app em segundo plano).
- 🧮 **Calculadora Visual de Anilhas & 1RM:**
  - Diagrama visual de montagem da barra olímpica por lado ou peso total.
  - Estimativa em tempo real de **1RM (Fórmulas de Epley & Brzycki)** e tabela completa de porcentagens de carga (`50%` a `95%`).
- 📋 **Importador Inteligente de Treinos por Texto:**
  - Cole treinos vindos do WhatsApp, notas ou personal trainer (ex.: `Supino Reto: 3x10` ou `2 séries preparatórias + 2 séries válidas`) e gere fichas completas com imagens automaticamente.
  - Biblioteca de **Modelos Consagrados** (*Push/Pull/Legs*, *Upper/Lower*, *Full Body*, *Especialização de Braços*).
- 📈 **Hall de Recordes (Trophy Room) & Evolução:**
  - Gráficos animados de progressão de carga máxima, 1RM estimado, volume semanal por grupo muscular e tendência de peso corporal.
- 💧 **Hábitos Diários & Recuperação:**
  - Controle quantitativo de hidratação (`ml`), meta diária de proteínas (`g`), hábitos personalizados com emojis e contagem automática de *streak* (`🔥`).
- ☁️ **Sincronização Incremental & Backup na Nuvem (Firebase + RLS):**
  - Sincronização bidirecional (`SQLite ↔ Firestore`) com diff por hash (`FNV-1a`), propagação de exclusões (*tombstones*), isolamento de dados por conta e exportação/importação de planilhas **CSV (RFC 4180)**.
- 🌍 **Internacionalização & Temas:**
  - Suporte nativo a **5 idiomas** (`PT-BR`, `EN`, `ES`, `DE`, `FR`), alternância `kg / lbs` e temas **Dark Obsidian** & **Light Mode**.

---

## 🏗️ Arquitetura do Projeto

```text
FocusLift/
├── src/
│   ├── components/       # Componentes modulares (ExerciseBlock, PlateCalculatorModal, PaywallModal, etc.)
│   ├── contexts/         # Estado global (AuthContext, SubscriptionContext, ThemeContext, LanguageContext)
│   ├── database/         # Camada SQLite local (schema, migrations, queries parametrizadas, snapshots)
│   ├── i18n/             # Dicionários multi-idioma (PT, EN, ES, DE, FR) e tradução de exercícios
│   ├── screens/          # Telas principais (Training, WorkoutSession, Evolution, History, Habits, Profile, Auth)
│   ├── services/         # Integrações externas (Firebase Auth/Firestore, Sync Incremental, Notificações)
│   ├── theme/            # Tokens de design e paletas Dark/Light
│   └── utils/            # Parsers (CSV RFC 4180, Workout Text Parser, 1RM, Sync Diff Hash, Timezone Local)
├── firestore.rules       # Regras de segurança Row-Level Security (RLS) para o Cloud Firestore
├── app.json              # Configuração Expo / EAS
└── package.json
```

---

## 🚀 Como Executar Localmente

### 1. Pré-requisitos
- **Node.js** 18+
- **Expo Go** no celular (Android/iOS) ou emulador Android Studio / Xcode

### 2. Instalação
```bash
git clone https://github.com/Igor8818/focuslift.git
cd focuslift
npm install
```

### 3. Configuração de Variáveis de Ambiente
Copie o arquivo `.env.example` para `.env` e preencha suas chaves do Firebase (e opcionalmente RevenueCat):
```bash
cp .env.example .env
```

> **Nota:** O FocusLift funciona **100% offline** via SQLite mesmo sem configurar chaves do Firebase ou RevenueCat.

### 4. Iniciar o Servidor de Desenvolvimento
```bash
npx expo start
```

### 5. Executar os Testes Automatizados
```bash
npm test
```

---

## 🔒 Segurança e Privacidade

- **Consultas SQL 100% Parametrizadas:** Prevenção contra SQL Injection na camada local `expo-sqlite`.
- **Row-Level Security (RLS):** Regras do Firestore (`firestore.rules`) garantem que cada usuário autenticado acesse exclusivamente `/users/{userId}/**`.
- **Proteção contra CSV Formula Injection:** Higienização automática de células iniciadas por `=`, `+`, `-`, `@` na exportação de planilhas.
- **Isolamento Multi-Conta:** Opção de limpeza segura do banco local e caches ao alternar contas no mesmo dispositivo.

---

## 📄 Licença e Direitos Autorais

Copyright © 2026 **Igor Hagge Senna** ([@Igor8818](https://github.com/Igor8818)). Todos os direitos reservados.

O código-fonte deste repositório é disponibilizado publicamente para **fins de portfólio, avaliação técnica e estudo arquitetural**. Não é permitida a redistribuição comercial ou publicação de cópias/derivados nas lojas de aplicativos (Google Play Store / Apple App Store) sem autorização expressa do autor.
