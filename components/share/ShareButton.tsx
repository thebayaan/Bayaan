import { generateRewayatSlug } from "@/utils/deepLink/rewayatSlugs";
import React from 'react';
import { Share, Alert, Platform } from 'react-native';
import { Button } from '@rneui/themed';
import { generateShareableLink } from '@/utils/deepLink';

interface ShareButtonProps {
  type: 'reciter' | 'playlist' | 'surah' | 'adhkar';
  params: Record<string, any>;
  title?: string;
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  titleStyle?: any;
  buttonStyle?: any;
  icon?: any;
  children?: React.ReactNode;
}

export const ShareButton: React.FC<ShareButtonProps> = ({
  type,
  params,
  title = 'Share',
  message,
  size = 'md',
  titleStyle,
  buttonStyle,
  icon,
  children,
}) => {
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
      } else if (result.action === Share.dismissedAction) {
        console.log('[Share] Share dismissed');
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

  if (children) {
    // Custom children - wrap in touchable
    return (
      <Button 
        onPress={handleShare}
        buttonStyle={[{ backgroundColor: 'transparent' }, buttonStyle]}
        titleStyle={{ display: 'none' }}
      >
        {children}
      </Button>
    );
  }

  return (
    <Button
      title={title}
      onPress={handleShare}
      size={size}
      titleStyle={titleStyle}
      buttonStyle={buttonStyle}
      icon={icon}
    />
  );
};

export default ShareButton;
