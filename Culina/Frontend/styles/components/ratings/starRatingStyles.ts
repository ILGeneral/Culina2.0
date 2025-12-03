import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 2,
  },
  interactive: {
    gap: 4,
  },
  starButton: {
    padding: 4,
  },
  ratingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    marginLeft: 6,
  },
  countText: {
    fontSize: 14,
    color: '#64748b',
    marginLeft: 2,
  },
});
