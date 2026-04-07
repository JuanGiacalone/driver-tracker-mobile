/**
 * ShiftManager — centralised shift-timer & notification manager.
 *
 * Works independently of the React component lifecycle so it keeps
 * scheduling notifications even when components unmount.
 *
 * Notification schedule (all in Spanish):
 *  • On shift start      → "Turno iniciado · Rastreo activo"
 *  • 30 min before end   → "Tu turno termina en 30 minutos"
 *  • At 4 h (auto-end)   → "Tu turno ha finalizado automáticamente"
 *  • 1 h without opening → "Llevas más de 1 hora sin abrir la app. Tu turno sigue activo."
 */

import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ─── Config ──────────────────────────────────────────────────────────────────

/** Total shift duration in milliseconds (4 hours). */
export const SHIFT_DURATION_MS = 4 * 60 * 60 * 1000;

/** How early (before the 4-h mark) to fire the warning notification. */
const WARNING_BEFORE_END_MS = 30 * 60 * 1000; // 30 minutes

/** How long without opening the app triggers the idle notification. */
const IDLE_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour

// ─── AsyncStorage keys ───────────────────────────────────────────────────────

export const SHIFT_START_TS_KEY = "shiftStartTs";
export const SHIFT_END_TS_KEY = "shiftEndTs";
const LAST_APP_OPEN_TS_KEY = "lastAppOpenTs";

// ─── Notification identifier constants ───────────────────────────────────────

const NOTIF_ID_START = "shift-start";
const NOTIF_ID_WARNING = "shift-warning";
const NOTIF_ID_AUTO_END = "shift-auto-end";
const NOTIF_ID_IDLE = "shift-idle";

// ─── Internal state ──────────────────────────────────────────────────────────

/** Called when the JS-side auto-end logic fires (in-process only). */
let _onAutoEnd: (() => void) | null = null;

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Call once when a shift starts.
 * Persists `shiftStartTs` / `shiftEndTs` to AsyncStorage and schedules
 * all local notifications.
 *
 * @param onAutoEnd Optional callback invoked when the auto-end timer fires
 *                  (only works while the app is alive in-process).
 */
export async function startShiftTimer(onAutoEnd?: () => void): Promise<void> {
  _onAutoEnd = onAutoEnd ?? null;

  const now = Date.now();
  const endTs = now + SHIFT_DURATION_MS;

  await AsyncStorage.setItem(SHIFT_START_TS_KEY, now.toString());
  await AsyncStorage.setItem(SHIFT_END_TS_KEY, endTs.toString());
  await AsyncStorage.setItem(LAST_APP_OPEN_TS_KEY, now.toString());

  // Cancel any stale notifications from a previous shift
  await _cancelAllShiftNotifications();

  // 1. Immediate "shift started" notification (fires after 1 s so it actually shows)
  await _scheduleNotification({
    id: NOTIF_ID_START,
    title: "🟢 Turno iniciado",
    body: "Rastreo de ubicación activo. Ahora eres visible en el mapa.",
    secondsFromNow: 1,
  });

  // 2. Warning: 30 min before the shift ends
  const warningSeconds = (SHIFT_DURATION_MS - WARNING_BEFORE_END_MS) / 1000;
  await _scheduleNotification({
    id: NOTIF_ID_WARNING,
    title: "⏳ Tu turno termina pronto",
    body: "Tu turno termina en 30 minutos. Prepárate para finalizar.",
    secondsFromNow: warningSeconds,
  });

  // 3. Auto-end: at 4 h
  const autoEndSeconds = SHIFT_DURATION_MS / 1000;
  await _scheduleNotification({
    id: NOTIF_ID_AUTO_END,
    title: "🔴 Turno finalizado automáticamente",
    body: "Han pasado 4 horas. Tu turno ha sido finalizado y el rastreo se detuvo.",
    secondsFromNow: autoEndSeconds,
  });

  // 4. Idle: 1 h without opening the app (reset each time app is foregrounded)
  await _scheduleIdleNotification();

  console.log("[ShiftManager] Shift timer started, ends at", new Date(endTs).toLocaleTimeString("es-ES"));
}

/**
 * Call every time the driver brings the app to the foreground.
 * Cancels the pending idle notification and reschedules it from *now*.
 */
export async function resetIdleTimer(): Promise<void> {
  await AsyncStorage.setItem(LAST_APP_OPEN_TS_KEY, Date.now().toString());
  await Notifications.cancelScheduledNotificationAsync(NOTIF_ID_IDLE).catch(() => { });
  await _scheduleIdleNotification();
  console.log("[ShiftManager] Idle timer reset");
}

/**
 * Call when the shift is explicitly ended by the driver OR after auto-end.
 * Cancels all scheduled notifications and clears persisted shift timestamps.
 */
export async function stopShiftTimer(): Promise<void> {
  _onAutoEnd = null;
  await _cancelAllShiftNotifications();
  await AsyncStorage.multiRemove([SHIFT_START_TS_KEY, SHIFT_END_TS_KEY, LAST_APP_OPEN_TS_KEY]);
  console.log("[ShiftManager] Shift timer stopped");
}

/**
 * Send the auto-end notification immediately (called from the background task
 * when the elapsed time check passes).
 */
export async function notifyAutoEnd(): Promise<void> {
  await _cancelAllShiftNotifications();
  await _scheduleNotification({
    id: NOTIF_ID_AUTO_END,
    title: "🔴 Turno finalizado automáticamente",
    body: "Han pasado 4 horas. Tu turno ha sido finalizado y el rastreo se detuvo.",
    secondsFromNow: 1,
  });
  console.log("[ShiftManager] Auto-end notification sent from background task");
}

/**
 * Fire an immediate notification when a new delivery is assigned to the rider.
 */
export async function notifyNewDelivery(delivery: {
  recipientName?: string | null;
  amount?: number | null;
  paymentMethod?: string | null;
  customerAddress?: string | null;
}): Promise<void> {
  const parts: string[] = [];
  if (delivery.recipientName) parts.push(delivery.recipientName);
  if (delivery.amount != null) parts.push(`$${delivery.amount.toFixed(2)}`);
  if (delivery.paymentMethod) parts.push(delivery.paymentMethod);
  if (delivery.customerAddress) parts.push(`📍 ${delivery.customerAddress}`);

  await _scheduleNotification({
    id: "delivery-new",
    title: "📦 Nueva entrega asignada",
    body: parts.length > 0 ? parts.join(" · ") : "Se te asignó una nueva entrega",
    secondsFromNow: 1,
  });
  console.log("[ShiftManager] New delivery notification sent");
}

/**
 * Returns the elapsed milliseconds of an active shift, or `null` if no shift
 * is stored.  Use this on app launch to re-attach to a running shift.
 */
export async function checkForActiveShift(): Promise<{
  elapsedMs: number;
  remainingMs: number;
  startTs: number;
  endTs: number;
} | null> {
  try {
    const [startStr, endStr] = await AsyncStorage.multiGet([SHIFT_START_TS_KEY, SHIFT_END_TS_KEY]);
    const startTs = startStr[1] ? parseInt(startStr[1], 10) : null;
    const endTs = endStr[1] ? parseInt(endStr[1], 10) : null;

    if (!startTs || !endTs) return null;

    const now = Date.now();
    if (now >= endTs) {
      // Shift already expired — clean up stale state
      await stopShiftTimer();
      return null;
    }

    return {
      elapsedMs: now - startTs,
      remainingMs: endTs - now,
      startTs,
      endTs,
    };
  } catch {
    return null;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function _scheduleNotification({
  id,
  title,
  body,
  secondsFromNow,
}: {
  id: string;
  title: string;
  body: string;
  secondsFromNow: number;
}): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: {
        title,
        body,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.max(1, Math.round(secondsFromNow)),
        repeats: false,
      },
    });
  } catch (err) {
    console.warn(`[ShiftManager] Failed to schedule notification "${id}":`, err);
  }
}

async function _scheduleIdleNotification(): Promise<void> {
  // Only schedule if there's an active shift
  const active = await checkForActiveShift();
  if (!active) return;

  // Don't schedule past the shift end
  const idleMs = Math.min(IDLE_THRESHOLD_MS, active.remainingMs - 1000);
  if (idleMs <= 0) return;

  await _scheduleNotification({
    id: NOTIF_ID_IDLE,
    title: "📵 ¿Sigues en turno?",
    body: "Llevas más de 1 hora sin abrir la app. Tu turno sigue activo y el rastreo continúa.",
    secondsFromNow: idleMs / 1000,
  });
}

async function _cancelAllShiftNotifications(): Promise<void> {
  await Promise.allSettled([
    Notifications.cancelScheduledNotificationAsync(NOTIF_ID_START),
    Notifications.cancelScheduledNotificationAsync(NOTIF_ID_WARNING),
    Notifications.cancelScheduledNotificationAsync(NOTIF_ID_AUTO_END),
    Notifications.cancelScheduledNotificationAsync(NOTIF_ID_IDLE),
  ]);
}
