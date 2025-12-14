// src/test/java/com/stadium/auth_service/AuthServiceApplicationTest.java
package com.stadium.auth_service;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
@ActiveProfiles("test")
class AuthServiceApplicationTest {
    
    @Test
    void contextLoads() {
        // Simple test to verify Spring context loads successfully
        assertTrue(true);
    }
}