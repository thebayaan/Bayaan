import React from 'react';
import { TouchableOpacity, Share, Alert, Platform } from 'react-native';
import { Icon } from '@rneui/themed';
import { generateShareableLink } from '@/utils/deepLink';
import { useTheme } from '@/hooks/useTheme';

interface ShareIconProps {
  type: 'reciter' | 'playlist' | 'surah' | 'adhkar';
  params: Record<string, any>;
  message?: string;
  size?: number;
  color?: string;
  style?: any;
  iconName?: string;
  iconType?: string;
}

export const ShareIcon: React.FC<ShareIconProps> = ({
  type,
  params,
  message,
  size = 24,
  color,
  style,
  iconName = 'share',
  iconType = 'material',
}) => {
  const { theme } = useTheme();
  const iconColor = color || theme.colors.primary;

  const handleShare = async () => {
    try {
      const shareUrl = generateShareableLink(type, params);
      
      // Generate contextual message based on content type
      let shareMessage = message;
      if (!shareMessage) {
        switch (type) {
          case 'reciter':
            shareMessage = `Listen to this beautiful Quran recitation on Bayaan`;
            break;
          case 'surah':
            shareMessage = `Check out this Surah on Bayaan`;
            break;
          case 'playlist':
            shareMessage = `Listen to this playlist on Bayaan`;
            break;
          case 'adhkar':
            shareMessage = `Read these beautiful adhkar on Bayaan`;
            break;
          default:
            shareMessage = `Check this out on Bayaan`;
        }
      }
      
      const shareContent = {
        title: 'Bayaan - Quran & Islamic Content',
        message: Platform.OS === 'ios' ? shareMessage : `${shareMessage}\n\n${shareUrl}`,
        url: Platform.OS === 'ios' ? shareUrl : undefined,
      };
      
      console.log('[Share] Sharing content:', shareContent);
      
      const result = await Share.share(shareContent);
      
      if (result.action === Share.sharedAction) {
        console.log('[Share] Content shared successfully');
        // Optionally track analytics here
      }
    } catch (error) {
      console.error('[Share] Error sharing:', error);
      Alert.alert(
        'Share Failed',
        'Unable to share this content. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  return (
    <TouchableOpacity onPress={handleShare} style={style}>
      <Icon
        name={iconName}
        type={iconType}
        size={size}
        color={iconColor}
      />
    </TouchableOpacity>
  );
};

export default ShareIcon;
