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
        
    }
}