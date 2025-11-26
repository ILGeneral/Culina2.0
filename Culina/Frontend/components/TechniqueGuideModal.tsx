import React from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { X, BookOpen, Zap, Award } from 'lucide-react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import type { TechniqueGuide } from '@/lib/cookingTechniques';

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

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingTop: 20,
    paddingBottom: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  icon: {
    fontSize: 40,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  difficultyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  difficultyText: {
    fontSize: 12,
    fontWeight: '600',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    color: '#4B5563',
  },
  tipsList: {
    gap: 12,
  },
  tipRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  tipBullet: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#128AFA',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  tipNumber: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: '#374151',
  },
  gotItButton: {
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 10,
    backgroundColor: '#128AFA',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  gotItText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
