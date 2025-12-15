package com.stadium.auth_service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.stadium.auth_service.dto.LoginRequest;
import com.stadium.auth_service.entity.User;
import com.stadium.auth_service.repository.UserRepository;
import com.stadium.auth_service.util.JwtUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")  // Use test profile
@Transactional  // Rollback database changes after each test
public class AuthServiceIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtUtil jwtUtil;

    private User activeUser;
    private User inactiveUser;

    @BeforeEach
    void setUp() {
        // No need to delete all - @Transactional will handle rollback
        
        activeUser = User.builder()
                .username("active@example.com")
                .password(passwordEncoder.encode("password123"))
                .name("Active User")
                .role("USER")
                .status("active")
                .build();

        inactiveUser = User.builder()
                .username("inactive@example.com")
                .password(passwordEncoder.encode("password123"))
                .name("Inactive User")
                .role("USER")
                .status("inactive")
                .build();

        // Save users
        activeUser = userRepository.save(activeUser);
        inactiveUser = userRepository.save(inactiveUser);
    }

    @Test
    void testLoginSuccess() throws Exception {
        LoginRequest request = new LoginRequest();
        request.setUsername("active@example.com");
        request.setPassword("password123");

        mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").exists())
                .andExpect(jsonPath("$.user_id").value(activeUser.getId()))
                .andExpect(jsonPath("$.role").value("USER"));
    }

    @Test
    void testLoginInactiveUser() throws Exception {
        LoginRequest request = new LoginRequest();
        request.setUsername("inactive@example.com");
        request.setPassword("password123");

        mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value("user_not_active"));
    }

    @Test
    void testLoginInvalidCredentials() throws Exception {
        LoginRequest request = new LoginRequest();
        request.setUsername("active@example.com");
        request.setPassword("wrongpassword");

        mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("invalid_credentials"));
    }

    @Test
    void testValidateToken() throws Exception {
        String token = jwtUtil.generateToken(activeUser.getId(), activeUser.getUsername(), activeUser.getRole());

        mockMvc.perform(post("/auth/validate")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user_id").value(activeUser.getId()))
                .andExpect(jsonPath("$.username").value(activeUser.getUsername()))
                .andExpect(jsonPath("$.role").value(activeUser.getRole()))
                .andExpect(jsonPath("$.exp").exists());
    }

    @Test
    void testValidateInvalidToken() throws Exception {
        mockMvc.perform(post("/auth/validate")
                        .header("Authorization", "Bearer invalid.token.here"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.valid").value(false))
                .andExpect(jsonPath("$.error").value("invalid_or_expired_token"));
    }

    @Test
    void testMeEndpoint() throws Exception {
        String token = jwtUtil.generateToken(activeUser.getId(), activeUser.getUsername(), activeUser.getRole());

        mockMvc.perform(get("/auth/me")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userId").value(activeUser.getId().toString()));
    }
}