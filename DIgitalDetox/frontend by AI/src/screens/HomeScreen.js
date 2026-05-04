import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { useAuth } from '../context/AuthContext';

export default function HomeScreen() {
  const { user, signOut } = useAuth();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f0faf4" />
      <Text style={styles.greeting}>
        Hey {user?.name?.split(' ')[0] || 'there'} 👋
      </Text>
      <Text style={styles.sub}>Your dashboard is coming soon!</Text>
      <Text style={styles.points}>⭐ {user?.total_points ?? 0} pts</Text>
      <TouchableOpacity style={styles.signOutBtn} onPress={signOut}>
        <Text style={styles.signOutText}>Sign out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0faf4',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  greeting: { fontSize: 28, fontWeight: '800', color: '#1a2e22', marginBottom: 8 },
  sub:      { fontSize: 15, color: '#6d9b7a', marginBottom: 24 },
  points:   { fontSize: 20, fontWeight: '700', color: '#27ae60', marginBottom: 40 },
  signOutBtn: {
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#a9dfbf',
  },
  signOutText: { fontSize: 14, fontWeight: '600', color: '#27ae60' },
});
