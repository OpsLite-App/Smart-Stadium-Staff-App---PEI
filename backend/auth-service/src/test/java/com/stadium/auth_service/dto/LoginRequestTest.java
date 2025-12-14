package com.stadium.auth_service.dto;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

class LoginRequestTest {
    
    private static Validator validator;
    
    @BeforeAll
    static void setUp() {
        ValidatorFactory factory = Validation.buildDefaultValidatorFactory();
        validator = factory.getValidator();
    }
    
    @Test
    void loginRequest_ShouldValidate_WhenFieldsAreValid() {
        // Given
        LoginRequest request = new LoginRequest();
        request.setUsername("test@example.com");
        request.setPassword("password123");
        
        // When
        Set<ConstraintViolation<LoginRequest>> violations = validator.validate(request);
        
        // Then
        assertTrue(violations.isEmpty());
    }
    
    @Test
    void loginRequest_ShouldFailValidation_WhenUsernameIsBlank() {
        // Given
        LoginRequest request = new LoginRequest();
        request.setUsername("");
        request.setPassword("password123");
        
        // When
        Set<ConstraintViolation<LoginRequest>> violations = validator.validate(request);
        
        // Then
        assertFalse(violations.isEmpty());
        assertEquals(1, violations.size());
        assertEquals("username", violations.iterator().next().getPropertyPath().toString());
    }
    
    @Test
    void loginRequest_ShouldFailValidation_WhenPasswordIsBlank() {
        // Given
        LoginRequest request = new LoginRequest();
        request.setUsername("test@example.com");
        request.setPassword("");
        
        // When
        Set<ConstraintViolation<LoginRequest>> violations = validator.validate(request);
        
        // Then
        assertFalse(violations.isEmpty());
        assertEquals(1, violations.size());
        assertEquals("password", violations.iterator().next().getPropertyPath().toString());
    }
}