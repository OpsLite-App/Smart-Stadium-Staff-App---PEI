package com.stadium.gateway.auth;

import org.junit.jupiter.api.Test;
import java.lang.reflect.Method;
import static org.junit.jupiter.api.Assertions.*;

class WebSocketAuthSimpleTest {

    @Test
    void testAllowedMethodLogic() throws Exception {
        // Create instance with null auth client (we won't use it)
        WebSocketAuthChannelInterceptor interceptor = 
            new WebSocketAuthChannelInterceptor(null);
        
        // Access private method via reflection
        Method allowedMethod = WebSocketAuthChannelInterceptor.class
            .getDeclaredMethod("allowed", String.class, String.class);
        allowedMethod.setAccessible(true);
        
        // Test cases based on the allowed method logic
        assertTrue((Boolean) allowedMethod.invoke(interceptor, "admin", "/topic/anything"));
        assertTrue((Boolean) allowedMethod.invoke(interceptor, "security", "/topic/emergency/alerts"));
        assertTrue((Boolean) allowedMethod.invoke(interceptor, "security", "/topic/crowd"));
        assertTrue((Boolean) allowedMethod.invoke(interceptor, "staff", "/topic/crowd"));
        assertTrue((Boolean) allowedMethod.invoke(interceptor, "cleaning", "/topic/maintenance"));
        assertTrue((Boolean) allowedMethod.invoke(interceptor, "maintenance", "/topic/maintenance"));
        
        // Negative cases
        assertFalse((Boolean) allowedMethod.invoke(interceptor, null, "/topic/anything"));
        assertFalse((Boolean) allowedMethod.invoke(interceptor, "staff", "/topic/emergency"));
        assertFalse((Boolean) allowedMethod.invoke(interceptor, "cleaning", "/topic/crowd"));
    }
    
    @Test
    void testStompPrincipal() {
        StompPrincipal principal = new StompPrincipal("testuser", "admin");
        assertEquals("testuser", principal.getName());
        assertEquals("admin", principal.getRole());
    }
}