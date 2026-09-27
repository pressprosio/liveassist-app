import { ActivityIndicator, View } from 'react-native';
import { colors } from '@/lib/theme';

/** Launch screen while the saved session loads; the gate in _layout redirects from here. */
export default function Index() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.wash }}>
      <ActivityIndicator color={colors.accent} size="large" />
    </View>
  );
}
