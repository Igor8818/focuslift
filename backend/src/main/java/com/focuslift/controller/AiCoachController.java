package com.focuslift.controller;

import com.focuslift.domain.model.User;
import com.focuslift.dto.aicoach.AiCoachAnalysisResponse;
import com.focuslift.dto.aicoach.AiCoachChatRequest;
import com.focuslift.dto.aicoach.AiCoachChatResponse;
import com.focuslift.security.UserPrincipal;
import com.focuslift.service.AiCoachService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/ai-coach")
@Tag(name = "AI Coach & Analytics", description = "Endpoints de análise inteligente de progressão de carga e chat com o treinador virtual")
@SecurityRequirement(name = "bearerAuth")
public class AiCoachController {

    private final AiCoachService aiCoachService;

    public AiCoachController(AiCoachService aiCoachService) {
        this.aiCoachService = aiCoachService;
    }

    @PostMapping("/analyze")
    @Operation(summary = "Gerar diagnóstico analítico completo de evolução de carga, volume e platôs")
    public ResponseEntity<AiCoachAnalysisResponse> analyzeProgress(
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        User user = principal.getUser();
        AiCoachAnalysisResponse response = aiCoachService.analyzeProgress(user);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/chat")
    @Operation(summary = "Conversar com o AI Coach tirando dúvidas específicas com base no seu histórico")
    public ResponseEntity<AiCoachChatResponse> chat(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody AiCoachChatRequest request
    ) {
        User user = principal.getUser();
        AiCoachChatResponse response = aiCoachService.chatWithCoach(user, request);
        return ResponseEntity.ok(response);
    }
}
