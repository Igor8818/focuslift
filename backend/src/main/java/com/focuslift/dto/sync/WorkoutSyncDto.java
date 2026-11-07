package com.focuslift.dto.sync;

import java.math.BigDecimal;
import java.util.List;

public record WorkoutSyncDto(
        Long id,
        String clientUuid,
        String title,
        String date,
        String notes,
        BigDecimal totalVolumeKg,
        List<ExerciseSyncDto> exercises,
        String createdAt
) {}
