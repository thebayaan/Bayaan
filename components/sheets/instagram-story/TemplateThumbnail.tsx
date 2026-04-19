import React from 'react';
import {Pressable, Text} from 'react-native';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {StoryPreviewCanvas} from '@/components/share/instagram-story/StoryPreviewCanvas';
import type {Template, RenderContext} from '@/components/share/instagram-story/types';
import {lightHaptics} from '@/utils/haptics';

interface Props {
  template: Template;
  ctx: RenderContext;
  isActive: boolean;
  onPress: (id: Template['id']) => void;
}

export const TemplateThumbnail: React.FC<Props> = ({
  template,
  ctx,
  isActive,
  onPress,
}) => {
  const handlePress = () => {
    lightHaptics();
    onPress(template.id);
  };

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={template.name}
      accessibilityState={{selected: isActive}}
      style={[styles.tile, isActive && styles.tileActive]}>
      <StoryPreviewCanvas
        template={template}
        ctx={ctx}
        width={moderateScale(80)}
      />
      <Text style={styles.label} numberOfLines={1}>
        {template.name}
      </Text>
    </Pressable>
  );
};

const styles = ScaledSheet.create({
  tile: {
    width: '84@ms',
    marginRight: '10@ms',
    borderRadius: '10@ms',
    borderWidth: 2,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  tileActive: {
    borderColor: '#38bdf8',
  },
  label: {
    fontSize: '10@ms',
    color: '#e8e8e8',
    textAlign: 'center',
    paddingVertical: '4@ms',
  },
});
