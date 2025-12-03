import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image } from 'react-native';
import { X } from 'lucide-react-native';
import { styles } from '@/styles/components/avatarPickerStyles';

interface AvatarPickerProps {
  onSelect: (avatarUrl: string) => void;
  onClose: () => void;
  currentAvatar?: string;
}

const AVATAR_STYLES = [
  { name: 'Avatars', style: 'avataaars', description: 'Cartoon avatars' },
  { name: 'Bots', style: 'bottts', description: 'Robot avatars' },
  { name: 'Personas', style: 'personas', description: 'Minimal avatars' },
  { name: 'Lorelei', style: 'lorelei', description: 'Illustrated faces' },
  { name: 'Micah', style: 'micah', description: 'Unique characters' },
  { name: 'Adventurer', style: 'adventurer', description: 'Adventure style' },
];

export default function AvatarPicker({ onSelect, onClose, currentAvatar }: AvatarPickerProps) {
  const [selectedStyle, setSelectedStyle] = useState('avataaars');
  const [selectedSeed, setSelectedSeed] = useState<number>(0);

  // Generate 12 different seeds for preview
  const seeds = Array.from({ length: 12 }, (_, i) => i);

  const generateAvatarUrl = (style: string, seed: number) => {
    // Use PNG format instead of SVG for React Native compatibility
    // Validate inputs to prevent malformed URLs
    if (!style || typeof style !== 'string') {
      console.warn('Invalid avatar style, using default');
      style = 'avataaars';
    }
    if (typeof seed !== 'number' || seed < 0) {
      console.warn('Invalid avatar seed, using default');
      seed = 0;
    }
    return `https://api.dicebear.com/7.x/${style}/png?seed=${seed}&size=200`;
  };

  const handleSelect = () => {
    const avatarUrl = generateAvatarUrl(selectedStyle, selectedSeed);
    onSelect(avatarUrl);
    onClose();
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Choose Your Avatar</Text>
          <TouchableOpacity onPress={onClose}>
            <X size={24} color="#666" />
          </TouchableOpacity>
        </View>

        {/* Avatar Styles */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Style</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.styleScroll}
          >
            {AVATAR_STYLES.map((item) => (
              <TouchableOpacity
                key={item.style}
                style={[
                  styles.styleButton,
                  selectedStyle === item.style && styles.styleButtonActive
                ]}
                onPress={() => setSelectedStyle(item.style)}
              >
                <Text style={[
                  styles.styleName,
                  selectedStyle === item.style && styles.styleNameActive
                ]}>
                  {item.name}
                </Text>
                <Text style={styles.styleDescription}>{item.description}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Avatar Grid */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Choose Avatar</Text>
          <ScrollView style={styles.gridScroll} showsVerticalScrollIndicator={false}>
            <View style={styles.grid}>
              {seeds.map((seed) => {
                const avatarUrl = generateAvatarUrl(selectedStyle, seed);
                return (
                  <TouchableOpacity
                    key={seed}
                    style={[
                      styles.avatarButton,
                      selectedSeed === seed && styles.avatarButtonActive
                    ]}
                    onPress={() => setSelectedSeed(seed)}
                  >
                    <Image
                      source={{ uri: avatarUrl }}
                      style={styles.avatarImage}
                      onError={(error) => {
                        console.warn('Failed to load avatar image:', avatarUrl, error);
                      }}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </View>

        {/* Preview and Confirm */}
        <View style={styles.footer}>
          <View style={styles.preview}>
            <Text style={styles.previewLabel}>Preview:</Text>
            <Image
              source={{ uri: generateAvatarUrl(selectedStyle, selectedSeed) }}
              style={styles.previewImage}
              onError={(error) => {
                console.warn('Failed to load preview avatar image:', error);
              }}
            />
          </View>
          <TouchableOpacity style={styles.confirmButton} onPress={handleSelect}>
            <Text style={styles.confirmText}>Select Avatar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}