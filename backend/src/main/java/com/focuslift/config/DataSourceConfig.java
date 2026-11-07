package com.focuslift.config;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.autoconfigure.jdbc.DataSourceProperties;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.util.StringUtils;

import javax.sql.DataSource;
import java.net.URI;

/**
 * Configuracao flexivel de DataSource para ambientes locais e Cloud (Render, Railway, Neon, Supabase, Heroku).
 *
 * Suporta automaticamente:
 * 1. URLs padrao Spring/JDBC (jdbc:postgresql://...)
 * 2. URLs no formato de provedores Cloud (DATABASE_URL=postgres://user:pass@host:port/dbname)
 * 3. Ambientes de teste locais em memoria (H2)
 */
@Configuration
public class DataSourceConfig {

    private static final Logger log = LoggerFactory.getLogger(DataSourceConfig.class);

    @Bean
    @Primary
    @ConfigurationProperties("spring.datasource")
    public DataSourceProperties dataSourceProperties() {
        return new DataSourceProperties();
    }

    @Bean
    @Primary
    public DataSource dataSource(DataSourceProperties properties) {
        String rawUrl = System.getenv("DATABASE_URL");
        if (!StringUtils.hasText(rawUrl)) {
            rawUrl = properties.getUrl();
        }

        HikariConfig hikariConfig = new HikariConfig();

        // Tratamento para URLs de nuvem (Render, Railway, Neon, Supabase) que comecam com postgres:// ou postgresql://
        if (StringUtils.hasText(rawUrl) && (rawUrl.startsWith("postgres://") || (rawUrl.startsWith("postgresql://") && !rawUrl.startsWith("jdbc:")))) {
            try {
                URI uri = new URI(rawUrl.replace("postgres://", "http://").replace("postgresql://", "http://"));
                String host = uri.getHost();
                int port = uri.getPort() == -1 ? 5432 : uri.getPort();
                String path = uri.getPath(); // /dbname
                String jdbcUrl = "jdbc:postgresql://" + host + ":" + port + path;
                hikariConfig.setJdbcUrl(jdbcUrl);

                if (uri.getUserInfo() != null) {
                    String[] userPass = uri.getUserInfo().split(":", 2);
                    hikariConfig.setUsername(userPass[0]);
                    if (userPass.length > 1) {
                        hikariConfig.setPassword(userPass[1]);
                    }
                }
                hikariConfig.setDriverClassName("org.postgresql.Driver");
                log.info("Detected cloud DATABASE_URL. Formatted to JDBC target: jdbc:postgresql://{}:{}{}", host, port, path);
            } catch (Exception e) {
                log.warn("Failed to parse cloud DATABASE_URL URI, falling back to standard format", e);
                hikariConfig.setJdbcUrl(rawUrl.startsWith("jdbc:") ? rawUrl : "jdbc:" + rawUrl);
                hikariConfig.setUsername(properties.getUsername());
                hikariConfig.setPassword(properties.getPassword());
                hikariConfig.setDriverClassName(StringUtils.hasText(properties.getDriverClassName()) ? properties.getDriverClassName() : "org.postgresql.Driver");
            }
        } else {
            // Caso normal (JDBC padrao ou banco H2 de testes)
            hikariConfig.setJdbcUrl(properties.determineUrl());
            hikariConfig.setUsername(properties.determineUsername());
            hikariConfig.setPassword(properties.determinePassword());
            if (StringUtils.hasText(properties.getDriverClassName())) {
                hikariConfig.setDriverClassName(properties.getDriverClassName());
            }
        }

        hikariConfig.setMaximumPoolSize(10);
        hikariConfig.setMinimumIdle(2);
        hikariConfig.setPoolName("FocusLiftHikariCP");

        return new HikariDataSource(hikariConfig);
    }
}
