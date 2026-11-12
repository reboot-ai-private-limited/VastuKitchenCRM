import * as Location from 'expo-location';
import type { LocationDto } from '@vastu/contracts';

export type LocationFix =
  | { ok: true; location: LocationDto }
  | { ok: false; reason: 'denied' | 'unavailable'; canAskAgain: boolean };

const FIX_TIMEOUT_MS = 15_000;

/**
 * One foreground High-accuracy fix, taken on tap. Asks for permission in context.
 * No background tracking, never returns 0,0.
 */
export async function getLocationFix(): Promise<LocationFix> {
  try {
    let perm = await Location.getForegroundPermissionsAsync();
    if (!perm.granted && perm.canAskAgain) perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) return { ok: false, reason: 'denied', canAskAgain: perm.canAskAgain };

    const pos = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), FIX_TIMEOUT_MS)),
    ]);
    if (!pos) return { ok: false, reason: 'unavailable', canAskAgain: true };
    const { latitude: lat, longitude: lng, accuracy } = pos.coords;
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) {
      return { ok: false, reason: 'unavailable', canAskAgain: true };
    }
    return {
      ok: true,
      location: { lat, lng, ...(typeof accuracy === 'number' && accuracy >= 0 ? { accuracy } : {}) },
    };
  } catch {
    // Location services off, or the OS refused the request.
    return { ok: false, reason: 'unavailable', canAskAgain: true };
  }
}

/** Thrown when no fix could be had and the caller did not allow a manual (no-location) punch. */
export class LocationUnavailableError extends Error {
  constructor(
    readonly reason: 'denied' | 'unavailable',
    readonly canAskAgain: boolean,
  ) {
    super(reason === 'denied' ? 'Location is off.' : 'We could not read your location.');
  }
}
