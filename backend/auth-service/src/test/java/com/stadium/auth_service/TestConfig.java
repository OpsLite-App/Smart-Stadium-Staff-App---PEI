// src/test/java/com/stadium/auth_service/TestConfig.java
package com.stadium.auth_service;

import com.stadium.auth_service.util.JwtUtil;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;

@TestConfiguration
public class TestConfig {
    
    @Bean
    @Primary  // Use this JwtUtil for tests instead of the production one
    public JwtUtil testJwtUtil() {
        return new JwtUtil("test-secret-key-123456789012345678901234567890", 3600000L);
    }
}