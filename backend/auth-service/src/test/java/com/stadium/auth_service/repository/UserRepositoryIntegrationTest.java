package com.stadium.auth_service.repository;

import com.stadium.auth_service.entity.User;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.context.ActiveProfiles;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

@DataJpaTest
@ActiveProfiles("test")
class UserRepositoryIntegrationTest {
    
    @Autowired
    private UserRepository userRepository;
    
    @Test
    void findByUsername_ShouldReturnUser_WhenUserExists() {
        // Given
        User user = User.builder()
                .username("test@example.com")
                .password("hashedPassword")
                .name("Test User")
                .role("USER")
                .status("active")
                .createdAt(LocalDateTime.now())
                .build();
        
        userRepository.save(user);
        
        // When
        Optional<User> foundUser = userRepository.findByUsername("test@example.com");
        
        // Then
        assertTrue(foundUser.isPresent());
        assertEquals("test@example.com", foundUser.get().getUsername());
        assertEquals("Test User", foundUser.get().getName());
    }
    
    @Test
    void findByUsername_ShouldReturnEmpty_WhenUserDoesNotExist() {
        // When
        Optional<User> foundUser = userRepository.findByUsername("nonexistent@example.com");
        
        // Then
        assertFalse(foundUser.isPresent());
    }
    
    @Test
    void saveUser_ShouldGenerateId() {
        // Given
        User user = User.builder()
                .username("new@example.com")
                .password("hashedPassword")
                .name("New User")
                .role("USER")
                .status("active")
                .createdAt(LocalDateTime.now())
                .build();
        
        // When
        User savedUser = userRepository.save(user);
        
        // Then
        assertNotNull(savedUser.getId());
        assertTrue(savedUser.getId() > 0);
    }
}