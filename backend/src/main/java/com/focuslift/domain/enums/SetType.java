package com.focuslift.domain.enums;

public enum SetType {
    NORMAL,
    WARMUP,
    DROP,
    FAILURE;

    public static SetType fromString(String val) {
        if (val == null || val.isBlank()) {
            return NORMAL;
        }
        try {
            return SetType.valueOf(val.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return NORMAL;
        }
    }
}
