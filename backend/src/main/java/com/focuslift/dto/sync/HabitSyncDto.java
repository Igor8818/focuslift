package com.focuslift.dto.sync;

public record HabitSyncDto(
        Long id,
        String date,
        Integer proteinDone,
        Integer waterDone,
        Integer workoutDone,
        Integer mealsDone,
        Integer streakCount,
        Integer waterCurrentMl,
        Integer waterTargetMl,
        Integer proteinCurrentG,
        Integer proteinTargetG
) {}
