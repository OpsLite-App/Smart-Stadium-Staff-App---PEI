package com.stadium.emergency_service.remote;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class DispatchRequest {
    @JsonProperty("incident_id")
    private String incident_id; // UUID from Python
    
    @JsonProperty("responder_role")
    private String responder_role;
    
    @JsonProperty("num_responders")
    private Integer num_responders;
}
