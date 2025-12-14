// src/test/java/com/stadium/auth_service/controller/AuthControllerTest.java
package com.stadium.auth_service.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.stadium.auth_service.dto.LoginRequest;
import com.stadium.auth_service.entity.User;
import com.stadium.auth_service.service.UserService;
import com.stadium.auth_service.util.JwtUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(AuthController.class)
@Import({com.stadium.auth_service.config.SecurityConfig.class, com.stadium.auth_service.TestConfig.class})
@ActiveProfiles("test")
class AuthControllerTest {
    
    @Autowired
    private MockMvc mockMvc;
    
    @Autowired
    private ObjectMapper objectMapper;
    
    @MockBean
    private UserService userService;
    
    @MockBean
    private com.stadium.auth_service.config.JwtAuthenticationFilter jwtAuthenticationFilter;
    
    @Autowired
    private JwtUtil jwtUtil;
    
    private User testUser;
    private String validToken;
    
    @BeforeEach
    void setUp() {
        testUser = User.builder()
                .id(1)
                .username("test@example.com")
                .password("encodedPassword")
                .name("Test User")
                .role("USER")
                .status("active")
                .build();
        
        validToken = jwtUtil.generateToken(testUser.getId(), testUser.getUsername(), testUser.getRole());
    }
    
    @Test
    void login_ShouldReturnToken_WhenCredentialsAreValid() throws Exception {
        LoginRequest loginRequest = new LoginRequest();
        loginRequest.setUsername("test@example.com");
        loginRequest.setPassword("password123");
        
        when(userService.findByUsername(anyString())).thenReturn(Optional.of(testUser));
        when(userService.checkPassword(any(User.class), anyString())).thenReturn(true);
        
        mockMvc.perform(post("/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(loginRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").exists())
                .andExpect(jsonPath("$.user_id").value(1))
                .andExpect(jsonPath("$.role").value("USER"));
    }
    
    @Test
    void login_ShouldReturn401_WhenCredentialsAreInvalid() throws Exception {
        LoginRequest loginRequest = new LoginRequest();
        loginRequest.setUsername("test@example.com");
        loginRequest.setPassword("wrongPassword");
        
        when(userService.findByUsername(anyString())).thenReturn(Optional.of(testUser));
        when(userService.checkPassword(any(User.class), anyString())).thenReturn(false);
        
        mockMvc.perform(post("/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(loginRequest)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("invalid_credentials"));
    }
    
    @Test
    void login_ShouldReturn403_WhenUserIsInactive() throws Exception {
        LoginRequest loginRequest = new LoginRequest();
        loginRequest.setUsername("test@example.com");
        loginRequest.setPassword("password123");
        
        User inactiveUser = User.builder()
                .id(1)
                .username("test@example.com")
                .password("encodedPassword")
                .name("Test User")
                .role("USER")
                .status("inactive")
                .build();
        
        when(userService.findByUsername(anyString())).thenReturn(Optional.of(inactiveUser));
        when(userService.checkPassword(any(User.class), anyString())).thenReturn(true);
        
        mockMvc.perform(post("/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(loginRequest)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value("user_not_active"));
    }
    
    @Test
    void validateToken_ShouldReturnClaims_WhenTokenIsValid() throws Exception {
        mockMvc.perform(post("/auth/validate")
                .header("Authorization", "Bearer " + validToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user_id").value(1))
                .andExpect(jsonPath("$.username").value("test@example.com"))
                .andExpect(jsonPath("$.role").value("USER"))
                .andExpect(jsonPath("$.exp").exists());
    }
    
    @Test
    void validateToken_ShouldReturn401_WhenTokenIsInvalid() throws Exception {
        mockMvc.perform(post("/auth/validate")
                .header("Authorization", "Bearer invalid.token.here"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.valid").value(false))
                .andExpect(jsonPath("$.error").exists());
    }
    
    @Test
    void validateToken_ShouldReturn400_WhenHeaderIsMissing() throws Exception {
        mockMvc.perform(post("/auth/validate"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("missing_authorization_header"));
    }
    
    @Test
    void validateToken_ShouldReturn400_WhenHeaderHasWrongFormat() throws Exception {
        mockMvc.perform(post("/auth/validate")
                .header("Authorization", "InvalidFormat"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("missing_authorization_header"));
    }
}