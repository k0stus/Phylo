import { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { router } from 'expo-router';
import { analyzePhoto } from '../../services/api';
import { soloTheme, fontSize, spacing, radius } from '../../constants/theme';

export default function CaptureScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<'front' | 'back'>('back');
  const [analyzing, setAnalyzing] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  if (!permission) return <View style={styles.container} />;

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.permText}>Camera access needed for physique scans</Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Grant Access</Text>
        </TouchableOpacity>
      </View>
    );
  }

  async function capture() {
    if (!cameraRef.current || analyzing) return;
    setAnalyzing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8, base64: false });
      if (!photo) throw new Error('No photo captured');

      // Resize to reduce payload size
      const resized = await ImageManipulator.manipulateAsync(
        photo.uri,
        [{ resize: { width: 800 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );

      if (!resized.base64) throw new Error('Failed to encode image');

      const result = await analyzePhoto({
        image: resized.base64,
        media_type: 'image/jpeg',
      });

      if (result.error) {
        if (result.error.includes('Daily scan limit')) {
          Alert.alert('Daily limit reached', 'You\'ve used all 5 scans for today. Try again tomorrow!');
        } else {
          Alert.alert('Analysis failed', result.error);
        }
        return;
      }

      router.push({
        pathname: '/scan/result',
        params: {
          scan_id: result.scan_id,
          overall_score: String(result.overall_score),
          category_scores: JSON.stringify(result.category_scores),
          ai_feedback: result.ai_feedback,
          used: String(result.usage?.used),
          limit: String(result.usage?.limit),
        },
      });
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={styles.camera} facing={facing}>
        <View style={styles.overlay}>
          <View style={styles.topBar}>
            <Text style={styles.instructions}>Full body, good lighting</Text>
            <TouchableOpacity onPress={() => setFacing(f => f === 'back' ? 'front' : 'back')}>
              <Text style={styles.flipText}>Flip</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.guideline} />

          <View style={styles.bottomBar}>
            {analyzing ? (
              <View style={styles.analyzingBadge}>
                <ActivityIndicator color="#fff" />
                <Text style={styles.analyzingText}>Analyzing...</Text>
              </View>
            ) : (
              <TouchableOpacity style={styles.shutterBtn} onPress={capture}>
                <View style={styles.shutterInner} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  camera: { flex: 1, width: '100%' },
  overlay: { flex: 1, justifyContent: 'space-between' },
  topBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: spacing.lg, paddingTop: 60, backgroundColor: 'rgba(0,0,0,0.4)',
  },
  instructions: { color: '#fff', fontSize: fontSize.sm },
  flipText: { color: '#fff', fontSize: fontSize.md, fontWeight: '600' },
  guideline: {
    alignSelf: 'center', width: '60%', aspectRatio: 0.55,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', borderRadius: radius.lg,
  },
  bottomBar: {
    padding: spacing.xl, paddingBottom: 60, alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  shutterBtn: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.25)', justifyContent: 'center', alignItems: 'center',
    borderWidth: 3, borderColor: '#fff',
  },
  shutterInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#fff' },
  analyzingBadge: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  analyzingText: { color: '#fff', fontSize: fontSize.md },
  permText: { color: soloTheme.text, fontSize: fontSize.md, textAlign: 'center', padding: spacing.xl },
  permBtn: {
    backgroundColor: soloTheme.accent, borderRadius: radius.md,
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
  },
  permBtnText: { color: '#fff', fontSize: fontSize.md, fontWeight: '700' },
});
