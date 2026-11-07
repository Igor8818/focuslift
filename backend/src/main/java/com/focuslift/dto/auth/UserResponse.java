package com.focuslift.dto.auth;

public record UserResponse(
        Long id,
        String email,
        String name,
        String role,
        String createdAt
) {}
