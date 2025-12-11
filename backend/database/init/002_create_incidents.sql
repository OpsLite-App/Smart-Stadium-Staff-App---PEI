CREATE TABLE IF NOT EXISTS incidents (
    id SERIAL PRIMARY KEY,
    type VARCHAR(50) NOT NULL,           -- sos | bin_alert | crowd_alert | maintenance
    location VARCHAR(10) NOT NULL,
    priority VARCHAR(20),
    status VARCHAR(20) DEFAULT 'active', -- active | assigned | resolved
    assigned_to INT REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);