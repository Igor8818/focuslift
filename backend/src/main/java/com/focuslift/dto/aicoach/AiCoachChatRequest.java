package com.focuslift.dto.aicoach;

import jakarta.validation.constraints.NotBlank;
import java.util.List;

public record AiCoachChatRequest(
        @NotBlank(message = "A pergunta ou dúvida não pode estar vazia")
        String question,
        String exerciseName,
        List<ChatMessageDto> history,
        String athleteContext,
        String language,
        String unit
) {
    public AiCoachChatRequest(String question, String exerciseName) {
        this(question, exerciseName, List.of(), null, "pt", "kg");
    }

    public AiCoachChatRequest(String question, String exerciseName, List<ChatMessageDto> history, String athleteContext) {
        this(question, exerciseName, history, athleteContext, "pt", "kg");
    }
}
