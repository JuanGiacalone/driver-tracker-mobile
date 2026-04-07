# RiderTracker — Product Roadmap

> **Last updated:** March 2026  
> **Current state:** MVP with multi-tenant tracking, delivery creation, customer tracking links, rider notifications.

---

## What We Have Today

| Capability | Status |
|---|---|
| Rider shift management (start/end, 4h auto-end, timer) | ✅ Shipped |
| Background GPS tracking (60s interval, foreground service) | ✅ Shipped |
| Multi-tenant data isolation (tenants, stores, riders) | ✅ Shipped |
| Admin dashboard with real-time map | ✅ Shipped |
| Delivery creation with order details (amount, payment, recipient) | ✅ Shipped |
| Customer tracking page (temporary 1.5h link) | ✅ Shipped |
| Rider push notification on new delivery | ✅ Shipped |
| API test suite (39 tests) | ✅ Shipped |

---

## Phase 4: Rider Delivery Lifecycle

**Goal:** Let riders actively manage deliveries from their phone — accept, navigate, and complete.

**Business impact:** 🔴 Critical — Without this, delivery status is a black box after dispatch. Admins have no visibility into progress, and customers don't know if the rider has picked up their order.

### 4.1 Delivery Status Flow (Rider App)
The delivery card on the shift screen evolves from a passive info card into an interactive workflow:

```
[Nuevo] → [Recogido] → [En camino] → [Entregado]
```

- **"Recogido" button** — Rider confirms order pickup at store. Notifies admin + customer.
- **"Entregado" button** — Rider confirms delivery. Auto-closes the delivery in the backend, notifies customer tracking page ("Entrega Completada"), and clears the card.
- Optional: **"Problema" button** — Flag an issue (wrong address, customer absent, etc.) with a reason selector.

### 4.2 Multiple Concurrent Deliveries
- Riders often carry 2-3 orders at once. The shift screen should stack delivery cards.
- Each card is independently actionable (mark picked up / delivered).
- New deliveries appear at the top with a brief animation.

### 4.3 Delivery Status on Admin Dashboard
- Admin delivery list panel showing all active deliveries with real-time status badges.
- Status colors: 🟡 Pending → 🔵 Picked Up → 🟢 En Camino → ✅ Delivered → 🔴 Problem.
- Click a delivery to center the map on its rider.

### 4.4 Customer-Facing Status Progression
- The `track.html` page shows a status stepper:  
  `Preparando → Recogido → En camino → Entregado`
- Each step updates in real-time via WebSocket.

**Estimated effort:** 2-3 weeks  
**Dependencies:** None (builds on existing architecture)

---

## Phase 5: Navigation & Address Intelligence

**Goal:** Help riders get to the delivery address faster and reduce "where do I go?" calls.

**Business impact:** 🟠 High — Reduces delivery times and rider frustration. Directly improves customer satisfaction.

### 5.1 In-App Navigation
- "Navegar" button on the delivery card opens the customer address in Google Maps / Waze / Apple Maps (deep link).
- Let the rider choose their preferred navigation app (saved in preferences).

### 5.2 Address Display on Map
- Geocode the `customerAddress` string to lat/lng coordinates using a geocoding API.
- Show a destination marker 📍 on the rider's map view (if map is added to the shift screen in the future).

### 5.3 Estimated Time of Arrival (ETA)
- Calculate approximate ETA based on straight-line distance or a directions API.
- Show on the customer tracking page: "Tu pedido llega en ~12 minutos".
- Update dynamically as the rider moves closer.

**Estimated effort:** 1-2 weeks  
**Dependencies:** External geocoding/directions API (Google Maps, Mapbox, or OpenStreetMap Nominatim for free tier)

---

## Phase 6: Operational Analytics Dashboard

**Goal:** Give admins data-driven insights to optimize operations.

**Business impact:** 🟠 High — Without metrics, tenants can't identify slow riders, peak hours, or underperforming stores.

### 6.1 Delivery History
- New "Historial" tab/page on the admin dashboard.
- Filter by date range, store, rider, status.
- Table view: delivery ID, rider, recipient, amount, payment method, status, duration (created → delivered), timestamps.
- CSV export for accounting and reporting.

### 6.2 KPI Cards
- **Today's summary:** Total deliveries, total revenue, average delivery time, active riders.
- **Rider performance:** Deliveries per rider, average delivery time per rider.
- **Store breakdown:** Deliveries per store, busiest hours heatmap.

### 6.3 Shift History
- Log shift start/end times per rider.
- Calculate hours worked per rider per day/week.
- Flag anomalies: shifts under 30 minutes, riders with no deliveries during shift.

**Estimated effort:** 2-3 weeks  
**Dependencies:** Phase 4 (need delivery completion timestamps for meaningful metrics)

---

## Phase 7: Security & Reliability Hardening

**Goal:** Production-grade security and resilience.

**Business impact:** 🟡 Medium (preventive) — Not user-facing, but critical before scaling to more tenants.

### 7.1 Password Hashing
- Currently storing passwords in plaintext. Migrate to bcrypt.
- Add password migration logic that rehashes on first login post-migration.

### 7.2 Rate Limiting
- Add `express-rate-limit` to login endpoint (5 attempts per 15 minutes per IP).
- Rate limit delivery creation and link generation.

### 7.3 Offline Location Caching (Rider App)
- When the background task fails to POST location (network error), cache the payload in AsyncStorage.
- On next successful POST, batch-send all cached locations.
- Cap cache at 100 entries to prevent unbounded growth.

### 7.4 Token Refresh
- Current tokens never refresh — rider must re-login if token expires.  
- Add a `/api/refresh` endpoint that issues a new token given a valid (or recently expired) one.
- Mobile app automatically refreshes before expiry.

### 7.5 Audit Logging
- Log all delivery lifecycle events to a separate `audit_log` table: who, what, when.
- Log customer tracking link access (IP, timestamp, delivery ID).

**Estimated effort:** 2 weeks  
**Dependencies:** None

---

## Phase 8: Customer Experience Enhancement

**Goal:** Make the tracking experience delightful and informative.

**Business impact:** 🟡 Medium — Differentiator. Customers who feel informed order again.

### 8.1 Delivery Details on Tracking Page
- Show order summary on the tracking page: recipient name, store name, estimated arrival.
- Display payment method and amount (useful for cash-on-delivery).

### 8.2 WhatsApp Sharing
- "Compartir por WhatsApp" button on the admin dashboard after generating a link.
- Pre-formatted message: "📦 Tu pedido de {storeName} está en camino! Seguilo acá: {link}"

### 8.3 Delivery Completion Feedback
- After "Entrega Completada", show a simple satisfaction survey on the tracking page (thumbs up / thumbs down).
- Store feedback in a `delivery_feedback` table linked to delivery ID.
- Surface aggregate ratings on the admin analytics dashboard.

### 8.4 Push Notifications (Customer)
- For returning customers: optional browser push notification opt-in.
- Notify when rider picks up order, and when rider is nearby (~500m).

**Estimated effort:** 2 weeks  
**Dependencies:** Phase 4.1 (delivery status flow for customer progress stepper)

---

## Phase 9: White-Label & Tenant Customization

**Goal:** Let each tenant brand the experience as their own.

**Business impact:** 🟡 Medium — Key for B2B growth. Tenants want "their" app and tracking page.

### 9.1 Tenant Branding (Tracking Page)
- Configurable fields per tenant: logo URL, primary color, store name override.
- Stored in the `tenants` table: `logo_url`, `primary_color`, `display_name`.
- `track.html` reads branding from the JWT and applies it dynamically.

### 9.2 Custom Tracking Page Subdomain
- Support `{tenant}.ridertracker.com/track?token=...` for branded URLs.
- Resolve tenant from subdomain, apply branding.

### 9.3 Mobile App Theming
- Dynamic theme loading based on tenant configuration.
- Custom splash screen and app icon per tenant (EAS build variants).

**Estimated effort:** 3-4 weeks  
**Dependencies:** Tenant configuration backend changes

---

## Phase 10: Scaling Infrastructure

**Goal:** Prepare for 10x growth in riders, deliveries, and tenants.

**Business impact:** 🟢 Low (proactive) — Important when approaching scale limits.

### 10.1 Database Migration to PostgreSQL
- SQLite is single-writer. Migrate to PostgreSQL for concurrent write support.
- Use connection pooling (pg-pool) for efficient resource use.
- This enables horizontal scaling of the backend.

### 10.2 Redis for In-Memory State
- Move `activeRiders`, `userSockets`, and `activeDeliveryRiders` from in-memory Maps to Redis.
- Enables multiple backend instances behind a load balancer.
- Socket.IO adapter: `@socket.io/redis-adapter`.

### 10.3 Background Job Queue
- Replace in-process timers with a job queue (BullMQ + Redis) for:
  - Auto-expiring old delivery tokens.
  - Cleaning up abandoned deliveries.
  - Periodic analytics aggregation.

### 10.4 CDN & Static Asset Separation
- Serve `track.html`, `index.html`, CSS/JS from a CDN.
- API server only handles API + WebSocket traffic.

**Estimated effort:** 4-6 weeks  
**Dependencies:** Phase 7 (security hardening should come first)

---

## Prioritized Roadmap Summary

| Priority | Phase | Name | Effort | Impact | Revenue Driver |
|---|---|---|---|---|---|
| 🔴 P0 | **Phase 4** | Rider Delivery Lifecycle | 2-3 weeks | Critical | Ops efficiency |
| 🟠 P1 | **Phase 5** | Navigation & Address | 1-2 weeks | High | Delivery speed |
| 🟠 P1 | **Phase 7** | Security Hardening | 2 weeks | High | Trust / compliance |
| 🟡 P2 | **Phase 6** | Analytics Dashboard | 2-3 weeks | High | Retention |
| 🟡 P2 | **Phase 8** | Customer Experience | 2 weeks | Medium | NPS / reorders |
| 🟡 P3 | **Phase 9** | White-Label | 3-4 weeks | Medium | B2B revenue |
| 🟢 P4 | **Phase 10** | Scaling Infrastructure | 4-6 weeks | Low (now) | Growth ceiling |

---

## Quick Wins (< 1 day each)

These can be shipped immediately between phases:

| Quick Win | Value |
|---|---|
| Password hashing with bcrypt (Phase 7.1) | Security baseline |
| WhatsApp share button (Phase 8.2) | Customer reach |
| "Navegar" deep link to Google Maps (Phase 5.1) | Rider UX |
| Delivery CSV export (Phase 6.1 subset) | Admin utility |
| Login rate limiting (Phase 7.2) | Security baseline |
| Show delivery count badge next to rider marker on admin map | Admin context |

---

## Open Questions for Product Decision

1. **Multi-delivery priority:** Should riders be able to reorder their delivery queue, or is it strict FIFO from dispatch?
2. **Payment confirmation:** Should riders confirm cash collection amounts, or is the dispatched amount assumed correct?
3. **Geofencing:** Should the app auto-detect when a rider arrives at the delivery address (within 100m) and prompt "¿Llegaste?"
4. **Rider availability:** Should riders be able to set "No disponible" status without ending their shift (e.g., bathroom break, refueling)?
5. **Tenant billing:** Is this a SaaS model (monthly per tenant)? If so, when should usage metering be added?
