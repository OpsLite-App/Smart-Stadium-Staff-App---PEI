package com.stadium.auth_service.service;

import com.stadium.auth_service.security.RoleAccess;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
public class KeycloakAuthClient {
  private static final Set<String> OPSLITE_ROLES = Set.of("security", "cleaning", "medical", "supervisor");

  private final boolean enabled;
  private final String tokenEndpoint;
  private final String clientId;
  private final String clientSecret;
  private final RestClient restClient;

  public KeycloakAuthClient(
      @Value("${opslite.keycloak.enabled:false}") boolean enabled,
      @Value("${opslite.keycloak.base-url:http://localhost:8084}") String baseUrl,
      @Value("${opslite.keycloak.realm:opslite}") String realm,
      @Value("${opslite.keycloak.client-id:opslite-auth-service}") String clientId,
      @Value("${opslite.keycloak.client-secret:opslite-dev-secret}") String clientSecret
  ) {
    this.enabled = enabled;
    this.tokenEndpoint = baseUrl + "/realms/" + realm + "/protocol/openid-connect/token";
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.restClient = RestClient.create();
  }

  public boolean isEnabled() {
    return enabled;
  }

  public AuthenticationResult authenticate(String username, String password) {
    MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
    form.add("grant_type", "password");
    form.add("client_id", clientId);
    form.add("client_secret", clientSecret);
    form.add("username", username);
    form.add("password", password);

    try {
      @SuppressWarnings("unchecked")
      Map<String, Object> response = restClient.post()
          .uri(tokenEndpoint)
          .contentType(MediaType.APPLICATION_FORM_URLENCODED)
          .body(form)
          .retrieve()
          .body(Map.class);

      if (response == null || !(response.get("access_token") instanceof String accessToken)) {
        throw new KeycloakAuthenticationException("missing_access_token");
      }

      return new AuthenticationResult(accessToken, extractRole(accessToken));
    } catch (HttpClientErrorException.Unauthorized | HttpClientErrorException.BadRequest exception) {
      throw new KeycloakAuthenticationException("invalid_credentials", exception);
    } catch (RestClientException exception) {
      throw new KeycloakAuthenticationException("identity_provider_unavailable", exception);
    }
  }

  private String extractRole(String accessToken) {
    String[] parts = accessToken.split("\\.");
    if (parts.length < 2) {
      throw new KeycloakAuthenticationException("invalid_access_token");
    }

    try {
      String payload = new String(java.util.Base64.getUrlDecoder().decode(parts[1]));
      @SuppressWarnings("unchecked")
      Map<String, Object> claims = new com.fasterxml.jackson.databind.ObjectMapper().readValue(payload, Map.class);
      Object realmAccessValue = claims.get("realm_access");
      if (!(realmAccessValue instanceof Map<?, ?> realmAccess)) {
        throw new KeycloakAuthenticationException("missing_realm_access");
      }
      Object rolesValue = realmAccess.get("roles");
      if (!(rolesValue instanceof List<?> roles)) {
        throw new KeycloakAuthenticationException("missing_realm_roles");
      }

      return roles.stream()
          .map(String::valueOf)
          .map(role -> role.toLowerCase(Locale.ROOT))
          .filter(OPSLITE_ROLES::contains)
          .findFirst()
          .map(RoleAccess::normalizeRole)
          .orElseThrow(() -> new KeycloakAuthenticationException("missing_opslite_role"));
    } catch (IllegalArgumentException | java.io.IOException exception) {
      throw new KeycloakAuthenticationException("invalid_access_token", exception);
    }
  }

  public record AuthenticationResult(String accessToken, String role) {}

  public static class KeycloakAuthenticationException extends RuntimeException {
    public KeycloakAuthenticationException(String message) {
      super(message);
    }

    public KeycloakAuthenticationException(String message, Throwable cause) {
      super(message, cause);
    }
  }
}
