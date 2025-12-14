// src/test/java/com/stadium/auth_service/config/JwtAuthenticationFilterTest.java
package com.stadium.auth_service.config;

import com.stadium.auth_service.util.JwtUtil;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jws;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;

import java.io.PrintWriter;
import java.io.StringWriter;
import java.util.Date;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class JwtAuthenticationFilterUnitTest {
    
    @Mock
    private JwtUtil jwtUtil;
    
    @InjectMocks
    private JwtAuthenticationFilter jwtAuthenticationFilter;
    
    private MockHttpServletRequest request;
    private MockHttpServletResponse response;
    private FilterChain filterChain;
    
    @BeforeEach
    void setUp() {
        request = new MockHttpServletRequest();
        response = new MockHttpServletResponse();
        filterChain = mock(FilterChain.class);
        SecurityContextHolder.clearContext();
    }
    
    @Test
    void shouldNotFilter_ShouldReturnTrue_ForLoginPath() {
        request.setServletPath("/auth/login");
        assertTrue(jwtAuthenticationFilter.shouldNotFilter(request));
    }
    
    @Test
    void shouldNotFilter_ShouldReturnTrue_ForHealthPath() {
        request.setServletPath("/actuator/health");
        assertTrue(jwtAuthenticationFilter.shouldNotFilter(request));
    }
    
    @Test
    void shouldNotFilter_ShouldReturnFalse_ForOtherPaths() {
        request.setServletPath("/auth/me");
        assertFalse(jwtAuthenticationFilter.shouldNotFilter(request));
    }
}