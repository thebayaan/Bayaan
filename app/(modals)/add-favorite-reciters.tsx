import {SelectFavoriteRecitersModal} from '@/components/SelectFavoriteRecitersModal';
import {router, useLocalSearchParams} from 'expo-router';

export default function SelectFavoriteRecitersModalScreen() {
  const {isVisible} = useLocalSearchParams<{isVisible: string}>();

  if (isVisible !== 'true') {
    return null;
  }

  return (
    <SelectFavoriteRecitersModal
      isVisible={true}
      onClose={() => {
        router.back();
      }}
    />
  );
}
