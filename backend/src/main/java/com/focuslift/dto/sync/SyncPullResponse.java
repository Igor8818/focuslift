package com.focuslift.dto.sync;

import java.util.List;

public record SyncPullResponse(
        List<WorkoutSyncDto> workouts,
        List<RoutineSyncDto> routines,
        List<HabitSyncDto> habits,
        String serverTimestamp
) {}
