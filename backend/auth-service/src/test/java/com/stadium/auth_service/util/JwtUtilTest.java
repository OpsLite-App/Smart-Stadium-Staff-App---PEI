package com.stadium.auth_service.util;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;

import static org.junit.jupiter.api.Assertions.*;

@ExtendWith(MockitoExtension.class)
class JwtUtilTest {
    
    private JwtUtil jwtUtil;
    
    @BeforeEach
    void setUp() {
        // Using the same secret as in application.yml
        String secret = "kAunJxnJDr4BBsUSb38Typ2IEWU8gWR/Crp7RJ8NmLI=";
        long expirationMs = 3600000; // 1 hour
        jwtUtil = new JwtUtil(secret, expirationMs);
    }
    
    @Test
    void generateToken_shouldGenerateValidToken() {
        // Arrange
        Integer userId = 123;
        String username = "test@example.com";
        String role = "security";
        
        // Act
        String token = jwtUtil.generateToken(userId, username, role);
        
        // Assert
        assertNotNull(token);
        assertFalse(token.isEmpty());
    }
    
    @Test
    void getClaims_shouldExtractClaimsFromValidToken() {
        // Arrange
        Integer userId = 123;
        String username = "test@example.com";
        String role = "security";
        String token = jwtUtil.generateToken(userId, username, role);
        
        // Act
        Claims claims = jwtUtil.getClaims(token);
        
        // Assert
        assertEquals(String.valueOf(userId), claims.getSubject());
        assertEquals(username, claims.get("username"));
        assertEquals(role, claims.get("role"));
        assertNotNull(claims.getExpiration());
    }
    
    @Test
    void validateToken_shouldThrowExceptionForInvalidToken() {
        // Arrange
        String invalidToken = "invalid.token.here";
        
        // Act & Assert
        assertThrows(JwtException.class, () -> {
            jwtUtil.validateToken(invalidToken);
        });
    }
}