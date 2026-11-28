import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { Text } from '@/components/ui/text';
import { colors, font, radius, space } from '@/constants/theme';

type Props = TextInputProps & {
  label?: string;
};

export function Input({ label, multiline, style, ...rest }: Props) {
  return (
    <View style={styles.wrap}>
      {label ? (
        <Text variant="label" color={colors.inkDeep}>
          {label}
        </Text>
      ) : null}
      <TextInput
        placeholderTextColor={colors.placeholder}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        style={[styles.input, multiline && styles.multiline, style]}
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 6,
  },
  input: {
    minHeight: 44,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.pageSoft,
    fontFamily: font.regular,
    fontSize: 15,
    color: colors.inkDeep,
  },
  multiline: {
    minHeight: 88,
    paddingTop: space[3],
  },
});
