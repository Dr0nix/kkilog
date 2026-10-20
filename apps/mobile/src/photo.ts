import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Linking } from 'react-native';

// 업로드 전에 긴 변 1024px JPEG(품질 0.7)로 줄인다. 원본 해상도는 보관하지 않는다(spec 3).
const MAX_EDGE = 1024;
const JPEG_QUALITY = 0.7;

export type PickedPhoto = { uri: string; width: number; height: number };

export type PickResult =
  | { status: 'picked'; photo: PickedPhoto }
  | { status: 'cancelled' }
  // 다시 물어볼 수 없게 거부됨 → 설정 화면으로 보내야 한다
  | { status: 'blocked' }
  | { status: 'denied' };

async function ensurePermission(source: 'camera' | 'library'): Promise<'granted' | 'denied' | 'blocked'> {
  const current =
    source === 'camera' ? await ImagePicker.getCameraPermissionsAsync() : await ImagePicker.getMediaLibraryPermissionsAsync();
  if (current.granted) return 'granted';
  if (!current.canAskAgain) return 'blocked';
  const asked =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (asked.granted) return 'granted';
  return asked.canAskAgain ? 'denied' : 'blocked';
}

export async function pickPhoto(source: 'camera' | 'library'): Promise<PickResult> {
  const permission = await ensurePermission(source);
  if (permission !== 'granted') return { status: permission };

  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1, exif: false };
  const result =
    source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset) return { status: 'cancelled' };
  return { status: 'picked', photo: await shrink(asset) };
}

async function shrink(asset: { uri: string; width: number; height: number }): Promise<PickedPhoto> {
  const context = ImageManipulator.manipulate(asset.uri);
  if (Math.max(asset.width, asset.height) > MAX_EDGE) {
    context.resize(asset.width >= asset.height ? { width: MAX_EDGE } : { height: MAX_EDGE });
  }
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ compress: JPEG_QUALITY, format: SaveFormat.JPEG });
  return { uri: saved.uri, width: saved.width, height: saved.height };
}

export function openAppSettings(): void {
  void Linking.openSettings();
}
