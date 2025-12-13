package com.stadium.gateway.auth;

import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.stereotype.Component;

import java.security.Principal;
import java.util.Map;

@Component
public class WebSocketAuthChannelInterceptor implements ChannelInterceptor {

    private final AuthServiceClient authClient;

    public WebSocketAuthChannelInterceptor(AuthServiceClient authClient) {
        this.authClient = authClient;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null) return message;

        if (StompCommand.CONNECT.equals(accessor.getCommand())) {
            String auth = accessor.getFirstNativeHeader("Authorization");
            if (auth == null) auth = accessor.getFirstNativeHeader("authorization");
            if (auth == null) {
                // try token header
                String token = accessor.getFirstNativeHeader("token");
                if (token != null) auth = "Bearer " + token;
            }

            if (auth != null && auth.startsWith("Bearer ")) {
                String token = auth.substring(7);
                Map<String, Object> claims = authClient.validateToken(token);
                if (claims != null) {
                    // Attach a simple Principal with role info
                    String username = (String) claims.get("username");
                    String role = (String) claims.get("role");
                    Principal p = new StompPrincipal(username, role);
                    accessor.setUser(p);
                }
            }
        }

        if (StompCommand.SUBSCRIBE.equals(accessor.getCommand())) {
            // Ensure subscribe permission based on role
            Principal p = accessor.getUser();
            String dest = accessor.getDestination();
            if (p instanceof StompPrincipal) {
                String role = ((StompPrincipal) p).getRole();
                if (!allowed(role, dest)) {
                    // deny subscription by returning null
                    return null;
                }
            }
        }

        return message;
    }

    private boolean allowed(String role, String destination) {
        if (role == null) return false;
        if ("admin".equalsIgnoreCase(role)) return true;
        if (destination == null) return false;
        if (destination.startsWith("/topic/emergency") && "security".equalsIgnoreCase(role)) return true;
        if (destination.startsWith("/topic/crowd") && ("security".equalsIgnoreCase(role) || "staff".equalsIgnoreCase(role))) return true;
        if (destination.startsWith("/topic/maintenance") && ("cleaning".equalsIgnoreCase(role) || "maintenance".equalsIgnoreCase(role))) return true;
        // fallback - deny
        return false;
    }
}

class StompPrincipal implements Principal {
    private final String name;
    private final String role;

    public StompPrincipal(String name, String role) {
        this.name = name;
        this.role = role;
    }

    @Override
    public String getName() {
        return name;
    }

    public String getRole() {
        return role;
    }
}
