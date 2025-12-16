package com.stadium.auth_service.config;

import com.stadium.auth_service.util.JwtUtil;
import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.context.SecurityContextHolder;

import java.io.PrintWriter;
import java.io.StringWriter;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class JwtAuthenticationFilterTest {
    
    @Mock
    private JwtUtil jwtUtil;
    
    @Mock
    private HttpServletRequest request;
    
    @Mock
    private HttpServletResponse response;
    
    @Mock
    private FilterChain filterChain;
    
    @Mock
    private Claims claims;
    
    private JwtAuthenticationFilter filter;
    
    @BeforeEach
    void setUp() {
        filter = new JwtAuthenticationFilter(jwtUtil);
        SecurityContextHolder.clearContext();
    }
    
    @Test
    void shouldNotFilter_loginAndHealthEndpoints() {
        // Arrange
        when(request.getServletPath()).thenReturn("/auth/login");
        
        // Act
        boolean result = filter.shouldNotFilter(request);
        
        // Assert
        assertTrue(result);
    }
    
    @Test
    void shouldFilter_otherEndpoints() {
        // Arrange
        when(request.getServletPath()).thenReturn("/auth/me");
        
        // Act
        boolean result = filter.shouldNotFilter(request);
        
        // Assert
        assertFalse(result);
    }
    
    @Test
    void doFilterInternal_withValidToken_shouldSetAuthentication() throws Exception {
        // Arrange
        String token = "valid.jwt.token";
        when(request.getHeader("Authorization")).thenReturn("Bearer " + token);
        when(jwtUtil.getClaims(token)).thenReturn(claims);
        when(claims.getSubject()).thenReturn("123");
        when(claims.get("role")).thenReturn("security");
        
        // Act
        filter.doFilterInternal(request, response, filterChain);
        
        // Assert
        assertNotNull(SecurityContextHolder.getContext().getAuthentication());
        verify(filterChain).doFilter(request, response);
    }
    
    @Test
    void doFilterInternal_withInvalidToken_shouldReturn401() throws Exception {
        // Arrange
        String token = "invalid.token";
        when(request.getHeader("Authorization")).thenReturn("Bearer " + token);
        when(jwtUtil.getClaims(token)).thenThrow(new io.jsonwebtoken.JwtException("Invalid token"));
        
        StringWriter stringWriter = new StringWriter();
        PrintWriter printWriter = new PrintWriter(stringWriter);
        when(response.getWriter()).thenReturn(printWriter);
        
        // Act
        filter.doFilterInternal(request, response, filterChain);
        
        // Assert
        verify(response).setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        verify(response).setContentType("application/json");
        assertNull(SecurityContextHolder.getContext().getAuthentication());
    }
}