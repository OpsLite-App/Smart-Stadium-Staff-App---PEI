package com.stadium.auth_service.util;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.*;

@ExtendWith(MockitoExtension.class)
class JwtUtilTest {
    
    private JwtUtil jwtUtil;
    
    @BeforeEach
    void setUp() {
        jwtUtil = new JwtUtil("test-secret-key-123456789012345678901234567890", 3600000L);
    }
    
    @Test
    void generateToken_ShouldReturnValidToken() {
        // Given
        Integer userId = 1;
        String username = "testuser";
        String role = "ADMIN";
        
        // When
        String token = jwtUtil.generateToken(userId, username, role);
        
        // Then
        assertNotNull(token);
        assertFalse(token.isEmpty());
    }
    
    @Test
    void getClaims_ShouldReturnCorrectClaims_WhenTokenIsValid() {
        // Given
        Integer userId = 1;
        String username = "testuser";
        String role = "ADMIN";
        String token = jwtUtil.generateToken(userId, username, role);
        
        // When
        Claims claims = jwtUtil.getClaims(token);
        
        // Then
        assertEquals(userId.toString(), claims.getSubject());
        assertEquals(username, claims.get("username"));
        assertEquals(role, claims.get("role"));
        assertNotNull(claims.getIssuedAt());
        assertNotNull(claims.getExpiration());
    }
    
    @Test
    void validateToken_ShouldThrowException_WhenTokenIsInvalid() {
        // Given
        String invalidToken = "invalid.token.string";
        
        // When & Then
        assertThrows(JwtException.class, () -> jwtUtil.validateToken(invalidToken));
    }
    
    @Test
    void generateToken_WithDifferentUsers_ShouldCreateUniqueTokens() {
        // Given
        String token1 = jwtUtil.generateToken(1, "user1", "USER");
        String token2 = jwtUtil.generateToken(2, "user2", "ADMIN");
        
        // Then
        assertNotEquals(token1, token2);
    }
}