-- Persist operational state for AI cameras.
-- This is the layer that live AI/emulator updates should write to.
CREATE TABLE IF NOT EXISTS indoor.camera_status (
  camera_id integer PRIMARY KEY REFERENCES indoor.camera_infrastructure(id) ON DELETE CASCADE,
  people_count integer NOT NULL DEFAULT 0 CHECK (people_count >= 0),
  density_level text NOT NULL DEFAULT 'normal'
    CHECK (density_level IN ('normal', 'busy', 'congested', 'critical')),
  queue_level text NOT NULL DEFAULT 'normal'
    CHECK (queue_level IN ('normal', 'busy', 'congested', 'critical')),
  status text NOT NULL DEFAULT 'online'
    CHECK (status IN ('online', 'degraded', 'offline')),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

INSERT INTO indoor.camera_status (camera_id, people_count, density_level, queue_level, status)
SELECT
  ci.id,
  CASE ci.id
    WHEN 1 THEN 18
    WHEN 2 THEN 31
    WHEN 3 THEN 42
    WHEN 4 THEN 12
    WHEN 5 THEN 24
    WHEN 6 THEN 57
    WHEN 7 THEN 36
    ELSE 0
  END AS people_count,
  CASE
    WHEN ci.id = 6 THEN 'critical'
    WHEN ci.id = 3 THEN 'congested'
    WHEN ci.id IN (2, 5, 7) THEN 'busy'
    ELSE 'normal'
  END AS density_level,
  CASE
    WHEN ci.id = 6 THEN 'critical'
    WHEN ci.id = 3 THEN 'congested'
    WHEN ci.id IN (2, 5, 7) THEN 'busy'
    ELSE 'normal'
  END AS queue_level,
  'online'
FROM indoor.camera_infrastructure ci
ON CONFLICT (camera_id) DO NOTHING;
