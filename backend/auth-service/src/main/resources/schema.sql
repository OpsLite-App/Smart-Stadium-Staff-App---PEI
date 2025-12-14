# src/main/resources/schema.sql
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    current_location VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert some test users (optional, for development)
INSERT INTO users (email, password_hash, name, role, status) 
VALUES 
    ('admin@stadium.com', '$2a$10$YourHashedPasswordHere', 'Admin User', 'ADMIN', 'active'),
    ('staff@stadium.com', '$2a$10$YourHashedPasswordHere', 'Staff User', 'STAFF', 'active')
ON CONFLICT (email) DO NOTHING;