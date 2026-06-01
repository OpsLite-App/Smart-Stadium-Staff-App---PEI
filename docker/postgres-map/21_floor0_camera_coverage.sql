-- Ensure the ground-floor entrance camera has a real coverage polygon.
-- The QGIS backup currently contains the camera point, but not its coverage area.
INSERT INTO indoor.camera_coverage (id, camera_id, floor_id, monitored_area, geom)
SELECT
  7,
  4,
  0,
  'Entrada',
  ST_Buffer(geom, 7, 'quad_segs=4')::geometry(Polygon, 32629)
FROM indoor.camera_infrastructure
WHERE id = 4
ON CONFLICT (id) DO NOTHING;

SELECT pg_catalog.setval(
  'indoor.camera_coverage_id_seq',
  GREATEST((SELECT COALESCE(MAX(id), 1) FROM indoor.camera_coverage), 7),
  true
);
