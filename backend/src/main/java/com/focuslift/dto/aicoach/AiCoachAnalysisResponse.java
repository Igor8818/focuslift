package com.focuslift.dto.aicoach;

import java.util.List;

public record AiCoachAnalysisResponse(
        String athleteName,
        int analyzedWorkoutsCount,
        double currentWeekVolumeKg,
        double previousWeekVolumeKg,
        double volumeDeltaPercent,
        List<ProgressionMetricDto> topProgressions,
        List<PlateauExerciseDto> detectedPlateaus,
        String aiSummary,
        String tacticalAdvice,
        String nextSessionFocus,
        String generatedAt,
        AcwrDto acwr
) {
    public AiCoachAnalysisResponse(
            String athleteName,
            int analyzedWorkoutsCount,
            double currentWeekVolumeKg,
            double previousWeekVolumeKg,
            double volumeDeltaPercent,
            List<ProgressionMetricDto> topProgressions,
            List<PlateauExerciseDto> detectedPlateaus,
            String aiSummary,
            String tacticalAdvice,
            String nextSessionFocus,
            String generatedAt
    ) {
        this(athleteName, analyzedWorkoutsCount, currentWeekVolumeKg, previousWeekVolumeKg, volumeDeltaPercent,
                topProgressions, detectedPlateaus, aiSummary, tacticalAdvice, nextSessionFocus, generatedAt, null);
    }
}
