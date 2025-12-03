import React from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { X, BookOpen, Zap, Award } from 'lucide-react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import type { TechniqueGuide } from '@/lib/cookingTechniques';
import { styles } from '@/styles/components/techniqueGuideModalStyles';

type TechniqueGuideModalProps = {
  visible: boolean;
  technique: TechniqueGuide | null;
  onClose: () => void;
};

export default function TechniqueGuideModal({ visible, technique, onClose }: TechniqueGuideModalProps) {
  if (!technique) return null;

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Easy':
        return { bg: '#D1FAE5', text: '#059669', border: '#10B981' };
      case 'Medium':
        return { bg: '#FEF3C7', text: '#D97706', border: '#F59E0B' };
      case 'Hard':
        return { bg: '#FEE2E2', text: '#DC2626', border: '#EF4444' };
      default:
        return { bg: '#F3F4F6', text: '#6B7280', border: '#9CA3AF' };
    }
  };

  const difficultyColors = getDifficultyColor(technique.difficulty);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <Animated.View entering={FadeIn} style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.icon}>{technique.icon}</Text>
              <View>
                <Text style={styles.title}>{technique.title}</Text>
                <View
                  style={[
                    styles.difficultyBadge,
                    { backgroundColor: difficultyColors.bg, borderColor: difficultyColors.border },
                  ]}
                >
                  <Award size={12} color={difficultyColors.text} />
                  <Text style={[styles.difficultyText, { color: difficultyColors.text }]}>
                    {technique.difficulty}
                  </Text>
                </View>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Description */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <BookOpen size={18} color="#128AFA" />
                <Text style={styles.sectionTitle}>What is it?</Text>
              </View>
              <Text style={styles.description}>{technique.description}</Text>
            </View>

            {/* Tips */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Zap size={18} color="#F59E0B" />
                <Text style={styles.sectionTitle}>Pro Tips</Text>
              </View>
              <View style={styles.tipsList}>
                {technique.tips.map((tip, index) => (
                  <View key={index} style={styles.tipRow}>
                    <View style={styles.tipBullet}>
                      <Text style={styles.tipNumber}>{index + 1}</Text>
                    </View>
                    <Text style={styles.tipText}>{tip}</Text>
                  </View>
                ))}
              </View>
            </View>
          </ScrollView>

          {/* Footer Button */}
          <TouchableOpacity style={styles.gotItButton} onPress={onClose}>
            <Text style={styles.gotItText}>Got it!</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}