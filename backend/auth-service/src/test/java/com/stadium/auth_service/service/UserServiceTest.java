package com.stadium.auth_service.service;

import com.stadium.auth_service.entity.User;
import com.stadium.auth_service.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
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
    
    @Mock
    private PasswordEncoder passwordEncoder;
    
    @InjectMocks
    private UserService userService;
    
    private User testUser;
    
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
    }
    
    @Test
    void findByUsername_ShouldReturnUser_WhenUserExists() {
        // Given
        String username = "test@example.com";
        when(userRepository.findByUsername(username)).thenReturn(Optional.of(testUser));
        
        // When
        Optional<User> result = userService.findByUsername(username);
        
        // Then
        assertTrue(result.isPresent());
        assertEquals(username, result.get().getUsername());
        verify(userRepository, times(1)).findByUsername(username);
    }
    
    @Test
    void findByUsername_ShouldReturnEmpty_WhenUserDoesNotExist() {
        // Given
        String username = "nonexistent@example.com";
        when(userRepository.findByUsername(username)).thenReturn(Optional.empty());
        
        // When
        Optional<User> result = userService.findByUsername(username);
        
        // Then
        assertFalse(result.isPresent());
        verify(userRepository, times(1)).findByUsername(username);
    }
    
    @Test
    void checkPassword_ShouldReturnTrue_WhenPasswordMatches() {
        // Given
        String rawPassword = "password123";
        when(passwordEncoder.matches(rawPassword, testUser.getPassword())).thenReturn(true);
        
        // When
        boolean result = userService.checkPassword(testUser, rawPassword);
        
        // Then
        assertTrue(result);
        verify(passwordEncoder, times(1)).matches(rawPassword, testUser.getPassword());
    }
    
    @Test
    void checkPassword_ShouldReturnFalse_WhenPasswordDoesNotMatch() {
        // Given
        String rawPassword = "wrongPassword";
        when(passwordEncoder.matches(rawPassword, testUser.getPassword())).thenReturn(false);
        
        // When
        boolean result = userService.checkPassword(testUser, rawPassword);
        
        // Then
        assertFalse(result);
        verify(passwordEncoder, times(1)).matches(rawPassword, testUser.getPassword());
    }
    
    @Test
    void createUser_ShouldEncodePasswordAndSaveUser() {
        // Given
        String rawPassword = "password123";
        String encodedPassword = "encodedPassword123";
        
        when(passwordEncoder.encode(rawPassword)).thenReturn(encodedPassword);
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> {
            User user = invocation.getArgument(0);
            user.setId(1);
            return user;
        });
        
        // When
        User createdUser = userService.createUser(
                "newuser@example.com",
                rawPassword,
                "New User",
                "USER",
                "active"
        );
        
        // Then
        assertNotNull(createdUser);
        assertEquals("newuser@example.com", createdUser.getUsername());
        assertEquals(encodedPassword, createdUser.getPassword());
        assertEquals("USER", createdUser.getRole());
        assertEquals("active", createdUser.getStatus());
        
        verify(passwordEncoder, times(1)).encode(rawPassword);
        verify(userRepository, times(1)).save(any(User.class));
    }
}