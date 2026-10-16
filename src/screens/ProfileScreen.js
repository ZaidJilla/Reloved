import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { SCHOOLS } from '../constants/schools';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, space, type } from '../theme';
import { Headline } from '../components';

export default function ProfileScreen() {
  const [profile, setProfile] = useState(null);
  const [myListings, setMyListings] = useState([]);

  const load = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData?.user?.id;
    if (!uid) return;

    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .single();
    setProfile(profileData);

    const { data: listings } = await supabase
      .from('listings')
      .select('id, title, price_cents, status')
      .eq('seller_id', uid)
      .order('created_at', { ascending: false });
    setMyListings(listings || []);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  const schoolName = SCHOOLS.find((s) => s.id === profile?.school_id)?.name;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Headline size="title" plain={profile?.full_name || ''} />
        <Text style={styles.school}>{schoolName}</Text>
      </View>

      <Text style={styles.sectionTitle}>Your listings</Text>
      <FlatList
        data={myListings}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.rowTitle}>{item.title}</Text>
            <Text style={styles.rowMeta}>
              ${(item.price_cents / 100).toFixed(2)} · {item.status}
            </Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>You haven't posted anything yet.</Text>}
      />

      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign out</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream, padding: space.xl, paddingBottom: 112 },
  header: { marginBottom: space.xxl, paddingTop: space.lg },
  school: { ...type.body, color: colors.inkSoft, marginTop: space.sm },
  sectionTitle: { ...type.section, color: colors.ink, marginBottom: space.sm },
  row: { paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: colors.line },
  rowTitle: { ...type.bodyMedium, color: colors.ink },
  rowMeta: { ...type.caption, color: colors.inkSoft, marginTop: 2 },
  empty: { ...type.body, color: colors.inkSoft, marginTop: space.sm },
  signOutButton: { marginTop: 'auto', padding: space.lg, alignItems: 'center' },
  signOutText: { ...type.bodyMedium, color: colors.danger },
});
