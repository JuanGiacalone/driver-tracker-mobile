# Updated Product Requirements Document (PRD): RiderTracker

## 1. Product Overview

**Name:** RiderTracker (also referred to as driver-tracker-mobile)  
**Platform:** React Native (Expo) Mobile App (iOS/Android) & Web admin dashboard.  
**Core Value Proposition:** A scalable, real-time location tracking solution for food delivery riders, supporting multi-tenancy for various organizations. Admins/dispatchers can monitor rider whereabouts during active shifts, while enabling customer visibility into deliveries via temporary access links. The platform ensures secure authentication, seamless background GPS tracking, and reliable WebSocket communication for safe, efficient deliveries across tenants and stores.

This update introduces multi-tenancy to allow the app to scale with additional functionality, including tenant-specific store selection for riders and limited customer access to tracking views.

## 2. Target Audience & Personas

**Persona 1: The Delivery Rider (Mobile App User)**  
- **Needs:** A simple, reliable app to start/end shifts, select and switch stores within their tenant, minimal battery drain, and clear status indicators for tracking. Interface fully in Spanish.  
- **Pain Points:** Apps that crash in the background, drain battery quickly, have confusing interfaces, or lack flexibility in store assignment.

**Persona 2: The Dispatcher/Admin (Dashboard User)**  
- **Needs:** Real-time visibility of active riders on a map, filtered by tenant and store, to assign orders efficiently. View rider status (online, connected, coordinates).  
- **Pain Points:** Limited scalability for managing multiple tenants or stores, inefficient order assignment without integrated tracking.

**Persona 3: The End-User Customer (Temporary Dashboard User)**  
- **Needs:** Temporary, secure access to a simplified dashboard view showing their own location, the assigned rider's live location, and the store location on a map. Access via a time-limited link (expires in 1.5 hours).  
- **Pain Points:** Lack of transparency in delivery status, requiring constant communication with dispatchers or riders.

## 3. Product Goals & Objectives

- **Scalability:** Support multi-tenancy with multiple stores per tenant, enabling growth across organizations without architectural rework.  
- **Simplicity:** 'One-tap' shift management, with intuitive store selection persisted on-device.  
- **Reliability:** Maintain WebSocket connections across network changes, with background GPS tracking and fallback for multi-tenant data handling.  
- **Battery Efficiency:** Location updates every 60 seconds to minimize power consumption.  
- **Real-time Monitoring:** Extend to customer views via temporary links, showing only relevant locations (customer, rider, store).  
- **Security & Privacy:** Ensure temporary customer links are short-lived and scope-limited to prevent unauthorized access.

## 4. Key Features & Requirements

### 4.1 Mobile Application (Rider UI)
- **Authentication:**  
  - Secure JWT-based login using credentials (username or email and password).  
  - SecureStorage for storing JWT tokens.  
  - Automatic injection of JWT tokens for WebSocket connections.  
  - Upon login, fetch tenant-specific data (e.g., list of stores associated with the rider's tenant).

- **Tenant & Store Management:**  
  - Riders are assigned to one tenant.  
  - Display a list of stores belonging to the rider's tenant for selection.  
  - Save selected store in device storage (using `expo-secure-store` for persistence).  
  - Allow store change only when no shift is active; disable selection during active shifts to prevent mid-delivery disruptions.  
  - Emit selected store ID with location updates for backend association.

- **Shift Management:**  
  - One-tap "Start Shift" and "End Shift" mechanism.  
  - Clear visual shift status indicator ("Turno Activo" / "Turno Inactivo").  
  - Integrate store selection as a prerequisite or confirmation step before starting a shift if not already set.

- **Real-time Location Tracking:**  
  - Foreground & Background GPS tracking using Expo Location.  
  - Fallback mechanisms for tracking when the device is locked or minimized.  
  - Location updates restricted to every 60 seconds (configurable) to save battery.  
  - Include tenant ID, store ID, and rider ID in emitted location payloads.

- **Connection Diagnostics:**  
  - Visual dot indicators for WebSocket health: 🟢 Green (Connected), 🟡 Yellow (Connecting), 🔴 Red (Disconnected).  
  - Live display of last emitted coordinates (latitude, longitude), timestamp, and selected store.

- **Language Support:**  
  - Full interface localized in Spanish.

### 4.2 Backend System & Real-Time Server
- **Authentication API:**  
  - Validates credentials and returns JWT + assigned rider ID, tenant ID, and list of associated stores.  
  - Support multi-tenant isolation: Data scoped by tenant ID to prevent cross-tenant access.

- **WebSocket Gateway (socket.io):**  
  - Authenticates sockets using JWT upon connection, verifying tenant and rider details.  
  - Listens for `location` events emitting `tenantId`, `storeId`, `riderId`, `lat`, `lng`, and timestamps.  
  - Listens for `end-shift` events to remove the rider's active tracking session.  
  - Broadcast updates to tenant-specific channels for admins and temporary customer sessions.

- **Admin Dashboard Integration:**  
  - Broadcast active location updates to administrative dashboards, filtered by tenant and store.  
  - Map view showing riders grouped by stores.

- **Customer Temporary Access:**  
  - Temporary authentication links are automatically generated and made available in the admin dashboard when an order is created or assigned to a rider (e.g., linked to a specific delivery ID). Dispatchers can directly share the pre-generated link without needing to initiate a separate generation process.  
  - Links use short-lived JWTs or signed tokens, authenticating users to a restricted dashboard view.  
  - Restricted View:  
    - Display only the customer's location (fetched via browser geolocation or provided in the link payload).  
    - Live rider location (assigned to the delivery).  
    - Store location (fixed or from order data).  
    - No access to other riders, tenants, or full admin features.  
    - Auto-refresh map with real-time updates via WebSocket subscription (scoped to the specific delivery ID).  
  - Security: Tokens invalidate after expiration (1.5 hours) or upon receipt of a "delivered" signal from the rider (indicating delivery completion); revoke automatically on either condition.

## 5. Non-Functional Requirements (NFRs)

- **Performance & Battery:**  
  - Restrict location payload to ~100 bytes per update, including tenant/store metadata.  
  - Ensure background processes sleep between 60-second intervals.  
  - Scale WebSocket handling for multiple tenants (e.g., via clustering or tenant-sharded connections).

- **Security:**  
  - HTTPS / WSS enforceable in production.  
  - Use `expo-secure-store` for token and store selection storage.  
  - Rate-limit login attempts and API calls on the backend.  
  - Multi-tenancy: Strict data isolation using tenant IDs in database queries (e.g., via Drizzle ORM filters).  
  - Temporary links: Use cryptographically signed URLs or JWTs with expiration; log access for auditing. Automatic revocation on delivery completion or time expiry.

- **Cross-Platform Compatibility:**  
  - Compile and run smoothly on Android and iOS, with adaptive layouts.  
  - Handle platform-specific permissions for location and storage.

- **Scalability:**  
  - Database design to support multiple tenants (e.g., tenant_id as a partition key in MySQL).  
  - WebSocket server capable of handling increased connections from riders and temporary customer sessions.

## 6. Technical Architecture

- **Mobile Framework:** React Native 0.81 paired with Expo 54.  
- **Language:** TypeScript.  
- **UI & Styling:** NativeWind 4 (Tailwind CSS for React Native).  
- **State Management:** React Context API + `useReducer` (extended to handle tenant/store state).  
- **Location & Permissions:** `expo-location` (Fine + Background Location).  
- **Storage:** `expo-secure-store` (now also for storing selected store ID).  
- **Network Stack:** Axios (REST API) + Socket.io-client (WebSockets).  
- **Backend Infrastructure:**  
  - Express Server / Node.js.  
  - Drizzle ORM + MySQL 2 (with tenant_id in schemas for isolation).  
  - Socket.io for WebSocket broadcasting (with rooms/channels per tenant and delivery ID).  
  - Additional: Token generation library (e.g., jsonwebtoken) for temporary links.

## 7. User Flows

1. **Initial Access:** App Launch -> Verify JWT? -> (If No) Login Screen -> Authenticate -> Store JWT -> Fetch Tenant Stores -> Select/Confirm Store -> Navigate to Shift Screen.  
2. **Store Selection/Change:** If no shift active, open store selector -> Choose from tenant's stores -> Save to secure storage -> Update UI.  
3. **Start Shift:** Ensure store selected -> Tap "Iniciar Turno" -> Request Permissions -> Open WSS -> Start 60-second location emits (with tenant/store metadata) -> Update UI (Green Dot).  
4. **End Shift:** Tap "Finalizar Turno" -> Stop intervals -> Emit `end-shift` -> Close WSS -> Update UI.  
5. **Customer Access:** When an order is created or assigned in the admin dashboard, a temporary link is automatically generated and displayed for the dispatcher to share directly with the customer -> Customer clicks link -> Authenticates temporarily -> Loads restricted map view -> Auto-subscribes to WebSocket for delivery-specific updates -> View expires after 1.5 hours or upon the rider emitting a "delivered" signal (indicating delivery completion).

## 8. Development & Build Configuration

- Uses ESBuild for bundling backend components.  
- Uses Expo Router for file-based routing.  
- Deployment via EAS with tailored bundles (`.aab` and `.ipa`).  
- Localized dynamic deep linking (extended for tenant-specific schemes if needed).  
- Testing: Add unit tests for multi-tenant data fetching, store persistence, and temporary token expiration.

## 9. Future Enhancements

- **App Rebranding per Tenant:** Customizable themes, logos, and app icons based on tenant configurations (e.g., via dynamic asset loading or build-time variants).  
- **Order Assignment:** Dispatchers assign orders to riders via dashboard; riders receive details (address, payment method, total) in-app notifications.  
- **Delivery Status Updates:** Riders can mark "Arrived and Waiting" and "Delivery Successful" with timestamps and optional photos; updates broadcast to admins and customers.  
- **Push Notifications:** Reminders to end shift, order assignments, or status changes.  
- **Offline Reliability:** Cache location data during network loss, sync on reconnect.  
- **Biometric Security:** Fingerprint/Face ID for faster re-login.  
- **Historical Analysis:** Route playback for past deliveries.  
- **Rider-to-Dispatcher Messaging:** In-app chat for quick coordination.