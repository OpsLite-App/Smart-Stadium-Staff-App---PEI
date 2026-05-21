package com.stadium.auth_service.controller;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import com.stadium.auth_service.dto.LoginRequest;
import com.stadium.auth_service.dto.LoginResponse;
import com.stadium.auth_service.security.RoleAccess;
import com.stadium.auth_service.service.UserService;
import com.stadium.auth_service.util.JwtUtil;

import java.util.Map;

@RestController
@RequestMapping("/auth")
public class AuthController {
  private static final String AUTH_COOKIE_NAME = "AUTH_TOKEN";

  private final UserService userService;
  private final JwtUtil jwtUtil;

  public AuthController(UserService userService, JwtUtil jwtUtil) {
    this.userService = userService;
    this.jwtUtil = jwtUtil;
  }

  @PostMapping("/login")
  public ResponseEntity<?> login(@Valid @RequestBody LoginRequest request, HttpServletRequest servletRequest) {
    return userService.findByUsername(request.getUsername())
        .filter(user -> userService.checkPassword(user, request.getPassword()))
        .map(user -> {
          if (!"active".equalsIgnoreCase(user.getStatus())) {
            return ResponseEntity.status(403).body(Map.of("error", "user_not_active"));
          }
          String normalizedRole = RoleAccess.normalizeRole(user.getRole());
          String token = jwtUtil.generateToken(user.getId(), user.getUsername(), normalizedRole);
          ResponseCookie cookie = createAuthCookie(servletRequest, token);
          return ResponseEntity.ok()
              .header(HttpHeaders.SET_COOKIE, cookie.toString())
              .body(new LoginResponse(
                  token,
                  user.getId(),
                  user.getUsername(),
                  user.getUsername(),
                  normalizedRole,
                  RoleAccess.permissionsForRole(normalizedRole)
              ));
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
      String username = (String) claims.get("username");
      String role = RoleAccess.normalizeRole((String) claims.get("role"));
      return ResponseEntity.ok(Map.of(
          "user_id", Long.parseLong(claims.getSubject()),
          "username", username != null ? username : "",
          "email", username != null ? username : "",
          "role", role,
          "permissions", RoleAccess.permissionsForRole(role),
          "exp", claims.getExpiration().getTime()
      ));
    } catch (Exception e) {
      return ResponseEntity.status(401).body(Map.of("valid", false, "error", "invalid_or_expired_token"));
    }
  }

  @GetMapping("/me")
  public ResponseEntity<?> me(Authentication authentication, HttpServletRequest servletRequest) {
    if (authentication == null || !authentication.isAuthenticated()) {
      return ResponseEntity.status(401).body(Map.of("error", "unauthenticated"));
    }
    String userId = authentication.getName();
    var details = authentication.getDetails();
    String username = details instanceof Map ? (String) ((Map<?, ?>) details).get("username") : null;
    String rawRole = details instanceof Map ? (String) ((Map<?, ?>) details).get("role") : null;
    if (userId == null || username == null || rawRole == null) {
      return ResponseEntity.status(401).body(Map.of("error", "unauthenticated"));
    }
    String role = RoleAccess.normalizeRole(rawRole);
    String token = jwtUtil.generateToken(Integer.parseInt(userId), username, role);
    ResponseCookie cookie = createAuthCookie(servletRequest, token);
    return ResponseEntity.ok()
        .header(HttpHeaders.SET_COOKIE, cookie.toString())
        .body(Map.of(
            "token", token,
            "user_id", Long.parseLong(userId),
            "username", username,
            "email", username,
            "role", role,
            "permissions", RoleAccess.permissionsForRole(role)
        ));
  }

  @PostMapping("/logout")
  public ResponseEntity<?> logout(HttpServletRequest servletRequest) {
    ResponseCookie cookie = ResponseCookie.from(AUTH_COOKIE_NAME, "")
        .httpOnly(true)
        .secure(servletRequest != null && isSecure(servletRequest))
        .sameSite("Strict")
        .path("/")
        .maxAge(0)
        .build();
    return ResponseEntity.ok()
        .header(HttpHeaders.SET_COOKIE, cookie.toString())
        .body(Map.of("logged_out", true));
  }

  @GetMapping("/staff")
  public ResponseEntity<?> getAllStaff() {
      var users = userService.findAll().stream()
          .map(u -> java.util.Map.of(
              "id", u.getId(),
              "name", u.getName(),
              "role", RoleAccess.normalizeRole(u.getRole()),
              "location", u.getCurrentLocation() != null ? u.getCurrentLocation() : "Unknown"
          ))
          .collect(java.util.stream.Collectors.toList());
      return ResponseEntity.ok(users);
  }

  private ResponseCookie createAuthCookie(HttpServletRequest request, String token) {
    return ResponseCookie.from(AUTH_COOKIE_NAME, token)
        .httpOnly(true)
        .secure(request != null && isSecure(request))
        .sameSite("Strict")
        .path("/")
        .maxAge(7 * 24 * 60 * 60)
        .build();
  }

  private boolean isSecure(HttpServletRequest request) {
    if (request.isSecure()) {
      return true;
    }
    String forwardedProto = request.getHeader("X-Forwarded-Proto");
    return "https".equalsIgnoreCase(forwardedProto);
  }
}
