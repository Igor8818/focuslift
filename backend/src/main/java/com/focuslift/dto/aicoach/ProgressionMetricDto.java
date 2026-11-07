package com.focuslift.dto.aicoach;

public record ProgressionMetricDto(
        String exerciseName,
        String muscleGroup,
        double current1Rm,
        double previous1Rm,
        double delta1RmKg,
        double delta1RmPercent,
        double currentTopWeight,
        int currentTopReps,
        double previousTopWeight,
        int previousTopReps
) {}
