import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Dimensions, Keyboard, Platform, StatusBar, View } from 'react-native';

/**
 * Lifts a screen's content above the on-screen keyboard. Measures where the container really ends
 * on the screen and how far the keyboard covers it, so it works under headers and tab bars and
 * whether or not the OS already resized the window (then the overlap is 0 and nothing is added).
 * Usage: <View ref={ref} collapsable={false} style={{ flex: 1, paddingBottom: pad }}>.
 */
export function useKeyboardAvoid() {
  const ref = useRef<ComponentRef<typeof View>>(null);
  const [pad, setPad] = useState(0);
  const [open, setOpen] = useState(false);
  // Measured while the keyboard is closed: once it opens, Android may shrink the window itself.
  // measureInWindow is relative to the app window; on Android that window starts below the status bar
  // and ends above the system navigation bar. Only the status bar shifts the measurement, so using the
  // whole screen-minus-window difference would count the navigation bar twice and leave a gap.
  const offsetRef = useRef(
    Platform.OS === 'android'
      ? (StatusBar.currentHeight ?? 0)
      : Math.max(0, Dimensions.get('screen').height - Dimensions.get('window').height),
  );

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const show = Keyboard.addListener('keyboardDidShow', (e) => {
      setOpen(true);
      // Measure after the OS has had its turn at resizing the window, or the gap is added twice.
      clearTimeout(timer);
      timer = setTimeout(() => ref.current?.measureInWindow((_x, y, _w, h) => {
        // measureInWindow is relative to the app window, the keyboard frame to the whole screen.
        // On edge-to-edge devices the window starts lower than the screen, so add the difference.
        const offset = offsetRef.current;
        setPad(Math.max(0, Math.round(y + h + offset - e.endCoordinates.screenY)));
      }), 150);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      setPad(0);
      setOpen(false);
    });
    return () => {
      clearTimeout(timer);
      show.remove();
      hide.remove();
    };
  }, []);

  /** `open`: the keyboard is up, so the system navigation bar is hidden behind it and the bottom inset no longer applies. */
  return { ref, pad, open };
}
