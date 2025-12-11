package com.stadium.auth_service.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import com.stadium.auth_service.entity.User;

public interface UserRepository extends JpaRepository<User, Long> {
  Optional<User> findByUsername(String username);
}