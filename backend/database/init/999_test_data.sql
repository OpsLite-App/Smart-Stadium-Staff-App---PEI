INSERT INTO users (name, email, password_hash, role, status, current_location)
VALUES
  ('John Doe', 'john.doe@example.com', '$2b$12$zcaBqN96NNRQKkpfq3tHK.Wmf9yVF4GgHJaMPLU1lJVUBA7d1PTa.', 'Security', 'active', '62'),
  ('Bruno Limpeza', 'bruno@test.com', '$2b$12$zcaBqN96NNRQKkpfq3tHK.Wmf9yVF4GgHJaMPLU1lJVUBA7d1PTa.', 'Cleaning', 'active', '70'),
  ('Alice Segurança', 'alice@test.com', '$2b$12$zcaBqN96NNRQKkpfq3tHK.Wmf9yVF4GgHJaMPLU1lJVUBA7d1PTa.', 'Security', 'active', '66'),
  ('Supervisor Ops', 'eu@test.com', '$2b$12$zcaBqN96NNRQKkpfq3tHK.Wmf9yVF4GgHJaMPLU1lJVUBA7d1PTa.', 'Supervisor', 'active', '62'),
  ('Médico Serviço', 'medico@test.com', '$2b$12$zcaBqN96NNRQKkpfq3tHK.Wmf9yVF4GgHJaMPLU1lJVUBA7d1PTa.', 'Medical', 'active', '1')
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  password_hash = EXCLUDED.password_hash,
  role = EXCLUDED.role,
  status = EXCLUDED.status,
  current_location = EXCLUDED.current_location;
