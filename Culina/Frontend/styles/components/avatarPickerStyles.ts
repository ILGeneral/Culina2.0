import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
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
