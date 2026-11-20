package com.focuslift.service;

import com.focuslift.domain.enums.Role;
import com.focuslift.domain.model.User;
import com.focuslift.dto.auth.AuthResponse;
import com.focuslift.dto.auth.LoginRequest;
import com.focuslift.dto.auth.RefreshTokenRequest;
import com.focuslift.dto.auth.RegisterRequest;
import com.focuslift.dto.auth.UserResponse;
import com.focuslift.repository.UserRepository;
import com.focuslift.security.JwtService;
import com.focuslift.security.UserPrincipal;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuthenticationManager authenticationManager;

    @Value("${application.security.jwt.expiration}")
    private long jwtExpiration;

    public AuthService(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            AuthenticationManager authenticationManager
    ) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.authenticationManager = authenticationManager;
    }

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        String cleanEmail = request.email().trim().toLowerCase();
        if (userRepository.existsByEmail(cleanEmail)) {
            throw new IllegalArgumentException("O e-mail informado já está cadastrado no FocusLift.");
        }

        User user = new User(
                cleanEmail,
                passwordEncoder.encode(request.password()),
                request.name() != null ? request.name().trim() : null,
                Role.USER
        );
        User savedUser = userRepository.save(user);

        UserPrincipal principal = new UserPrincipal(savedUser);
        String accessToken = jwtService.generateToken(principal);
        String refreshToken = jwtService.generateRefreshToken(principal);

        return AuthResponse.of(accessToken, refreshToken, jwtExpiration, toUserResponse(savedUser));
    }

    public AuthResponse login(LoginRequest request) {
        String cleanEmail = request.email().trim().toLowerCase();
        Authentication auth = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(cleanEmail, request.password())
        );

        UserPrincipal principal = (UserPrincipal) auth.getPrincipal();
        User user = principal.getUser();

        String accessToken = jwtService.generateToken(principal);
        String refreshToken = jwtService.generateRefreshToken(principal);

        return AuthResponse.of(accessToken, refreshToken, jwtExpiration, toUserResponse(user));
    }

    public AuthResponse refreshToken(RefreshTokenRequest request) {
        String token = request.refreshToken().trim();
        String email = jwtService.extractUsername(token);
        if (email == null || email.isBlank()) {
            throw new IllegalArgumentException("Refresh token inválido");
        }

        User user = userRepository.findByEmail(email.trim().toLowerCase())
                .orElseThrow(() -> new IllegalArgumentException("Usuário não encontrado ou token inválido"));

        UserPrincipal principal = new UserPrincipal(user);
        if (!jwtService.isRefreshTokenValid(token, principal)) {
            throw new IllegalArgumentException("Refresh token expirado ou inválido");
        }

        String accessToken = jwtService.generateToken(principal);
        String newRefreshToken = jwtService.generateRefreshToken(principal);

        return AuthResponse.of(accessToken, newRefreshToken, jwtExpiration, toUserResponse(user));
    }

    @Transactional
    public void deleteAccount(User user) {
        if (user == null || user.getId() == null) {
            throw new IllegalArgumentException("Usuário inválido para exclusão");
        }
        userRepository.deleteById(user.getId());
    }

    public UserResponse toUserResponse(User user) {
        return new UserResponse(
                user.getId(),
                user.getEmail(),
                user.getName(),
                user.getRole().name(),
                user.getCreatedAt().toString()
        );
    }
}
