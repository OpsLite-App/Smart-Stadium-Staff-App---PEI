package com.stadium.auth_service.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class LoginResponse {
  private String token;
  private Integer user_id;
  private String role;
}