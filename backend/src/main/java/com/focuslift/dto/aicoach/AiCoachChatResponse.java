package com.focuslift.dto.aicoach;

import java.util.List;

public record AiCoachChatResponse(
        String answer,
        List<String> keyTakeaways,
        String timestamp
) {}
