import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Dimensions, Keyboard, View } from 'react-native';

/**
 * Lifts a screen's content above the on-screen keyboard. Measures where the container really ends
 * on the screen and how far the keyboard covers it, so it works under headers and tab bars and
 * whether or not the OS already resized the window (then the overlap is 0 and nothing is added).
 * Usage: <View ref={ref} collapsable={false} style={{ flex: 1, paddingBottom: pad }}>.
 */
export function useKeyboardAvoid() {
  const ref = useRef<ComponentRef<typeof View>>(null);
  const [pad, setPad] = useState(0);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) => {
      ref.current?.measureInWindow((_x, y, _w, h) => {
        // measureInWindow is relative to the app window, the keyboard frame to the whole screen.
        // On edge-to-edge devices the window starts lower than the screen, so add the difference.
        const offset = Math.max(0, Dimensions.get('screen').height - Dimensions.get('window').height);
        setPad(Math.max(0, Math.round(y + h + offset - e.endCoordinates.screenY)));
      });
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => setPad(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return { ref, pad };
}
