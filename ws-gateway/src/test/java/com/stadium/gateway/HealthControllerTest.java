package com.stadium.gateway;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class HealthControllerTest {
    
    @Test
    void healthControllerExists() {
        // Simple test that doesn't require Spring context
        HealthController controller = new HealthController();
        assertNotNull(controller);
    }
    
    @Test
    void healthMethodReturnsOk() {
        // Test the logic directly
        HealthController controller = new HealthController();
        String result = controller.health();
        assertEquals("ok", result);
    }
}