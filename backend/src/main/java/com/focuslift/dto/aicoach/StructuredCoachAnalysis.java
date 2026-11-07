package com.focuslift.dto.aicoach;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record StructuredCoachAnalysis(
        String summary,
        String tacticalAdvice,
        String nextSessionFocus
) {}
