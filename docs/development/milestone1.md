# Milestone 1: Inception Phase & Project Planning

**Status:** **COMPLETED**  
**Due Date:** October 28, 2025  
**Focus:** Project Scope Definition, Planning, Initial Architecture

---

## 1. Overview

This milestone marks the completion of the Inception Phase according to the OpenUP methodology. The primary objective is to establish a clear understanding of the project scope, objectives, and initial planning to ensure a solid foundation for development.

All key deliverables for this phase have been planned and are in progress, including project charter, initial architecture, communication plan, and detailed scheduling.

---

## 2. Project Context & Problem Statement

### 2.1 Context Analysis
Estádio do Dragão hosts football matches and large events with over 55,000 attendees. The stadium employs hundreds of staff across various roles (security, cleaning, emergency response, supervisors) who need to coordinate in real-time during events.

**Current Challenges Identified:**
- Staff lack real-time situational awareness of crowd distribution
- Communication delays between different staff roles
- Inefficient response to incidents and emergencies
- No centralized system for operational coordination
- Manual processes for crowd management and incident response

### 2.2 Business Opportunity
By implementing a real-time staff coordination application, we aim to:
- Improve safety and security during events
- Reduce response times to incidents
- Optimize staff deployment based on real-time needs
- Enhance overall visitor experience
- Provide data-driven insights for operational improvements

---

## 3. Project Vision & Objectives

### 3.1 Vision Statement
"To develop a lightweight, real-time mobile application that empowers stadium staff with situational awareness and coordination capabilities, improving operational efficiency and safety during large-scale events."

### 3.2 Primary Objectives
1. **Improve Operational Efficiency**: Reduce response times by 40% through real-time coordination
2. **Enhance Safety**: Provide immediate emergency response capabilities
3. **Increase Situational Awareness**: Offer real-time crowd heatmaps and incident tracking
4. **Ensure Reliability**: Create a robust system that works in high-density environments
5. **Maintain Usability**: Design intuitive interfaces for diverse staff roles

### 3.3 Success Criteria
- MVP deployed and tested by December 2025
- System handles 500+ concurrent users with <100ms latency
- Staff adoption rate >80% in pilot testing
- Reduction in incident response time by 30%

---

## 4. Stakeholder Analysis

| Stakeholder | Role | Interests & Requirements |
|-------------|------|--------------------------|
| **Stadium Management** | Primary client | Operational efficiency, safety compliance, cost reduction |
| **Security Staff** | End users | Real-time incident alerts, crowd monitoring, quick response |
| **Cleaning Staff** | End users | Maintenance alerts, optimized routing, task assignment |
| **Emergency Responders** | End users | SOS functionality, location sharing, rapid deployment |
| **Supervisors** | End users | Overall oversight, staff coordination, reporting |
| **Development Team** | Implementers | Clear requirements, realistic timelines, technical feasibility |
| **University** | Academic oversight | Learning outcomes, research value, documentation quality |

---

## 5. Scope Definition

### 5.1 In-Scope (MVP Features)
1. **Real-time Crowd Heatmaps**
   - Color-coded gate/section density (G/Y/R)
   - Threshold-based alerts
   - Historical data visualization

2. **Wait-Time Estimation**
   - M/M/1 queueing model implementation
   - Real-time updates (15-second intervals)
   - Uncertainty bands display

3. **Maintenance Management**
   - Bin-full alerts with geolocation
   - Shortest-path routing to maintenance points
   - Task assignment and tracking

4. **Emergency Response**
   - SOS button functionality
   - Nearest responder assignment
   - Hazard-aware routing
   - Emergency mode activation

5. **Role-Based Interfaces**
   - Security role: Focus on crowd control and incidents
   - Cleaning role: Focus on maintenance tasks and routing
   - Supervisor role: Overview dashboard and coordination
   - Bilingual support (PT/EN)

6. **Communication Features**
   - Group chat by staff role
   - Geographic zone-based chat
   - Alert broadcasting system

### 5.2 Out-of-Scope (Future Considerations)
- Facial recognition systems
- Visitor-facing applications
- Payment processing systems
- Full AI-based prediction models
- Hardware deployment (sensors, beacons)
- Integration with external ticketing systems

### 5.3 Assumptions
1. Stadium has reliable Wi-Fi coverage for all staff
2. Staff are equipped with Android 10+ devices
3. Network latency remains under 100ms during peak usage
4. Staff are authorized to use mobile devices during operations
5. Synthetic/anonymized data is sufficient for development and testing

---

## 6. Technical Approach

### 6.1 Architecture Strategy
**Microservices Architecture** chosen for:
- Independent scalability of components
- Technology flexibility per service
- Team parallel development capability
- Resilience through service isolation

**Real-time Communication** via:
- WebSocket for bidirectional communication
- HTTP REST APIs for request/response patterns
- Apache Kafka for event streaming

### 6.2 Technology Stack Selection

| Component | Technology | Rationale |
|-----------|------------|-----------|
| **Mobile App** | Flutter | Cross-platform development, team expertise |
| **Backend Services** | Java (Spring Boot) | Stability, performance, enterprise readiness |
| **Real-time Gateway** | Node.js/NestJS | WebSocket efficiency, event-driven architecture |
| **Message Broker** | Apache Kafka | High-throughput event streaming |
| **Database** | PostgreSQL + Redis | Relational data + real-time caching |
| **Containerization** | Docker + Kubernetes | Scalability, deployment consistency |

### 6.3 Development Methodology
**Agile/Scrum Framework** with:
- 2-week sprints
- Daily stand-up meetings
- Sprint planning and review sessions
- Bi-weekly demos to supervisors
- Continuous integration/delivery pipeline

---

## 7. Project Planning

### 7.1 High-Level Timeline

```mermaid
gantt
    title Project Timeline - Academic Year 2025/2026
    dateFormat  YYYY-MM-DD
    section Phase 1: Foundation
    Inception Phase      : 2025-10-07, 21d
    Architecture Design  : 2025-10-14, 14d
    section Phase 2: Construction
    MVP Development      : 2025-11-04, 42d
    Integration Testing  : 2025-12-16, 14d
    section Phase 3: Transition
    System Validation    : 2026-02-03, 21d
    Final Delivery       : 2026-05-01, 60d