import { Tabs } from 'expo-router'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BottomTabBarProps } from '@react-navigation/bottom-tabs'

function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets()
  
  return (
    <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <LinearGradient
        colors={['#FF9F45', '#D494FF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.tabBarLine}
      />
      
      {/* Search Tab */}
      <TouchableOpacity 
        style={styles.tab} 
        onPress={() => navigation.navigate('search')}
      >
        {state.index === 0 ? (
          <LinearGradient
            colors={['#FF9F45', '#D494FF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.activeIconBorder}
          >
            <View style={styles.iconBackground}>
              <MaterialIcons name="search" size={24} color="#FF9F45" />
            </View>
          </LinearGradient>
        ) : (
          <View style={styles.inactiveIcon}>
            <MaterialIcons name="search" size={24} color="#666666" />
          </View>
        )}
        <Text style={[styles.tabText, state.index === 0 && styles.activeText]}>
          Search
        </Text>
      </TouchableOpacity>

      {/* Join Tab */}
      <TouchableOpacity 
        style={styles.tab}
        onPress={() => navigation.navigate('join')}
      >
        {state.index === 1 ? (
          <LinearGradient
            colors={['#FF9F45', '#D494FF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.activeIconBorder}
          >
            <View style={styles.iconBackground}>
              <MaterialIcons name="star" size={24} color="#FF9F45" />
            </View>
          </LinearGradient>
        ) : (
          <View style={styles.inactiveIcon}>
            <MaterialIcons name="star" size={24} color="#666666" />
          </View>
        )}
        <Text style={[styles.tabText, state.index === 1 && styles.activeText]}>
          Join
        </Text>
      </TouchableOpacity>

      {/* Home Tab */}
      <TouchableOpacity 
        style={styles.tab}
        onPress={() => navigation.navigate('index')}
      >
        {state.index === 2 ? (
          <LinearGradient
            colors={['#FF9F45', '#D494FF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.activeIconBorder}
          >
            <View style={styles.iconBackground}>
              <MaterialIcons name="home" size={24} color="#FF9F45" />
            </View>
          </LinearGradient>
        ) : (
          <View style={styles.inactiveIcon}>
            <MaterialIcons name="home" size={24} color="#666666" />
          </View>
        )}
        <Text style={[styles.tabText, state.index === 2 && styles.activeText]}>
          Home
        </Text>
      </TouchableOpacity>

      {/* Book Tab */}
      <TouchableOpacity 
        style={styles.tab}
        onPress={() => navigation.navigate('book')}
      >
        {state.index === 3 ? (
          <LinearGradient
            colors={['#FF9F45', '#D494FF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.activeIconBorder}
          >
            <View style={styles.iconBackground}>
              <MaterialIcons name="add" size={24} color="#FF9F45" />
            </View>
          </LinearGradient>
        ) : (
          <View style={styles.inactiveIcon}>
            <MaterialIcons name="add" size={24} color="#666666" />
          </View>
        )}
        <Text style={[styles.tabText, state.index === 3 && styles.activeText]}>
          Book
        </Text>
      </TouchableOpacity>

      {/* More Tab */}
      <TouchableOpacity 
        style={styles.tab}
        onPress={() => navigation.navigate('more')}
      >
        {state.index === 4 ? (
          <LinearGradient
            colors={['#FF9F45', '#D494FF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.activeIconBorder}
          >
            <View style={styles.iconBackground}>
              <MaterialIcons name="more-horiz" size={24} color="#FF9F45" />
            </View>
          </LinearGradient>
        ) : (
          <View style={styles.inactiveIcon}>
            <MaterialIcons name="more-horiz" size={24} color="#666666" />
          </View>
        )}
        <Text style={[styles.tabText, state.index === 4 && styles.activeText]}>
          More
        </Text>
      </TouchableOpacity>
    </View>
  )
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
      }}
      tabBar={props => <CustomTabBar {...props} />}
    >
      <Tabs.Screen name="search" />
      <Tabs.Screen name="join" />
      <Tabs.Screen name="index" />
      <Tabs.Screen name="book" />
      <Tabs.Screen name="more" />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#000000',
    height: 80,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#1A1A1A',
  },
  tabBarLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  activeIconBorder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    padding: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconBackground: {
    width: '100%',
    height: '100%',
    borderRadius: 18,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  inactiveIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabText: {
    fontSize: 12,
    fontFamily: 'Montserrat',
    color: '#666666',
    marginTop: 2,
  },
  activeText: {
    color: '#FFFFFF',
  },
});
