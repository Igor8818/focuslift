package com.focuslift.dto.sync;

import java.util.List;

public record ExerciseSyncDto(
        Long id,
        String name,
        String muscleGroup,
        Integer restTimerSeconds,
        Integer orderIndex,
        List<SetSyncDto> sets
) {}
