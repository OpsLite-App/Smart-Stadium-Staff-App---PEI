package com.stadium.auth_service.services;

import com.stadium.auth_service.model.User;
import com.stadium.auth_service.repositories.UserRepository;
import com.stadium.auth_service.config.JWTUtil;
import org.springframework.stereotype.Service;

@Service
public class AuthService {

    private final UserRepository userRepo;
    private final JWTUtil jwtUtil;

    public AuthService(UserRepository userRepo, JWTUtil jwtUtil) {
        this.userRepo = userRepo;
        this.jwtUtil = jwtUtil;
    }

    public String login(String username, String password) {
        User user = userRepo.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (!user.getPassword().equals(password)) {
            throw new RuntimeException("Invalid password");
        }

        return jwtUtil.generateToken(user.getUsername(), user.getRole());
    }

    public boolean validate(String token) {
        return jwtUtil.validateToken(token);
    }
}
