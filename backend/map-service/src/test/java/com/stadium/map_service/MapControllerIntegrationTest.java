package com.stadium.map_service;

import com.stadium.map_service.dto.MapClosureDTO;
import com.stadium.map_service.dto.MapGraphDTO;
import org.apache.hc.client5.http.impl.classic.CloseableHttpClient;
import org.apache.hc.client5.http.impl.classic.HttpClients;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.*;
import org.springframework.http.client.HttpComponentsClientHttpRequestFactory;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
public class MapControllerIntegrationTest {

    @LocalServerPort
    private int port;

    @Autowired
    private TestRestTemplate restTemplate;

    private String baseUrl;

    @BeforeEach
    void setUp() {
        baseUrl = "http://localhost:" + port + "/map";

        CloseableHttpClient httpClient = HttpClients.createDefault();
        restTemplate.getRestTemplate()
                .setRequestFactory(new HttpComponentsClientHttpRequestFactory(httpClient));
    }

    @Test
    void testGetGraph() {
        ResponseEntity<MapGraphDTO> response = restTemplate.getForEntity(baseUrl + "/graph", MapGraphDTO.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        MapGraphDTO mapGraph = response.getBody();
        assertThat(mapGraph).isNotNull();
        assertThat(mapGraph.getNodes()).isNotEmpty();
        assertThat(mapGraph.getEdges()).isNotEmpty();
    }

    @Test
    void testUpdateClosure() {
        Map<String, Object> closure = new HashMap<>();
        closure.put("from", "N1");
        closure.put("to", "N2");
        closure.put("status", "closed");

        MapClosureDTO closureDTO = new MapClosureDTO();
        closureDTO.setClosures(List.of(closure));

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        HttpEntity<MapClosureDTO> request = new HttpEntity<>(closureDTO, headers);

        ResponseEntity<MapGraphDTO> response = restTemplate.exchange(
                baseUrl + "/closure",
                HttpMethod.PATCH,
                request,
                MapGraphDTO.class
        );

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        MapGraphDTO updatedMap = response.getBody();
        assertThat(updatedMap).isNotNull();
        assertThat(updatedMap.getHazards()).isNotEmpty();
        assertThat(updatedMap.getHazards().get(0).get("from")).isEqualTo("N1");
        assertThat(updatedMap.getHazards().get(0).get("to")).isEqualTo("N2");
        assertThat(updatedMap.getHazards().get(0).get("status")).isEqualTo("closed");
    }

    @Test
    void testGetPOIs() {
        ResponseEntity<List> response = restTemplate.getForEntity(baseUrl + "/pois", List.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        List pois = response.getBody();
        assertThat(pois).isNotNull();
        assertThat(pois.size()).isGreaterThan(0);
    }
}
