import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
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
