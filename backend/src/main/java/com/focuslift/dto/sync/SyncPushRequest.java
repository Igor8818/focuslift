package com.focuslift.dto.sync;

import java.util.List;

public record SyncPushRequest(
        List<WorkoutSyncDto> workouts,
        List<RoutineSyncDto> routines,
        List<HabitSyncDto> habits,
        List<TombstoneSyncDto> tombstones
) {}
