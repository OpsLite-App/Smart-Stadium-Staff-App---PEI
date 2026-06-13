"""
Legacy Map-Service integration tests.

The active architecture no longer uses the Map-Service CRUD API for routing or
operational GIS data. Routing now reads the indoor graph directly from
PostGIS/pgRouting through Routing-Service. This file is intentionally kept as a
visible historical marker so older test commands fail gracefully instead of
silently validating the wrong architecture.
"""

import pytest

pytestmark = pytest.mark.skip(reason="Legacy Map-Service is not part of the active PostGIS/pgRouting runtime")


def test_map_service_is_legacy_documentation_marker():
    assert True
