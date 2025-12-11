package com.stadium.map_service;

import com.stadium.map_service.model.MapData;
import com.stadium.map_service.repository.MapRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;

import java.nio.file.Files;
import java.nio.file.Path;

@SpringBootApplication
public class MapServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(MapServiceApplication.class, args);
    }

    @Bean
    CommandLineRunner initDatabase(MapRepository mapRepository) {
        return args -> {
            if (mapRepository.count() == 0) {
                String json = Files.readString(Path.of("src/main/resources/static/map.json"));
                MapData mapData = new MapData();
                mapData.setNodes(json);
                mapData.setEdges(json);
                mapRepository.save(mapData);
                System.out.println("Map data initialized in DB.");
            }
        };
    }
}
