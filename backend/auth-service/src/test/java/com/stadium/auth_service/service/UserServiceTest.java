package com.stadium.auth_service.service;

import com.stadium.auth_service.entity.User;
import com.stadium.auth_service.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {
    
    @Mock
    private UserRepository userRepository;
    
    private PasswordEncoder passwordEncoder;
    private UserService userService;
    
    @BeforeEach
    void setUp() {
        passwordEncoder = new BCryptPasswordEncoder();
        userService = new UserService(userRepository, passwordEncoder);
    }
    
    @Test
    void findByUsername_shouldReturnUserWhenExists() {
        // Arrange
        String username = "test@example.com";
        User mockUser = User.builder()
                .id(1)
                .username(username)
                .password("encodedPassword")
                .name("Test User")
                .role("security")
                .status("active")
                .build();
        
        when(userRepository.findByUsername(username)).thenReturn(Optional.of(mockUser));
        
        // Act
        Optional<User> result = userService.findByUsername(username);
        
        // Assert
        assertTrue(result.isPresent());
        assertEquals(username, result.get().getUsername());
        verify(userRepository).findByUsername(username);
    }
    
    @Test
    void findByUsername_shouldReturnEmptyWhenNotExists() {
        // Arrange
        String username = "nonexistent@example.com";
        when(userRepository.findByUsername(username)).thenReturn(Optional.empty());
        
        // Act
        Optional<User> result = userService.findByUsername(username);
        
        // Assert
        assertFalse(result.isPresent());
        verify(userRepository).findByUsername(username);
    }
    
    @Test
    void checkPassword_shouldReturnTrueForMatchingPassword() {
        // Arrange
        String rawPassword = "password123";
        String encodedPassword = passwordEncoder.encode(rawPassword);
        User user = User.builder()
                .password(encodedPassword)
                .build();
        
        // Act
        boolean result = userService.checkPassword(user, rawPassword);
        
        // Assert
        assertTrue(result);
    }
    
    @Test
    void checkPassword_shouldReturnFalseForWrongPassword() {
        // Arrange
        String rawPassword = "password123";
        String encodedPassword = passwordEncoder.encode(rawPassword);
        User user = User.builder()
                .password(encodedPassword)
                .build();
        
        // Act
        boolean result = userService.checkPassword(user, "wrongpassword");
        
        // Assert
        assertFalse(result);
    }
    
    @Test
    void createUser_shouldEncodePasswordAndSaveUser() {
        // Arrange
        String rawPassword = "password123";
        User expectedUser = User.builder()
                .username("new@example.com")
                .password(passwordEncoder.encode(rawPassword))
                .name("New User")
                .role("security")
                .status("active")
                .build();
        
        when(userRepository.save(any(User.class))).thenReturn(expectedUser);
        
        // Act
        User result = userService.createUser(
                "new@example.com",
                rawPassword,
                "New User",
                "security",
                "active"
        );
        
        // Assert
        assertNotNull(result);
        assertEquals("new@example.com", result.getUsername());
        assertTrue(passwordEncoder.matches(rawPassword, result.getPassword()));
        verify(userRepository).save(any(User.class));
    }
}