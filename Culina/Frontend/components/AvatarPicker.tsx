import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, StyleSheet } from 'react-native';
import { X } from 'lucide-react-native';

interface AvatarPickerProps {
  onSelect: (avatarUrl: string) => void;
  onClose: () => void;
  currentAvatar?: string;
}

const AVATAR_STYLES = [
  { name: 'Avataaars', style: 'avataaars', description: 'Cartoon avatars' },
  { name: 'Bottts', style: 'bottts', description: 'Robot avatars' },
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '90%',
    maxWidth: 500,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  styleScroll: {
    flexGrow: 0,
  },
  styleButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    marginRight: 10,
    minWidth: 120,
  },
  styleButtonActive: {
    backgroundColor: '#128AFA',
  },
  styleName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  styleNameActive: {
    color: '#fff',
  },
  styleDescription: {
    fontSize: 12,
    color: '#666',
  },
  gridScroll: {
    maxHeight: 300,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  avatarButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: 'transparent',
  },
  avatarButtonActive: {
    borderColor: '#128AFA',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  previewLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  previewImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  confirmButton: {
    backgroundColor: '#128AFA',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  confirmText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
