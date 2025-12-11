CREATE TABLE IF NOT EXISTS map_data (
    id SERIAL PRIMARY KEY,
    nodes JSONB NOT NULL,
    edges JSONB NOT NULL,
    hazards JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT NOW()
);