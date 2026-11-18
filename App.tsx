import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  CameraView,
  useCameraPermissions,
  useMicrophonePermissions,
  type AvailableLenses,
  type CameraMode,
  type CameraType,
  type FlashMode,
  type LensInfo,
} from 'expo-camera';
import { Asset, requestPermissionsAsync } from 'expo-media-library';

type CapturedMedia = {
  uri: string;
  isVideo: boolean;
  saved: boolean;
};

const RECORD_MAX_SECONDS = 600;

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function lensLabel(lens: LensInfo): string {
  const { deviceType } = lens;
  if (deviceType.includes('UltraWide')) {
    return '超广';
  }
  if (deviceType.includes('Telephoto')) {
    return '长焦';
  }
  if (deviceType.includes('WideAngle')) {
    return '广角';
  }
  return lens.localizedName;
}

function lensSortRank(lens: LensInfo): number {
  const { deviceType } = lens;
  if (deviceType.includes('UltraWide')) {
    return 0;
  }
  if (deviceType.includes('WideAngle')) {
    return 1;
  }
  if (deviceType.includes('Telephoto')) {
    return 2;
  }
  return 3;
}

export default function App() {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();

  const [facing, setFacing] = useState<CameraType>('back');
  const [flash, setFlash] = useState<FlashMode>('off');
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [mode, setMode] = useState<CameraMode>('picture');
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [shutterFlash, setShutterFlash] = useState(false);
  const [lastMedia, setLastMedia] = useState<CapturedMedia | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lenses, setLenses] = useState<LensInfo[]>([]);
  const [selectedLens, setSelectedLens] = useState<string | undefined>(undefined);

  const cameraRef = useRef<CameraView>(null);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (recordTimerRef.current) {
        clearInterval(recordTimerRef.current);
      }
    };
  }, []);

  const saveToLibrary = useCallback(async (uri: string): Promise<boolean> => {
    try {
      const permission = await requestPermissionsAsync(true);
      if (!permission.granted) {
        setErrorMessage('未获得相册权限，本次拍摄没有保存到系统相册。');
        return false;
      }
      await Asset.create(uri);
      return true;
    } catch (error) {
      setErrorMessage(`保存到相册失败：${String(error)}`);
      return false;
    }
  }, []);

  const takePhoto = useCallback(async () => {
    if (isRecording || isBusy) {
      return;
    }
    setIsBusy(true);
    setShutterFlash(true);
    try {
      const photo = await cameraRef.current?.takePictureAsync();
      if (photo?.uri) {
        const saved = await saveToLibrary(photo.uri);
        setLastMedia({ uri: photo.uri, isVideo: false, saved });
      }
    } catch (error) {
      setErrorMessage(`拍照失败：${String(error)}`);
    } finally {
      setIsBusy(false);
      setTimeout(() => setShutterFlash(false), 150);
    }
  }, [isRecording, isBusy, saveToLibrary]);

  const stopRecording = useCallback(() => {
    cameraRef.current?.stopRecording();
  }, []);

  const startRecording = useCallback(async () => {
    if (isRecording || isBusy) {
      return;
    }
    if (!micPermission?.granted) {
      const result = await requestMicPermission();
      if (!result.granted) {
        setErrorMessage('需要麦克风权限才能录制视频，请在系统设置中开启。');
        return;
      }
    }
    setIsRecording(true);
    setRecordSeconds(0);
    recordTimerRef.current = setInterval(() => {
      setRecordSeconds((seconds) => seconds + 1);
    }, 1000);
    try {
      const video = await cameraRef.current?.recordAsync({
        maxDuration: RECORD_MAX_SECONDS,
      });
      if (video?.uri) {
        const saved = await saveToLibrary(video.uri);
        setLastMedia({ uri: video.uri, isVideo: true, saved });
      }
    } catch (error) {
      setErrorMessage(`录像失败：${String(error)}`);
    } finally {
      if (recordTimerRef.current) {
        clearInterval(recordTimerRef.current);
        recordTimerRef.current = null;
      }
      setIsRecording(false);
    }
  }, [isRecording, isBusy, micPermission, requestMicPermission, saveToLibrary]);

  const refreshLenses = useCallback(async () => {
    try {
      const available = (await cameraRef.current?.getAvailableLensesAsync()) ?? [];
      setLenses([...available].sort((a, b) => lensSortRank(a) - lensSortRank(b)));
    } catch {
      setLenses([]);
    }
  }, []);

  const handleLensesChanged = useCallback((event: AvailableLenses) => {
    setLenses([...event.lenses].sort((a, b) => lensSortRank(a) - lensSortRank(b)));
  }, []);

  const cycleFlash = useCallback(() => {
    setFlash((current) => {
      if (current === 'off') {
        return 'auto';
      }
      if (current === 'auto') {
        return 'on';
      }
      return 'off';
    });
  }, []);

  const switchCamera = useCallback(() => {
    if (isRecording) {
      return;
    }
    setFacing((current) => (current === 'back' ? 'front' : 'back'));
    setTorchEnabled(false);
    setSelectedLens(undefined);
  }, [isRecording]);

  const onShutterPress = useCallback(() => {
    if (mode === 'picture') {
      void takePhoto();
    } else if (isRecording) {
      stopRecording();
    } else {
      void startRecording();
    }
  }, [mode, isRecording, takePhoto, stopRecording, startRecording]);

  if (!cameraPermission) {
    return (
      <View style={styles.centerContainer}>
        <StatusBar style="light" />
        <ActivityIndicator size="large" color="#ffffff" />
      </View>
    );
  }

  if (!cameraPermission.granted) {
    return (
      <View style={styles.centerContainer}>
        <StatusBar style="light" />
        <Text style={styles.permissionTitle}>Kapture 需要相机权限</Text>
        <Text style={styles.permissionBody}>请在设置中允许 Kapture 访问相机。</Text>
        {cameraPermission.canAskAgain ? (
          <Pressable style={styles.primaryButton} onPress={() => void requestCameraPermission()}>
            <Text style={styles.primaryButtonText}>重新请求权限</Text>
          </Pressable>
        ) : null}
        <Pressable
          style={[styles.primaryButton, styles.secondaryButton]}
          onPress={() => void Linking.openSettings()}>
          <Text style={styles.secondaryButtonText}>打开系统设置</Text>
        </Pressable>
      </View>
    );
  }

  const flashLabel = flash === 'off' ? '闪光:关' : flash === 'auto' ? '闪光:自动' : '闪光:开';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        mode={mode}
        facing={facing}
        flash={flash}
        enableTorch={torchEnabled && facing === 'back'}
        selectedLens={facing === 'back' ? selectedLens : undefined}
        onCameraReady={() => void refreshLenses()}
        onAvailableLensesChanged={handleLensesChanged}
        onMountError={(event) => setErrorMessage(`相机启动失败：${event.message}`)}
      />

      {shutterFlash ? <View style={styles.shutterFlashOverlay} /> : null}

      <View style={styles.overlay}>
        <View style={styles.topBar}>
          <View style={styles.modeSwitch}>
            {(['picture', 'video'] as const).map((value) => (
              <Pressable
                key={value}
                style={[styles.modeSwitchItem, mode === value && styles.modeSwitchItemActive]}
                disabled={isRecording}
                onPress={() => setMode(value)}>
                <Text
                  style={[styles.modeSwitchText, mode === value && styles.modeSwitchTextActive]}>
                  {value === 'picture' ? '拍照' : '录像'}
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable style={styles.pillButton} onPress={cycleFlash} disabled={isRecording}>
            <Text style={styles.pillButtonText}>{flashLabel}</Text>
          </Pressable>

          <Pressable
            style={[styles.pillButton, torchEnabled && styles.pillButtonActive]}
            disabled={facing !== 'back' || isRecording}
            onPress={() => setTorchEnabled((enabled) => !enabled)}>
            <Text style={[styles.pillButtonText, torchEnabled && styles.pillButtonTextActive]}>
              {torchEnabled ? '手电筒:开' : '手电筒:关'}
            </Text>
          </Pressable>
        </View>

        <View style={styles.middleArea}>
          {facing === 'back' && lenses.length > 1 ? (
            <View style={styles.lensBar}>
              {lenses.map((lens) => (
                <Pressable
                  key={lens.deviceType}
                  style={[
                    styles.lensButton,
                    selectedLens === lens.deviceType && styles.lensButtonActive,
                  ]}
                  disabled={isRecording}
                  onPress={() => setSelectedLens(lens.deviceType)}>
                  <Text
                    style={[
                      styles.lensButtonText,
                      selectedLens === lens.deviceType && styles.lensButtonTextActive,
                    ]}>
                    {lensLabel(lens)}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {isRecording ? (
            <View style={styles.recordingBadge}>
              <View style={styles.recordingDot} />
              <Text style={styles.recordingText}>{formatDuration(recordSeconds)}</Text>
            </View>
          ) : null}
        </View>

        {errorMessage ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText} numberOfLines={3}>
              {errorMessage}
            </Text>
            <Pressable hitSlop={8} onPress={() => setErrorMessage(null)}>
              <Text style={styles.errorDismiss}>关闭</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.bottomBar}>
          <Pressable style={styles.galleryButton} onPress={() => setShowPreview(true)}>
            {lastMedia ? (
              lastMedia.isVideo ? (
                <View style={styles.galleryVideoPlaceholder}>
                  <Text style={styles.galleryVideoText}>视频</Text>
                </View>
              ) : (
                <Image source={{ uri: lastMedia.uri }} style={styles.galleryThumbnail} />
              )
            ) : (
              <View style={styles.galleryEmpty} />
            )}
          </Pressable>

          <Pressable style={styles.shutterOuter} onPress={onShutterPress} disabled={isBusy}>
            <View
              style={[
                styles.shutterInner,
                mode === 'video' && styles.shutterInnerVideo,
                isRecording && styles.shutterInnerRecording,
              ]}
            />
          </Pressable>

          <Pressable style={styles.flipButton} onPress={switchCamera} disabled={isRecording}>
            <Text style={styles.flipText}>翻转</Text>
          </Pressable>
        </View>
      </View>

      <Modal visible={showPreview} animationType="slide" onRequestClose={() => setShowPreview(false)}>
        <SafeAreaView style={styles.previewContainer}>
          <Pressable style={styles.previewClose} onPress={() => setShowPreview(false)} hitSlop={8}>
            <Text style={styles.previewCloseText}>关闭</Text>
          </Pressable>
          {lastMedia ? (
            lastMedia.isVideo ? (
              <View style={styles.previewEmpty}>
                <Text style={styles.previewEmptyText}>
                  {lastMedia.saved ? '视频已保存到系统相册' : '视频未能保存到相册（缺少权限）'}
                  {'\n'}请在系统相册中播放
                </Text>
              </View>
            ) : (
              <Image source={{ uri: lastMedia.uri }} style={styles.previewImage} />
            )
          ) : (
            <View style={styles.previewEmpty}>
              <Text style={styles.previewEmptyText}>还没有拍摄内容</Text>
            </View>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 8,
  },
  permissionTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
  },
  permissionBody: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  primaryButton: {
    backgroundColor: '#ffffff',
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 24,
  },
  primaryButtonText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  secondaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  camera: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  shutterFlashOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  overlay: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 16,
  },
  modeSwitch: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 20,
    overflow: 'hidden',
  },
  modeSwitchItem: {
    paddingVertical: 8,
    paddingHorizontal: 18,
  },
  modeSwitchItemActive: {
    backgroundColor: '#ffffff',
  },
  modeSwitchText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    fontWeight: '600',
  },
  modeSwitchTextActive: {
    color: '#000000',
  },
  pillButton: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  pillButtonActive: {
    backgroundColor: '#ffcc00',
  },
  pillButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '500',
  },
  pillButtonTextActive: {
    color: '#000000',
  },
  middleArea: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 20,
    gap: 12,
  },
  lensBar: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 18,
  },
  lensButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  lensButtonActive: {
    backgroundColor: '#ffcc00',
  },
  lensButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  lensButtonTextActive: {
    color: '#000000',
  },
  recordingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    gap: 6,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ff3b30',
  },
  recordingText: {
    color: '#ffffff',
    fontSize: 14,
    fontVariant: ['tabular-nums'],
  },
  errorBanner: {
    position: 'absolute',
    bottom: 150,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(180,40,40,0.88)',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    flex: 1,
    color: '#ffffff',
    fontSize: 13,
  },
  errorDismiss: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    fontWeight: '600',
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 36,
    paddingBottom: 8,
    paddingTop: 4,
  },
  galleryButton: {
    width: 52,
    height: 52,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.8)',
    overflow: 'hidden',
  },
  galleryThumbnail: {
    width: '100%',
    height: '100%',
  },
  galleryVideoPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  galleryVideoText: {
    color: '#ffffff',
    fontSize: 12,
  },
  galleryEmpty: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  shutterOuter: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 5,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#ffffff',
  },
  shutterInnerVideo: {
    width: 46,
    height: 46,
    borderRadius: 10,
  },
  shutterInnerRecording: {
    width: 34,
    height: 34,
    borderRadius: 6,
    backgroundColor: '#ff3b30',
  },
  flipButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flipText: {
    color: '#ffffff',
    fontSize: 13,
  },
  previewContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  previewClose: {
    alignSelf: 'flex-end',
    padding: 16,
  },
  previewCloseText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  previewImage: {
    flex: 1,
  },
  previewEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewEmptyText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 26,
  },
});
