package com.focuslift.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.focuslift.domain.model.User;
import com.focuslift.domain.model.Workout;
import com.focuslift.dto.aicoach.*;
import com.focuslift.repository.WorkoutRepository;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

@Service
public class AiCoachService {

    private static final Logger log = LoggerFactory.getLogger(AiCoachService.class);

    private final ProgressionMathEngine mathEngine;
    private final WorkoutRepository workoutRepository;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;
    private final AiResponseValidator responseValidator;
    private final MeterRegistry meterRegistry;

    // Métricas de observabilidade Micrometer
    private final Timer requestTimer;
    private final Counter fallbackCounter;
    private final Counter hallucinationCounter;
    private final Counter promptTokensCounter;
    private final Counter candidateTokensCounter;

    // Cache em memória com TTL de 10 minutos para evitar queimar tokens em estados idênticos
    private final Map<Long, CachedAnalysis> analysisCache = new ConcurrentHashMap<>();
    private static final Duration CACHE_TTL = Duration.ofMinutes(10);

    @Value("${application.ai.gemini.api-key:}")
    private String geminiApiKey;

    @Value("${application.ai.gemini.model:gemini-2.5-flash}")
    private String geminiModel;

    @Value("${application.ai.gemini.base-url:https://generativelanguage.googleapis.com/v1beta/models}")
    private String geminiBaseUrl;

    @Autowired
    public AiCoachService(
            ProgressionMathEngine mathEngine,
            WorkoutRepository workoutRepository,
            ObjectMapper objectMapper,
            AiResponseValidator responseValidator,
            @Autowired(required = false) MeterRegistry meterRegistry
    ) {
        this.mathEngine = mathEngine;
        this.workoutRepository = workoutRepository;
        this.objectMapper = objectMapper;
        this.responseValidator = responseValidator;
        this.meterRegistry = meterRegistry;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();

        if (meterRegistry != null) {
            this.requestTimer = Timer.builder("ai.coach.request.duration")
                    .description("Tempo de resposta das requisições ao Gemini API")
                    .register(meterRegistry);
            this.fallbackCounter = Counter.builder("ai.coach.fallback.count")
                    .description("Total de execuções do fallback determinístico")
                    .register(meterRegistry);
            this.hallucinationCounter = Counter.builder("ai.coach.hallucination.blocked")
                    .description("Total de alucinações bloqueadas pelo guardrail")
                    .register(meterRegistry);
            this.promptTokensCounter = Counter.builder("ai.coach.tokens.prompt")
                    .description("Tokens de entrada consumidos pelo LLM")
                    .register(meterRegistry);
            this.candidateTokensCounter = Counter.builder("ai.coach.tokens.candidates")
                    .description("Tokens de saída gerados pelo LLM")
                    .register(meterRegistry);
        } else {
            this.requestTimer = null;
            this.fallbackCounter = null;
            this.hallucinationCounter = null;
            this.promptTokensCounter = null;
            this.candidateTokensCounter = null;
        }
    }

    public AiCoachService(
            ProgressionMathEngine mathEngine,
            WorkoutRepository workoutRepository,
            ObjectMapper objectMapper
    ) {
        this(mathEngine, workoutRepository, objectMapper, new AiResponseValidator(), null);
    }

    @Transactional(readOnly = true)
    public AiCoachAnalysisResponse analyzeProgress(User user) {
        String fourWeeksAgo = LocalDate.now().minusWeeks(4).toString();
        List<Workout> recentWorkouts = workoutRepository.findRecentWorkoutsWithDetails(user, fourWeeksAgo);

        // Verificação de cache por hash de estado do atleta
        String stateHash = computeAthleteStateHash(recentWorkouts);
        if (user.getId() != null) {
            CachedAnalysis cached = analysisCache.get(user.getId());
            if (cached != null && cached.stateHash().equals(stateHash) &&
                    Duration.between(cached.cachedAt(), Instant.now()).compareTo(CACHE_TTL) < 0) {
                log.debug("[AiCoachService] Retornando análise do cache para o usuário {}", user.getId());
                return cached.response();
            }
        }

        ProgressionMathEngine.WeeklyVolumeAnalysis volumeAnalysis = mathEngine.analyzeWeeklyVolumes(recentWorkouts);
        ProgressionMathEngine.AcwrAnalysis acwrAnalysis = mathEngine.calculateAcwr(recentWorkouts);
        List<ProgressionMetricDto> topProgressions = mathEngine.calculateTopProgressions(recentWorkouts);
        List<PlateauExerciseDto> plateaus = mathEngine.detectPlateaus(recentWorkouts);

        String athleteName = user.getName() != null && !user.getName().isBlank() ? user.getName() : "Atleta";

        String systemInstruction = buildAnalysisSystemInstruction();
        String userContent = buildAnalysisUserContent(athleteName, recentWorkouts.size(), volumeAnalysis, acwrAnalysis, topProgressions, plateaus);

        StructuredCoachAnalysis structured = callGeminiStructured(systemInstruction, userContent, StructuredCoachAnalysis.class);

        String aiAnalysisText = null;
        String tacticalAdvice = null;
        String nextSessionFocus = null;

        if (structured != null && structured.summary() != null && !structured.summary().isBlank()) {
            AiResponseValidator.ValidationResult validation = responseValidator.validateAnalysis(
                    structured.summary(), volumeAnalysis, acwrAnalysis, topProgressions, plateaus, recentWorkouts.size()
            );

            if (validation.isValid()) {
                aiAnalysisText = structured.summary().trim();
                tacticalAdvice = structured.tacticalAdvice() != null && !structured.tacticalAdvice().isBlank()
                        ? structured.tacticalAdvice().trim()
                        : generateTacticalAdvice(volumeAnalysis, topProgressions, plateaus);
                nextSessionFocus = structured.nextSessionFocus() != null && !structured.nextSessionFocus().isBlank()
                        ? structured.nextSessionFocus().trim()
                        : generateNextSessionFocus(topProgressions, plateaus);
            } else {
                log.warn("[AiCoachService] Resposta estruturada reprovada pelo guardrail: {}. Ativando fallback determinístico.", validation.reason());
                recordHallucinationBlocked();
            }
        }

        if (aiAnalysisText == null) {
            recordFallbackTriggered();
            aiAnalysisText = generateDeterministicFallbackAnalysis(athleteName, volumeAnalysis, acwrAnalysis, topProgressions, plateaus);
            tacticalAdvice = generateTacticalAdvice(volumeAnalysis, topProgressions, plateaus);
            nextSessionFocus = generateNextSessionFocus(topProgressions, plateaus);
        }

        AcwrDto acwrDto = new AcwrDto(
                acwrAnalysis.acuteVolumeKg(),
                acwrAnalysis.chronicWeeklyVolumeKg(),
                acwrAnalysis.ratio(),
                acwrAnalysis.riskLevel().name(),
                acwrAnalysis.interpretation(),
                acwrAnalysis.recommendation()
        );

        AiCoachAnalysisResponse response = new AiCoachAnalysisResponse(
                athleteName,
                recentWorkouts.size(),
                volumeAnalysis.currentWeekVolume(),
                volumeAnalysis.previousWeekVolume(),
                volumeAnalysis.deltaPercent(),
                topProgressions.stream().limit(5).toList(),
                plateaus,
                aiAnalysisText,
                tacticalAdvice,
                nextSessionFocus,
                Instant.now().toString(),
                acwrDto
        );

        if (user.getId() != null) {
            analysisCache.put(user.getId(), new CachedAnalysis(response, Instant.now(), stateHash));
        }

        return response;
    }

    @Transactional(readOnly = true)
    public AiCoachChatResponse chatWithCoach(User user, AiCoachChatRequest request) {
        String sanitizedQuestion = sanitizeUserInput(request.question());
        String sanitizedContext = sanitizeUserInput(request.exerciseName());

        String fourWeeksAgo = LocalDate.now().minusWeeks(4).toString();
        List<Workout> recentWorkouts = workoutRepository.findRecentWorkoutsWithDetails(user, fourWeeksAgo);

        List<ProgressionMetricDto> topProgressions = mathEngine.calculateTopProgressions(recentWorkouts);
        List<PlateauExerciseDto> plateaus = mathEngine.detectPlateaus(recentWorkouts);

        String athleteName = user.getName() != null && !user.getName().isBlank() ? user.getName() : "Atleta";

        String systemInstruction = buildChatSystemInstruction();
        String userContent = buildChatUserContent(athleteName, recentWorkouts.size(), sanitizedContext, sanitizedQuestion, topProgressions, plateaus);

        StructuredCoachChat structured = callGeminiStructured(systemInstruction, userContent, StructuredCoachChat.class);

        String aiAnswer = null;
        List<String> keyTakeaways = null;

        if (structured != null && structured.answer() != null && !structured.answer().isBlank()) {
            AiResponseValidator.ValidationResult validation = responseValidator.validateChatResponse(
                    structured.answer(), topProgressions, plateaus, recentWorkouts.size()
            );

            if (validation.isValid()) {
                aiAnswer = structured.answer().trim();
                keyTakeaways = (structured.keyTakeaways() != null && !structured.keyTakeaways().isEmpty())
                        ? structured.keyTakeaways()
                        : List.of(
                                "Sobrecarga simples: +1 repetição ou micro-carga (+1kg a +2kg)",
                                "Descanso: 2-3min para compostos e 60-90s para isoladores",
                                "Cadência: 2-3s na descida excêntrica e deload de 1 série se fadigado"
                        );
            } else {
                log.warn("[AiCoachService] Chat LLM reprovado pelo guardrail: {}. Ativando fallback determinístico.", validation.reason());
                recordHallucinationBlocked();
            }
        }

        if (aiAnswer == null) {
            recordFallbackTriggered();
            aiAnswer = ("Olá, %s! Para a próxima sessão, aplique sobrecarga progressiva básica: busque +1 repetição com a carga atual ou adicione micro-carga de +1kg a +2kg na primeira série do exercício principal.\n\n"
                    + "Controle a descida excêntrica em 2 a 3 segundos e respeite os descansos: 2 a 3 minutos para compostos e 60 a 90 segundos para isoladores.\n\n"
                    + "Caso sinta fadiga alta ou estagnação no exercício, reduza 1 série de trabalho para acelerar a recuperação muscular.")
                    .formatted(athleteName);
            keyTakeaways = List.of(
                    "Sobrecarga simples: +1 repetição ou micro-carga (+1kg a +2kg)",
                    "Descanso: 2-3min para compostos e 60-90s para isoladores",
                    "Cadência: 2-3s na descida excêntrica e deload de 1 série se fadigado"
            );
        }

        return new AiCoachChatResponse(aiAnswer, keyTakeaways, Instant.now().toString());
    }

    /**
     * Sanitiza entrada do usuário contra Prompt Injection (OWASP LLM01), limitando tamanho e expurgando comandos de controle.
     */
    public String sanitizeUserInput(String input) {
        if (input == null) return "";
        String sanitized = input.trim();
        if (sanitized.length() > 500) {
            sanitized = sanitized.substring(0, 500);
        }
        sanitized = sanitized.replaceAll("[\\p{Cntrl}&&[^\r\n\t]]", "");
        sanitized = sanitized.replaceAll("(?i)(ignore\\s+all\\s+previous\\s+instructions|ignorar\\s+todas\\s+as\\s+instrucoes|system\\s*:|developer\\s+mode|dan\\s+mode)", "[filtered]");
        return sanitized;
    }

    private <T> T callGeminiStructured(String systemInstruction, String userContent, Class<T> responseType) {
        if (geminiApiKey == null || geminiApiKey.isBlank()) {
            log.info("[AiCoachService] GEMINI_API_KEY não configurada. Usando motor analítico determinístico.");
            return null;
        }

        long startTime = System.currentTimeMillis();

        // Retry com backoff simples para resiliência (429 / 503)
        for (int attempt = 1; attempt <= 2; attempt++) {
            try {
                String endpoint = String.format("%s/%s:generateContent", geminiBaseUrl, geminiModel);

                Map<String, Object> payload = Map.of(
                        "systemInstruction", Map.of(
                                "parts", List.of(Map.of("text", systemInstruction))
                        ),
                        "contents", List.of(
                                Map.of(
                                        "role", "user",
                                        "parts", List.of(Map.of("text", userContent))
                                )
                        ),
                        "generationConfig", Map.of(
                                "temperature", 0.2,
                                "maxOutputTokens", 800,
                                "responseMimeType", "application/json"
                        )
                );

                String requestBody = objectMapper.writeValueAsString(payload);

                HttpRequest request = HttpRequest.newBuilder()
                        .uri(URI.create(endpoint))
                        .header("Content-Type", "application/json")
                        .header("x-goog-api-key", geminiApiKey.trim())
                        .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                        .timeout(Duration.ofSeconds(15))
                        .build();

                HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

                long elapsed = System.currentTimeMillis() - startTime;
                if (requestTimer != null) {
                    requestTimer.record(elapsed, TimeUnit.MILLISECONDS);
                }

                if (response.statusCode() == 200) {
                    JsonNode root = objectMapper.readTree(response.body());

                    // Coleta métricas de consumo de tokens
                    JsonNode usage = root.get("usageMetadata");
                    if (usage != null) {
                        int promptTokens = usage.path("promptTokenCount").asInt(0);
                        int candTokens = usage.path("candidatesTokenCount").asInt(0);
                        if (promptTokensCounter != null && promptTokens > 0) {
                            promptTokensCounter.increment(promptTokens);
                        }
                        if (candidateTokensCounter != null && candTokens > 0) {
                            candidateTokensCounter.increment(candTokens);
                        }
                    }

                    JsonNode textNode = root.at("/candidates/0/content/parts/0/text");
                    if (!textNode.isMissingNode()) {
                        String jsonResponse = textNode.asText().trim();
                        return objectMapper.readValue(jsonResponse, responseType);
                    }
                } else if (response.statusCode() == 429 || response.statusCode() == 503) {
                    log.warn("[AiCoachService] Tentativa {} falhou com status {}. Aguardando backoff...", attempt, response.statusCode());
                    if (attempt < 2) {
                        Thread.sleep(1000);
                        continue;
                    }
                } else {
                    log.warn("[AiCoachService] Resposta não-200 do Gemini API (status {}): {}", response.statusCode(), response.body());
                    break;
                }
            } catch (Exception e) {
                log.warn("[AiCoachService] Exceção ao comunicar com Gemini API (tentativa {}): {}", attempt, e.getMessage());
                if (attempt < 2) {
                    try { Thread.sleep(1000); } catch (InterruptedException ignored) {}
                }
            }
        }

        return null;
    }

    private String buildAnalysisSystemInstruction() {
        return """
                Você é o FocusLift AI Coach, treinador especialista de musculação para app mobile.
                
                CONTRATO ESTRITO DE RESPOSTA (JSON MODE):
                Você DEVE responder exclusivamente com um objeto JSON válido contendo exatamente estas chaves:
                {
                  "summary": "Resumo de 2 a 3 parágrafos curtos ou bullets objetivos formatados em Markdown para celular.",
                  "tacticalAdvice": "Uma única orientação prática e acionável para o próximo treino.",
                  "nextSessionFocus": "Frase curta indicando o foco prioritário imediato (ex: Quebrar platô no supino)."
                }
                
                REGRAS ESTRITAS DE COMPORTAMENTO:
                1. LIMITAÇÃO A CORREÇÕES BÁSICAS DE TREINO:
                   - Sobrecarga progressiva simples: +1 repetição com carga atual ou micro-carga de +1kg a +2kg.
                   - Descanso: 2 a 3 minutos para compostos pesados e 60 a 90 segundos para isoladores.
                   - Cadência: 2 a 3 segundos na descida excêntrica controlada.
                   - Detecção de fadiga (ACWR): se ACWR > 1.5 ou volume subiu mais de 12%, recomende corte de 1 série ou deload leve.
                2. PROIBIÇÕES ABSOLUTAS:
                   - PROIBIDO prescrever dietas, contagem de macros, suplementos pesados, anabolizantes ou receitas médicas.
                   - PROIBIDO dissertações acadêmicas prolixas ou jargões densos.
                3. ZERO ALUCINAÇÕES NUMÉRICAS:
                   - Cite APENAS os números de 1RM, volume e percentuais fornecidos nos dados reais. NUNCA altere ou invente valores de peso ou séries.
                """;
    }

    private String buildAnalysisUserContent(
            String athleteName,
            int workoutsCount,
            ProgressionMathEngine.WeeklyVolumeAnalysis volume,
            ProgressionMathEngine.AcwrAnalysis acwr,
            List<ProgressionMetricDto> progressions,
            List<PlateauExerciseDto> plateaus
    ) {
        return """
                DADOS MATEMÁTICOS EXATOS DO ATLETA %s:
                - Treinos analisados: %d
                - Volume Semana Atual: %.1f kg
                - Volume Semana Anterior: %.1f kg
                - Variação Semanal: %.1f%%
                - Índice ACWR (Agudo/Crônico): %.2f (Nível: %s - %s)
                
                PROGRESSÃO DE 1RM POR EXERCÍCIO (Brzycki):
                %s
                
                EXERCÍCIOS EM PLATÔ (>= 3 sessões sem avanço com RPE alto):
                %s
                """.formatted(
                athleteName,
                workoutsCount,
                volume.currentWeekVolume(),
                volume.previousWeekVolume(),
                volume.deltaPercent(),
                acwr.ratio(),
                acwr.riskLevel().name(),
                acwr.interpretation(),
                formatProgressionsForPrompt(progressions),
                formatPlateausForPrompt(plateaus)
        );
    }

    private String buildChatSystemInstruction() {
        return """
                Você é o FocusLift AI Coach, treinador prático de musculação focado em correções rápidas de treino no celular.
                
                CONTRATO ESTRITO DE RESPOSTA (JSON MODE):
                Você DEVE responder exclusivamente com um objeto JSON válido contendo exatamente estas chaves:
                {
                  "answer": "Resposta curta e prática em 2 parágrafos curtos para leitura rápida no celular.",
                  "keyTakeaways": [
                    "Ponto de ação 1 (ex: Sobrecarga simples de +1 rep ou +1kg a +2kg)",
                    "Ponto de ação 2 (ex: Descanso de 2-3min compostos e 60-90s isoladores)",
                    "Ponto de ação 3 (ex: Cadência de 2-3s na excêntrica)"
                  ]
                }
                
                REGRAS ESTRITAS:
                1. Limitação a sobrecarga simples (+1 rep ou +1kg/+2kg), descansos (2-3min compostos, 60-90s isoladores) e cadência (2-3s excêntrica).
                2. PROIBIDO dietas, anabolizantes, receitas médicas ou dissertações prolixas.
                3. ZERO ALUCINAÇÕES: não invente cargas ou marcas que não constam nos dados.
                """;
    }

    private String buildChatUserContent(
            String athleteName,
            int workoutsCount,
            String exerciseContext,
            String question,
            List<ProgressionMetricDto> progressions,
            List<PlateauExerciseDto> plateaus
    ) {
        return """
                DADOS REAIS DO ATLETA (%s):
                - Treinos recentes: %d
                - Contexto do exercício: %s
                - Principais 1RMs calculados:
                %s
                - Platôs detectados:
                %s
                
                PERGUNTA DO ATLETA:
                "%s"
                """.formatted(
                athleteName,
                workoutsCount,
                exerciseContext.isBlank() ? "Geral" : exerciseContext,
                formatProgressionsForPrompt(progressions),
                formatPlateausForPrompt(plateaus),
                question
        );
    }

    private String generateDeterministicFallbackAnalysis(
            String athleteName,
            ProgressionMathEngine.WeeklyVolumeAnalysis volume,
            ProgressionMathEngine.AcwrAnalysis acwr,
            List<ProgressionMetricDto> progressions,
            List<PlateauExerciseDto> plateaus
    ) {
        StringBuilder sb = new StringBuilder();
        sb.append(String.format("Fala, %s! Resumo direto das últimas semanas:\n\n", athleteName));

        if (volume.previousWeekVolume() > 0) {
            if (volume.deltaPercent() >= 3.0 && volume.deltaPercent() <= 12.0) {
                sb.append(String.format("• **Volume Semanal Ótimo:** Subiu de **%.1f kg** para **%.1f kg** (+%.1f%%). Faixa ideal de sobrecarga progressiva sem fadiga excessiva.\n\n",
                        volume.previousWeekVolume(), volume.currentWeekVolume(), volume.deltaPercent()));
            } else if (volume.deltaPercent() > 12.0) {
                sb.append(String.format("• **Volume em Alta Forte:** Subiu +%.1f%% (**%.1f kg**). Reduza 1 série nos exercícios secundários na próxima sessão para controlar a fadiga.\n\n",
                        volume.deltaPercent(), volume.currentWeekVolume()));
            } else if (volume.deltaPercent() < -10.0) {
                sb.append(String.format("• **Semana de Recuperação:** Volume caiu %.1f%% (**%.1f kg**). Ótimo deload natural para regeneração articular e muscular.\n\n",
                        volume.deltaPercent(), volume.currentWeekVolume()));
            } else {
                sb.append(String.format("• **Consistência de Carga:** Volume semanal fechou em **%.1f kg** (variação de %.1f%%). Busque +1 repetição ou micro-carga de +1kg a +2kg para novos estímulos.\n\n",
                        volume.currentWeekVolume(), volume.deltaPercent()));
            }
        }

        // Incorpora análise ACWR de fadiga e lesão
        if (acwr != null && acwr.riskLevel() != ProgressionMathEngine.AcwrRiskLevel.INSUFFICIENT_DATA) {
            if (acwr.riskLevel() == ProgressionMathEngine.AcwrRiskLevel.DANGER_ZONE) {
                sb.append(String.format("• **Alerta de Fadiga (ACWR %.2f):** Pico agudo detectado. %s\n\n", acwr.ratio(), acwr.recommendation()));
            } else if (acwr.riskLevel() == ProgressionMathEngine.AcwrRiskLevel.OPTIMAL) {
                sb.append(String.format("• **Sweet Spot de Carga (ACWR %.2f):** Relação aguda/crônica equilibrada. Menor risco de lesão e máxima hipertrofia.\n\n", acwr.ratio()));
            }
        }

        if (!progressions.isEmpty()) {
            ProgressionMetricDto top = progressions.get(0);
            if (top.delta1RmKg() > 0) {
                sb.append(String.format("• **Evolução Principal:** Destaque no **%s** com 1RM estimado de **%.1f kg** para **%.1f kg** (+%.1f%%, top: **%.1f kg × %d reps**).\n\n",
                        top.exerciseName(), top.previous1Rm(), top.current1Rm(), top.delta1RmPercent(), top.currentTopWeight(), top.currentTopReps()));
            }
        }

        if (!plateaus.isEmpty()) {
            PlateauExerciseDto p = plateaus.get(0);
            sb.append(String.format("• **Ajuste em Platô:** **%s** estabilizou em **%.1f kg × %d reps** (%d treinos seguidos). %s",
                    p.exerciseName(), p.currentWeight(), p.currentReps(), p.consecutiveStagnantSessions(), p.suggestedAction()));
        } else {
            sb.append("• **Sobrecarga Regular:** Sem platôs detectados. Mantenha 2 a 3 segundos na descida excêntrica e descanso de 2 a 3min nos compostos.");
        }

        return sb.toString().trim();
    }

    private String generateTacticalAdvice(
            ProgressionMathEngine.WeeklyVolumeAnalysis volume,
            List<ProgressionMetricDto> progressions,
            List<PlateauExerciseDto> plateaus
    ) {
        if (!plateaus.isEmpty()) {
            return "Destrave o platô com micro-carga de +1kg a +2kg ou busque +1 repetição mantendo descida controlada de 2 a 3 segundos.";
        }
        if (volume.deltaPercent() > 15.0) {
            return "Volume semanal subiu rápido (+15%). Reduza 1 série dos exercícios secundários e descanse 2 a 3 minutos nos compostos para controlar a fadiga.";
        }
        return "Aplique sobrecarga progressiva simples: busque +1 repetição ou micro-carga de +1kg a +2kg na primeira série, com descanso de 2-3min nos compostos e 60-90s nos isoladores.";
    }

    private String generateNextSessionFocus(List<ProgressionMetricDto> progressions, List<PlateauExerciseDto> plateaus) {
        if (!plateaus.isEmpty()) {
            return String.format("Quebrar platô em %s: tentar +1 repetição ou adicionar micro-carga (+1kg/+2kg) com descida em 2 a 3 segundos.", plateaus.get(0).exerciseName());
        }
        if (!progressions.isEmpty()) {
            return String.format("Consolidar %s: manter carga com 2 a 3s na descida e descansar 2 a 3 minutos entre séries.", progressions.get(0).exerciseName());
        }
        return "Buscar +1 repetição na primeira série pesada mantendo cadência de 2 a 3 segundos na descida.";
    }

    private String formatProgressionsForPrompt(List<ProgressionMetricDto> progressions) {
        if (progressions == null || progressions.isEmpty()) return "Nenhum dado anterior suficiente ainda.";
        StringBuilder sb = new StringBuilder();
        for (ProgressionMetricDto p : progressions.stream().limit(5).toList()) {
            sb.append(String.format("- %s (%s): 1RM Atual: %.1fkg | 1RM Anterior: %.1fkg | Delta: +%.1fkg (+%.1f%%)\n",
                    p.exerciseName(), p.muscleGroup(), p.current1Rm(), p.previous1Rm(), p.delta1RmKg(), p.delta1RmPercent()));
        }
        return sb.toString();
    }

    private String formatPlateausForPrompt(List<PlateauExerciseDto> plateaus) {
        if (plateaus == null || plateaus.isEmpty()) return "Nenhum platô crítico detectado.";
        StringBuilder sb = new StringBuilder();
        for (PlateauExerciseDto p : plateaus) {
            sb.append(String.format("- %s na ficha '%s': %d treinos com %.1fkg x %d reps (RPE %.1f)\n",
                    p.exerciseName(), p.routineTitle(), p.consecutiveStagnantSessions(), p.currentWeight(), p.currentReps(), p.averageRpe()));
        }
        return sb.toString();
    }

    private String computeAthleteStateHash(List<Workout> workouts) {
        if (workouts == null || workouts.isEmpty()) return "empty";
        Workout latest = workouts.get(workouts.size() - 1);
        return workouts.size() + ":" + latest.getDate() + ":" + latest.getTotalVolumeKg();
    }

    private void recordFallbackTriggered() {
        if (fallbackCounter != null) {
            fallbackCounter.increment();
        }
    }

    private void recordHallucinationBlocked() {
        if (hallucinationCounter != null) {
            hallucinationCounter.increment();
        }
    }

    private record CachedAnalysis(AiCoachAnalysisResponse response, Instant cachedAt, String stateHash) {}
}
