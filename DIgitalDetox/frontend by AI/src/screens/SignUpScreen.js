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

const ICON = '🌱';

export default function SignUpScreen({ navigation }) {
  const { signIn } = useAuth();

  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [loading, setLoading]   = useState(false);
  const [showPwd, setShowPwd]   = useState(false);

  // Shake animation
  const shakeAnim = useRef(new Animated.Value(0)).current;

  // Password strength (0-4)
  const strength = (() => {
    let s = 0;
    if (password.length >= 8)             s++;
    if (/[A-Z]/.test(password))           s++;
    if (/[0-9]/.test(password))           s++;
    if (/[^A-Za-z0-9]/.test(password))   s++;
    return s;
  })();

  const strengthLabel = ['Weak', 'Fair', 'Good', 'Strong', 'Very Strong'][strength];
  const strengthColor = ['#e74c3c', '#e67e22', '#f1c40f', '#27ae60', '#1a5e38'][strength];

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10,  duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6,   duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -6,  duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,   duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !password || !confirm) {
      shake();
      Alert.alert('Oops!', 'Please fill in all fields.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      shake();
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    if (password.length < 6) {
      shake();
      Alert.alert('Weak Password', 'Password must be at least 6 characters.');
      return;
    }

    if (password !== confirm) {
      shake();
      Alert.alert('Password Mismatch', 'Passwords do not match.');
      return;
    }

    setLoading(true);
    const { data, error } = await apiFetch('/auth/register', {
      method: 'POST',
      body: {
        name:     name.trim(),
        email:    email.trim().toLowerCase(),
        password,
      },
    });
    setLoading(false);

    if (error) {
      shake();
      Alert.alert('Registration Failed', error);
      return;
    }

    await signIn(data.user, data.token);
    // Root navigator will redirect to Home on auth state change
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
          <Text style={styles.tagline}>Start your digital wellness journey</Text>
        </View>

        {/* ── Card ── */}
        <Animated.View style={[styles.card, { transform: [{ translateX: shakeAnim }] }]}>
          <Text style={styles.cardTitle}>Create account ✨</Text>
          <Text style={styles.cardSub}>It only takes 30 seconds</Text>

          {/* Name */}
          <View style={styles.fieldWrap}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Alex Johnson"
              placeholderTextColor="#9cbbaa"
              autoCapitalize="words"
              value={name}
              onChangeText={setName}
              testID="signup-name-input"
            />
          </View>

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
              testID="signup-email-input"
            />
          </View>

          {/* Password */}
          <View style={styles.fieldWrap}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.pwdRow}>
              <TextInput
                style={[styles.input, styles.pwdInput]}
                placeholder="Min. 6 characters"
                placeholderTextColor="#9cbbaa"
                secureTextEntry={!showPwd}
                value={password}
                onChangeText={setPassword}
                testID="signup-password-input"
              />
              <TouchableOpacity
                onPress={() => setShowPwd(v => !v)}
                style={styles.eyeBtn}
                testID="toggle-signup-password"
              >
                <Text style={styles.eyeText}>{showPwd ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>

            {/* Strength meter */}
            {password.length > 0 && (
              <View style={styles.strengthWrap}>
                <View style={styles.strengthBar}>
                  {[0, 1, 2, 3].map(i => (
                    <View
                      key={i}
                      style={[
                        styles.strengthSegment,
                        { backgroundColor: i < strength ? strengthColor : '#dff0e6' },
                      ]}
                    />
                  ))}
                </View>
                <Text style={[styles.strengthLabel, { color: strengthColor }]}>
                  {strengthLabel}
                </Text>
              </View>
            )}
          </View>

          {/* Confirm password */}
          <View style={styles.fieldWrap}>
            <Text style={styles.label}>Confirm Password</Text>
            <TextInput
              style={[
                styles.input,
                confirm.length > 0 && confirm !== password && styles.inputError,
              ]}
              placeholder="Repeat your password"
              placeholderTextColor="#9cbbaa"
              secureTextEntry={!showPwd}
              value={confirm}
              onChangeText={setConfirm}
              testID="signup-confirm-password-input"
            />
            {confirm.length > 0 && confirm !== password && (
              <Text style={styles.errorHint}>Passwords don't match</Text>
            )}
          </View>

          {/* What you get blurb */}
          <View style={styles.perksWrap}>
            {[
              '🏅  Earn points for every app you control',
              '🔥  Build streaks and climb to Platinum',
              '🎁  Unlock real-world coupons & rewards',
            ].map((perk, i) => (
              <Text key={i} style={styles.perk}>{perk}</Text>
            ))}
          </View>

          {/* Register button */}
          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.85}
            testID="signup-submit-button"
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>Start Detoxing 🌿</Text>
            }
          </TouchableOpacity>

          {/* Login prompt */}
          <View style={styles.loginRow}>
            <Text style={styles.loginPrompt}>Already have an account? </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('Login')}
              testID="navigate-to-login"
            >
              <Text style={styles.loginLink}>Log in →</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        <Text style={styles.footer}>Your screen time, your rules.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────
const GREEN        = '#27ae60';
const GREEN_MID    = '#a9dfbf';
const GREEN_LIGHT  = '#eafaf1';
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

  hero: { alignItems: 'center', marginTop: 48, marginBottom: 28 },

  iconRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: GREEN_LIGHT,
    borderWidth: 2,
    borderColor: GREEN_MID,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
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

  tagline: { marginTop: 6, fontSize: 14, color: TEXT_MUTED, textAlign: 'center' },

  card: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 28,
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },

  cardTitle: { fontSize: 22, fontWeight: '700', color: TEXT_PRIMARY, marginBottom: 4 },
  cardSub:   { fontSize: 14, color: TEXT_MUTED, marginBottom: 24 },

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

  inputError: { borderColor: '#e74c3c' },

  errorHint: { marginTop: 5, fontSize: 12, color: '#e74c3c', marginLeft: 4 },

  pwdRow: { flexDirection: 'row', alignItems: 'center' },
  pwdInput: { flex: 1 },

  eyeBtn: {
    position: 'absolute',
    right: 14,
    height: 52,
    justifyContent: 'center',
  },

  eyeText: { fontSize: 18 },

  // Strength meter
  strengthWrap: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 8 },
  strengthBar:  { flex: 1, flexDirection: 'row', gap: 4 },
  strengthSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  strengthLabel: { fontSize: 12, fontWeight: '600', minWidth: 70, textAlign: 'right' },

  // Perks
  perksWrap: {
    backgroundColor: GREEN_LIGHT,
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
    gap: 8,
  },
  perk: { fontSize: 13, color: TEXT_PRIMARY, lineHeight: 20 },

  btn: {
    width: '100%',
    height: 54,
    backgroundColor: GREEN,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: GREEN,
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    marginBottom: 20,
  },

  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },

  loginRow: { flexDirection: 'row', justifyContent: 'center' },
  loginPrompt: { fontSize: 14, color: TEXT_MUTED },
  loginLink:   { fontSize: 14, color: GREEN, fontWeight: '700' },

  footer: { marginTop: 36, fontSize: 12, color: TEXT_MUTED },
});
