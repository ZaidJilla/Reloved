import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { supabase } from '../../lib/supabase';
import { colors, space, type } from '../../theme';
import { Headline, Button, FormInput } from '../../components';
import { schoolFromEmail } from '../../constants/schools';

export default function SignUpScreen({ navigation }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSignUp() {
    const school = schoolFromEmail(email);
    if (!school) {
      Alert.alert(
        'Unsupported school email',
        'Reloved is currently only available to Tufts and Northeastern students. Please sign up with your .edu email.'
      );
      return;
    }
    if (!fullName.trim()) {
      Alert.alert('Missing name', 'Please enter your full name.');
      return;
    }

    setLoading(true);
    // school_id/full_name are passed as user metadata; a database trigger
    // (see supabase/schema.sql) creates the profiles row server-side, since
    // there's no active session yet to satisfy the profiles RLS policy here.
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          school_id: school.id,
          full_name: fullName.trim(),
        },
      },
    });
    setLoading(false);

    if (error) {
      Alert.alert('Sign up failed', error.message);
      return;
    }

    Alert.alert(
      'Check your email',
      `We sent a confirmation link to ${email}. Confirm it, then log in.`
    );
    navigation.navigate('Login');
  }

  return (
    <View style={styles.container}>
      <Headline plain="Join your" italic="campus" />
      <Text style={styles.subtitle}>Tufts and Northeastern students only — sign up with your .edu email.</Text>

      <FormInput
        placeholder="Full name"
        value={fullName}
        onChangeText={setFullName}
      />
      <FormInput
        placeholder="you@tufts.edu or you@northeastern.edu"
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

      <Button style={styles.button} label={loading ? 'Creating account...' : 'Sign up'} onPress={handleSignUp} disabled={loading} />

      <TouchableOpacity onPress={() => navigation.navigate('Login')}>
        <Text style={styles.link}>Already have an account? Log in</Text>
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
