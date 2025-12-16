package com.stadium.auth_service.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.stadium.auth_service.dto.LoginRequest;
import com.stadium.auth_service.dto.LoginResponse;
import com.stadium.auth_service.entity.User;
import com.stadium.auth_service.service.UserService;
import com.stadium.auth_service.util.JwtUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;

import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthControllerTest {
    
    @Mock
    private UserService userService;
    
    @Mock
    private JwtUtil jwtUtil;
    
    @Mock
    private Authentication authentication;
    
    private AuthController authController;
    private ObjectMapper objectMapper;
    
    @BeforeEach
    void setUp() {
        authController = new AuthController(userService, jwtUtil);
        objectMapper = new ObjectMapper();
    }
    
    @Test
    void login_shouldReturnTokenForValidCredentials() {
        // Arrange
        LoginRequest request = new LoginRequest();
        request.setUsername("test@example.com");
        request.setPassword("password123");
        
        User mockUser = User.builder()
                .id(1)
                .username("test@example.com")
                .password("encodedPassword")
                .role("security")
                .status("active")
                .build();
        
        when(userService.findByUsername("test@example.com")).thenReturn(Optional.of(mockUser));
        when(userService.checkPassword(mockUser, "password123")).thenReturn(true);
        when(jwtUtil.generateToken(1, "test@example.com", "security")).thenReturn("mock.jwt.token");
        
        // Act
        ResponseEntity<?> response = authController.login(request);
        
        // Assert
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        
        if (response.getBody() instanceof LoginResponse) {
            LoginResponse loginResponse = (LoginResponse) response.getBody();
            assertEquals("mock.jwt.token", loginResponse.getToken());
            assertEquals(1, loginResponse.getUser_id());
            assertEquals("security", loginResponse.getRole());
        }
    }
    
    @Test
    void login_shouldReturn401ForInvalidCredentials() {
        // Arrange
        LoginRequest request = new LoginRequest();
        request.setUsername("test@example.com");
        request.setPassword("wrongpassword");
        
        User mockUser = User.builder()
                .id(1)
                .username("test@example.com")
                .password("encodedPassword")
                .build();
        
        when(userService.findByUsername("test@example.com")).thenReturn(Optional.of(mockUser));
        when(userService.checkPassword(mockUser, "wrongpassword")).thenReturn(false);
        
        // Act
        ResponseEntity<?> response = authController.login(request);
        
        // Assert
        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
        assertTrue(response.getBody() instanceof Map);
        Map<?, ?> body = (Map<?, ?>) response.getBody();
        assertEquals("invalid_credentials", body.get("error"));
    }
    
    @Test
    void login_shouldReturn403ForInactiveUser() {
        // Arrange
        LoginRequest request = new LoginRequest();
        request.setUsername("inactive@example.com");
        request.setPassword("password123");
        
        User mockUser = User.builder()
                .id(1)
                .username("inactive@example.com")
                .password("encodedPassword")
                .role("security")
                .status("inactive")
                .build();
        
        when(userService.findByUsername("inactive@example.com")).thenReturn(Optional.of(mockUser));
        when(userService.checkPassword(mockUser, "password123")).thenReturn(true);
        
        // Act
        ResponseEntity<?> response = authController.login(request);
        
        // Assert
        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
        assertTrue(response.getBody() instanceof Map);
        Map<?, ?> body = (Map<?, ?>) response.getBody();
        assertEquals("user_not_active", body.get("error"));
    }
    
    @Test
    void validateToken_shouldReturnClaimsForValidToken() {
        // Arrange
        String token = "valid.jwt.token";
        String authHeader = "Bearer " + token;
        
        when(jwtUtil.getClaims(token)).thenReturn(mock(io.jsonwebtoken.Claims.class));
        when(jwtUtil.getClaims(token).getSubject()).thenReturn("123");
        when(jwtUtil.getClaims(token).get("username")).thenReturn("test@example.com");
        when(jwtUtil.getClaims(token).get("role")).thenReturn("security");
        when(jwtUtil.getClaims(token).getExpiration()).thenReturn(new java.util.Date());
        
        // Act
        ResponseEntity<?> response = authController.validateToken(authHeader);
        
        // Assert
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertTrue(response.getBody() instanceof Map);
    }
    
    @Test
    void me_shouldReturnUserIdFromAuthentication() {
        // Arrange
        when(authentication.getPrincipal()).thenReturn("123");
        
        // Act
        ResponseEntity<?> response = authController.me(authentication);
        
        // Assert
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertTrue(response.getBody() instanceof Map);
        Map<?, ?> body = (Map<?, ?>) response.getBody();
        assertEquals("123", body.get("userId"));
    }
}