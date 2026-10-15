import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { colors, radius, space, type } from '../theme';
import { Headline, Button, Pill, FormInput } from '../components';

export default function CreateListingScreen({ navigation }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('');
  const [size, setSize] = useState('');
  const [condition, setCondition] = useState('');
  const [listingType, setListingType] = useState('resale'); // 'resale' | 'handmade'
  const [photoUri, setPhotoUri] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function pickImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'We need photo library access to add listing photos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (!result.canceled) {
      setPhotoUri(result.assets[0].uri);
    }
  }

  async function handleSubmit() {
    if (!title.trim() || !price) {
      Alert.alert('Missing info', 'Title and price are required.');
      return;
    }
    const priceCents = Math.round(parseFloat(price) * 100);
    if (isNaN(priceCents) || priceCents < 0) {
      Alert.alert('Invalid price', 'Enter a valid price like 25.00');
      return;
    }

    setSubmitting(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from('profiles')
        .select('school_id')
        .eq('id', userData.user.id)
        .single();

      const { data: listing, error } = await supabase
        .from('listings')
        .insert({
          seller_id: userData.user.id,
          school_id: profile.school_id,
          title: title.trim(),
          description: description.trim(),
          price_cents: priceCents,
          category: category.trim() || null,
          size: size.trim() || null,
          condition: condition.trim() || null,
          listing_type: listingType,
        })
        .select('id')
        .single();

      if (error) throw error;

      if (photoUri) {
        const fileExt = photoUri.split('.').pop();
        const fileName = `${listing.id}-${Date.now()}.${fileExt}`;
        const response = await fetch(photoUri);
        const blob = await response.blob();

        const { error: uploadError } = await supabase.storage
          .from('listing-photos')
          .upload(fileName, blob, { contentType: `image/${fileExt}` });

        if (!uploadError) {
          const { data: publicUrl } = supabase.storage
            .from('listing-photos')
            .getPublicUrl(fileName);

          await supabase.from('listing_photos').insert({
            listing_id: listing.id,
            photo_url: publicUrl.publicUrl,
          });
        }
      }

      Alert.alert('Listed!', 'Your item is now live for your campus to see.');
      setTitle('');
      setDescription('');
      setPrice('');
      setCategory('');
      setSize('');
      setCondition('');
      setPhotoUri(null);
      setListingType('resale');
      navigation.navigate('HomeTab');
    } catch (err) {
      Alert.alert('Error creating listing', err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Headline plain="Sell it" italic="in 30 seconds" style={styles.headline} />

        <TouchableOpacity style={styles.photoPicker} onPress={pickImage}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.photoPreview} />
          ) : (
            <Text style={styles.photoPickerText}>Add photo</Text>
          )}
        </TouchableOpacity>

        <View style={styles.pillRow}>
          <Pill label="Resale" selected={listingType === 'resale'} onPress={() => setListingType('resale')} />
          <Pill label="Handmade by me" selected={listingType === 'handmade'} onPress={() => setListingType('handmade')} />
        </View>

        <FormInput placeholder="Title" value={title} onChangeText={setTitle} />
        <FormInput placeholder="Description" value={description} onChangeText={setDescription} multiline />
        <FormInput placeholder="Price (e.g. 25.00)" keyboardType="decimal-pad" value={price} onChangeText={setPrice} />
        <FormInput placeholder="Category (e.g. Jackets, Tops)" value={category} onChangeText={setCategory} />
        <FormInput placeholder="Size" value={size} onChangeText={setSize} />
        <FormInput placeholder="Condition (e.g. Like new, Good, Worn)" value={condition} onChangeText={setCondition} />

        <Button
          label={submitting ? 'Posting...' : 'Post listing'}
          onPress={handleSubmit}
          disabled={submitting}
          style={styles.cta}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  // Bottom padding keeps the post button clear of the floating nav bar.
  content: { padding: space.xl, paddingBottom: 112 },
  headline: { marginBottom: space.xxl },
  photoPicker: {
    height: 180,
    borderRadius: radius.row,
    backgroundColor: colors.sand,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.muted,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: space.lg,
    overflow: 'hidden',
  },
  photoPreview: { width: '100%', height: '100%' },
  photoPickerText: { ...type.body, color: colors.inkSoft },
  pillRow: { flexDirection: 'row', gap: space.sm, marginBottom: space.lg },
  cta: { marginTop: space.sm },
});
