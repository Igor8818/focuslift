package com.focuslift.dto.sync;

import java.math.BigDecimal;

public record SetSyncDto(
        Long id,
        BigDecimal weight,
        Integer reps,
        BigDecimal rpe,
        String setType,
        String completedAt,
        Integer orderIndex
) {}
