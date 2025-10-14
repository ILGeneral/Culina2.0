import { View, Text, StyleSheet } from 'react-native'
import React from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'

export default function recipe_gen() {
  return (
    <SafeAreaView style={styles.container}>
        <View>
            <Text style={styles.text}> Recipe Generator </Text>
        </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    text: {
        fontSize: 14,
        fontWeight: 'bold',
    },
})