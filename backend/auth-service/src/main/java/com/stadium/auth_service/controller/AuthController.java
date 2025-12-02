package com.stadium.auth_service.controller;

import com.stadium.auth_service.services.AuthService;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/login")
    public Map<String, String> login(@RequestBody Map<String, String> body) {
        String token = authService.login(body.get("username"), body.get("password"));
        return Map.of("token", token);
    }

    @PostMapping("/validate")
    public Map<String, Boolean> validate(@RequestBody Map<String, String> body) {
        boolean valid = authService.validate(body.get("token"));
        return Map.of("valid", valid);
    }
}
