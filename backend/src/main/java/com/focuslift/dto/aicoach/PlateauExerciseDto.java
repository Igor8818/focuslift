package com.focuslift.dto.aicoach;

public record PlateauExerciseDto(
        String exerciseName,
        String routineTitle,
        int consecutiveStagnantSessions,
        double currentWeight,
        int currentReps,
        double averageRpe,
        String suggestedAction
) {}
