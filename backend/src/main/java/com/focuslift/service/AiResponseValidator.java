package com.focuslift.service;

import com.focuslift.dto.aicoach.PlateauExerciseDto;
import com.focuslift.dto.aicoach.ProgressionMetricDto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Guardrail determinístico de validação e anti-alucinação de respostas do LLM (Gemini).
 *
 * Verifica:
 * 1. Consistência numérica estrita no relatório de análise (qualquer métrica histórica
 *    de carga/volume citada deve bater com os dados do ProgressionMathEngine).
 * 2. Sanidade numérica e segurança no chat consultivo (permite cálculos derivados de
 *    aquecimento, deload e progressão, bloqueando valores absurdos e termos proibidos).
 */
@Component
public class AiResponseValidator {

    private static final Logger log = LoggerFactory.getLogger(AiResponseValidator.class);

    private static final Pattern NUMBER_PATTERN = Pattern.compile("\\b\\d+(?:[.,]\\d+)?\\b");
    private static final double MAX_HUMAN_CHAT_NUMBER = 25000.0;

    // Constantes pedagógicas permitidas em respostas de treino (micro-cargas, descanso, séries, cadência)
    private static final Set<Double> SAFE_PEDAGOGICAL_CONSTANTS = Set.of(
            1.0, 1.5, 2.0, 2.5, 3.0, 4.0, 5.0, 6.0, 8.0, 10.0, 12.0, 15.0, 20.0, // micro-cargas, reps, deload %
            60.0, 90.0, 120.0, 180.0, // descansos em segundos
            0.8, 1.3 // limiares padrão do modelo ACWR de Tim Gabbett
    );

    private static final List<String> FORBIDDEN_KEYWORDS = List.of(
            "durateston", "trembolona", "oxandrolona", "stanozolol", "hemogenin", "anabolizante",
            "prescricao medica", "prescrição médica", "receita medica", "receita médica",
            "ignore previous instructions", "ignorar instrucoes", "ignorar instruções"
    );

    public record ValidationResult(boolean isValid, String reason) {
        public static ValidationResult valid() {
            return new ValidationResult(true, "Válido");
        }

        public static ValidationResult invalid(String reason) {
            return new ValidationResult(false, reason);
        }
    }

    /**
     * Valida o texto gerado pelo LLM para análise periódica com checagem estrita de ground truth.
     */
    public ValidationResult validateAnalysis(
            String text,
            ProgressionMathEngine.WeeklyVolumeAnalysis volume,
            ProgressionMathEngine.AcwrAnalysis acwr,
            List<ProgressionMetricDto> progressions,
            List<PlateauExerciseDto> plateaus,
            int analyzedWorkoutsCount
    ) {
        return validateAnalysis(text, volume, acwr, progressions, plateaus, analyzedWorkoutsCount, "kg");
    }

    public ValidationResult validateAnalysis(
            String text,
            ProgressionMathEngine.WeeklyVolumeAnalysis volume,
            ProgressionMathEngine.AcwrAnalysis acwr,
            List<ProgressionMetricDto> progressions,
            List<PlateauExerciseDto> plateaus,
            int analyzedWorkoutsCount,
            String unit
    ) {
        if (text == null || text.isBlank()) {
            return ValidationResult.invalid("Texto gerado está vazio");
        }

        ValidationResult safetyCheck = checkSafetyAndForbiddenTerms(text);
        if (!safetyCheck.isValid()) {
            return safetyCheck;
        }

        Set<Double> groundTruthNumbers = buildGroundTruthNumbers(volume, acwr, progressions, plateaus, analyzedWorkoutsCount);
        if ("lbs".equalsIgnoreCase(unit)) {
            Set<Double> imperialNumbers = new HashSet<>();
            for (Double n : groundTruthNumbers) {
                imperialNumbers.add(Math.round(n * 2.20462 * 10.0) / 10.0);
            }
            groundTruthNumbers.addAll(imperialNumbers);
        }
        return validateNumbersAgainstGroundTruth(text, groundTruthNumbers);
    }

    /**
     * Valida a resposta do chat interativo do Coach.
     * Permite cálculos derivados legítimos (aquecimento, deload, metas futuras),
     * bloqueando termos proibidos e números fisicamente absurdos.
     */
    public ValidationResult validateChatResponse(
            String text,
            List<ProgressionMetricDto> progressions,
            List<PlateauExerciseDto> plateaus,
            int analyzedWorkoutsCount
    ) {
        if (text == null || text.isBlank()) {
            return ValidationResult.invalid("Resposta do chat está vazia");
        }

        ValidationResult safetyCheck = checkSafetyAndForbiddenTerms(text);
        if (!safetyCheck.isValid()) {
            return safetyCheck;
        }

        return validateChatNumericSanity(text);
    }

    private ValidationResult checkSafetyAndForbiddenTerms(String text) {
        String lower = text.toLowerCase();
        for (String forbidden : FORBIDDEN_KEYWORDS) {
            if (lower.contains(forbidden)) {
                log.warn("[AiResponseValidator] Termo proibido detectado na resposta do LLM: '{}'", forbidden);
                return ValidationResult.invalid("Resposta contém termo proibido ou violação de política: " + forbidden);
            }
        }
        return ValidationResult.valid();
    }

    private ValidationResult validateChatNumericSanity(String text) {
        Matcher matcher = NUMBER_PATTERN.matcher(text);

        while (matcher.find()) {
            String rawNum = matcher.group().replace(',', '.');
            try {
                double parsed = Double.parseDouble(rawNum);
                double abs = Math.abs(parsed);

                if (abs > MAX_HUMAN_CHAT_NUMBER) {
                    log.warn("[AiResponseValidator] Número absurdo detectado no chat: {}", abs);
                    return ValidationResult.invalid("Número fora dos limites fisiológicos de treino: " + abs);
                }
            } catch (NumberFormatException ignored) {}
        }

        return ValidationResult.valid();
    }

    private Set<Double> buildGroundTruthNumbers(
            ProgressionMathEngine.WeeklyVolumeAnalysis volume,
            ProgressionMathEngine.AcwrAnalysis acwr,
            List<ProgressionMetricDto> progressions,
            List<PlateauExerciseDto> plateaus,
            int analyzedWorkoutsCount
    ) {
        Set<Double> numbers = new HashSet<>();
        numbers.add((double) analyzedWorkoutsCount);

        if (volume != null) {
            addNumber(numbers, volume.currentWeekVolume());
            addNumber(numbers, volume.previousWeekVolume());
            addNumber(numbers, volume.deltaPercent());
        }

        if (acwr != null) {
            addNumber(numbers, acwr.acuteVolumeKg());
            addNumber(numbers, acwr.chronicWeeklyVolumeKg());
            addNumber(numbers, acwr.ratio());
        }

        if (progressions != null) {
            for (ProgressionMetricDto p : progressions) {
                addNumber(numbers, p.current1Rm());
                addNumber(numbers, p.previous1Rm());
                addNumber(numbers, p.delta1RmKg());
                addNumber(numbers, p.delta1RmPercent());
                addNumber(numbers, p.currentTopWeight());
                addNumber(numbers, (double) p.currentTopReps());
                addNumber(numbers, p.previousTopWeight());
                addNumber(numbers, (double) p.previousTopReps());
            }
        }

        if (plateaus != null) {
            for (PlateauExerciseDto p : plateaus) {
                addNumber(numbers, (double) p.consecutiveStagnantSessions());
                addNumber(numbers, p.currentWeight());
                addNumber(numbers, (double) p.currentReps());
                addNumber(numbers, p.averageRpe());
            }
        }

        return numbers;
    }

    private void addNumber(Set<Double> set, double val) {
        if (!Double.isNaN(val) && !Double.isInfinite(val)) {
            set.add(Math.abs(val));
        }
    }

    private ValidationResult validateNumbersAgainstGroundTruth(String text, Set<Double> groundTruthNumbers) {
        Matcher matcher = NUMBER_PATTERN.matcher(text);

        while (matcher.find()) {
            String rawNum = matcher.group().replace(',', '.');
            try {
                double parsed = Double.parseDouble(rawNum);
                double abs = Math.abs(parsed);

                // Permite constantes pedagógicas seguras do treino (ex: 1kg, 2kg, 60s, 3min)
                if (SAFE_PEDAGOGICAL_CONSTANTS.contains(abs)) {
                    continue;
                }

                // Pequenos inteiros de 1 a 15 frequentemente representam números de lista ou pequenos contadores
                if (abs >= 1.0 && abs <= 15.0 && Math.floor(abs) == abs) {
                    continue;
                }

                // Para valores numéricos significativos (> 15.0 ou decimais), verifica se bate com os fatos matemáticos
                boolean matchesGroundTruth = false;
                for (Double truth : groundTruthNumbers) {
                    if (Math.abs(truth - abs) <= 0.6) { // tolerância de arredondamento de 0.6
                        matchesGroundTruth = true;
                        break;
                    }
                }

                if (!matchesGroundTruth) {
                    log.warn("[AiResponseValidator] Alucinação numérica detectada: valor {} não consta nos dados matemáticos reais {}",
                            abs, groundTruthNumbers);
                    return ValidationResult.invalid("Alucinação de métrica detectada: " + abs);
                }
            } catch (NumberFormatException ignored) {}
        }

        return ValidationResult.valid();
    }
}
