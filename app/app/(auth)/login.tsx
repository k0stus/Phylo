import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { login } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { soloTheme, fontSize, spacing, radius } from '../../constants/theme';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const setTokensAndUser = useAuthStore(s => s.setTokensAndUser);

  async function handleLogin() {
    if (!email || !password) return;
    setLoading(true);
    try {
      const res = await login(email.trim().toLowerCase(), password);
      if (res.error || !res.access_token || !res.user) {
        Alert.alert('Login failed', res.error ?? 'Unknown error');
        return;
      }
      await setTokensAndUser(res.access_token, res.refresh_token!, {
        ...res.user,
        wins: res.user.wins ?? 0,
        losses: res.user.losses ?? 0,
      });
      router.replace('/(tabs)/dashboard');
    } catch {
      Alert.alert('Error', 'Network error — please try again');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
        <Text style={styles.logo}>PHYLO</Text>
        <Text style={styles.subtitle}>Track your physique journey</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={soloTheme.textMuted}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={soloTheme.textMuted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity style={styles.btn} onPress={handleLogin} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>Log In</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/(auth)/signup')} style={styles.link}>
          <Text style={styles.linkText}>No account? Sign up</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: soloTheme.background },
  inner: { flex: 1, justifyContent: 'center', padding: spacing.xl },
  logo: {
    fontSize: fontSize['4xl'],
    fontWeight: '900',
    color: soloTheme.text,
    letterSpacing: 8,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: fontSize.md,
    color: soloTheme.textMuted,
    textAlign: 'center',
    marginBottom: spacing['2xl'],
  },
  input: {
    backgroundColor: soloTheme.surface,
    color: soloTheme.text,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: soloTheme.border,
    padding: spacing.md,
    fontSize: fontSize.md,
    marginBottom: spacing.md,
  },
  btn: {
    backgroundColor: soloTheme.accent,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  btnText: { color: '#fff', fontSize: fontSize.md, fontWeight: '700' },
  link: { marginTop: spacing.lg, alignItems: 'center' },
  linkText: { color: soloTheme.accentLight, fontSize: fontSize.sm },
});
