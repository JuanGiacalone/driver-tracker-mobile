# RiderTracker Mobile App

A React Native (Expo) mobile application for food delivery riders to share their location in real-time during active shifts. Built with TypeScript, NativeWind (Tailwind CSS), and Socket.IO for real-time WebSocket communication.

## Features

- **Secure Authentication:** JWT-based login with SecureStore token storage
- **Real-time Location Tracking:** GPS updates every 60 seconds via WebSocket
- **Shift Management:** Start/end shifts with one tap
- **Connection Status:** Visual indicators for WebSocket connection state
- **Background Location Updates:** Continues tracking while app is in background
- **Spanish UI:** Complete Spanish language interface
- **Battery Efficient:** Optimized for minimal battery drain

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React Native 0.81 with Expo 54 |
| Language | TypeScript 5.9 |
| Styling | NativeWind 4 (Tailwind CSS) |
| State Management | React Context + useReducer |
| Secure Storage | expo-secure-store |
| Location Services | expo-location |
| Real-time Communication | Socket.IO client |
| Routing | Expo Router 6 |
| HTTP Client | Axios |

## Prerequisites

- Node.js 20+ and npm/yarn
- Expo CLI: `npm install -g expo-cli`
- Android SDK 10+ (for Android testing)
- Xcode 14+ (for iOS testing, macOS only)
- Physical device or emulator for testing

## Installation

1. Clone or navigate to the project:
```bash
cd driver-tracker-mobile
```

2. Install dependencies:
```bash
npm install
```

3. Configure backend URL:

Edit `app/login.tsx` and `app/(tabs)/shift.tsx`:

```typescript
const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://YOUR_IP:3000";
```

Replace `YOUR_IP` with your backend machine's IP address.

## Running the App

### Development Mode

Start the Expo development server:

```bash
npm run dev
```

This starts Metro bundler on port 8081. You can:

- **Scan QR code** with Expo Go app on your phone
- **Test on Android emulator:** `npm run android`
- **Test on iOS simulator:** `npm run ios` (macOS only)
- **Test on web:** `npm run web`

### Production Build

```bash
npm run build
eas build --profile preview
```

## Project Structure

```
app/
├── _layout.tsx              # Root layout with providers
├── login.tsx                # Login screen
└── (tabs)/
    ├── _layout.tsx          # Tab navigation layout
    ├── index.tsx            # Home redirect
    └── shift.tsx            # Main shift screen

lib/
├── auth-context.tsx         # Authentication state management
├── location-service.ts      # Location tracking & WebSocket
└── utils.ts                 # Utility functions

components/
├── screen-container.tsx     # SafeArea wrapper
├── themed-view.tsx          # Themed view component
└── ui/
    └── icon-symbol.tsx      # Icon mapping

hooks/
├── use-auth.ts              # Auth hook
├── use-colors.ts            # Theme colors hook
└── use-color-scheme.ts      # Dark/light mode detection

constants/
└── theme.ts                 # Theme configuration

assets/images/
├── icon.png                 # App icon
├── splash-icon.png          # Splash screen icon
├── favicon.png              # Web favicon
└── android-icon-*.png       # Android adaptive icons
```

## Screens

### Login Screen (`app/login.tsx`)

The initial authentication screen where drivers enter their credentials.

**Features:**
- Email and password input fields
- Error message display
- Loading state during authentication
- Demo credentials information
- Backend URL display

**Demo Credentials:**
- Email: `rider1@example.com`
- Password: `password123`

### Shift Screen (`app/(tabs)/shift.tsx`)

The main application screen for managing shifts and viewing location data.

**Features:**
- Shift status indicator (Active/Inactive)
- Large Start/End Shift button
- Real-time location display (latitude, longitude)
- Last update timestamp
- WebSocket connection status
- Active rider count
- Logout button

**Status Indicators:**
- **Green dot + "Conectado":** WebSocket connected
- **Yellow dot + "Conectando...":** Connection in progress
- **Red dot + "Desconectado":** Connection lost

## Authentication Flow

1. User enters email and password on Login Screen
2. App sends credentials to backend `/api/login` endpoint
3. Backend validates and returns JWT token + rider ID
4. App stores token securely in SecureStore
5. User redirected to Shift Screen
6. Token automatically included in WebSocket connection

## Location Tracking Flow

1. User taps "Iniciar Turno" (Start Shift)
2. App requests location permissions
3. App connects to WebSocket with JWT token
4. App starts watching position with 60-second interval
5. Every 60 seconds, app emits location event:
   ```json
   {
     "riderId": "rider_123",
     "lat": -34.6037,
     "lng": -58.3816,
     "ts": 1708700000000
   }
   ```
6. Backend broadcasts to admin dashboard
7. Admin sees real-time marker updates

## Configuration

### Environment Variables

Create a `.env.local` file:

```
EXPO_PUBLIC_API_URL=http://192.168.1.100:3000
```

Or set directly in `app/login.tsx` and `app/(tabs)/shift.tsx`.

### Theme Customization

Edit `theme.config.js` to change colors:

```javascript
const themeColors = {
  primary: { light: '#2563EB', dark: '#2563EB' },
  background: { light: '#ffffff', dark: '#0F172A' },
  // ... more colors
};
```

### App Configuration

Edit `app.config.ts` to customize:

```typescript
const env = {
  appName: "RiderTracker",
  appSlug: "driver-tracker-mobile",
  logoUrl: "https://...",
};
```

## Permissions

The app requests the following permissions:

| Permission | Purpose | When |
|-----------|---------|------|
| Fine Location | GPS coordinates | When starting shift |
| Background Location | Track while app backgrounded | When starting shift |
| POST_NOTIFICATIONS | Push notifications (future) | On app start |

### Android Manifest Permissions

Automatically included via Expo plugins:

```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```

## API Integration

### Login Endpoint

**POST** `/api/login`

Request:
```json
{
  "email": "rider1@example.com",
  "password": "password123"
}
```

Response:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "riderId": "rider_1708700000000_abc123",
  "email": "rider1@example.com"
}
```

### WebSocket Events

**Emit Events:**

- `location`: Send GPS coordinates
  ```json
  {
    "riderId": "rider_123",
    "lat": -34.6037,
    "lng": -58.3816,
    "ts": 1708700000000
  }
  ```

- `end-shift`: Signal shift end
  ```json
  {
    "riderId": "rider_123"
  }
  ```

**Listen Events:**

- `connect`: Successfully connected
- `disconnect`: Connection lost
- `error`: Connection error
- `connect_error`: Connection failed

## Styling with NativeWind

The app uses NativeWind (Tailwind CSS for React Native).

### Available Colors

| Token | Usage |
|-------|-------|
| `background` | Screen background |
| `foreground` | Primary text |
| `muted` | Secondary text |
| `primary` | Accent color (blue) |
| `surface` | Cards/elevated surfaces |
| `border` | Borders/dividers |
| `success` | Success states (green) |
| `error` | Error states (red) |

### Example Styling

```tsx
<View className="flex-1 items-center justify-center p-4 bg-background">
  <Text className="text-2xl font-bold text-foreground">
    Hello World
  </Text>
  <TouchableOpacity className="bg-primary px-6 py-3 rounded-lg mt-4">
    <Text className="text-white font-semibold">
      Tap Me
    </Text>
  </TouchableOpacity>
</View>
```

## State Management

### Authentication State

Managed via `AuthContext` (React Context + useReducer):

```typescript
const { state, login, logout, clearError } = useAuth();

// state properties:
// - isLoading: boolean
// - userToken: string | null
// - riderId: string | null
// - email: string | null
// - error: string | null
```

### Location State

Managed locally in `ShiftScreen` component:

```typescript
const [shiftActive, setShiftActive] = useState(false);
const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
const [connectionStatus, setConnectionStatus] = useState("disconnected");
```

## Testing

### Manual Testing Checklist

- [ ] Login with demo credentials
- [ ] Verify rider ID is displayed
- [ ] Start shift and confirm permissions prompt
- [ ] Verify connection status changes to "Conectado"
- [ ] Check location displays on screen
- [ ] Verify location appears on admin dashboard
- [ ] Wait 60 seconds and confirm location updates
- [ ] End shift and verify marker disappears from dashboard
- [ ] Logout and return to login screen
- [ ] Test with invalid credentials

### Testing on Physical Device

1. Ensure device is on same network as backend
2. Update API URL to your machine's IP
3. Build and deploy to device:
   ```bash
   eas build --platform android --profile preview
   ```
4. Scan QR code with Expo Go or install APK
5. Test all flows

## Troubleshooting

### "Cannot connect to server"

**Solutions:**
1. Verify backend is running: `npm run dev` in backend directory
2. Check API URL is correct and uses your machine IP
3. Ensure device is on same network
4. Check firewall allows port 3000
5. Test with `curl http://YOUR_IP:3000/api/health`

### "Location permission denied"

**Solutions:**
1. Grant permission when prompted
2. Check Settings > Apps > RiderTracker > Permissions
3. On Android 11+, select "Allow only while using the app"
4. Restart app after granting permission

### "WebSocket connection failed"

**Solutions:**
1. Verify backend is running
2. Check JWT token is valid
3. Verify network connectivity
4. Check browser console for errors
5. Restart backend and app

### "Location not updating"

**Solutions:**
1. Verify shift is active (button shows "Finalizar Turno")
2. Check connection status is "Conectado"
3. Enable location services on device
4. Try moving device to get new GPS fix
5. Check backend logs for incoming events

### App crashes on startup

**Solutions:**
1. Clear cache: `npm run dev` with `--clear` flag
2. Rebuild: `npm run build`
3. Check for TypeScript errors: `npm run check`
4. Review console logs for stack trace

## Performance Optimization

### Battery Efficiency

- Location updates every 60 seconds (not continuous)
- Balanced accuracy (not high accuracy)
- WebSocket stays open (reuses connection)
- No unnecessary re-renders

### Network Efficiency

- Minimal payload per location update (~100 bytes)
- Automatic reconnection on network loss
- Exponential backoff for reconnection attempts
- Compression via Socket.IO

## Building for Production

### Android APK

```bash
eas build --platform android
```

### Android App Bundle (Google Play)

```bash
eas build --platform android --release
```

### iOS App

```bash
eas build --platform ios
```

### Web Build

```bash
npm run build
```

## Security Best Practices

1. **Change API URL in production:** Update to your domain
2. **Use HTTPS:** Ensure backend uses SSL/TLS
3. **Secure JWT Secret:** Backend should use strong secret
4. **Validate Permissions:** Only request necessary permissions
5. **Secure Storage:** Never store sensitive data in AsyncStorage
6. **Rate Limiting:** Backend should limit login attempts

## Future Enhancements

- [ ] Push notifications for shift reminders
- [ ] Offline mode with local caching
- [ ] Biometric authentication
- [ ] Delivery history tracking
- [ ] Performance analytics
- [ ] Multi-language support
- [ ] Dark mode optimization
- [ ] Ride assignment system

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| react-native | 0.81 | Mobile framework |
| expo | 54 | Development platform |
| expo-router | 6 | Navigation |
| expo-location | Latest | GPS tracking |
| expo-secure-store | Latest | Secure token storage |
| socket.io-client | Latest | WebSocket client |
| axios | Latest | HTTP client |
| nativewind | 4 | Tailwind CSS |
| typescript | 5.9 | Type safety |

## License

ISC

## Support

For issues or questions:

1. Check the troubleshooting section above
2. Review backend logs: `npm run dev` in backend directory
3. Check browser console for admin dashboard errors
4. Review mobile app console for errors

## Additional Resources

- **Expo Documentation:** https://docs.expo.dev/
- **React Native Docs:** https://reactnative.dev/
- **Socket.IO Client:** https://socket.io/docs/v4/client-api/
- **NativeWind:** https://www.nativewind.dev/
- **Leaflet.js:** https://leafletjs.com/
