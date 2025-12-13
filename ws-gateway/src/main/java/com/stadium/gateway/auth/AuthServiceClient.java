package com.stadium.gateway.auth;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

@Component
public class AuthServiceClient {

    private final RestTemplate restTemplate = new RestTemplate();
    private final String authServiceUrl;

    public AuthServiceClient(@Value("${auth.serviceUrl:http://localhost:8081}") String authServiceUrl) {
        this.authServiceUrl = authServiceUrl;
    }

    public Map<String, Object> validateToken(String token) {
        if (token == null) return null;
        String url = authServiceUrl + "/auth/validate";
        HttpHeaders headers = new HttpHeaders();
        headers.set("Authorization", "Bearer " + token);

        try {
            HttpEntity<Void> entity = new HttpEntity<>(headers);
            ResponseEntity<Map> r = restTemplate.postForEntity(url, entity, Map.class);
            if (r.getStatusCode().is2xxSuccessful()) {
                return r.getBody();
            }
        } catch (Exception e) {
            System.out.println("Auth validation failed: " + e.getMessage());
        }
        return null;
    }
}
