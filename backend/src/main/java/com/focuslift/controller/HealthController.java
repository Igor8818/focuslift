package com.focuslift.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/health")
@Tag(name = "Health Check", description = "Monitoramento do status do servidor")
public class HealthController {

    @GetMapping
    @Operation(summary = "Verifica se a API está online e operante")
    public ResponseEntity<Map<String, Object>> checkHealth() {
        return ResponseEntity.ok(Map.of(
                "status", "UP",
                "service", "FocusLift Gym Progression Cloud API",
                "timestamp", Instant.now().toString(),
                "version", "1.0.0"
        ));
    }
}
