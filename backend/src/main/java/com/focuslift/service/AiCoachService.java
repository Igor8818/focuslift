package com.focuslift.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.focuslift.domain.model.User;
import com.focuslift.domain.model.Workout;
import com.focuslift.dto.aicoach.*;
import com.focuslift.repository.WorkoutRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
public class AiCoachService {

    private static final Logger log = LoggerFactory.getLogger(AiCoachService.class);

    private final ProgressionMathEngine mathEngine;
    private final WorkoutRepository workoutRepository;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    @Value("${application.ai.gemini.api-key:}")
    private String geminiApiKey;

    @Value("${application.ai.gemini.model:gemini-2.5-flash}")
    private String geminiModel;

    @Value("${application.ai.gemini.base-url:https://generativelanguage.googleapis.com/v1beta/models}")
    private String geminiBaseUrl;

    public AiCoachService(
            ProgressionMathEngine mathEngine,
            WorkoutRepository workoutRepository,
            ObjectMapper objectMapper
    ) {
        this.mathEngine = mathEngine;
        this.workoutRepository = workoutRepository;
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();
    }

    @Transactional(readOnly = true)
    public AiCoachAnalysisResponse analyzeProgress(User user) {
        String fourWeeksAgo = LocalDate.now().minusWeeks(4).toString();
        List<Workout> recentWorkouts = workoutRepository.findRecentWorkoutsWithDetails(user, fourWeeksAgo);

        ProgressionMathEngine.WeeklyVolumeAnalysis volumeAnalysis = mathEngine.analyzeWeeklyVolumes(recentWorkouts);
        List<ProgressionMetricDto> topProgressions = mathEngine.calculateTopProgressions(recentWorkouts);
        List<PlateauExerciseDto> plateaus = mathEngine.detectPlateaus(recentWorkouts);

        String athleteName = user.getName() != null && !user.getName().isBlank() ? user.getName() : "Atleta";

        // Gera prompt estruturado para o LLM
        String systemPrompt = buildAnalysisPrompt(athleteName, recentWorkouts.size(), volumeAnalysis, topProgressions, plateaus);

        String aiAnalysisText = callGeminiApi(systemPrompt);

        if (aiAnalysisText == null || aiAnalysisText.isBlank()) {
            aiAnalysisText = generateDeterministicFallbackAnalysis(athleteName, volumeAnalysis, topProgressions, plateaus);
        }

        String tacticalAdvice = generateTacticalAdvice(volumeAnalysis, topProgressions, plateaus);
        String nextSessionFocus = generateNextSessionFocus(topProgressions, plateaus);

        return new AiCoachAnalysisResponse(
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
                Instant.now().toString()
        );
    }

    @Transactional(readOnly = true)
    public AiCoachChatResponse chatWithCoach(User user, AiCoachChatRequest request) {
        String fourWeeksAgo = LocalDate.now().minusWeeks(4).toString();
        List<Workout> recentWorkouts = workoutRepository.findRecentWorkoutsWithDetails(user, fourWeeksAgo);

        List<ProgressionMetricDto> topProgressions = mathEngine.calculateTopProgressions(recentWorkouts);
        List<PlateauExerciseDto> plateaus = mathEngine.detectPlateaus(recentWorkouts);

        String athleteName = user.getName() != null && !user.getName().isBlank() ? user.getName() : "Atleta";

        String prompt = """
                Você é o FocusLift AI Coach, treinador prático de musculação focado em correções básicas de treino no celular.
                
                DADOS REAIS DO ATLETA (%s):
                - Total de treinos recentes: %d
                - Principais exercícios e 1RMs calculados:
                %s
                - Exercícios em platô detectados:
                %s
                
                PERGUNTA DO ATLETA:
                "%s"
                
                REGRAS ESTRITAS DE COMPORTAMENTO E FORMATO:
                1. LIMITAÇÃO A CORREÇÕES BÁSICAS DE TREINO:
                   - Sobrecarga progressiva simples: busque apenas +1 repetição com a carga atual ou micro-carga de +1kg a +2kg no total.
                   - Ajuste de descanso: estipule 2 a 3 minutos para exercícios compostos pesados e 60 a 90 segundos para exercícios isoladores.
                   - Cadência e controle excêntrico: oriente descida controlada em 2 a 3 segundos.
                   - Fadiga e deload simples: se houver fadiga acumulada ou estagnação persistente, recomende reduzir 1 série de trabalho ou deload simples.
                2. PROIBIÇÕES ABSOLUTAS:
                   - PROIBIDO receitar ou discutir planos alimentares, dietas complexas, macros, suplementos pesados ou medicamentos.
                   - PROIBIDO dissertações teóricas prolixas, textos longos ou jargões científicos densos.
                3. FORMATO ULTRACURTO PARA CELULAR:
                   - Responda em no máximo 2 a 3 parágrafos curtos OU 3 bullets objetivos e diretos para leitura rápida durante o treino no celular.
                4. ZERO ALUCINAÇÕES (REGRA MANDATÓRIA):
                   - NUNCA invente ou altere números de carga, séries, repetições ou 1RM além dos dados matemáticos fornecidos acima.
                """.formatted(
                athleteName,
                recentWorkouts.size(),
                formatProgressionsForPrompt(topProgressions),
                formatPlateausForPrompt(plateaus),
                request.question()
        );

        String aiAnswer = callGeminiApi(prompt);

        if (aiAnswer == null || aiAnswer.isBlank()) {
            aiAnswer = ("Olá, %s! Para a próxima sessão, aplique sobrecarga progressiva básica: busque +1 repetição com a carga atual ou adicione micro-carga de +1kg a +2kg na primeira série do exercício principal.\n\n"
                    + "Controle a descida excêntrica em 2 a 3 segundos e respeite os descansos: 2 a 3 minutos para compostos e 60 a 90 segundos para isoladores.\n\n"
                    + "Caso sinta fadiga alta ou estagnação no exercício, reduza 1 série de trabalho para acelerar a recuperação muscular.")
                    .formatted(athleteName);
        }

        List<String> keyTakeaways = List.of(
                "Sobrecarga simples: +1 repetição ou micro-carga (+1kg a +2kg)",
                "Descanso: 2-3min para compostos e 60-90s para isoladores",
                "Cadência: 2-3s na descida excêntrica e deload de 1 série se fadigado"
        );

        return new AiCoachChatResponse(aiAnswer, keyTakeaways, Instant.now().toString());
    }

    private String callGeminiApi(String prompt) {
        if (geminiApiKey == null || geminiApiKey.isBlank()) {
            log.info("[AiCoachService] GEMINI_API_KEY não configurada. Usando motor analítico determinístico.");
            return null;
        }

        try {
            String endpoint = String.format("%s/%s:generateContent?key=%s", geminiBaseUrl, geminiModel, geminiApiKey.trim());

            Map<String, Object> payload = Map.of(
                    "contents", List.of(
                            Map.of("parts", List.of(Map.of("text", prompt)))
                    ),
                    "generationConfig", Map.of(
                            "temperature", 0.4,
                            "maxOutputTokens", 800
                    )
            );

            String requestBody = objectMapper.writeValueAsString(payload);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(endpoint))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                    .timeout(Duration.ofSeconds(15))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() == 200) {
                JsonNode root = objectMapper.readTree(response.body());
                JsonNode textNode = root.at("/candidates/0/content/parts/0/text");
                if (!textNode.isMissingNode()) {
                    return textNode.asText().trim();
                }
            } else {
                log.warn("[AiCoachService] Resposta não-200 do Gemini API (status {}): {}", response.statusCode(), response.body());
            }
        } catch (Exception e) {
            log.warn("[AiCoachService] Falha ao comunicar com Gemini API: {}", e.getMessage());
        }
        return null;
    }

    private String buildAnalysisPrompt(
            String athleteName,
            int workoutsCount,
            ProgressionMathEngine.WeeklyVolumeAnalysis volume,
            List<ProgressionMetricDto> progressions,
            List<PlateauExerciseDto> plateaus
    ) {
        return """
                Você é o FocusLift AI Coach, treinador prático de musculação focado em correções básicas de treino no celular.
                Analise os dados matemáticos calculados deterministicamente abaixo para o atleta %s:
                
                METRICAS MATEMATICAS EXATAS (NÃO ALTERE ESTES VALORES):
                - Treinos analisados: %d
                - Volume da Semana Atual: %.1f kg
                - Volume da Semana Anterior: %.1f kg
                - Variação Semanal de Volume: %.1f%%
                
                PROGRESSÃO DE 1RM POR EXERCÍCIO (Brzycki Formula):
                %s
                
                EXERCÍCIOS EM PLATÔ (Estagnação >= 3 sessões):
                %s
                
                REGRAS ESTRITAS DE COMPORTAMENTO E FORMATO:
                1. LIMITAÇÃO A CORREÇÕES BÁSICAS DE TREINO:
                   - Sobrecarga progressiva simples: priorize micro-progressão de +1 repetição ou micro-carga de +1kg a +2kg.
                   - Ajuste de descanso: recomende 2 a 3 minutos para compostos pesados e 60 a 90 segundos para isoladores.
                   - Cadência e controle excêntrico: enfatize descida controlada em 2 a 3 segundos.
                   - Detecção de fadiga e deload simples: se o volume semanal aumentou excessivamente (>12%%) ou houver platô com RPE alto, oriente reduzir 1 série dos secundários ou deload leve.
                2. PROIBIÇÕES ABSOLUTAS:
                   - PROIBIDO receitar, prescrever ou discutir dietas complexas, planos nutricionais, suplementos pesados ou medicamentos.
                   - PROIBIDO dissertações teóricas prolixas, fisiologia acadêmica densa ou jargões complexos.
                3. FORMATO ULTRACURTO PARA CELULAR:
                   - Responda em no máximo 2 a 3 parágrafos curtos OU 3 bullets objetivos e diretos para leitura rápida no celular durante o treino.
                4. ZERO ALUCINAÇÕES DE CARGA (REGRA MANDATÓRIA):
                   - Cite EXATAMENTE os números de 1RM, volume e percentuais fornecidos acima. NUNCA calcule novos 1RMs nem invente números de carga ou repetições fora do relatório.
                """.formatted(
                athleteName,
                workoutsCount,
                volume.currentWeekVolume(),
                volume.previousWeekVolume(),
                volume.deltaPercent(),
                formatProgressionsForPrompt(progressions),
                formatPlateausForPrompt(plateaus)
        );
    }

    private String generateDeterministicFallbackAnalysis(
            String athleteName,
            ProgressionMathEngine.WeeklyVolumeAnalysis volume,
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
}
