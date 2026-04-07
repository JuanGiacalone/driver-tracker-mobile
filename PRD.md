# Product Requirements Document (PRD): RiderTracker

## 1. Product Overview

**Name:** RiderTracker (also referred to as driver-tracker-mobile)  
**Platform:** React Native (Expo) Mobile App (iOS/Android) & Web admin dashboard.  
**Core Value Proposition:** A scalable, real-time location tracking solution for food delivery riders, supporting multi-tenancy for various organizations. Admins/dispatchers can monitor rider whereabouts during active shifts, create deliveries with full order details (amount, payment method, recipient), generate temporary customer tracking links, and manage delivery lifecycle. Riders receive in-app delivery notifications with order details during their shifts. Customers can track their assigned rider's live location via a time-limited web page.

## 2. Target Audience & Personas

**Persona 1: The Delivery Rider (Mobile App User)**  
- **Needs:** A simple, reliable app to start/end shifts, select stores within their tenant, view assigned delivery details (recipient, amount, payment method, address), receive push notifications for new deliveries, minimal battery drain, and clear status indicators. Interface fully in Spanish.  
- **Pain Points:** Apps that crash in the background, drain battery quickly, have confusing interfaces, lack delivery context, or miss notifications for new orders.

**Persona 2: The Dispatcher/Admin (Dashboard User)**  
- **Needs:** Real-time visibility of active riders on a map filtered by tenant and store, create deliveries with full order details, generate and share customer tracking links, manage delivery status (active/delivered/expired), and add/manage riders and stores.  
- **Pain Points:** Limited scalability for managing multiple tenants or stores, manual tracking link generation, lack of delivery detail context when dispatching.

**Persona 3: The End-User Customer (Temporary Tracking View)**  
- **Needs:** Temporary, secure access to a simplified tracking page showing their assigned rider's live location and the store location on a map. Access via a time-limited link (expires in 1.5 hours). No app installation required.  
- **Pain Points:** Lack of transparency in delivery status, requiring constant communication with dispatchers or riders.

## 3. Product Goals & Objectives

- **Scalability:** Support multi-tenancy with multiple stores per tenant, enabling growth across organizations without architectural rework.  
- **Simplicity:** One-tap shift management, with intuitive store selection persisted on-device.  
- **Reliability:** Maintain WebSocket connections across network changes, with background GPS tracking and automatic shift management (4-hour auto-end).  
- **Battery Efficiency:** Location updates every 60 seconds to minimize power consumption.  
- **Real-time Monitoring:** Extend to customer views via temporary links, showing relevant locations (customer, rider, store).  
- **Delivery Context:** Provide full delivery details (amount, payment method, recipient) to riders, admins, and customers.  
- **Security & Privacy:** Short-lived customer tokens, tenant-scoped data isolation, and delivery-specific WebSocket rooms.

## 4. Key Features & Requirements

### 4.1 Mobile Application (Rider UI)

- **Authentication:**  
  - Secure JWT-based login using credentials (username and password).  
  - SecureStorage for storing JWT tokens, riderId, tenantId, tenantName, and stores.  
  - Automatic injection of JWT tokens for WebSocket connections.  
  - Upon login, fetch tenant-specific data (list of stores, rider assignment).

- **Tenant & Store Management:**  
  - Riders are assigned to one tenant.  
  - Display a list of stores belonging to the rider's tenant for selection.  
  - Save selected store in device storage (using `expo-secure-store`).  
  - Allow store change only when no shift is active; disable selection during active shifts.  
  - Emit selected store ID with location updates for backend association.

- **Shift Management:**  
  - One-tap "Start Shift" and "End Shift" mechanism.  
  - Clear visual shift status indicator ("Turno Activo" / "Turno Inactivo").  
  - Store selection required as prerequisite before starting a shift.  
  - **4-hour auto-end:** Shifts automatically end after 4 hours to prevent indefinite tracking.  
  - **Countdown timer:** Visual progress bar and remaining time display.  
  - **Shift notification schedule (all in Spanish):**  
    - On shift start: "Turno iniciado · Rastreo activo"  
    - 30 min before end: "Tu turno termina en 30 minutos"  
    - At 4h (auto-end): "Tu turno ha finalizado automáticamente"  
    - 1h without opening app: "Llevas más de 1 hora sin abrir la app"  
  - Idle timer resets when app is foregrounded.

- **Delivery Notifications & Details:**  
  - When a delivery is assigned via the admin dashboard, rider receives a push notification: "📦 Nueva entrega asignada — {recipientName} · ${amount} · {paymentMethod}"  
  - **Delivery card** displayed on shift screen showing:  
    - 👤 Recipient name  
    - 💰 Amount  
    - 💳 Payment method (Efectivo, Transferencia, MercadoPago, Tarjeta)  
    - 📍 Customer address (if provided)  
  - Delivery data received via WebSocket `new-delivery` event.

- **Real-time Location Tracking:**  
  - Foreground & Background GPS tracking using `expo-location` with Android foreground service.  
  - Location updates every 60 seconds via background task.  
  - Include tenant ID, store ID, and rider ID in emitted location payloads.  
  - Dual update path: HTTP REST POST fallback (background) + WebSocket emit (foreground).  
  - Deduplication logic prevents sending updates more frequently than every 10 seconds.  
  - Credential caching to avoid SecureStore/Keystore overhead in background task.

- **Connection Diagnostics:**  
  - Visual dot indicators for WebSocket health: 🟢 Green (Connected), 🟡 Yellow (Connecting), 🔴 Red (Disconnected).  
  - Live display of last emitted coordinates (latitude, longitude) and timestamp.

- **Language Support:**  
  - Full interface localized in Spanish.

### 4.2 Backend System & Real-Time Server

- **Authentication API:**  
  - `POST /api/login` — Validates credentials, returns JWT + riderId, tenantId, tenantName, stores list.  
  - `POST /api/riders` — Admin-only endpoint to create new rider accounts.  
  - Multi-tenant isolation: Data scoped by tenant ID in all queries.

- **Store Management API:**  
  - `GET /api/stores` — Returns stores for the admin's tenant.  
  - `POST /api/stores` — Admin-only endpoint to create new stores with name, lat, lng.

- **Location API:**  
  - `POST /api/location` — Accepts rider location updates (lat, lng, ts, storeId) with JWT auth.  
  - Broadcasts to tenant room via WebSocket for real-time admin dashboard updates.

- **Delivery Management API:**  
  - `POST /api/deliveries` — Create delivery assigning rider + store, with order details:  
    - `riderUsername` (required)  
    - `storeId` (required)  
    - `recipientName` — customer name  
    - `amount` — delivery total  
    - `paymentMethod` — Efectivo, Transferencia, MercadoPago, Tarjeta  
    - `customerAddress` — optional delivery address  
  - On creation, emits `new-delivery` WebSocket event directly to the assigned rider's socket.  
  - `GET /api/deliveries` — List active deliveries filtered by tenant and optionally by `?storeId=` (matches admin's current store filter).  
  - `POST /api/deliveries/:id/link` — Generates a short-lived customer JWT (1.5h expiry) containing delivery details (riderId, storeId, storeLat, storeLng, storeName, recipientName, amount, paymentMethod). Returns a shareable `track.html?token=` URL.  
  - `PATCH /api/deliveries/:id` — Update delivery status to `delivered` or `expired`. Notifies connected customer sockets and cleans up in-memory tracking.

- **Health API:**  
  - `GET /api/health` — Returns server status and active rider count.

- **WebSocket Gateway (Socket.IO):**  
  - Authenticates sockets using JWT upon connection, verifying tenant and rider/customer details.  
  - **Admin/Rider connections:**  
    - Join tenant-specific room on connect.  
    - `location` events broadcast rider position to tenant room.  
    - `end-shift` events remove rider from active tracking.  
    - `initial-state` event sends current rider positions to newly connected admins.  
    - `rider-offline` event broadcast when rider disconnects.  
    - `new-delivery` event emitted directly to rider's socket when a delivery is assigned.  
  - **Customer connections (role: "customer"):**  
    - Authenticated via customer JWT with `role: 'customer'`.  
    - Join delivery-specific room: `delivery:<deliveryId>`.  
    - Receive `delivery-info` on connect (storeName, storeLat, storeLng, riderId).  
    - Receive `rider-location` updates scoped to their delivery's rider.  
    - Receive `delivery-complete` when delivery is marked delivered/expired.  
    - Isolated: no access to other riders, tenants, or admin features.  
  - **Delivery room broadcasting:** Rider location updates also broadcast to all `delivery:<deliveryId>` rooms associated with that rider (tracked via `activeDeliveryRiders` Map).

- **Database (SQLite via better-sqlite3):**  
  - `tenants` — id, name  
  - `stores` — id, tenant_id, name, lat, lng  
  - `users` — id, username, password, role (admin/rider), store_id, tenant_id  
  - `deliveries` — id, tenant_id, store_id, rider_username, status (active/delivered/expired), customer_address, amount, payment_method, recipient_name, created_at  
  - Auto-migration for schema changes (ALTER TABLE fallback for existing databases).  
  - Seed data for development (default tenant, stores, admin, riders).

- **In-Memory State:**  
  - `activeRiders` Map — riderId → { lat, lng, ts, tenantId, storeId, storeName }  
  - `userSockets` Map — username → Socket (for direct rider notifications)  
  - `activeDeliveryRiders` Map — riderId → Set<deliveryId> (for delivery room broadcasting)

### 4.3 Admin Dashboard (Web)

- **Authentication:** JWT-based login form. Token stored in-memory for session.
- **Real-time Map:**  
  - Leaflet.js with CartoDB dark tiles.  
  - Rider markers with motorcycle icon, auto-updating positions via WebSocket.  
  - Store markers at fixed coordinates.  
  - Filter riders by store via header dropdown.
- **Rider Management:**  
  - "➕ Agregar Repartidor" — modal to create new rider accounts.
- **Delivery Management:**  
  - "📦 Nueva Entrega" — modal with fields:  
    - Repartidor (username)  
    - Sucursal (dropdown populated from stores)  
    - Nombre del destinatario (required)  
    - Monto ($ number input, required)  
    - Método de pago (Efectivo/Transferencia/MercadoPago/Tarjeta, required)  
    - Dirección del cliente (optional)  
  - Two-step flow: Create → Show link with copy-to-clipboard.  
  - "Crear otra entrega" for batch workflows.
- **UI:** Vanilla HTML/CSS/JS, dark theme, glassmorphism, mobile-responsive header with auto-hide.

### 4.4 Customer Tracking Page (`track.html`)

- **Standalone static HTML page** served by the Express server (no framework required).
- **Authentication:** JWT token passed as `?token=` URL parameter. Validated on WebSocket connection.
- **Map:** Dark Leaflet map (CartoDB dark tiles) with three marker types:  
  - 🏍️ Rider marker — live position via `rider-location` WebSocket events.  
  - 🏪 Store marker — fixed position from delivery info.  
  - 📍 Customer marker — browser geolocation (optional, non-blocking).  
- **Auto-fit bounds:** Map automatically adjusts to show all visible markers.
- **Status bar (top):** Connection indicator (🟢 connected / 🟡 connecting / 🔴 disconnected).
- **Info card (bottom):** Delivery status, store name, last update time.
- **Overlay states:** Loading (spinner), Error (invalid link), Expired (token expired), Completed (delivery finished).
- **Styling:** Mobile-first dark theme with glassmorphism, responsive layout (centered card on desktop).
- **Expiry:** Token expires after 1.5 hours. Server disconnects customer when delivery is marked delivered/expired.

## 5. Non-Functional Requirements (NFRs)

- **Performance & Battery:**  
  - Background location updates every 60 seconds with deduplication guard (10s minimum).  
  - ~100 bytes per location payload including tenant/store metadata.  
  - Foreground service notification on Android for persistent background tracking.  
  - 4-hour shift auto-end to prevent indefinite battery drain.

- **Security:**  
  - HTTPS / WSS enforceable in production (Helmet middleware with HSTS disabled for dev).  
  - `expo-secure-store` for token and credential storage on mobile.  
  - JWT signing with configurable `JWT_SECRET` environment variable.  
  - Multi-tenancy: Strict data isolation using tenant IDs in all database queries.  
  - Customer tokens: Cryptographically signed JWTs with 1.5-hour expiration, scoped to specific delivery ID. Automatic revocation on delivery completion.  
  - Duplicate session handling: Previous socket connections for the same user are automatically disconnected.

- **Cross-Platform Compatibility:**  
  - Compile and run on Android and iOS via Expo.  
  - Platform-specific permissions handled: foreground location, background location, notifications (Android 13+).

- **Scalability:**  
  - Database with tenant_id partitioning.  
  - WebSocket rooms per tenant and per delivery for efficient broadcasting.

## 6. Technical Architecture

- **Mobile Framework:** React Native 0.81 paired with Expo 54.  
- **Language:** TypeScript.  
- **UI & Styling:** NativeWind 4 (Tailwind CSS for React Native).  
- **State Management:** React Context API + `useReducer` (AuthContext for auth/tenant/store state).  
- **Location & Permissions:** `expo-location` (foreground + background) + `expo-task-manager`.  
- **Notifications:** `expo-notifications` for local shift and delivery notifications.  
- **Storage:** `expo-secure-store` (JWT, riderId, tenantId, storeId) + `@react-native-async-storage/async-storage` (shift timestamps, location dedup).  
- **Network Stack:** Axios (REST API) + Socket.io-client (WebSockets, `websocket` transport only).  
- **Backend Infrastructure:**  
  - Node.js + Express server (`dashboard/server.js`).  
  - SQLite via `better-sqlite3` (`dashboard/db.js`) with auto-migration.  
  - Socket.IO for WebSocket broadcasting with rooms per tenant and delivery.  
  - `jsonwebtoken` for JWT signing/verification (admin, rider, and customer tokens).  
  - `helmet` + `cors` middleware for security headers.  
  - Static file serving for admin dashboard and customer tracking page.
- **Testing:**  
  - Vitest + Supertest for API endpoint testing (39 tests across 11 suites).  
  - Test coverage: login, health, stores (GET/POST), location, riders, deliveries (CRUD + link generation), auth edge cases (expired/malformed tokens).

## 7. User Flows

1. **Rider Login:** App Launch → Verify JWT in SecureStore → (If No) Login Screen → POST /api/login → Store JWT/riderId/tenantId/stores → Navigate to Shift Screen.  
2. **Store Selection:** If no shift active, open store selector → Choose from tenant's stores → Save to SecureStore → Update UI.  
3. **Start Shift:** Ensure store selected → Tap "Iniciar Turno" → Request permissions (location + notifications) → Connect WebSocket → Send initial location → Start 60s background GPS task → Start 4-hour shift timer + notifications → Update UI (Green Dot, countdown timer).  
4. **Receive Delivery:** Admin creates delivery in dashboard → Server emits `new-delivery` to rider socket → Rider receives push notification "📦 Nueva entrega asignada — Juan · $1500 · Efectivo" → Delivery card appears on shift screen showing recipient, amount, payment, address.  
5. **End Shift:** Tap "Finalizar Turno" → Confirm alert → Stop background GPS → Emit `end-shift` → Close WebSocket → Cancel scheduled notifications → Reset timer → Update UI.  
6. **Auto-End Shift:** 4 hours elapsed → Background task detects expiry → Stop location updates → Fire "Turno finalizado automáticamente" notification → Clean up shift state.  
7. **Admin Creates Delivery:** Login to dashboard → ⚙️ → "📦 Nueva Entrega" → Fill rider, store, recipient, amount, payment method, address → Submit → API creates delivery + notifies rider → Generates tracking link → Copy to clipboard → Share with customer.  
8. **Customer Tracking:** Customer receives link → Opens `track.html?token=...` → WebSocket authenticates via customer JWT → Joins `delivery:<id>` room → Receives store info + current rider position → Map shows live rider marker → On delivery completion: "Entrega Completada" overlay → Token expires after 1.5h.

## 8. Project Structure

```
driver-tracker-mobile/
├── app/                          # Expo Router screens
│   ├── (tabs)/
│   │   ├── _layout.tsx           # Tab layout configuration
│   │   ├── index.tsx             # Home redirect (→ /shift or /login)
│   │   └── shift.tsx             # Main rider shift screen
│   ├── _layout.tsx               # Root layout (AuthProvider, ThemeProvider)
│   └── login.tsx                 # Login screen
├── components/                   # Reusable UI components
│   ├── screen-container.tsx      # Safe area wrapper
│   └── ui/                       # Base UI elements
├── hooks/                        # Custom hooks
│   ├── use-auth.ts               # Auth hook
│   └── use-colors.ts             # Theme colors
├── lib/                          # Core services
│   ├── auth-context.tsx          # AuthProvider (Context + Reducer)
│   ├── location-service.ts       # LocationService class (GPS + WebSocket)
│   ├── shift-manager.ts          # Shift timer + notifications
│   └── utils.ts                  # Utility functions
├── dashboard/                    # Admin backend + web UI
│   ├── server.js                 # Express + Socket.IO server
│   ├── db.js                     # SQLite database (schema + migrations + seeds)
│   ├── server.test.mjs           # API test suite (39 tests)
│   ├── TESTING.md                # Test documentation
│   └── public/                   # Static web assets
│       ├── index.html            # Admin dashboard
│       ├── track.html            # Customer tracking page
│       └── track.css             # Customer tracking styles
├── drizzle/                      # Drizzle ORM schema (MySQL reference)
└── server/                       # tRPC backend (alternative)
```

## 9. Development & Build Configuration

- Uses Expo Router for file-based routing.  
- Deployment via EAS with tailored bundles (`.aab` and `.ipa`).  
- Dashboard backend: `cd dashboard && npm run dev` (uses `node --watch` for auto-reload).  
- Testing: `cd dashboard && npm test` (Vitest + Supertest, 39 tests).  
- Environment variables: `PORT`, `NODE_ENV`, `JWT_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`.  
- Mobile API URL configured via `EXPO_PUBLIC_API_URL` environment variable.

## 10. Future Enhancements

- **App Rebranding per Tenant:** Customizable themes, logos, and app icons based on tenant configurations.  
- **Delivery Status Updates:** Riders mark "Arrived and Waiting" and "Delivery Successful" with timestamps and optional photos; updates broadcast to admins and customers.  
- **Offline Reliability:** Cache location data during network loss, sync on reconnect.  
- **Biometric Security:** Fingerprint/Face ID for faster re-login.  
- **Historical Analysis:** Route playback for past deliveries.  
- **Rider-to-Dispatcher Messaging:** In-app chat for quick coordination.  
- **Multi-delivery Support:** Multiple concurrent deliveries per rider with stacked delivery cards.  
- **Delivery History:** Admin view of past deliveries with filtering and export.  
- **Customer Feedback:** Rating system after delivery completion.