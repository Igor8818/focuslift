package com.focuslift.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    private static final String SECURITY_SCHEME_NAME = "bearerAuth";

    @Bean
    public OpenAPI customOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("FocusLift Gym Progression Cloud API")
                        .description("API RESTful desenvolvida em Java 21 + Spring Boot 3 para sincronização na nuvem de treinos e módulo AI Coach com cálculos determinísticos de 1RM e volume.")
                        .version("1.0.0")
                        .contact(new Contact().name("Igor Dev").url("https://github.com/Igor8818/focuslift"))
                        .license(new License().name("FocusLift Source-Available License").url("https://github.com/Igor8818/focuslift")))
                .addSecurityItem(new SecurityRequirement().addList(SECURITY_SCHEME_NAME))
                .components(new Components()
                        .addSecuritySchemes(SECURITY_SCHEME_NAME,
                                new SecurityScheme()
                                        .name(SECURITY_SCHEME_NAME)
                                        .type(SecurityScheme.Type.HTTP)
                                        .scheme("bearer")
                                        .bearerFormat("JWT")
                                        .description("Insira o token JWT gerado no endpoint /api/v1/auth/login ou /register")
                        ));
    }
}
