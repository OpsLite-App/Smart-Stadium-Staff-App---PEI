package com.stadium.auth_service.util;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.security.Key;
import java.util.Date;
import java.util.Map;

@Component
public class JwtUtil {

  private final Key key;
  private final long expirationMs;

  public JwtUtil(@Value("${jwt.secret}") String secret,
                 @Value("${jwt.expiration-ms}") long expirationMsEnv) {
    // Secret must be long enough for HS256; decode or directly use bytes
    if (secret == null || secret.length() < 32) {
      // pad or fallback - for demo only
      secret = (secret == null ? "development-secret-please-change-1234567890" : secret);
      while (secret.length() < 64) secret += "0";
    }
    this.key = Keys.hmacShaKeyFor(secret.getBytes());
    this.expirationMs = expirationMsEnv;
  }

  public String generateToken(Integer userId, String username, String role) {
    long now = System.currentTimeMillis();
    return Jwts.builder()
        .setSubject(String.valueOf(userId))
        .setIssuedAt(new Date(now))
        .setExpiration(new Date(now + expirationMs))
        .claim("username", username)
        .claim("role", role)
        .signWith(key, SignatureAlgorithm.HS256)
        .compact();
  }

  public Jws<Claims> validateToken(String token) throws JwtException {
    return Jwts.parserBuilder().setSigningKey(key).build().parseClaimsJws(token);
  }

  public Claims getClaims(String token) {
    return validateToken(token).getBody();
  }
}
