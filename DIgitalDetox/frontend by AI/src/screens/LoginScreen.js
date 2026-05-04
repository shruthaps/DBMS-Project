import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Animated,
  ActivityIndicator,
  Alert,
  ScrollView,
  StatusBar,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../utils/api';

// ── Leaf / detox icon (SVG-less, pure emoji + text approach for RN) ──
const ICON = '🌿';

export default function LoginScreen({ navigation }) {
  const { signIn } = useAuth();

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [showPwd, setShowPwd]   = useState(false);

  // Shake animation for invalid input
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10,  duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6,   duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -6,  duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,   duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      shake();
      Alert.alert('Oops!', 'Please fill in both email and password.');
      return;
    }

    setLoading(true);
    const { data, error } = await apiFetch('/auth/login', {
      method: 'POST',
      body: { email: email.trim().toLowerCase(), password },
    });
    setLoading(false);

    if (error) {
      shake();
      Alert.alert('Login Failed', error);
      return;
    }

    await signIn(data.user, data.token);
    // Navigation to Home handled by root navigator watching auth state
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#f0faf4" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero ── */}
        <View style={styles.hero}>
          <View style={styles.iconRing}>
            <Text style={styles.iconEmoji}>{ICON}</Text>
          </View>
          <Text style={styles.brand}>DigitalDetox</Text>
          <Text style={styles.tagline}>Reclaim your time. Earn your rewards.</Text>
        </View>

        {/* ── Card ── */}
        <Animated.View style={[styles.card, { transform: [{ translateX: shakeAnim }] }]}>
          <Text style={styles.cardTitle}>Welcome back 👋</Text>
          <Text style={styles.cardSub}>Log in to see your streak</Text>

          {/* Email */}
          <View style={styles.fieldWrap}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor="#9cbbaa"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={email}
              onChangeText={setEmail}
              testID="login-email-input"
            />
          </View>

          {/* Password */}
          <View style={styles.fieldWrap}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.pwdRow}>
              <TextInput
                style={[styles.input, styles.pwdInput]}
                placeholder="••••••••"
                placeholderTextColor="#9cbbaa"
                secureTextEntry={!showPwd}
                value={password}
                onChangeText={setPassword}
                testID="login-password-input"
              />
              <TouchableOpacity
                onPress={() => setShowPwd(v => !v)}
                style={styles.eyeBtn}
                testID="toggle-password-visibility"
              >
                <Text style={styles.eyeText}>{showPwd ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Forgot password (placeholder — add later) */}
          <TouchableOpacity style={styles.forgotWrap}>
            <Text style={styles.forgotText}>Forgot password?</Text>
          </TouchableOpacity>

          {/* Login button */}
          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
            testID="login-submit-button"
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>Log In</Text>
            }
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Sign-up prompt */}
          <View style={styles.signupRow}>
            <Text style={styles.signupPrompt}>New here? </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('SignUp')}
              testID="navigate-to-signup"
            >
              <Text style={styles.signupLink}>Create an account →</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Footer */}
        <Text style={styles.footer}>Your screen time, your rules.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────
const GREEN        = '#27ae60';
const GREEN_DARK   = '#1e8449';
const GREEN_LIGHT  = '#eafaf1';
const GREEN_MID    = '#a9dfbf';
const TEXT_PRIMARY = '#1a2e22';
const TEXT_MUTED   = '#6d9b7a';

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#f0faf4' },

  scroll: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 40,
  },

  // Hero
  hero: { alignItems: 'center', marginTop: 64, marginBottom: 32 },

  iconRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: GREEN_LIGHT,
    borderWidth: 2,
    borderColor: GREEN_MID,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    // Shadow
    shadowColor: GREEN,
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },

  iconEmoji: { fontSize: 36 },

  brand: {
    fontSize: 30,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    letterSpacing: -0.5,
  },

  tagline: {
    marginTop: 6,
    fontSize: 14,
    color: TEXT_MUTED,
    textAlign: 'center',
  },

  // Card
  card: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 28,
    // Shadow
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },

  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    marginBottom: 4,
  },

  cardSub: { fontSize: 14, color: TEXT_MUTED, marginBottom: 28 },

  // Form fields
  fieldWrap: { marginBottom: 18 },

  label: {
    fontSize: 13,
    fontWeight: '600',
    color: TEXT_PRIMARY,
    marginBottom: 8,
    letterSpacing: 0.3,
  },

  input: {
    width: '100%',
    height: 52,
    backgroundColor: '#f7fbf8',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: GREEN_MID,
    paddingHorizontal: 16,
    fontSize: 15,
    color: TEXT_PRIMARY,
  },

  pwdRow: { flexDirection: 'row', alignItems: 'center' },

  pwdInput: { flex: 1 },

  eyeBtn: {
    position: 'absolute',
    right: 14,
    height: 52,
    justifyContent: 'center',
  },

  eyeText: { fontSize: 18 },

  forgotWrap: { alignSelf: 'flex-end', marginBottom: 24 },

  forgotText: { fontSize: 13, color: GREEN, fontWeight: '600' },

  // Button
  btn: {
    width: '100%',
    height: 54,
    backgroundColor: GREEN,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    // Glow
    shadowColor: GREEN,
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },

  btnDisabled: { opacity: 0.6 },

  btnText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },

  // Divider
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },

  dividerLine: { flex: 1, height: 1, backgroundColor: '#dff0e6' },

  dividerText: { marginHorizontal: 12, fontSize: 13, color: TEXT_MUTED },

  // Sign-up
  signupRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },

  signupPrompt: { fontSize: 14, color: TEXT_MUTED },

  signupLink: { fontSize: 14, color: GREEN, fontWeight: '700' },

  // Footer
  footer: { marginTop: 36, fontSize: 12, color: TEXT_MUTED },
});
