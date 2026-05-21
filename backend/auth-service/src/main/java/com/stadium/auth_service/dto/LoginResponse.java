package com.stadium.auth_service.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import java.util.Map;

@Getter
@AllArgsConstructor
public class LoginResponse {
  private String token;
  private Integer user_id;
  private String username;
  private String email;
  private String role;
  private Map<String, Boolean> permissions;
}
