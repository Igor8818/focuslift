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
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

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
import java.util.concurrent.atomic.AtomicBoolean;

@Service
public class AiCoachService {

    private static final Logger log = LoggerFactory.getLogger(AiCoachService.class);

    private static final int MAX_CACHE_ENTRIES = 500;
    private static final int MAX_RATE_LIMIT_ENTRIES = 1000;
    private static final Duration CACHE_TTL = Duration.ofMinutes(10);
    private static final Duration RATE_WINDOW_DURATION = Duration.ofHours(1);

    private final ProgressionMathEngine mathEngine;
    private final WorkoutRepository workoutRepository;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;
    private final AiResponseValidator responseValidator;
    private final MeterRegistry meterRegistry;
    private final TransactionTemplate readOnlyTransactionTemplate;

    // Métricas de observabilidade Micrometer
    private final Timer requestTimer;
    private final Counter fallbackCounter;
    private final Counter hallucinationCounter;
    private final Counter rateLimitedCounter;
    private final Counter promptTokensCounter;
    private final Counter candidateTokensCounter;

    // Cache em memória limitado com TTL de 10 minutos para evitar OOM e queimar tokens em estados idênticos
    private final Map<Long, CachedAnalysis> analysisCache = new ConcurrentHashMap<>();

    // Controle de cota horária por usuário (proteção contra abuso em Free Tier / Gemini API)
    private final Map<Long, UserRateWindow> userRateLimits = new ConcurrentHashMap<>();

    @Value("${application.ai.rate-limit-per-hour:25}")
    private int maxRequestsPerHour = 25;

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
            @Autowired(required = false) MeterRegistry meterRegistry,
            @Autowired(required = false) PlatformTransactionManager transactionManager
    ) {
        this.mathEngine = mathEngine;
        this.workoutRepository = workoutRepository;
        this.objectMapper = objectMapper;
        this.responseValidator = responseValidator;
        this.meterRegistry = meterRegistry;

        if (transactionManager != null) {
            TransactionTemplate tpl = new TransactionTemplate(transactionManager);
            tpl.setReadOnly(true);
            tpl.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRED);
            this.readOnlyTransactionTemplate = tpl;
        } else {
            this.readOnlyTransactionTemplate = null;
        }

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
            this.rateLimitedCounter = Counter.builder("ai.coach.rate_limited.count")
                    .description("Total de chamadas bloqueadas pelo rate limit horário")
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
            this.rateLimitedCounter = null;
            this.promptTokensCounter = null;
            this.candidateTokensCounter = null;
        }
    }

    public AiCoachService(
            ProgressionMathEngine mathEngine,
            WorkoutRepository workoutRepository,
            ObjectMapper objectMapper,
            AiResponseValidator responseValidator,
            MeterRegistry meterRegistry
    ) {
        this(mathEngine, workoutRepository, objectMapper, responseValidator, meterRegistry, null);
    }

    public AiCoachService(
            ProgressionMathEngine mathEngine,
            WorkoutRepository workoutRepository,
            ObjectMapper objectMapper
    ) {
        this(mathEngine, workoutRepository, objectMapper, new AiResponseValidator(), null, null);
    }

    public AiCoachAnalysisResponse analyzeProgress(User user) {
        return analyzeProgress(user, "pt", "kg");
    }

    public AiCoachAnalysisResponse analyzeProgress(User user, String language, String unit) {
        String lang = normalizeLanguage(language);
        String weightUnit = normalizeUnit(unit);
        boolean isPt = "pt".equals(lang);

        // Lê e computa o snapshot numa transação curta (sem prender conexão HTTP ao Gemini)
        AthleteMetricsSnapshot snapshot = loadAthleteMetricsSnapshot(user);
        String cacheKeyHash = snapshot.stateHash() + ":" + lang + ":" + weightUnit;

        // Verificação de cache por hash de estado, idioma e unidade do atleta
        if (user.getId() != null) {
            CachedAnalysis cached = analysisCache.get(user.getId());
            if (cached != null && cached.stateHash().equals(cacheKeyHash) &&
                    Duration.between(cached.cachedAt(), Instant.now()).compareTo(CACHE_TTL) < 0) {
                log.debug("[AiCoachService] Retornando análise do cache para o usuário {}", user.getId());
                return cached.response();
            }
        }

        ProgressionMathEngine.WeeklyVolumeAnalysis volumeAnalysis = snapshot.volumeAnalysis();
        ProgressionMathEngine.AcwrAnalysis acwrAnalysis = snapshot.acwrAnalysis();
        List<ProgressionMetricDto> topProgressions = snapshot.topProgressions();
        List<PlateauExerciseDto> plateaus = snapshot.plateaus();

        String defaultName = isPt ? "Atleta" : "Athlete";
        String athleteName = user.getName() != null && !user.getName().isBlank() ? user.getName() : defaultName;

        String systemInstruction = buildAnalysisSystemInstruction(lang, weightUnit);
        String userContent = buildAnalysisUserContent(athleteName, snapshot.workoutsCount(), volumeAnalysis, acwrAnalysis, topProgressions, plateaus, weightUnit);

        StructuredCoachAnalysis structured = null;
        if (tryConsumeUserQuota(user)) {
            structured = callGeminiStructured(systemInstruction, userContent, StructuredCoachAnalysis.class);
        } else {
            recordRateLimited();
            log.warn("[AiCoachService] Cota horária de IA atingida para usuário {}. Usando fallback determinístico.", user.getId());
        }

        String aiAnalysisText = null;
        String tacticalAdvice = null;
        String nextSessionFocus = null;

        if (structured != null && structured.summary() != null && !structured.summary().isBlank()) {
            AiResponseValidator.ValidationResult validation = responseValidator.validateAnalysis(
                    structured.summary(), volumeAnalysis, acwrAnalysis, topProgressions, plateaus, snapshot.workoutsCount(), weightUnit
            );

            if (validation.isValid()) {
                aiAnalysisText = structured.summary().trim();
                tacticalAdvice = structured.tacticalAdvice() != null && !structured.tacticalAdvice().isBlank()
                        ? structured.tacticalAdvice().trim()
                        : generateTacticalAdvice(volumeAnalysis, topProgressions, plateaus, lang, weightUnit);
                nextSessionFocus = structured.nextSessionFocus() != null && !structured.nextSessionFocus().isBlank()
                        ? structured.nextSessionFocus().trim()
                        : generateNextSessionFocus(topProgressions, plateaus, lang);
            } else {
                log.warn("[AiCoachService] Resposta estruturada reprovada pelo guardrail: {}. Ativando fallback determinístico.", validation.reason());
                recordHallucinationBlocked();
            }
        }

        if (aiAnalysisText == null) {
            recordFallbackTriggered();
            aiAnalysisText = generateDeterministicFallbackAnalysis(athleteName, volumeAnalysis, acwrAnalysis, topProgressions, plateaus, lang, weightUnit);
            tacticalAdvice = generateTacticalAdvice(volumeAnalysis, topProgressions, plateaus, lang, weightUnit);
            nextSessionFocus = generateNextSessionFocus(topProgressions, plateaus, lang);
        }

        AcwrDto acwrDto = buildLocalizedAcwrDto(acwrAnalysis, lang);

        AiCoachAnalysisResponse response = new AiCoachAnalysisResponse(
                athleteName,
                snapshot.workoutsCount(),
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
            putInCache(user.getId(), new CachedAnalysis(response, Instant.now(), cacheKeyHash));
        }

        return response;
    }

    public AiCoachChatResponse chatWithCoach(User user, AiCoachChatRequest request) {
        String lang = normalizeLanguage(request.language());
        String weightUnit = normalizeUnit(request.unit());
        boolean isPt = "pt".equals(lang);

        String sanitizedQuestion = sanitizeUserInput(request.question());
        String sanitizedExercise = sanitizeUserInput(request.exerciseName());
        String sanitizedAthleteContext = sanitizeUserInput(request.athleteContext(), 800);
        List<ChatMessageDto> recentHistory = sanitizeHistory(request.history());

        // Lê métricas e libera a conexão do banco imediatamente antes da chamada HTTP externa
        AthleteMetricsSnapshot snapshot = loadAthleteMetricsSnapshot(user);

        List<ProgressionMetricDto> topProgressions = snapshot.topProgressions();
        List<PlateauExerciseDto> plateaus = snapshot.plateaus();

        String athleteName = user.getName() != null && !user.getName().isBlank()
                ? user.getName()
                : (isPt ? "Atleta" : "Athlete");

        String systemInstruction = buildChatSystemInstruction(lang, weightUnit);
        String userContent = buildChatUserContent(
                athleteName,
                snapshot.workoutsCount(),
                sanitizedExercise,
                sanitizedAthleteContext,
                recentHistory,
                sanitizedQuestion,
                snapshot.acwrAnalysis(),
                topProgressions,
                plateaus,
                weightUnit
        );

        StructuredCoachChat structured = null;
        if (tryConsumeUserQuota(user)) {
            structured = callGeminiStructured(systemInstruction, userContent, StructuredCoachChat.class);
        } else {
            recordRateLimited();
            log.warn("[AiCoachService] Cota horária de chat atingida para usuário {}. Retornando orientação determinística.", user.getId());
        }

        String aiAnswer = null;
        List<String> keyTakeaways = null;

        if (structured != null && structured.answer() != null && !structured.answer().isBlank()) {
            AiResponseValidator.ValidationResult validation = responseValidator.validateChatResponse(
                    structured.answer(), topProgressions, plateaus, snapshot.workoutsCount()
            );

            if (validation.isValid()) {
                aiAnswer = structured.answer().trim();
                keyTakeaways = (structured.keyTakeaways() != null && !structured.keyTakeaways().isEmpty())
                        ? structured.keyTakeaways()
                        : defaultChatKeyTakeaways(lang);
            } else {
                log.warn("[AiCoachService] Chat LLM reprovado pelo guardrail: {}. Ativando fallback determinístico.", validation.reason());
                recordHallucinationBlocked();
            }
        }

        if (aiAnswer == null) {
            recordFallbackTriggered();
            aiAnswer = generateDeterministicChatFallback(athleteName, sanitizedExercise, snapshot, lang, weightUnit);
            keyTakeaways = defaultChatKeyTakeaways(lang);
        }

        return new AiCoachChatResponse(aiAnswer, keyTakeaways, Instant.now().toString());
    }

    private AthleteMetricsSnapshot loadAthleteMetricsSnapshot(User user) {
        if (readOnlyTransactionTemplate != null) {
            AthleteMetricsSnapshot snapshot = readOnlyTransactionTemplate.execute(status -> computeSnapshot(user));
            if (snapshot != null) {
                return snapshot;
            }
        }
        return computeSnapshot(user);
    }

    private AthleteMetricsSnapshot computeSnapshot(User user) {
        String fourWeeksAgo = LocalDate.now().minusWeeks(4).toString();
        List<Workout> recentWorkouts = workoutRepository.findRecentWorkoutsWithDetails(user, fourWeeksAgo);
        if (recentWorkouts == null) {
            recentWorkouts = List.of();
        }
        String stateHash = computeAthleteStateHash(recentWorkouts);
        ProgressionMathEngine.WeeklyVolumeAnalysis volumeAnalysis = mathEngine.analyzeWeeklyVolumes(recentWorkouts);
        ProgressionMathEngine.AcwrAnalysis acwrAnalysis = mathEngine.calculateAcwr(recentWorkouts);
        List<ProgressionMetricDto> topProgressions = mathEngine.calculateTopProgressions(recentWorkouts);
        List<PlateauExerciseDto> plateaus = mathEngine.detectPlateaus(recentWorkouts);

        return new AthleteMetricsSnapshot(
                recentWorkouts.size(),
                stateHash,
                volumeAnalysis,
                acwrAnalysis,
                topProgressions,
                plateaus
        );
    }

    /**
     * Controla cota horária de chamadas ao LLM por usuário (proteção contra abuso e estouro de Free Tier).
     */
    boolean tryConsumeUserQuota(User user) {
        if (user == null || user.getId() == null) {
            return true;
        }
        if (maxRequestsPerHour <= 0) {
            return false;
        }

        Instant now = Instant.now();
        if (userRateLimits.size() > MAX_RATE_LIMIT_ENTRIES) {
            Instant cutoff = now.minus(Duration.ofHours(2));
            userRateLimits.entrySet().removeIf(e -> e.getValue().windowStart().isBefore(cutoff));
        }

        AtomicBoolean allowed = new AtomicBoolean(false);
        userRateLimits.compute(user.getId(), (id, existing) -> {
            if (existing == null || Duration.between(existing.windowStart(), now).compareTo(RATE_WINDOW_DURATION) >= 0) {
                allowed.set(true);
                return new UserRateWindow(now, 1);
            }
            if (existing.count() < maxRequestsPerHour) {
                allowed.set(true);
                return new UserRateWindow(existing.windowStart(), existing.count() + 1);
            }
            allowed.set(false);
            return existing;
        });

        return allowed.get();
    }

    private void putInCache(Long userId, CachedAnalysis entry) {
        Instant now = Instant.now();
        if (analysisCache.size() >= MAX_CACHE_ENTRIES) {
            analysisCache.entrySet().removeIf(e -> Duration.between(e.getValue().cachedAt(), now).compareTo(CACHE_TTL) >= 0);
        }
        if (analysisCache.size() >= MAX_CACHE_ENTRIES) {
            analysisCache.entrySet().stream()
                    .min(Comparator.comparing(e -> e.getValue().cachedAt()))
                    .map(Map.Entry::getKey)
                    .ifPresent(analysisCache::remove);
        }
        analysisCache.put(userId, entry);
    }

    /**
     * Sanitiza entrada do usuário contra Prompt Injection (OWASP LLM01), limitando tamanho e expurgando comandos de controle.
     */
    public String sanitizeUserInput(String input) {
        return sanitizeUserInput(input, 500);
    }

    private String sanitizeUserInput(String input, int maxLength) {
        if (input == null) return "";
        String sanitized = input.trim();
        if (sanitized.length() > maxLength) {
            sanitized = sanitized.substring(0, maxLength);
        }
        sanitized = sanitized.replaceAll("[\\p{Cntrl}&&[^\r\n\t]]", "");
        sanitized = sanitized.replaceAll("(?i)(ignore\\s+all\\s+previous\\s+instructions|ignorar\\s+todas\\s+as\\s+instrucoes|system\\s*:|developer\\s+mode|dan\\s+mode)", "[filtered]");
        return sanitized;
    }

    private List<ChatMessageDto> sanitizeHistory(List<ChatMessageDto> history) {
        if (history == null || history.isEmpty()) {
            return List.of();
        }
        int start = Math.max(0, history.size() - 6);
        List<ChatMessageDto> cleaned = new ArrayList<>();
        for (int i = start; i < history.size(); i++) {
            ChatMessageDto msg = history.get(i);
            if (msg == null || msg.text() == null || msg.text().isBlank()) continue;
            String role = "coach".equalsIgnoreCase(msg.role()) || "assistant".equalsIgnoreCase(msg.role())
                    ? "Coach"
                    : "Atleta";
            cleaned.add(new ChatMessageDto(role, sanitizeUserInput(msg.text(), 400)));
        }
        return cleaned;
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

    private String normalizeLanguage(String language) {
        if (language == null || language.isBlank()) return "pt";
        String clean = language.trim().toLowerCase();
        return switch (clean) {
            case "en", "es", "de", "fr", "pt" -> clean;
            default -> clean.startsWith("pt") ? "pt"
                    : clean.startsWith("es") ? "es"
                    : clean.startsWith("de") ? "de"
                    : clean.startsWith("fr") ? "fr"
                    : "en";
        };
    }

    private String normalizeUnit(String unit) {
        return "lbs".equalsIgnoreCase(unit != null ? unit.trim() : "") ? "lbs" : "kg";
    }

    private String languageDisplayName(String lang) {
        return switch (lang) {
            case "en" -> "English";
            case "es" -> "Español";
            case "de" -> "Deutsch";
            case "fr" -> "Français";
            default -> "Português (Brasil)";
        };
    }

    private double convertDisplayWeight(double kg, String weightUnit) {
        if (!"lbs".equals(weightUnit) || kg <= 0) return kg;
        return Math.round(kg * 2.20462 * 10.0) / 10.0;
    }

    private String buildAnalysisSystemInstruction(String lang, String weightUnit) {
        String targetLang = languageDisplayName(lang);
        return """
                Você é o FocusLift AI Coach, treinador especialista de musculação para app mobile.
                IDIOMA OBRIGATÓRIO DA RESPOSTA: Escreva 100%% dos campos em %s.
                UNIDADE DE PESO PREFERIDA PELO ATLETA: %s.
                
                CONTRATO ESTRITO DE RESPOSTA (JSON MODE):
                Você DEVE responder exclusivamente com um objeto JSON válido contendo exatamente estas chaves:
                {
                  "summary": "Resumo de 2 a 3 parágrafos curtos ou bullets objetivos formatados em Markdown para celular, no idioma %s.",
                  "tacticalAdvice": "Uma única orientação prática e acionável para o próximo treino, no idioma %s.",
                  "nextSessionFocus": "Frase curta indicando o foco prioritário imediato no idioma %s."
                }
                
                REGRAS ESTRITAS DE COMPORTAMENTO:
                1. LIMITAÇÃO A CORREÇÕES BÁSICAS DE TREINO:
                   - Sobrecarga progressiva simples: +1 repetição com carga atual ou micro-carga (+1kg/+2kg ou +2.5lbs/+5lbs).
                   - Descanso: 2 a 3 minutos para compostos pesados e 60 a 90 segundos para isoladores.
                   - Cadência: 2 a 3 segundos na descida excêntrica controlada.
                   - Detecção de fadiga (ACWR): se ACWR > 1.5 ou volume subiu mais de 12%%, recomende corte de 1 série ou deload leve.
                2. PROIBIÇÕES ABSOLUTAS:
                   - PROIBIDO prescrever dietas, contagem de macros, suplementos pesados, anabolizantes ou receitas médicas.
                   - PROIBIDO dissertações acadêmicas prolixas ou jargões densos.
                3. ZERO ALUCINAÇÕES NUMÉRICAS:
                   - Cite APENAS os números de 1RM, volume e percentuais fornecidos nos dados reais. NUNCA altere ou invente valores de peso ou séries.
                """.formatted(targetLang, weightUnit, targetLang, targetLang, targetLang);
    }

    private String buildAnalysisUserContent(
            String athleteName,
            int workoutsCount,
            ProgressionMathEngine.WeeklyVolumeAnalysis volume,
            ProgressionMathEngine.AcwrAnalysis acwr,
            List<ProgressionMetricDto> progressions,
            List<PlateauExerciseDto> plateaus,
            String weightUnit
    ) {
        return """
                DADOS MATEMÁTICOS EXATOS DO ATLETA %s (Unidade: %s):
                - Treinos analisados: %d
                - Volume Semana Atual: %.1f %s
                - Volume Semana Anterior: %.1f %s
                - Variação Semanal: %.1f%%
                - Índice ACWR (Agudo/Crônico): %.2f (Nível: %s - %s)
                
                PROGRESSÃO DE 1RM POR EXERCÍCIO (Brzycki):
                %s
                
                EXERCÍCIOS EM PLATÔ (>= 3 sessões sem avanço com RPE alto):
                %s
                """.formatted(
                athleteName,
                weightUnit,
                workoutsCount,
                convertDisplayWeight(volume.currentWeekVolume(), weightUnit),
                weightUnit,
                convertDisplayWeight(volume.previousWeekVolume(), weightUnit),
                weightUnit,
                volume.deltaPercent(),
                acwr.ratio(),
                acwr.riskLevel().name(),
                acwr.interpretation(),
                formatProgressionsForPrompt(progressions, weightUnit),
                formatPlateausForPrompt(plateaus, weightUnit)
        );
    }

    private String buildChatSystemInstruction(String lang, String weightUnit) {
        String targetLang = languageDisplayName(lang);
        return """
                Você é o FocusLift AI Coach, treinador prático de musculação focado em correções rápidas e acionáveis durante o treino no celular.
                IDIOMA OBRIGATÓRIO DA RESPOSTA: Escreva 100%% da resposta ("answer" e "keyTakeaways") no idioma %s.
                UNIDADE DE PESO PREFERIDA: %s.
                
                CONTRATO ESTRITO DE RESPOSTA (JSON MODE):
                Você DEVE responder exclusivamente com um objeto JSON válido contendo exatamente estas chaves:
                {
                  "answer": "Resposta curta, personalizada aos dados reais do atleta e prática em 2 parágrafos curtos para leitura rápida no celular, no idioma %s.",
                  "keyTakeaways": [
                    "Ponto de ação 1 em %s",
                    "Ponto de ação 2 em %s",
                    "Ponto de ação 3 em %s"
                  ]
                }
                
                REGRAS ESTRITAS:
                1. Use os dados reais do atleta (1RMs, cargas de topo, platôs, ACWR e contexto adicional de fichas/hábitos) e o histórico da conversa para responder de forma contextualizada.
                2. Limitação a sobrecarga progressiva (+1 rep ou micro-carga), substituições biomecânicas, séries de aquecimento calculadas sobre a carga real, descansos (2-3min compostos, 60-90s isoladores) e cadência (2-3s excêntrica).
                3. PROIBIDO dietas complexas, anabolizantes, receitas médicas ou dissertações prolixas.
                """.formatted(targetLang, weightUnit, targetLang, targetLang, targetLang, targetLang);
    }

    private String buildChatUserContent(
            String athleteName,
            int workoutsCount,
            String exerciseContext,
            String athleteContext,
            List<ChatMessageDto> history,
            String question,
            ProgressionMathEngine.AcwrAnalysis acwr,
            List<ProgressionMetricDto> progressions,
            List<PlateauExerciseDto> plateaus,
            String weightUnit
    ) {
        StringBuilder historyBlock = new StringBuilder();
        if (history == null || history.isEmpty()) {
            historyBlock.append("Nenhuma mensagem anterior nesta sessão.");
        } else {
            for (ChatMessageDto msg : history) {
                historyBlock.append(String.format("- %s: %s\n", msg.role(), msg.text()));
            }
        }

        return """
                DADOS REAIS DO ATLETA (%s | Unidade: %s):
                - Treinos recentes (28d): %d
                - Índice ACWR atual: %.2f (%s)
                - Contexto do exercício: %s
                - Contexto adicional (fichas, hábitos, peso): %s
                - Principais 1RMs calculados:
                %s
                - Platôs detectados:
                %s
                
                HISTÓRICO RECENTE DA CONVERSA:
                %s
                
                PERGUNTA ATUAL DO ATLETA:
                "%s"
                """.formatted(
                athleteName,
                weightUnit,
                workoutsCount,
                acwr.ratio(),
                acwr.riskLevel().name(),
                exerciseContext.isBlank() ? "Geral" : exerciseContext,
                athleteContext.isBlank() ? "Não informado" : athleteContext,
                formatProgressionsForPrompt(progressions, weightUnit),
                formatPlateausForPrompt(plateaus, weightUnit),
                historyBlock.toString().trim(),
                question
        );
    }

    private List<String> defaultChatKeyTakeaways(String lang) {
        if ("pt".equals(lang)) {
            return List.of(
                    "Sobrecarga simples: +1 repetição ou micro-carga (+1kg a +2kg)",
                    "Descanso: 2-3min para compostos e 60-90s para isoladores",
                    "Cadência: 2-3s na descida excêntrica e deload de 1 série se fadigado"
            );
        }
        return List.of(
                "Simple progressive overload: +1 rep or micro-load (+2.5lb to +5lb / +1-2kg)",
                "Rest periods: 2-3min for heavy compounds and 60-90s for isolation work",
                "Tempo: 2-3s controlled eccentric and cut 1 working set if overly fatigued"
        );
    }

    private String generateDeterministicChatFallback(
            String athleteName,
            String exerciseFocus,
            AthleteMetricsSnapshot snapshot,
            String lang,
            String weightUnit
    ) {
        if (!"pt".equals(lang)) {
            StringBuilder sbEn = new StringBuilder();
            sbEn.append(String.format("Hey %s! ", athleteName));
            if (!snapshot.plateaus().isEmpty()) {
                PlateauExerciseDto p = snapshot.plateaus().get(0);
                sbEn.append(String.format(
                        "Recent plateau detected on **%s** (%.1f %s × %d reps). ",
                        p.exerciseName(), convertDisplayWeight(p.currentWeight(), weightUnit), weightUnit, p.currentReps()
                ));
            } else if (!snapshot.topProgressions().isEmpty()) {
                ProgressionMetricDto top = snapshot.topProgressions().get(0);
                sbEn.append(String.format(
                        "Looking at your current mark on **%s** (%.1f %s × %d reps, est. 1RM ~%.1f %s), ",
                        top.exerciseName(), convertDisplayWeight(top.currentTopWeight(), weightUnit), weightUnit,
                        top.currentTopReps(), convertDisplayWeight(top.current1Rm(), weightUnit), weightUnit
                ));
            } else if (!exerciseFocus.isBlank()) {
                sbEn.append(String.format("For %s, ", exerciseFocus));
            }
            sbEn.append("apply progressive overload next session: aim for +1 rep with the same weight or add a small micro-load on your top set.\n\n"
                    + "Keep a controlled 2-3s eccentric lowering phase and rest 2-3 minutes on heavy compounds (60-90s on isolation).\n\n"
                    + "If you notice high fatigue or stalled performance, reduce 1 working set to accelerate neuromuscular recovery.");
            return sbEn.toString();
        }

        StringBuilder sb = new StringBuilder();
        sb.append(String.format("Olá, %s! ", athleteName));

        if (!snapshot.plateaus().isEmpty()) {
            PlateauExerciseDto p = snapshot.plateaus().get(0);
            sb.append(String.format(
                    "Notei estagnação recente em **%s** (%.1f kg × %d reps). ",
                    p.exerciseName(), p.currentWeight(), p.currentReps()
            ));
        } else if (!snapshot.topProgressions().isEmpty()) {
            ProgressionMetricDto top = snapshot.topProgressions().get(0);
            sb.append(String.format(
                    "Considerando sua marca atual em **%s** (%.1f kg × %d reps, 1RM ~%.1f kg), ",
                    top.exerciseName(), top.currentTopWeight(), top.currentTopReps(), top.current1Rm()
            ));
        } else if (!exerciseFocus.isBlank()) {
            sb.append(String.format("Para %s, ", exerciseFocus));
        }

        sb.append("para a próxima sessão aplique sobrecarga progressiva básica: busque +1 repetição com a carga atual ou adicione micro-carga de +1kg a +2kg na primeira série do exercício principal.\n\n"
                + "Controle a descida excêntrica em 2 a 3 segundos e respeite os descansos: 2 a 3 minutos para compostos e 60 a 90 segundos para isoladores.\n\n"
                + "Caso sinta fadiga alta ou estagnação no exercício, reduza 1 série de trabalho para acelerar a recuperação muscular.");

        return sb.toString();
    }

    private String generateDeterministicFallbackAnalysis(
            String athleteName,
            ProgressionMathEngine.WeeklyVolumeAnalysis volume,
            ProgressionMathEngine.AcwrAnalysis acwr,
            List<ProgressionMetricDto> progressions,
            List<PlateauExerciseDto> plateaus,
            String lang,
            String weightUnit
    ) {
        if (!"pt".equals(lang)) {
            StringBuilder sbEn = new StringBuilder();
            sbEn.append(String.format("Hey %s! Here is your direct training summary:\n\n", athleteName));
            double curVol = convertDisplayWeight(volume.currentWeekVolume(), weightUnit);
            double prevVol = convertDisplayWeight(volume.previousWeekVolume(), weightUnit);
            if (prevVol > 0) {
                if (volume.deltaPercent() >= 3.0 && volume.deltaPercent() <= 12.0) {
                    sbEn.append(String.format("• **Optimal Weekly Volume:** Rose from **%.1f %s** to **%.1f %s** (+%.1f%%). Ideal progressive overload zone.\n\n",
                            prevVol, weightUnit, curVol, weightUnit, volume.deltaPercent()));
                } else if (volume.deltaPercent() > 12.0) {
                    sbEn.append(String.format("• **High Volume Spike:** Up +%.1f%% (**%.1f %s**). Cut 1 working set on accessory lifts next session to manage fatigue.\n\n",
                            volume.deltaPercent(), curVol, weightUnit));
                } else {
                    sbEn.append(String.format("• **Volume Consistency:** Weekly tonnage hit **%.1f %s** (%.1f%% change). Push for +1 rep or micro-load next session.\n\n",
                            curVol, weightUnit, volume.deltaPercent()));
                }
            }
            if (!progressions.isEmpty() && progressions.get(0).delta1RmKg() > 0) {
                ProgressionMetricDto top = progressions.get(0);
                sbEn.append(String.format("• **Top Strength Gain:** **%s** est. 1RM progressed to **%.1f %s** (+%.1f%%).\n\n",
                        top.exerciseName(), convertDisplayWeight(top.current1Rm(), weightUnit), weightUnit, top.delta1RmPercent()));
            }
            if (!plateaus.isEmpty()) {
                PlateauExerciseDto p = plateaus.get(0);
                sbEn.append(String.format("• **Plateau Alert:** **%s** stalled for %d sessions at %.1f %s × %d reps. Aim for +1 rep or 5%% deload.",
                        p.exerciseName(), p.consecutiveStagnantSessions(), convertDisplayWeight(p.currentWeight(), weightUnit), weightUnit, p.currentReps()));
            } else {
                sbEn.append("• **Steady Overload:** No plateaus detected. Maintain 2-3s eccentric tempo and 2-3min rest on heavy compounds.");
            }
            return sbEn.toString().trim();
        }

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
            List<PlateauExerciseDto> plateaus,
            String lang,
            String weightUnit
    ) {
        if (!"pt".equals(lang)) {
            if (!plateaus.isEmpty()) {
                return "Break the plateau with +1 rep on your first working set or a small micro-load while keeping a 2-3s eccentric tempo.";
            }
            if (volume.deltaPercent() > 15.0) {
                return "Weekly volume jumped quickly (+15%). Drop 1 working set on accessories and rest 2-3 minutes on compounds.";
            }
            return "Apply steady progressive overload: chase +1 rep or a small weight bump on your top set, resting 2-3min on compounds.";
        }
        if (!plateaus.isEmpty()) {
            return "Destrave o platô com micro-carga de +1kg a +2kg ou busque +1 repetição mantendo descida controlada de 2 a 3 segundos.";
        }
        if (volume.deltaPercent() > 15.0) {
            return "Volume semanal subiu rápido (+15%). Reduza 1 série dos exercícios secundários e descanse 2 a 3 minutos nos compostos para controlar a fadiga.";
        }
        return "Aplique sobrecarga progressiva simples: busque +1 repetição ou micro-carga de +1kg a +2kg na primeira série, com descanso de 2-3min nos compostos e 60-90s nos isoladores.";
    }

    private String generateNextSessionFocus(List<ProgressionMetricDto> progressions, List<PlateauExerciseDto> plateaus, String lang) {
        if (!"pt".equals(lang)) {
            if (!plateaus.isEmpty()) {
                return String.format("Break plateau on %s: aim for +1 rep or micro-load with 2-3s eccentric control.", plateaus.get(0).exerciseName());
            }
            if (!progressions.isEmpty()) {
                return String.format("Consolidate %s: keep strict 2-3s eccentric tempo and 2-3min rest between sets.", progressions.get(0).exerciseName());
            }
            return "Hit +1 rep on your first heavy working set with a controlled 2-3s lowering phase.";
        }
        if (!plateaus.isEmpty()) {
            return String.format("Quebrar platô em %s: tentar +1 repetição ou adicionar micro-carga (+1kg/+2kg) com descida em 2 a 3 segundos.", plateaus.get(0).exerciseName());
        }
        if (!progressions.isEmpty()) {
            return String.format("Consolidar %s: manter carga com 2 a 3s na descida e descansar 2 a 3 minutos entre séries.", progressions.get(0).exerciseName());
        }
        return "Buscar +1 repetição na primeira série pesada mantendo cadência de 2 a 3 segundos na descida.";
    }

    private AcwrDto buildLocalizedAcwrDto(ProgressionMathEngine.AcwrAnalysis acwr, String lang) {
        if ("pt".equals(lang)) {
            return new AcwrDto(
                    acwr.acuteVolumeKg(),
                    acwr.chronicWeeklyVolumeKg(),
                    acwr.ratio(),
                    acwr.riskLevel().name(),
                    acwr.interpretation(),
                    acwr.recommendation()
            );
        }
        String interpretation;
        String recommendation;
        switch (acwr.riskLevel()) {
            case UNDER_TRAINING -> {
                interpretation = "Acute volume is below your chronic average (deload or under-stimulation phase).";
                recommendation = "Gradually increase working sets to avoid detraining or focus on crisp technique.";
            }
            case OPTIMAL -> {
                interpretation = "Physiological Sweet Spot (0.8 - 1.3): safe overload and optimal hypertrophy stimulus.";
                recommendation = "Maintain your pace with +1 rep or small micro-load progression.";
            }
            case OVERREACHING -> {
                interpretation = "Accelerated acute workload (+30% above chronic baseline). Monitor fatigue closely.";
                recommendation = "Prioritize sleep and nutrition; cut 1 accessory set if average RPE exceeds 9.";
            }
            case DANGER_ZONE -> {
                interpretation = "Danger Zone (ACWR >= 1.5): excessive acute fatigue spike detected.";
                recommendation = "Elevated injury risk. Schedule a light deload reducing next week's volume by 20%.";
            }
            default -> {
                interpretation = "Insufficient training history (minimum 2 logged workouts in 28 days).";
                recommendation = "Keep logging workouts consistently to unlock fatigue monitoring.";
            }
        }
        return new AcwrDto(
                acwr.acuteVolumeKg(),
                acwr.chronicWeeklyVolumeKg(),
                acwr.ratio(),
                acwr.riskLevel().name(),
                interpretation,
                recommendation
        );
    }

    private String formatProgressionsForPrompt(List<ProgressionMetricDto> progressions, String weightUnit) {
        if (progressions == null || progressions.isEmpty()) return "Nenhum dado anterior suficiente ainda.";
        StringBuilder sb = new StringBuilder();
        for (ProgressionMetricDto p : progressions.stream().limit(5).toList()) {
            sb.append(String.format("- %s (%s): 1RM Atual: %.1f%s | 1RM Anterior: %.1f%s | Delta: +%.1f%s (+%.1f%%)\n",
                    p.exerciseName(), p.muscleGroup(),
                    convertDisplayWeight(p.current1Rm(), weightUnit), weightUnit,
                    convertDisplayWeight(p.previous1Rm(), weightUnit), weightUnit,
                    convertDisplayWeight(p.delta1RmKg(), weightUnit), weightUnit,
                    p.delta1RmPercent()));
        }
        return sb.toString();
    }

    private String formatPlateausForPrompt(List<PlateauExerciseDto> plateaus, String weightUnit) {
        if (plateaus == null || plateaus.isEmpty()) return "Nenhum platô crítico detectado.";
        StringBuilder sb = new StringBuilder();
        for (PlateauExerciseDto p : plateaus) {
            sb.append(String.format("- %s na ficha '%s': %d treinos com %.1f%s x %d reps (RPE %.1f)\n",
                    p.exerciseName(), p.routineTitle(), p.consecutiveStagnantSessions(),
                    convertDisplayWeight(p.currentWeight(), weightUnit), weightUnit, p.currentReps(), p.averageRpe()));
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

    private void recordRateLimited() {
        if (rateLimitedCounter != null) {
            rateLimitedCounter.increment();
        }
    }

    private record CachedAnalysis(AiCoachAnalysisResponse response, Instant cachedAt, String stateHash) {}

    private record UserRateWindow(Instant windowStart, int count) {}

    private record AthleteMetricsSnapshot(
            int workoutsCount,
            String stateHash,
            ProgressionMathEngine.WeeklyVolumeAnalysis volumeAnalysis,
            ProgressionMathEngine.AcwrAnalysis acwrAnalysis,
            List<ProgressionMetricDto> topProgressions,
            List<PlateauExerciseDto> plateaus
    ) {}
}
