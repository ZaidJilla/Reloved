import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { supabase } from '../../lib/supabase';
import { colors, space, type } from '../../theme';
import { Headline, Button, FormInput } from '../../components';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      Alert.alert('Login failed', error.message);
    }
    // On success, the onAuthStateChange listener in App.js takes over routing.
  }

  return (
    <View style={styles.container}>
      <Headline plain="Welcome" italic="back" />
      <Text style={styles.subtitle}>Buy, sell, and make clothes with your campus.</Text>

      <FormInput
        placeholder="School email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <FormInput
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <Button style={styles.button} label={loading ? 'Logging in...' : 'Log in'} onPress={handleLogin} disabled={loading} />

      <TouchableOpacity onPress={() => navigation.navigate('SignUp')}>
        <Text style={styles.link}>New here? Create an account</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: space.xl, backgroundColor: colors.cream },
  subtitle: { ...type.body, color: colors.inkSoft, marginTop: space.md, marginBottom: space.xxl },
  button: { marginTop: space.sm },
  link: { ...type.body, textAlign: 'center', marginTop: space.xl, color: colors.ink },
});
