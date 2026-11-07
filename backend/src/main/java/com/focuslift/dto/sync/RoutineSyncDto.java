package com.focuslift.dto.sync;

import java.util.List;

public record RoutineSyncDto(
        Long id,
        String clientUuid,
        String name,
        String description,
        String color,
        List<RoutineExerciseSyncDto> exercises,
        String createdAt
) {}
