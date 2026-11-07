package com.focuslift.dto.sync;

public record SyncPushResponse(
        boolean success,
        int workoutsSaved,
        int routinesSaved,
        int habitsSaved,
        int tombstonesProcessed,
        String serverTimestamp
) {}
