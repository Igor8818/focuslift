package com.focuslift.dto.aicoach;

public record AcwrDto(
        double acuteVolumeKg,
        double chronicWeeklyVolumeKg,
        double ratio,
        String riskLevel,
        String interpretation,
        String recommendation
) {}
