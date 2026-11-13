import { Link } from 'expo-router';
import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { colors, space } from '@/constants/theme';

export default function NotFound() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space[3] }}>
      <Text variant="section">This page could not be found.</Text>
      <Link href="/">
        <Text color={colors.primary}>Go home</Text>
      </Link>
    </View>
  );
}
