package com.stadium.gateway.auth;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class AuthServiceClientTest {

    @Test
    void constructorAndBasicBehavior() {
        AuthServiceClient client = new AuthServiceClient("http://localhost:8081");
        assertNotNull(client);
        
        // Test null token returns null
        assertNull(client.validateToken(null));
        
        // The actual HTTP call would require mocking, but at least
        // we've tested the constructor and null handling
    }
}