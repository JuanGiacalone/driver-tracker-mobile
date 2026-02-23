# DriverTracker Mobile App - Design Document

## Screen List

1. **Login Screen** — Initial authentication (email/password)
2. **Shift Status Screen** — Main screen with shift toggle and status display

## Primary Content and Functionality

### Login Screen
- **Content**: Email input field, password input field, login button
- **Functionality**: 
  - Validate credentials against backend
  - Store JWT token securely (SecureStore)
  - Generate driver ID from backend response
  - Navigate to Shift Status on success

### Shift Status Screen
- **Content**: 
  - Large status indicator ("Shift Inactive" / "Shift Active")
  - Primary action button ("Start Shift" / "End Shift")
  - GPS status indicator
  - Connection status indicator
  - Last update timestamp
- **Functionality**:
  - Toggle shift state
  - Display real-time GPS location (lat/lng)
  - Maintain WebSocket connection
  - Handle background location updates
  - Show connection status

## Key User Flows

### Flow 1: First Launch & Login
1. User opens app → sees Login Screen
2. User enters email and password
3. Tap "Login" → backend validates, returns JWT + driver ID
4. App stores credentials securely
5. Navigate to Shift Status Screen

### Flow 2: Start Shift
1. User on Shift Status Screen (inactive state)
2. Tap "Start Shift" button
3. App requests location permissions (if not granted)
4. App starts foreground service with persistent notification
5. App establishes WebSocket connection
6. App begins emitting location every 60 seconds
7. UI updates to "Shift Active"

### Flow 3: End Shift
1. User on Shift Status Screen (active state)
2. Tap "End Shift" button
3. App emits 'end-shift' event
4. App stops foreground service
5. App closes WebSocket connection
6. UI updates to "Shift Inactive"

## Color Choices

- **Primary**: #2563EB (Blue) — Action buttons, active states
- **Success**: #10B981 (Green) — Shift active indicator
- **Error**: #EF4444 (Red) — Errors, offline state
- **Background**: #FFFFFF (Light) / #0F172A (Dark)
- **Surface**: #F3F4F6 (Light) / #1E293B (Dark)
- **Text**: #1F2937 (Light) / #F1F5F9 (Dark)

## UI Principles

- **Simplicity**: Minimal UI, focus on shift toggle and status
- **One-handed usage**: Large buttons, centered layout
- **Real-time feedback**: Show connection status, GPS updates, shift state
- **Spanish UI**: All text in Spanish
- **Battery efficiency**: Background location updates every 60 seconds, not continuous
