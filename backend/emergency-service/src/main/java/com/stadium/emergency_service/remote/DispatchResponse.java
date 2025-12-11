package com.stadium.emergency_service.remote;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class DispatchResponse {
    private String dispatch_id;
    private Long incident_id;
    private Integer responder_id;
    private String responder_role;
    private String status;
    private LocalDateTime dispatched_at;
    private LocalDateTime eta;
}
