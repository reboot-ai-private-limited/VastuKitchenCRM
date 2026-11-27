import { Platform, Vibration } from 'react-native';
import * as Haptics from 'expo-haptics';

/**
 * Light, crisp tactile tick for lightweight UI switches (dropdowns, tab bar).
 * Uses a short 10ms pulse on Android so it works reliably even when system touch-feedback is off.
 */
export function softTick(): void {
  if (Platform.OS === 'android') {
    Vibration.vibrate(10);
  } else if (Platform.OS === 'ios') {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
  }
}
