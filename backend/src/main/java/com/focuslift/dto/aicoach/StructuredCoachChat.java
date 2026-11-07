package com.focuslift.dto.aicoach;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public record StructuredCoachChat(
        String answer,
        List<String> keyTakeaways
) {}
