package com.focuslift.controller;

import com.focuslift.domain.model.User;
import com.focuslift.dto.sync.SyncPullResponse;
import com.focuslift.dto.sync.SyncPushRequest;
import com.focuslift.dto.sync.SyncPushResponse;
import com.focuslift.security.UserPrincipal;
import com.focuslift.service.SyncService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/sync")
@Tag(name = "Sincronização Cloud", description = "Endpoints para sincronização bidirecional offline-first entre o app e a nuvem")
@SecurityRequirement(name = "bearerAuth")
public class SyncController {

    private final SyncService syncService;

    public SyncController(SyncService syncService) {
        this.syncService = syncService;
    }

    @PostMapping("/push")
    @Operation(summary = "Enviar delta incremental de treinos, fichas, hábitos e exclusões para a nuvem")
    public ResponseEntity<SyncPushResponse> pushSync(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestBody SyncPushRequest request
    ) {
        User user = principal.getUser();
        SyncPushResponse response = syncService.pushSync(user, request);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/pull")
    @Operation(summary = "Baixar snapshot consolidado de todos os dados do usuário para restauração")
    public ResponseEntity<SyncPullResponse> pullSync(
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        User user = principal.getUser();
        SyncPullResponse response = syncService.pullSync(user);
        return ResponseEntity.ok(response);
    }
}
