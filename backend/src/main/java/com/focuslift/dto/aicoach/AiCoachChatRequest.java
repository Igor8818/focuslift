package com.focuslift.dto.aicoach;

import jakarta.validation.constraints.NotBlank;

public record AiCoachChatRequest(
        @NotBlank(message = "A pergunta ou dúvida não pode estar vazia")
        String question,
        String exerciseName
) {}
