// src/test/java/com/stadium/auth_service/config/SecurityConfigTest.java
package com.stadium.auth_service.config;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SecurityConfigTest {
    
    @Autowired
    private MockMvc mockMvc;
    
    @MockBean
    private JwtAuthenticationFilter jwtAuthenticationFilter;
    
    @Test
    void healthEndpoint_ShouldBeAccessibleWithoutAuthentication() throws Exception {
        mockMvc.perform(get("/actuator/health"))
                .andExpect(status().isOk());
    }
    
    @Test
    void loginEndpoint_ShouldBeAccessibleWithoutAuthentication() throws Exception {
        mockMvc.perform(post("/auth/login"))
                .andExpect(status().isBadRequest()); // Returns 400 because no request body
    }
    
    @Test
    void securedEndpoints_ShouldRequireAuthentication() throws Exception {
        mockMvc.perform(get("/auth/me"))
                .andExpect(status().isForbidden()); // Returns 403 because no authentication
    }
}