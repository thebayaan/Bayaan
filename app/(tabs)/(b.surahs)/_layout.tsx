import {Stack} from 'expo-router';
import {MaxWidthContainer} from '@/components/layout/MaxWidthContainer';

export default function SurahsLayout() {
  return (
    <MaxWidthContainer>
      <Stack
        screenOptions={{
          headerShown: true,
          freezeOnBlur: true,
          headerTransparent: true,
          headerShadowVisible: false,
        }}>
        <Stack.Screen
          name="index"
          options={{
            title: '',
            headerShown: false,
          }}
        />
      </Stack>
    </MaxWidthContainer>
  );
}
