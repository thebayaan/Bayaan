/**
 * Captures the share card from a Skia Canvas ref and writes it to a
 * temporary PNG file. Returns the file URI for sharing.
 */
import * as FileSystem from 'expo-file-system/legacy';
import {ImageFormat, type CanvasRef} from '@shopify/react-native-skia';

export async function captureShareCard(
  canvasRef: React.RefObject<CanvasRef | null>,
  filename: string = 'bayaan-share.png',
): Promise<string> {
  const image = canvasRef.current?.makeImageSnapshot();
  if (!image) throw new Error('Failed to capture share card image');

  const base64 = image.encodeToBase64(ImageFormat.PNG, 100);
  const uri = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(uri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return uri;
}
