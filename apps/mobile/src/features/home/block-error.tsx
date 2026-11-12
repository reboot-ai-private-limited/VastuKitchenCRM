import { View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { space } from '@/constants/theme';
import { NetworkError } from '@/lib/api/client';

/** Per-block failure row for the home screens: says what went wrong and offers Retry (never the empty-state copy). */
export function BlockError({ error, onRetry }: { error?: unknown; onRetry: () => void }) {
  return (
    <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
      <View style={{ flex: 1 }}>
        <Text muted>
          {error instanceof NetworkError ? 'No connection. Could not load this.' : 'Could not load this.'}
        </Text>
      </View>
      <Button title="Retry" size="sm" variant="outline" onPress={onRetry} />
    </Card>
  );
}
