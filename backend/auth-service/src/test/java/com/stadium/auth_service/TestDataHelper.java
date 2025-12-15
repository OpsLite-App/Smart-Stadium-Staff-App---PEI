package com.stadium.auth_service;

import com.stadium.auth_service.entity.User;

public class TestDataHelper {
    
    public static User createActiveUser() {
        return User.builder()
                .id(1)
                .username("active@example.com")
                .password("$2a$10$encodedpassword")
                .name("Active User")
                .role("security")
                .status("active")
                .build();
    }
    
    public static User createInactiveUser() {
        return User.builder()
                .id(2)
                .username("inactive@example.com")
                .password("$2a$10$encodedpassword")
                .name("Inactive User")
                .role("cleaning")
                .status("inactive")
                .build();
    }
}