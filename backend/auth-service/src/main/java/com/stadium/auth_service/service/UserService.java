package com.stadium.auth_service.service;

import com.stadium.auth_service.entity.User;
import com.stadium.auth_service.repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
public class UserService {
  private final UserRepository userRepository;
  private final PasswordEncoder passwordEncoder;

  public UserService(UserRepository userRepository, PasswordEncoder passwordEncoder) {
    this.userRepository = userRepository;
    this.passwordEncoder = passwordEncoder;
  }

  public Optional<User> findByUsername(String username) {
    return userRepository.findByUsername(username);
  }

  public boolean checkPassword(User user, String rawPassword) {
    return passwordEncoder.matches(rawPassword, user.getPassword());
  }

  public User createUser(String username, String rawPassword, String name, String role, String status){
    User u = User.builder()
      .username(username)
      .password(passwordEncoder.encode(rawPassword))
      .name(name)
      .role(role)
      .status(status)
      .build();
    return userRepository.save(u);
  }
}
