package com.stadium.auth_service.config;

import com.stadium.auth_service.entity.User;
import com.stadium.auth_service.repository.UserRepository;
import com.stadium.auth_service.security.RoleAccess;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;

@Component
public class DevUserSeeder implements ApplicationRunner {
  private static final String DEV_PASSWORD_HASH =
      "$2b$12$zcaBqN96NNRQKkpfq3tHK.Wmf9yVF4GgHJaMPLU1lJVUBA7d1PTa.";

  private final UserRepository userRepository;
  private final boolean seedUsers;
  private final boolean resetUsers;

  public DevUserSeeder(
      UserRepository userRepository,
      @Value("${opslite.seed-users:false}") boolean seedUsers,
      @Value("${opslite.seed-users-reset:false}") boolean resetUsers
  ) {
    this.userRepository = userRepository;
    this.seedUsers = seedUsers;
    this.resetUsers = resetUsers;
  }

  @Override
  public void run(ApplicationArguments args) {
    if (!seedUsers) {
      return;
    }

    if (resetUsers) {
      userRepository.deleteAll();
    }

    List<SeedUser> users = List.of(
        new SeedUser("John Doe", "john.doe@example.com", "Security", "62"),       // cruzamento, F1
        new SeedUser("Bruno Limpeza", "bruno@test.com", "Cleaning", "70"),      // escadas, F2
        new SeedUser("Alice Segurança", "alice@test.com", "Security", "66"),    // cruzamento, F1
        new SeedUser("Supervisor Ops", "eu@test.com", "Supervisor", "62"),     // cruzamento, F1
        new SeedUser("Médico Serviço", "medico@test.com", "Medical", "1")       // SalaIn, F1
    );

    users.forEach(this::upsertUser);
  }

  private void upsertUser(SeedUser seed) {
    User user = userRepository.findByUsername(seed.email())
        .orElseGet(() -> User.builder()
            .username(seed.email())
            .createdAt(LocalDateTime.now())
            .build());

    user.setName(seed.name());
    user.setPassword(DEV_PASSWORD_HASH);
    user.setRole(RoleAccess.normalizeRole(seed.role()));
    user.setStatus("active");
    user.setCurrentLocation(seed.currentLocation());

    if (user.getCreatedAt() == null) {
      user.setCreatedAt(LocalDateTime.now());
    }

    userRepository.save(user);
  }

  private record SeedUser(String name, String email, String role, String currentLocation) {}
}
