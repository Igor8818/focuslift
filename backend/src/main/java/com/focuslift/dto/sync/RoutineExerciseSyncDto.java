package com.focuslift.dto.sync;

public record RoutineExerciseSyncDto(
        Long id,
        String exerciseName,
        String muscleGroup,
        Integer targetSets,
        Integer restTimerSeconds,
        Integer orderIndex
) {}
