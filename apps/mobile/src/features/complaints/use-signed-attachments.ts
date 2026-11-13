import { useCallback, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import type { ImageInputDto, UploadTicketDto } from '@vastu/contracts';
import { imageProblem, uploadToTicket, type PickedImage } from '@/lib/api/upload';

export type Attachment = {
  key: string;
  image: PickedImage;
  progress: number;
  status: 'uploading' | 'done' | 'error';
  result?: ImageInputDto;
  error?: string;
};

/**
 * Same behaviour as features/projects/use-photo-attachments (pick, compress, upload at once), but the
 * caller supplies how to get the signed ticket, so complaints can use their own sign routes.
 */
export function useSignedAttachments(sign: () => Promise<UploadTicketDto>, max: number) {
  const [items, setItems] = useState<Attachment[]>([]);
  const [problem, setProblem] = useState<string | null>(null);

  const patch = useCallback((key: string, p: Partial<Attachment>) => {
    setItems((cur) => cur.map((a) => (a.key === key ? { ...a, ...p } : a)));
  }, []);

  const upload = useCallback(
    async (a: Attachment) => {
      patch(a.key, { status: 'uploading', progress: 0, error: undefined });
      try {
        const ticket = await sign();
        const result = await uploadToTicket(ticket, a.image, (f) => patch(a.key, { progress: f }));
        patch(a.key, { status: 'done', progress: 1, result });
      } catch (e) {
        patch(a.key, { status: 'error', error: e instanceof Error ? e.message : 'Upload failed' });
      }
    },
    [patch, sign],
  );

  const add = useCallback(
    (assets: ImagePicker.ImagePickerAsset[]) => {
      setProblem(null);
      const room = Math.max(0, max - items.length);
      if (assets.length > room) setProblem(`You can attach up to ${max} photos.`);
      const next: Attachment[] = [];
      for (const asset of assets.slice(0, room)) {
        const image: PickedImage = {
          uri: asset.uri,
          name: asset.fileName ?? `photo-${Date.now()}.jpg`,
          type: asset.mimeType ?? 'image/jpeg',
          size: asset.fileSize,
        };
        const bad = imageProblem(image);
        if (bad) {
          setProblem(bad);
          continue;
        }
        next.push({ key: `${Date.now()}-${Math.random()}`, image, progress: 0, status: 'uploading' });
      }
      if (next.length === 0) return;
      setItems((cur) => [...cur, ...next]);
      next.forEach((a) => void upload(a));
    },
    [items.length, max, upload],
  );

  const pickFromGallery = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return setProblem('Allow photo access in Settings to attach photos.');
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: Math.max(1, max - items.length),
      quality: 0.6,
      exif: false,
    });
    if (!res.canceled) add(res.assets);
  }, [add, items.length, max]);

  const takePhoto = useCallback(async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return setProblem('Allow camera access in Settings to take photos.');
    const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.6, exif: false });
    if (!res.canceled) add(res.assets);
  }, [add]);

  const remove = useCallback((key: string) => setItems((cur) => cur.filter((a) => a.key !== key)), []);
  const retry = useCallback(
    (key: string) => {
      const a = items.find((x) => x.key === key);
      if (a) void upload(a);
    },
    [items, upload],
  );
  const clear = useCallback(() => {
    setItems([]);
    setProblem(null);
  }, []);

  return {
    items,
    problem,
    images: items.flatMap((a) => (a.result ? [a.result] : [])),
    uploadsDone: items.every((a) => a.status === 'done'),
    busy: items.some((a) => a.status === 'uploading'),
    pickFromGallery,
    takePhoto,
    remove,
    retry,
    clear,
  };
}
