package com.stadium.map_service.repository;

import com.stadium.map_service.model.MapData;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface MapRepository extends JpaRepository<MapData, Long> {
}
