import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import React from 'react'
import { MaterialIcons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'

export default function Header() {
  return (
    <View style={styles.container}>
      {/* Location Button with Gradient Border */}
      <View style={styles.topSection}>
        <LinearGradient
          colors={['#FF9F45', '#D494FF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.locationWrapper}
        >
          <View style={styles.locationButton}>
            <MaterialIcons name='location-on' size={24} color='#FF9F45' />
            <Text style={styles.locationText}>Location</Text>
            <MaterialIcons
              name='keyboard-arrow-down'
              size={24}
              color='#FF9F45'
            />
          </View>
        </LinearGradient>

        {/* Right Icons */}
        <View style={styles.rightIcons}>
          <LinearGradient
            colors={['#FF9F45', '#D494FF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.iconWrapper}
          >
            <View style={styles.iconButton}>
              <MaterialIcons name='chat' size={20} color='#FF9F45' />
            </View>
          </LinearGradient>

          <LinearGradient
            colors={['#FF9F45', '#D494FF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.iconWrapper, styles.profileWrapper]}
          >
            <View style={styles.profileButton}>
              {/* Profile image placeholder */}
            </View>
          </LinearGradient>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 50,
    paddingHorizontal: 16,
    backgroundColor: '#000',
    gap: 20,
  },
  topSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  locationWrapper: {
    borderRadius: 30,
    padding: 1,
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#000',
    borderRadius: 29,
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 8,
  },
  locationText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },
  rightIcons: {
    flexDirection: 'row',
    gap: 12,
  },
  iconWrapper: {
    borderRadius: 20,
    padding: 1,
  },
  iconButton: {
    backgroundColor: '#000',
    borderRadius: 19,
    padding: 8,
  },
  profileWrapper: {
    width: 40,
    height: 40,
  },
  profileButton: {
    backgroundColor: '#000',
    borderRadius: 19,
    flex: 1,
  },
})
