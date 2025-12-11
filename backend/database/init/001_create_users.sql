CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(200) NOT NULL,
    role VARCHAR(50) NOT NULL,       -- security | cleaning | medic | supervisor
    status VARCHAR(30) DEFAULT 'available',
    current_location VARCHAR(10),
    created_at TIMESTAMP DEFAULT NOW()
);