import pytest
from models import mm1_queue, mmk_queue, smooth_arrival_rate, QueueStatus

# Tests for M/M/1 (Single Server)

def test_mm1_calculation_logic():
    """Validates a standard M/M/1 scenario: λ=10, μ=15"""
    # ρ = 10/15 = 0.666...
    # Wq = λ / (μ * (μ - λ)) = 10 / (15 * 5) = 10/75 = 0.1333... min
    metrics = mm1_queue(arrival_rate=10.0, service_rate=15.0)
    
    assert metrics is not None
    assert metrics.is_stable is True
    assert metrics.status == QueueStatus.NORMAL
    # Use absolute tolerance to avoid rounding issues
    assert metrics.utilization == pytest.approx(0.666, abs=0.01)
    assert metrics.avg_wait_time == pytest.approx(0.133, abs=0.01)

def test_mm1_unstable_boundary():
    """Valida que o sistema marca como UNSTABLE quando λ >= μ"""
    # λ=20, μ=15 -> ρ = 1.33 (Instável)
    metrics = mm1_queue(arrival_rate=20.0, service_rate=15.0)
    assert metrics.is_stable is False
    assert metrics.status == QueueStatus.UNSTABLE
    assert metrics.avg_wait_time >= 999999.0

# Tests for M/M/k (Multiple Servers) 

def test_mmk_vs_mm1_equivalence():
    """Checks if M/M/k with k=1 yields the same result as M/M/1"""
    m1 = mm1_queue(10, 15)
    mk = mmk_queue(10, 15, 1)
    
    assert mk is not None
    assert pytest.approx(m1.avg_wait_time, abs=1e-5) == mk.avg_wait_time
    assert m1.utilization == mk.utilization

# Smoothing Tests 

@pytest.mark.parametrize("alpha, current, new, expected", [
    (0.3, 10.0, 20.0, 13.0),
    (0.5, 10.0, 10.0, 10.0),
])
def test_smooth_arrival_rate(alpha, current, new, expected):
    result = smooth_arrival_rate(current, new, alpha)
    assert result == pytest.approx(expected)

# Error Case Tests (Based on code behavior)

def test_invalid_parameters_return_none():
    """
    Checks if the function returns None for impossible inputs,
    as implemented in models.py
    """
    # Service rate zero or negative should return None
    assert mm1_queue(arrival_rate=10.0, service_rate=0.0) is None
    assert mm1_queue(arrival_rate=10.0, service_rate=-5.0) is None
    
    # Negative arrival rate should also be handled
    assert mm1_queue(arrival_rate=-1.0, service_rate=10.0) is None

def test_zero_arrival_is_empty():
    """Tests EMPTY status when there is nobody in the queue"""
    metrics = mm1_queue(arrival_rate=0.0, service_rate=10.0)
    assert metrics.status == QueueStatus.EMPTY
    assert metrics.avg_wait_time == 0.0
    assert metrics.utilization == 0.0