# RiderTracker - Project TODO

## Mobile App (React Native)
- [x] Configure app branding (logo, app name)
- [x] Create Login Screen (email/password form)
- [x] Implement JWT authentication flow
- [x] Secure token storage (SecureStore)
- [x] Create Shift Status Screen
- [x] Implement location permissions handling
- [x] Integrate expo-location for GPS updates
- [x] Implement WebSocket connection (Socket.IO client)
- [x] Emit location events every 60 seconds
- [x] Handle shift start/end logic
- [x] Display connection status indicator
- [x] Display GPS status indicator
- [x] Implement automatic reconnect with exponential backoff
- [x] Handle background location updates
- [x] Translate all UI text to Spanish
- [ ] Test on Android 10+ (manual testing required)

## Backend (Node.js + Socket.IO)
- [x] Initialize Express server with Socket.IO
- [x] Implement JWT authentication endpoint (POST /api/login)
- [x] Implement in-memory storage for active riders
- [x] Implement socket event handlers (location, end-shift)
- [x] Implement admin authentication and room
- [x] Implement initial-state event for admin
- [x] Implement rider-update broadcast
- [x] Implement rider-offline broadcast
- [x] Add helmet for security headers
- [x] Add input validation
- [ ] Add basic unit tests (Jest) - optional enhancement
- [x] Write deployment README

## Admin Web Interface (HTML/JS + Leaflet.js)
- [x] Create single-page HTML app
- [x] Implement admin authentication (login form)
- [x] Integrate Leaflet.js with OpenStreetMap
- [x] Initialize map at Buenos Aires (default)
- [x] Implement Socket.IO client connection
- [x] Handle initial-state event
- [x] Handle rider-update event
- [x] Handle rider-offline event
- [x] Create and manage rider markers
- [x] Update marker popups with time ago display
- [x] Implement loading spinner
- [x] Add No active riders fallback message
- [x] Optimize for desktop browsers (1024x768+)

## General
- [x] Generate app logo and update branding
- [x] Create comprehensive README with setup instructions
- [x] Document deployment steps
- [x] Create testing instructions
- [ ] Ensure HTTPS for all communications (production setup)
- [ ] Verify system supports up to 50 concurrent riders (performance testing)
