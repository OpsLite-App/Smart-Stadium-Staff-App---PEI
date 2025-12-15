package com.stadium.auth_service.controller;

import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import com.stadium.auth_service.dto.LoginRequest;
import com.stadium.auth_service.dto.LoginResponse;
import com.stadium.auth_service.entity.User;
import com.stadium.auth_service.service.UserService;
import com.stadium.auth_service.util.JwtUtil;

import java.util.Map;

@RestController
@RequestMapping("/auth")
public class AuthController {

  private final UserService userService;
  private final JwtUtil jwtUtil;

  public AuthController(UserService userService, JwtUtil jwtUtil) {
    this.userService = userService;
    this.jwtUtil = jwtUtil;
  }

  @PostMapping("/login")
  public ResponseEntity<?> login(@Valid @RequestBody LoginRequest request) {
    return userService.findByUsername(request.getUsername())
        .filter(user -> userService.checkPassword(user, request.getPassword()))
        .map(user -> {
          if (!"active".equalsIgnoreCase(user.getStatus())) {
            return ResponseEntity.status(403).body(Map.of("error", "user_not_active"));
          }
          String token = jwtUtil.generateToken(user.getId(), user.getUsername(), user.getRole());
          return ResponseEntity.ok(new LoginResponse(token, user.getId(), user.getRole()));
        })
        .orElseGet(() -> ResponseEntity.status(401).body(Map.of("error", "invalid_credentials")));
  }

  @PostMapping("/validate")
  public ResponseEntity<?> validateToken(@RequestHeader("Authorization") String authHeader) {
    if (authHeader == null || !authHeader.startsWith("Bearer ")) {
      return ResponseEntity.badRequest().body(Map.of("error", "missing_authorization_header"));
    }
    String token = authHeader.substring(7);
    try {
      var claims = jwtUtil.getClaims(token);
      return ResponseEntity.ok(Map.of(
          "user_id", Long.parseLong(claims.getSubject()),
          "username", claims.get("username"),
          "role", claims.get("role"),
          "exp", claims.getExpiration().getTime()
      ));
    } catch (Exception e) {
      return ResponseEntity.status(401).body(Map.of("valid", false, "error", "invalid_or_expired_token"));
    }
  }

  @GetMapping("/me")
  public ResponseEntity<?> me(Authentication authentication) {
    return ResponseEntity.ok(Map.of("userId", authentication.getPrincipal()));
  }

  @GetMapping("/staff")
  public ResponseEntity<?> getAllStaff() {
      var users = userService.findAll().stream()
          .map(u -> java.util.Map.of(
              "id", u.getId(),
              "name", u.getName(),
              "role", u.getRole(),
              "location", u.getCurrentLocation() != null ? u.getCurrentLocation() : "Unknown"
          ))
          .collect(java.util.stream.Collectors.toList());
      return ResponseEntity.ok(users);
  }
}
