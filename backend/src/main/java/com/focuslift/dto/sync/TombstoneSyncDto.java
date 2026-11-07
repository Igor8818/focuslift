package com.focuslift.dto.sync;

public record TombstoneSyncDto(
        String entityType,
        String clientUuid,
        String deletedAt
) {}
