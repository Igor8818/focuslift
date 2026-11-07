package com.focuslift.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.focuslift.domain.model.User;
import com.focuslift.domain.model.Workout;
import com.focuslift.dto.aicoach.AiCoachAnalysisResponse;
import com.focuslift.dto.aicoach.AiCoachChatRequest;
import com.focuslift.dto.aicoach.AiCoachChatResponse;
import com.focuslift.repository.WorkoutRepository;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AiCoachServiceTest {

    @Mock
    private WorkoutRepository workoutRepository;

    private ProgressionMathEngine mathEngine;
    private ObjectMapper objectMapper;
    private SimpleMeterRegistry meterRegistry;
    private AiCoachService aiCoachService;

    @BeforeEach
    void setUp() {
        mathEngine = new ProgressionMathEngine();
        objectMapper = new ObjectMapper();
        meterRegistry = new SimpleMeterRegistry();
        aiCoachService = new AiCoachService(mathEngine, workoutRepository, objectMapper, new AiResponseValidator(), meterRegistry);
        ReflectionTestUtils.setField(aiCoachService, "geminiApiKey", ""); // Modo fallback determinístico
        ReflectionTestUtils.setField(aiCoachService, "geminiModel", "gemini-2.5-flash");
        ReflectionTestUtils.setField(aiCoachService, "geminiBaseUrl", "https://generativelanguage.googleapis.com/v1beta/models");
    }

    @Test
    @DisplayName("analyzeProgress deve gerar diagnóstico completo com ACWR e acionar contador de fallback")
    void testAnalyzeProgressFallbackAndAcwr() {
        User user = new User("atleta@focuslift.com", "pass", "Igor", null);
        when(workoutRepository.findRecentWorkoutsWithDetails(eq(user), any())).thenReturn(List.of());

        AiCoachAnalysisResponse response = aiCoachService.analyzeProgress(user);

        assertThat(response).isNotNull();
        assertThat(response.athleteName()).isEqualTo("Igor");
        assertThat(response.aiSummary()).contains("Fala, Igor!");
        assertThat(response.tacticalAdvice()).isNotBlank();
        assertThat(response.nextSessionFocus()).isNotBlank();
        assertThat(response.acwr()).isNotNull();
        assertThat(response.acwr().riskLevel()).isEqualTo("INSUFFICIENT_DATA");

        // Verifica incremento da métrica do Micrometer
        double fallbackCount = meterRegistry.get("ai.coach.fallback.count").counter().count();
        assertThat(fallbackCount).isEqualTo(1.0);
    }

    @Test
    @DisplayName("analyzeProgress deve utilizar cache em memória para estados inalterados do atleta")
    void testAnalyzeProgressCache() {
        User user = new User("atleta@focuslift.com", "pass", "Igor", null);
        ReflectionTestUtils.setField(user, "id", 42L);

        Workout w1 = new Workout(null, "w-1", "Treino A", LocalDate.now().toString(), null, BigDecimal.valueOf(1000));
        when(workoutRepository.findRecentWorkoutsWithDetails(eq(user), any())).thenReturn(List.of(w1));

        // Primeira chamada - popula cache
        AiCoachAnalysisResponse first = aiCoachService.analyzeProgress(user);
        // Segunda chamada imediata - consome cache
        AiCoachAnalysisResponse second = aiCoachService.analyzeProgress(user);

        assertThat(first).isNotNull();
        assertThat(second).isNotNull();
        assertThat(second.aiSummary()).isEqualTo(first.aiSummary());
        // WorkoutRepository é chamado para checagem de estado, mas o resultado analítico é preservado do cache
        verify(workoutRepository, times(2)).findRecentWorkoutsWithDetails(eq(user), any());
    }

    @Test
    @DisplayName("chatWithCoach deve responder dúvidas técnicas de treino e fornecer key takeaways")
    void testChatWithCoach() {
        User user = new User("atleta@focuslift.com", "pass", "Igor", null);
        when(workoutRepository.findRecentWorkoutsWithDetails(eq(user), any())).thenReturn(List.of());

        AiCoachChatRequest request = new AiCoachChatRequest("Como quebrar o platô no supino?", "Supino Reto com Barra");
        AiCoachChatResponse response = aiCoachService.chatWithCoach(user, request);

        assertThat(response).isNotNull();
        assertThat(response.answer()).isNotBlank();
        assertThat(response.answer()).contains("+1kg a +2kg");
        assertThat(response.answer()).contains("2 a 3 segundos");
        assertThat(response.answer()).contains("compostos");
        assertThat(response.keyTakeaways()).hasSize(3);
        assertThat(response.keyTakeaways().get(0)).contains("+1kg a +2kg");
        assertThat(response.keyTakeaways().get(1)).contains("2-3min");
        assertThat(response.keyTakeaways().get(2)).contains("2-3s");
    }
}
