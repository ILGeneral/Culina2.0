import { StyleSheet } from 'react-native';

export const skeletonStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    marginBottom: 14,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  image: {
    width: 70,
    height: 70,
    borderRadius: 14,
    marginRight: 14,
    backgroundColor: '#e5e7eb',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    gap: 8,
  },
  titleBar: {
    width: '70%',
    height: 16,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
  },
  subtitleBar: {
    width: '40%',
    height: 14,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
  },
  smallBar: {
    width: '30%',
    height: 12,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
  },
});

export const toastStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 8,
    zIndex: 9999,
  },
  message: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
  },
});

export const sectionHeaderStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f9fafb',
    gap: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  badge: {
    backgroundColor: '#e5e7eb',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    minWidth: 24,
    alignItems: 'center',
  },
  count: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6b7280',
  },
});
