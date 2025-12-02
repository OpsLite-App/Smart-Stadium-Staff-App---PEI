"""
QUEUEING THEORY MODELS
Implements M/M/1 and M/M/k for wait time estimation
"""

import math
from typing import Dict, Optional, Tuple
from dataclasses import dataclass
from enum import Enum


class QueueStatus(Enum):
    """Queue status based on utilization"""
    EMPTY = "empty"          # ρ < 0.2
    NORMAL = "normal"        # 0.2 ≤ ρ < 0.7
    BUSY = "busy"            # 0.7 ≤ ρ < 0.9
    CROWDED = "crowded"      # 0.9 ≤ ρ < 1.0
    UNSTABLE = "unstable"    # ρ ≥ 1.0


@dataclass
class QueueMetrics:
    """Queue performance metrics"""
    # Input parameters
    arrival_rate: float       # λ (people/min)
    service_rate: float       # μ (people/min per server)
    num_servers: int          # k (number of servers)
    
    # Calculated metrics
    utilization: float        # ρ = λ/(k*μ)
    avg_queue_length: float   # Lq (people in queue)
    avg_system_length: float  # L (people in system)
    avg_wait_time: float      # Wq (minutes in queue)
    avg_system_time: float    # W (minutes in system)
    
    # Status
    status: QueueStatus
    is_stable: bool
    
    # Confidence
    confidence: str           # "high", "medium", "low"


def mm1_queue(arrival_rate: float, service_rate: float) -> Optional[QueueMetrics]:
    """
    M/M/1 Queue Model
    
    Single server queue with Poisson arrivals and exponential service times
    
    Args:
        arrival_rate (λ): Average arrivals per minute
        service_rate (μ): Average service rate per minute
    
    Returns:
        QueueMetrics with calculated wait times
    
    Formulas:
        ρ = λ/μ (utilization)
        Lq = ρ²/(1-ρ) (avg queue length)
        L = ρ/(1-ρ) (avg system length)
        Wq = ρ/(μ-λ) (avg wait time in queue)
        W = 1/(μ-λ) (avg time in system)
    """
    
    # Validate inputs
    if arrival_rate < 0 or service_rate <= 0:
        return None
    
    # Calculate utilization
    utilization = arrival_rate / service_rate
    
    # Check stability
    is_stable = utilization < 1.0
    
    if not is_stable:
        # System is unstable - queue grows infinitely
        # Use large number instead of inf for JSON compatibility
        return QueueMetrics(
            arrival_rate=arrival_rate,
            service_rate=service_rate,
            num_servers=1,
            utilization=utilization,
            avg_queue_length=999999.0,
            avg_system_length=999999.0,
            avg_wait_time=999999.0,
            avg_system_time=999999.0,
            status=QueueStatus.UNSTABLE,
            is_stable=False,
            confidence="low"
        )
    
    # Calculate metrics
    # Lq = ρ²/(1-ρ)
    avg_queue_length = (utilization ** 2) / (1 - utilization)
    
    # L = ρ/(1-ρ)
    avg_system_length = utilization / (1 - utilization)
    
    # Wq = ρ/(μ-λ) = Lq/λ
    avg_wait_time = utilization / (service_rate - arrival_rate)
    
    # W = 1/(μ-λ) = L/λ
    avg_system_time = 1 / (service_rate - arrival_rate)
    
    # Determine status
    if utilization < 0.2:
        status = QueueStatus.EMPTY
        confidence = "high"
    elif utilization < 0.7:
        status = QueueStatus.NORMAL
        confidence = "high"
    elif utilization < 0.9:
        status = QueueStatus.BUSY
        confidence = "medium"
    else:
        status = QueueStatus.CROWDED
        confidence = "low"
    
    return QueueMetrics(
        arrival_rate=arrival_rate,
        service_rate=service_rate,
        num_servers=1,
        utilization=round(utilization, 4),
        avg_queue_length=round(avg_queue_length, 2),
        avg_system_length=round(avg_system_length, 2),
        avg_wait_time=round(avg_wait_time, 2),
        avg_system_time=round(avg_system_time, 2),
        status=status,
        is_stable=is_stable,
        confidence=confidence
    )


def mmk_queue(arrival_rate: float, service_rate: float, num_servers: int) -> Optional[QueueMetrics]:
    """
    M/M/k Queue Model
    
    Multiple server queue with Poisson arrivals and exponential service times
    
    Args:
        arrival_rate (λ): Average arrivals per minute
        service_rate (μ): Average service rate per minute per server
        num_servers (k): Number of parallel servers
    
    Returns:
        QueueMetrics with calculated wait times
    
    Uses Erlang C formula for probability of waiting
    """
    
    # Validate inputs
    if arrival_rate < 0 or service_rate <= 0 or num_servers < 1:
        return None
    
    # If only 1 server, use M/M/1
    if num_servers == 1:
        return mm1_queue(arrival_rate, service_rate)
    
    # Calculate utilization per server
    total_capacity = num_servers * service_rate
    utilization = arrival_rate / total_capacity
    
    # Check stability
    is_stable = utilization < 1.0
    
    if not is_stable:
        return QueueMetrics(
            arrival_rate=arrival_rate,
            service_rate=service_rate,
            num_servers=num_servers,
            utilization=utilization,
            avg_queue_length=999999.0,
            avg_system_length=999999.0,
            avg_wait_time=999999.0,
            avg_system_time=999999.0,
            status=QueueStatus.UNSTABLE,
            is_stable=False,
            confidence="low"
        )
    
    # Calculate Erlang C (probability of waiting)
    erlang_c = _erlang_c(arrival_rate, service_rate, num_servers)
    
    # Average wait time in queue (Wq)
    # Wq = (C(k,a) / (k*μ - λ)) * (1/μ)
    avg_wait_time = (erlang_c / (total_capacity - arrival_rate)) * (1 / service_rate)
    
    # Average time in system (W)
    avg_system_time = avg_wait_time + (1 / service_rate)
    
    # Average queue length (Lq = λ * Wq)
    avg_queue_length = arrival_rate * avg_wait_time
    
    # Average system length (L = λ * W)
    avg_system_length = arrival_rate * avg_system_time
    
    # Determine status
    if utilization < 0.2:
        status = QueueStatus.EMPTY
        confidence = "high"
    elif utilization < 0.7:
        status = QueueStatus.NORMAL
        confidence = "high"
    elif utilization < 0.9:
        status = QueueStatus.BUSY
        confidence = "medium"
    else:
        status = QueueStatus.CROWDED
        confidence = "low"
    
    return QueueMetrics(
        arrival_rate=arrival_rate,
        service_rate=service_rate,
        num_servers=num_servers,
        utilization=round(utilization, 4),
        avg_queue_length=round(avg_queue_length, 2),
        avg_system_length=round(avg_system_length, 2),
        avg_wait_time=round(avg_wait_time, 2),
        avg_system_time=round(avg_system_time, 2),
        status=status,
        is_stable=is_stable,
        confidence=confidence
    )


def _erlang_c(arrival_rate: float, service_rate: float, num_servers: int) -> float:
    """
    Calculate Erlang C probability (probability of waiting)
    
    C(k,a) = (a^k / k!) / [(a^k / k!) * (k/(k-a)) + Σ(a^i / i!) for i=0 to k-1]
    
    where a = λ/μ (offered load)
    """
    a = arrival_rate / service_rate  # Offered load
    
    # Calculate numerator: a^k / k!
    numerator = (a ** num_servers) / math.factorial(num_servers)
    
    # Calculate denominator part 1: (a^k / k!) * (k/(k-a))
    denom_part1 = numerator * (num_servers / (num_servers - a))
    
    # Calculate denominator part 2: Σ(a^i / i!) for i=0 to k-1
    denom_part2 = sum((a ** i) / math.factorial(i) for i in range(num_servers))
    
    # Erlang C formula
    erlang_c = numerator / (denom_part1 + denom_part2)
    
    return erlang_c


def estimate_queue_from_observations(
    current_queue_length: int,
    recent_arrivals: int,
    recent_departures: int,
    observation_period_minutes: float,
    num_servers: int = 1
) -> QueueMetrics:
    """
    Estimate queue metrics from observed data
    
    Args:
        current_queue_length: Current number of people in queue
        recent_arrivals: Arrivals observed in period
        recent_departures: Departures observed in period
        observation_period_minutes: Observation duration
        num_servers: Number of servers
    
    Returns:
        Estimated QueueMetrics
    """
    
    # Estimate arrival rate (λ)
    arrival_rate = recent_arrivals / observation_period_minutes
    
    # Estimate service rate (μ)
    if recent_departures > 0 and num_servers > 0:
        service_rate = recent_departures / (observation_period_minutes * num_servers)
    else:
        # Fallback: assume reasonable service time
        service_rate = 0.5  # 2 minutes per person
    
    # Use appropriate model
    if num_servers == 1:
        return mm1_queue(arrival_rate, service_rate)
    else:
        return mmk_queue(arrival_rate, service_rate, num_servers)


def smooth_arrival_rate(
    current_rate: float,
    new_observation: float,
    alpha: float = 0.3
) -> float:
    """
    Exponential smoothing for arrival rate
    
    Args:
        current_rate: Current estimated rate
        new_observation: Newly observed rate
        alpha: Smoothing factor (0-1), higher = more weight on new data
    
    Returns:
        Smoothed rate
    """
    return alpha * new_observation + (1 - alpha) * current_rate


def calculate_wait_time_bounds(metrics: QueueMetrics, confidence_level: float = 0.95) -> Tuple[float, float]:
    """
    Calculate confidence bounds for wait time
    
    Uses exponential distribution assumption
    
    Args:
        metrics: Queue metrics
        confidence_level: Confidence level (default 0.95)
    
    Returns:
        (lower_bound, upper_bound) in minutes
    """
    # Handle unstable systems
    if metrics.avg_wait_time >= 999999.0:
        return (999999.0, 999999.0)
    
    # For exponential distribution, variance = mean²
    std_dev = metrics.avg_wait_time
    
    # Z-score for 95% confidence ≈ 1.96
    z_score = 1.96 if confidence_level >= 0.95 else 1.645
    
    lower = max(0, metrics.avg_wait_time - z_score * std_dev)
    upper = metrics.avg_wait_time + z_score * std_dev
    
    return (round(lower, 2), round(upper, 2))