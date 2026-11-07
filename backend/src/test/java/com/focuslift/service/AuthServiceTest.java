package com.focuslift.service;

import com.focuslift.domain.model.User;
import com.focuslift.dto.auth.AuthResponse;
import com.focuslift.dto.auth.RegisterRequest;
import com.focuslift.repository.UserRepository;
import com.focuslift.security.JwtService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private JwtService jwtService;

    @Mock
    private AuthenticationManager authenticationManager;

    private AuthService authService;

    @BeforeEach
    void setUp() {
        authService = new AuthService(userRepository, passwordEncoder, jwtService, authenticationManager);
        ReflectionTestUtils.setField(authService, "jwtExpiration", 86400000L);
    }

    @Test
    @DisplayName("register deve criar usuário com senha criptografada e retornar tokens JWT")
    void testRegisterSuccess() {
        RegisterRequest req = new RegisterRequest("teste@focuslift.com", "senha123", "Igor Dev");

        when(userRepository.existsByEmail("teste@focuslift.com")).thenReturn(false);
        when(passwordEncoder.encode("senha123")).thenReturn("hash_bcrypt_123");
        when(userRepository.save(any(User.class))).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            u.setId(1L);
            return u;
        });
        when(jwtService.generateToken(any())).thenReturn("access_token_jwt");
        when(jwtService.generateRefreshToken(any())).thenReturn("refresh_token_jwt");

        AuthResponse res = authService.register(req);

        assertThat(res).isNotNull();
        assertThat(res.accessToken()).isEqualTo("access_token_jwt");
        assertThat(res.refreshToken()).isEqualTo("refresh_token_jwt");
        assertThat(res.user().email()).isEqualTo("teste@focuslift.com");
    }

    @Test
    @DisplayName("register deve lançar exceção ao tentar cadastrar e-mail duplicado")
    void testRegisterDuplicateEmail() {
        RegisterRequest req = new RegisterRequest("existente@focuslift.com", "senha123", "Igor");
        when(userRepository.existsByEmail("existente@focuslift.com")).thenReturn(true);

        assertThatThrownBy(() -> authService.register(req))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("já está cadastrado");
    }
}
