import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { signup } from '../../services/api';
import { storeTokens } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { soloTheme, fontSize, spacing, radius } from '../../constants/theme';

export default function SignupScreen() {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [country, setCountry] = useState('');
  const [loading, setLoading] = useState(false);
  const setTokensAndUser = useAuthStore(s => s.setTokensAndUser);

  async function handleSignup() {
    if (!email || !username || !password) {
      Alert.alert('Required', 'Please fill in all required fields');
      return;
    }
    if (username.length < 3) {
      Alert.alert('Username too short', 'At least 3 characters');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Password too short', 'At least 8 characters');
      return;
    }
    setLoading(true);
    try {
      const res = await signup({
        email: email.trim().toLowerCase(),
        username: username.trim(),
        password,
        country: country.trim().toUpperCase() || undefined,
      });
      if (res.error || !res.access_token || !res.user) {
        Alert.alert('Signup failed', res.error ?? 'Unknown error');
        return;
      }
      await setTokensAndUser(res.access_token, res.refresh_token!, {
        ...res.user, wins: 0, losses: 0,
      });
      router.replace('/(tabs)/dashboard');
    } catch {
      Alert.alert('Error', 'Network error — please try again');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <Text style={styles.logo}>PHYLO</Text>
        <Text style={styles.subtitle}>Create your account</Text>

        <TextInput
          style={styles.input} placeholder="Email *" placeholderTextColor={soloTheme.textMuted}
          value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none"
        />
        <TextInput
          style={styles.input} placeholder="Username * (3–20 chars, letters/numbers/_)"
          placeholderTextColor={soloTheme.textMuted} value={username} onChangeText={setUsername}
          autoCapitalize="none" autoCorrect={false}
        />
        <TextInput
          style={styles.input} placeholder="Password * (min 8 chars)" placeholderTextColor={soloTheme.textMuted}
          value={password} onChangeText={setPassword} secureTextEntry
        />
        <TextInput
          style={styles.input} placeholder="Country code (optional, e.g. US)"
          placeholderTextColor={soloTheme.textMuted} value={country} onChangeText={setCountry}
          autoCapitalize="characters" maxLength={2}
        />

        <TouchableOpacity style={styles.btn} onPress={handleSignup} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>Create Account</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.back()} style={styles.link}>
          <Text style={styles.linkText}>Already have an account? Log in</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: soloTheme.background },
  inner: { flexGrow: 1, justifyContent: 'center', padding: spacing.xl },
  logo: {
    fontSize: fontSize['4xl'], fontWeight: '900', color: soloTheme.text,
    letterSpacing: 8, textAlign: 'center', marginBottom: spacing.xs,
  },
  subtitle: { fontSize: fontSize.md, color: soloTheme.textMuted, textAlign: 'center', marginBottom: spacing['2xl'] },
  input: {
    backgroundColor: soloTheme.surface, color: soloTheme.text, borderRadius: radius.md,
    borderWidth: 1, borderColor: soloTheme.border, padding: spacing.md,
    fontSize: fontSize.md, marginBottom: spacing.md,
  },
  btn: {
    backgroundColor: soloTheme.accent, borderRadius: radius.md,
    padding: spacing.md, alignItems: 'center', marginTop: spacing.sm,
  },
  btnText: { color: '#fff', fontSize: fontSize.md, fontWeight: '700' },
  link: { marginTop: spacing.lg, alignItems: 'center' },
  linkText: { color: soloTheme.accentLight, fontSize: fontSize.sm },
});
