# RiderTracker - Testing Guide

This guide provides comprehensive testing instructions for the entire RiderTracker system, including the backend server, mobile app, and admin dashboard.

## System Overview

RiderTracker consists of three main components that work together:

1. **Backend Server** (Node.js + Socket.IO): Handles authentication, stores rider locations, and broadcasts updates
2. **Mobile App** (React Native): Driver interface for authentication, shift management, and location sharing
3. **Admin Dashboard** (HTML/JavaScript): Live map interface for monitoring active riders

## Pre-Testing Setup

### Prerequisites

Ensure you have the following installed and ready:

- Node.js 20+ with npm
- Expo CLI (`npm install -g expo-cli`)
- Git for version control
- A terminal/command prompt
- A web browser (Chrome, Firefox, Safari)
- An Android device or emulator (for mobile testing)

### Project Structure

Both projects should be in the same parent directory:

```
driver-tracker/
├── driver-tracker-backend/
└── driver-tracker-mobile/
```

### Initial Setup

1. **Backend Setup:**
   ```bash
   cd driver-tracker-backend
   npm install
   ```

2. **Mobile App Setup:**
   ```bash
   cd driver-tracker-mobile
   npm install
   ```

## Backend Testing

### 1. Server Startup Test

**Objective:** Verify the backend server starts correctly

**Steps:**
1. Navigate to backend directory: `cd driver-tracker-backend`
2. Start development server: `npm run dev`
3. Observe console output

**Expected Result:**
```
[Server] RiderTracker Backend listening on port 3000
[Server] Environment: development
[Server] Ready for connections...
```

**Pass Criteria:**
- Server starts without errors
- Port 3000 is available
- No error messages in console

### 2. Health Check Endpoint Test

**Objective:** Verify the health check endpoint responds correctly

**Steps:**
1. Open terminal/command prompt
2. Run: `curl http://localhost:3000/api/health`
3. Observe response

**Expected Response:**
```json
{
  "status": "ok",
  "activeRiders": 0
}
```

**Pass Criteria:**
- Status is "ok"
- activeRiders is a number
- Response time < 100ms

### 3. Login Endpoint Test

**Objective:** Test authentication with valid and invalid credentials

**Test Case 1: Valid Credentials**

```bash
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "rider1@example.com",
    "password": "password123"
  }'
```

**Expected Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "riderId": "rider_1708700000000_abc123def",
  "email": "rider1@example.com"
}
```

**Pass Criteria:**
- Token is a valid JWT
- riderId is a non-empty string
- Email matches input

**Test Case 2: Invalid Credentials**

```bash
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "rider1@example.com",
    "password": "wrongpassword"
  }'
```

**Expected Response:**
```json
{
  "error": "Invalid credentials"
}
```

**Pass Criteria:**
- Returns error message
- HTTP status is 401 (Unauthorized)
- No token is issued

**Test Case 3: Missing Fields**

```bash
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "rider1@example.com"
  }'
```

**Expected Response:**
```json
{
  "error": "Email and password required"
}
```

**Pass Criteria:**
- Returns error message
- HTTP status is 400 (Bad Request)

### 4. WebSocket Connection Test

**Objective:** Test WebSocket connection with valid JWT token

**Steps:**

1. Get a valid token from login endpoint (see Test 3, Case 1)
2. Create a test file `test-socket.js`:

```javascript
const io = require("socket.io-client");

const token = "YOUR_JWT_TOKEN_HERE"; // Replace with token from login

const socket = io("http://localhost:3000", {
  auth: {
    token: token
  }
});

socket.on("connect", () => {
  console.log("[✓] Connected to server");
  console.log("Socket ID:", socket.id);
  
  // Test location emission
  socket.emit("location", {
    riderId: "test_rider",
    lat: -34.6037,
    lng: -58.3816,
    ts: Date.now()
  });
  
  console.log("[✓] Location emitted");
});

socket.on("disconnect", () => {
  console.log("[✗] Disconnected from server");
});

socket.on("error", (error) => {
  console.error("[✗] Socket error:", error);
});

socket.on("connect_error", (error) => {
  console.error("[✗] Connection error:", error);
});

setTimeout(() => {
  socket.disconnect();
  console.log("[✓] Test completed");
  process.exit(0);
}, 3000);
```

3. Run: `node test-socket.js`

**Expected Output:**
```
[✓] Connected to server
Socket ID: abc123def...
[✓] Location emitted
[✓] Disconnected from server
[✓] Test completed
```

**Pass Criteria:**
- Successfully connects with valid token
- Can emit location events
- Disconnects cleanly

### 5. In-Memory Storage Test

**Objective:** Verify rider locations are stored and retrieved correctly

**Steps:**

1. Start backend: `npm run dev`
2. Get valid token from login
3. Connect two WebSocket clients with different rider IDs
4. Each client emits a location
5. Check health endpoint

**Expected Behavior:**
- Health endpoint shows `activeRiders: 2`
- Each rider's location is stored
- Locations persist until shift ends

**Pass Criteria:**
- Active rider count increases with each connection
- Locations are stored correctly
- Locations are cleared on disconnect

## Mobile App Testing

### 1. App Startup Test

**Objective:** Verify the app starts without errors

**Steps:**
1. Navigate to mobile app directory: `cd driver-tracker-mobile`
2. Start Expo: `npm run dev`
3. Scan QR code with Expo Go or use emulator

**Expected Result:**
- App loads without crashing
- Login screen appears
- Demo credentials are visible

**Pass Criteria:**
- App launches successfully
- No console errors
- UI is responsive

### 2. Login Screen Test

**Objective:** Test authentication flow on mobile app

**Test Case 1: Valid Login**

**Steps:**
1. Enter email: `rider1@example.com`
2. Enter password: `password123`
3. Tap "Iniciar Sesión" (Login)
4. Wait for response

**Expected Result:**
- Loading indicator appears
- After 2-3 seconds, navigates to Shift Screen
- Rider ID is displayed

**Pass Criteria:**
- Login succeeds
- Navigation works
- No error messages

**Test Case 2: Invalid Credentials**

**Steps:**
1. Enter email: `rider1@example.com`
2. Enter password: `wrongpassword`
3. Tap "Iniciar Sesión"

**Expected Result:**
- Error message appears: "Error de Autenticación"
- Stays on login screen
- Can retry

**Pass Criteria:**
- Error is displayed
- User can try again
- App doesn't crash

**Test Case 3: Empty Fields**

**Steps:**
1. Leave email and password empty
2. Tap "Iniciar Sesión"

**Expected Result:**
- Alert: "Por favor completa todos los campos"
- Stays on login screen

**Pass Criteria:**
- Validation works
- Helpful error message

### 3. Shift Screen Test

**Objective:** Test shift management functionality

**Test Case 1: Start Shift**

**Steps:**
1. Login successfully
2. Verify "Turno Inactivo" is displayed
3. Tap "Iniciar Turno" (Start Shift)
4. Grant location permissions when prompted
5. Wait 3-5 seconds

**Expected Result:**
- Status changes to "Turno Activo"
- Connection status shows "Conectado"
- Green dot appears next to status
- Current location is displayed (latitude, longitude)
- Timestamp shows "Última actualización"

**Pass Criteria:**
- Shift starts successfully
- Location permissions are requested
- Connection is established
- Location data is displayed

**Test Case 2: Location Updates**

**Steps:**
1. Shift is active
2. Wait 60 seconds
3. Observe location updates

**Expected Result:**
- Timestamp updates every 60 seconds
- Location may change if device moved
- No errors in console

**Pass Criteria:**
- Location updates occur
- Timestamps are accurate
- Updates are regular

**Test Case 3: End Shift**

**Steps:**
1. Shift is active
2. Tap "Finalizar Turno" (End Shift)
3. Confirm in dialog

**Expected Result:**
- Status changes to "Turno Inactivo"
- Connection status shows "Desconectado"
- Location display clears
- Button text changes back to "Iniciar Turno"

**Pass Criteria:**
- Shift ends successfully
- UI updates correctly
- Connection closes

### 4. Logout Test

**Objective:** Test logout functionality

**Steps:**
1. On Shift Screen
2. Tap "Cerrar Sesión" (Logout)
3. Confirm navigation

**Expected Result:**
- Navigates back to Login Screen
- Stored token is cleared
- Can login again with new credentials

**Pass Criteria:**
- Logout works
- Token is cleared
- Can login again

### 5. Permission Handling Test

**Objective:** Test location permission handling

**Test Case 1: Permission Granted**

**Steps:**
1. On Shift Screen
2. Tap "Iniciar Turno"
3. Tap "Allow" on permission prompt
4. Wait for connection

**Expected Result:**
- Location permission is granted
- WebSocket connects
- Location is displayed

**Pass Criteria:**
- Permission flow works
- App continues normally

**Test Case 2: Permission Denied**

**Steps:**
1. On Shift Screen
2. Tap "Iniciar Turno"
3. Tap "Deny" on permission prompt

**Expected Result:**
- Error alert: "Permiso de ubicación denegado"
- Shift doesn't start
- Button remains "Iniciar Turno"

**Pass Criteria:**
- Error is handled gracefully
- App doesn't crash
- User can retry

## Admin Dashboard Testing

### 1. Admin Login Test

**Objective:** Test admin authentication

**Steps:**
1. Open browser to `http://localhost:3000`
2. See login form
3. Enter username: `admin`
4. Enter password: `adminpass`
5. Click "Iniciar Sesión"

**Expected Result:**
- Login succeeds
- Redirects to map view
- Map is displayed
- "Sin Conductores Activos" message appears

**Pass Criteria:**
- Login works
- Map loads
- No active riders initially

### 2. Map Initialization Test

**Objective:** Verify map displays correctly

**Expected Result:**
- Map is centered at Buenos Aires (-34.6037, -58.3816)
- Zoom level is 10
- OpenStreetMap tiles load
- No console errors

**Pass Criteria:**
- Map renders
- Tiles load
- Zoom controls work

### 3. Real-time Rider Updates Test

**Objective:** Test real-time marker updates

**Steps:**
1. Admin dashboard is open and logged in
2. Start shift on mobile app
3. Observe dashboard

**Expected Result:**
- Rider marker appears on map after 1-2 seconds
- Marker shows at rider's location
- "Conductores Activos" count increases to 1
- Popup shows rider ID and "Última actualización"

**Pass Criteria:**
- Marker appears
- Location is accurate
- Count updates

### 4. Multiple Riders Test

**Objective:** Test with multiple active riders

**Steps:**
1. Admin dashboard is open
2. Start shift on mobile app 1
3. Start shift on mobile app 2 (different device/emulator)
4. Observe dashboard

**Expected Result:**
- Two markers appear on map
- Count shows "2"
- Each marker has unique rider ID
- Both receive location updates

**Pass Criteria:**
- Multiple riders are tracked
- Each has unique marker
- All receive updates

### 5. Rider Disconnect Test

**Objective:** Test marker removal on shift end

**Steps:**
1. Multiple riders are active on dashboard
2. End shift on one mobile app
3. Observe dashboard

**Expected Result:**
- Corresponding marker disappears
- Count decreases
- Other markers remain

**Pass Criteria:**
- Marker is removed
- Count updates
- Other riders unaffected

### 6. Connection Status Test

**Objective:** Test connection indicator

**Expected Result:**
- Green dot + "Conectado" when connected
- Red dot + "Desconectado" when disconnected
- Yellow dot + "Cargando..." during initial load

**Pass Criteria:**
- Status indicator updates
- Reflects actual connection state

### 7. Logout Test

**Objective:** Test admin logout

**Steps:**
1. Click "Cerrar Sesión" (Logout)
2. Confirm

**Expected Result:**
- Navigates back to login screen
- Map is hidden
- Can login again

**Pass Criteria:**
- Logout works
- Session is cleared

## End-to-End Integration Tests

### Test 1: Complete Shift Lifecycle

**Scenario:** A rider completes a full shift from login to logout

**Steps:**
1. Backend is running
2. Admin dashboard is open and logged in
3. Mobile app is open on login screen
4. Login on mobile app
5. Start shift
6. Wait 2 minutes (observe location updates)
7. End shift
8. Logout

**Expected Results:**
- Login succeeds
- Shift starts, marker appears on dashboard
- Location updates every 60 seconds
- Marker moves on dashboard
- Shift ends, marker disappears
- Logout succeeds

**Pass Criteria:**
- All steps complete successfully
- No errors or crashes
- Real-time updates work

### Test 2: Multiple Concurrent Riders

**Scenario:** Multiple riders are active simultaneously

**Steps:**
1. Backend is running
2. Admin dashboard is open
3. Start 3-5 shifts on different devices/emulators
4. Observe dashboard for 2-3 minutes
5. End shifts in random order

**Expected Results:**
- All riders appear on map
- All receive location updates
- Markers move as riders move
- Markers disappear as shifts end
- Dashboard remains responsive

**Pass Criteria:**
- System handles multiple riders
- No performance degradation
- All updates are real-time

### Test 3: Network Reconnection

**Scenario:** Mobile app loses and regains connection

**Steps:**
1. Shift is active
2. Disable network on mobile device
3. Wait 10 seconds
4. Re-enable network
5. Observe app behavior

**Expected Results:**
- Connection status changes to "Desconectado"
- App attempts to reconnect
- After network is restored, status changes to "Conectado"
- Location updates resume

**Pass Criteria:**
- Automatic reconnection works
- Status updates correctly
- Updates resume after reconnection

### Test 4: Backend Restart

**Scenario:** Backend server restarts while riders are active

**Steps:**
1. Multiple riders are active
2. Stop backend server (Ctrl+C)
3. Observe mobile app behavior
4. Restart backend
5. Observe recovery

**Expected Results:**
- Mobile apps show "Desconectado"
- Apps attempt to reconnect
- After backend restarts, apps reconnect
- Location updates resume
- Admin dashboard shows riders again

**Pass Criteria:**
- Apps handle server restart gracefully
- Automatic reconnection works
- System recovers properly

## Performance Testing

### Test 1: Concurrent Connections

**Objective:** Test system with maximum concurrent riders

**Steps:**
1. Create 50 WebSocket connections
2. Each emits location every 60 seconds
3. Monitor backend performance
4. Check admin dashboard responsiveness

**Expected Results:**
- All connections succeed
- No connection timeouts
- Dashboard remains responsive
- Memory usage stays reasonable

**Pass Criteria:**
- System supports 50 concurrent riders
- No performance degradation

### Test 2: Location Update Frequency

**Objective:** Test with faster location updates

**Steps:**
1. Modify mobile app to emit location every 10 seconds
2. Start shift
3. Monitor backend and dashboard

**Expected Results:**
- Updates are received and processed
- Dashboard updates smoothly
- No data loss

**Pass Criteria:**
- System handles increased frequency
- All updates are received

## Security Testing

### Test 1: Invalid JWT Token

**Objective:** Test WebSocket connection with invalid token

**Steps:**
1. Try to connect WebSocket with invalid token
2. Observe server response

**Expected Result:**
- Connection is rejected
- Error message is returned
- No access to rider data

**Pass Criteria:**
- Invalid tokens are rejected
- Security is maintained

### Test 2: Missing Credentials

**Objective:** Test login without credentials

**Steps:**
1. Try to login without email/password
2. Try to connect WebSocket without token

**Expected Result:**
- Both are rejected with error messages
- No access is granted

**Pass Criteria:**
- Validation works
- Security is maintained

### Test 3: SQL Injection Attempt

**Objective:** Test input validation

**Steps:**
1. Try to login with SQL injection payload
2. Observe response

**Expected Result:**
- Payload is treated as regular string
- No database error
- Login fails normally

**Pass Criteria:**
- Input is properly validated
- No injection vulnerabilities

## Browser Compatibility Testing

### Test on Multiple Browsers

**Browsers to Test:**
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

**Steps:**
1. Open admin dashboard in each browser
2. Login
3. Start shift on mobile app
4. Observe marker updates

**Expected Result:**
- Admin dashboard works in all browsers
- Map renders correctly
- Real-time updates work

**Pass Criteria:**
- Cross-browser compatibility confirmed

## Mobile Device Testing

### Test on Different Android Versions

**Versions to Test:**
- Android 10
- Android 11
- Android 12
- Android 13
- Android 14

**Steps:**
1. Build APK for each version
2. Install and run
3. Test all features

**Expected Result:**
- App works on all versions
- Location permissions work
- WebSocket connects

**Pass Criteria:**
- Android 10+ compatibility confirmed

## Regression Testing Checklist

After making changes, verify:

- [ ] Backend starts without errors
- [ ] Health check endpoint works
- [ ] Login endpoint works with valid/invalid credentials
- [ ] WebSocket connections work
- [ ] Mobile app starts without crashes
- [ ] Login flow works
- [ ] Shift start/end works
- [ ] Location updates appear
- [ ] Admin dashboard loads
- [ ] Markers appear and update
- [ ] Logout works
- [ ] No console errors

## Bug Report Template

When reporting issues, include:

```
**Title:** [Brief description]

**Steps to Reproduce:**
1. 
2. 
3. 

**Expected Behavior:**
[What should happen]

**Actual Behavior:**
[What actually happens]

**Environment:**
- Backend: [version/commit]
- Mobile App: [version/commit]
- Device: [Android version/browser]
- Network: [WiFi/cellular]

**Logs:**
[Console errors, stack traces]

**Screenshots:**
[If applicable]
```

## Test Results Summary

Create a test results document:

```
# Test Results - [Date]

## Backend Tests
- [ ] Server Startup: PASS/FAIL
- [ ] Health Check: PASS/FAIL
- [ ] Login Valid: PASS/FAIL
- [ ] Login Invalid: PASS/FAIL
- [ ] WebSocket: PASS/FAIL

## Mobile App Tests
- [ ] App Startup: PASS/FAIL
- [ ] Login: PASS/FAIL
- [ ] Start Shift: PASS/FAIL
- [ ] Location Updates: PASS/FAIL
- [ ] End Shift: PASS/FAIL
- [ ] Logout: PASS/FAIL

## Admin Dashboard Tests
- [ ] Login: PASS/FAIL
- [ ] Map Display: PASS/FAIL
- [ ] Rider Markers: PASS/FAIL
- [ ] Real-time Updates: PASS/FAIL
- [ ] Logout: PASS/FAIL

## Integration Tests
- [ ] Complete Lifecycle: PASS/FAIL
- [ ] Multiple Riders: PASS/FAIL
- [ ] Network Reconnection: PASS/FAIL
- [ ] Backend Restart: PASS/FAIL

## Overall: PASS/FAIL
```

## Continuous Testing

### Automated Testing

For continuous integration, consider adding:

```bash
# Backend tests
npm test

# Mobile app tests
npm run test

# Linting
npm run lint

# Type checking
npm run check
```

### Manual Testing Schedule

- **Daily:** Core functionality (login, shift, logout)
- **Weekly:** All features, multiple riders
- **Before Release:** Full regression testing

## Support

For testing issues or questions, refer to the main README files in each project directory.
