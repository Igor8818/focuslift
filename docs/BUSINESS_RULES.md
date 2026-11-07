# FocusLift — Regras de Negócio e Princípios da Aplicação

> **Missão:** Entregar um aplicativo de musculação e progressão de sobrecarga intuitivo, veloz e offline-first, onde o atleta tem clareza imediata do que levantou no último treino e qual a meta exata de carga/repetições para hoje.

---

## 1. Princípios Fundamentais de UX e Arquitetura

1. **Mobile-First & Offline-First:**
   - O aplicativo funciona perfeitamente sem conexão com a internet.
   - O banco de dados local **SQLite** (`expo-sqlite`) é a fonte primária de verdade em tempo de execução no celular.
   - A sincronização na nuvem com o backend Java/PostgreSQL é transacional, em segundo plano e tolerante a falhas (usa FNV-1a hash diffs e *Tombstones* para exclusões).
2. **Zero Fricção Durante o Treino:**
   - Durante a execução, o atleta não pode perder tempo calculando porcentagens ou navegando entre muitas telas.
   - A carga e repetições da **mesma ficha anterior** ficam visíveis fixas na coluna `ANTERIOR` e nunca somem ao digitar.
   - Tocar na carga anterior preenche a série com 1 toque (*Smart Fill*).
3. **Cálculos Realistas e Sem Malabarismos ("Sem cálculos loucos"):**
   - Na musculação, progressões reais acontecem em incrementos graduais (ex: $+1\text{ a }2.5\text{ kg}$ no total ou $+1$ repetição com boa forma).
   - O app não inventa métricas obscuras nem projeta 1RMs irreais para séries de altas repetições ($>12$ reps).
   - O LLM (Gemini) **nunca faz contas matemáticas**. Todas as estatísticas são calculadas deterministicamente pelo código Java e fornecidas estruturadas no prompt.

---

## 2. Fórmulas Matemáticas e Regras de Progressão

### 2.1. Estimativa de 1 Repetição Máxima (1RM) — Fórmula de Brzycki
Para estimar a força máxima a partir de uma série submáxima:

$$\text{1RM} = W \times \frac{36}{37 - \min(R, 12)}$$

- **Limite de Confiabilidade:** Limitado a repetições efetivas $1 \le R \le 12$. Séries acima de 12 repetições medem resistência muscular localizada, logo a fórmula é travada em 12 para evitar distorção matemática.
- **Carga Total vs. Por Lado:**
  - Se o exercício for registrado como `per_side` (halteres, anilhas em máquina unilateral, leg press por lado), a carga total efetiva para o cálculo é sempre dobrada: $W_{\text{efetivo}} = W_{\text{lado}} \times 2$.

### 2.2. Volume Semanal de Carga (Tonnage)
Para cada exercício e grupo muscular na semana:

$$\text{Volume} = \sum_{i=1}^{n} (W_i \times R_i)$$

- Permite comparar se o volume semanal por grupo muscular (ex: *Peito*, *Costas*, *Pernas*) aumentou ou diminuiu entre a semana atual e a semana anterior.
- Uma variação saudável de volume de sobrecarga progressiva fica entre $+3\%$ e $+10\%$ por semana. Variações acima de $+25\%$ indicam pico súbito de fadiga (*spike*), e quedas acima de $-20\%$ indicam *deload* ou perda de frequência.

### 2.3. Detecção de Platô (Estagnação de Carga)
Um exercício em uma ficha específica é considerado em **Platô** se atender a todas as condições abaixo:
1. Pelo menos **3 sessões registradas** da mesma ficha para aquele exercício nas últimas 4 semanas.
2. O **1RM Máximo** e a **Maior Carga** da série pesada permaneceram estagnados ($\text{variação} \le 0\%$).
3. O **RPE** (Esforço Percebido) registrado nessas séries foi alto ($\ge 8.0$), indicando que o atleta tentou progredir na intensidade máxima mas travou.

**Sugestão de Ação do AI Coach para Platô:**
- Recomendar variação de repetições (ex: se estava fazendo $3 \times 6$ com 80kg, sugerir trabalhar $3 \times 8$ com 75kg ou micro-carga de $+1\text{ a }2\text{kg}$ total).
- Checar se o descanso entre séries não está curto demais ($<2\text{ a }3\text{ min}$ para compostos pesados).
- Sugerir redução de 1 série de trabalho ou semana regenerativa (*deload* com $-30\%$ de volume).

### 2.4. Classificação de Esforço (RPE — Rating of Perceived Exertion)
- **RPE 10:** Falha concêntrica atingida (zero repetições na reserva / RIR 0).
- **RPE 9:** 1 repetição na reserva (RIR 1).
- **RPE 8:** 2 repetições na reserva (RIR 2) — faixa ideal para a maioria das séries de hipertrofia.
- **RPE 7:** 3 repetições na reserva — início da faixa de trabalho efetivo.
- **RPE < 7:** Série de aquecimento ou muito distante da falha para estímulo máximo.

---

## 3. Diretrizes do AI Coach (Módulo de IA)

1. **Tom de Voz:** Direto, motivador, técnico e sem jargões desnecessários. Fala como um treinador pessoal focado em execução e sobrecarga.
2. **Anti-Alucinação Estrita:**
   - O backend em Java entrega um JSON com:
     - `best1RmHistory`: evolução dos últimos treinos.
     - `weeklyVolumeDeltaPercent`: delta percentual calculado.
     - `plateauExercises`: lista de exercícios estagnados.
     - `nextSessionTarget`: meta sugerida calculada em Java (`+1 rep` ou `+1kg a +2kg`).
   - O LLM recebe a instrução mandatória: *"Use apenas os números exatos fornecidos pelo motor de análise. Nunca calcule novos 1RMs nem contradiga os valores fornecidos."*
3. **Respostas Estruturadas:**
   - Toda resposta do AI Coach traz 3 blocos claros:
     1. **Destaque de Vitória / Progresso** (o que melhorou).
     2. **Ponto de Atenção / Platô** (exercícios estagnados ou volume excessivo).
     3. **Plano de Ataque para o Próximo Treino** (meta prática para bater na próxima sessão).

---

## 4. Estrutura do Backend Java Spring Boot

- **Java 21 LTS** + **Spring Boot 3.4.x**.
- **PostgreSQL 16** com versionamento via **Flyway** (`V1__init_schema.sql`).
- **Autenticação:** JWT Stateless (Bearer Token) via Spring Security 6 com `BCryptPasswordEncoder`.
- **Endpoints Principais:**
  - `POST /api/v1/auth/register`
  - `POST /api/v1/auth/login`
  - `GET  /api/v1/auth/me`
  - `POST /api/v1/sync/push` (Delta sync com idempotência)
  - `GET  /api/v1/sync/pull` (Snapshot completo para restauração)
  - `POST /api/v1/ai-coach/analyze` (Diagnóstico completo de evolução)
  - `POST /api/v1/ai-coach/chat` (Perguntas e respostas sobre o treino)
  - `GET  /swagger-ui.html` (Documentação interativa OpenAPI 3)
