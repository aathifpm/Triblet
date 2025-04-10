import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ImageBackground,
  Image,
} from 'react-native'
import React, { useState } from 'react'
import { MaterialIcons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'

export default function Explore() {
  const router = useRouter()
  const [selectedCategory, setSelectedCategory] = useState('Trending')

  const categories = ['Trending', 'Featured', 'New', 'Popular']

  const trendingVenues = [
    {
      id: 1,
      name: 'Hiranandani Cricket Ground',
      location: 'Powai, Mumbai',
      image: require('@/assets/images/turf-cricket.png'),
      rating: 4.8,
      price: '₹400/hr',
      sport: 'Cricket',
      distance: '2.5 km',
    },
    {
      id: 2,
      name: 'Turf Park',
      location: 'Andheri, Mumbai',
      image: require('@/assets/images/turf-cricket.png'),
      rating: 4.5,
      price: '₹800/hr',
      sport: 'Football',
      distance: '4.2 km',
    },
  ]

  const activities = [
    {
      id: 1,
      title: 'Morning Cricket',
      participants: 45,
      image: require('@/assets/images/turf-cricket.png'),
    },
    {
      id: 2,
      title: 'Evening Football',
      participants: 32,
      image: require('@/assets/images/turf-cricket.png'),
    },
  ]

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Explore</Text>
          <LinearGradient
            colors={['#FF9F45', '#D494FF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.titleUnderline}
          />
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerIconButton}>
            <MaterialIcons name="chat" size={24} color="#FF9F45" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconButton}>
            <View style={styles.profilePic} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content}>
        {/* Categories */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoriesContainer}
          contentContainerStyle={styles.categoriesContent}
        >
          {categories.map((category) => (
            <TouchableOpacity
              key={category}
              style={[
                styles.categoryButton,
                selectedCategory === category && styles.categoryButtonActive,
              ]}
              onPress={() => setSelectedCategory(category)}
            >
              <LinearGradient
                colors={['#FF9F45', '#D494FF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.categoryGradient}
              >
                <View style={styles.categoryInner}>
                  <Text
                    style={[
                      styles.categoryText,
                      selectedCategory === category && styles.categoryTextActive,
                    ]}
                  >
                    {category}
                  </Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Featured Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Featured Venues</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.venuesContainer}
          >
            {trendingVenues.map((venue) => (
              <TouchableOpacity 
                key={venue.id} 
                style={styles.venueCard}
                onPress={() => router.push('/GameDetailsScreen')}
              >
                <ImageBackground
                  source={venue.image}
                  style={styles.venueImage}
                  imageStyle={styles.venueImageStyle}
                >
                  <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.8)']}
                    style={styles.venueGradient}
                  >
                    <View style={styles.venueInfo}>
                      <View style={styles.venueHeader}>
                        <View>
                          <Text style={styles.venueName}>{venue.name}</Text>
                          <View style={styles.locationContainer}>
                            <MaterialIcons name="location-on" size={16} color="#FF9F45" />
                            <Text style={styles.locationText}>{venue.location}</Text>
                          </View>
                        </View>
                        <View style={styles.ratingContainer}>
                          <MaterialIcons name="star" size={16} color="#FF9F45" />
                          <Text style={styles.ratingText}>{venue.rating}</Text>
                        </View>
                      </View>

                      <View style={styles.venueFooter}>
                        <View style={styles.priceContainer}>
                          <Text style={styles.priceLabel}>Starting from</Text>
                          <Text style={styles.price}>{venue.price}</Text>
                        </View>
                        <View style={styles.distanceContainer}>
                          <MaterialIcons name="directions" size={16} color="#666666" />
                          <Text style={styles.distanceText}>{venue.distance}</Text>
                        </View>
                        <TouchableOpacity 
                          style={styles.bookButton}
                          onPress={() => router.push('/book')}
                        >
                          <LinearGradient
                            colors={['#FF9F45', '#D494FF']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.bookButtonGradient}
                          >
                            <Text style={styles.bookButtonText}>Book Now</Text>
                          </LinearGradient>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </LinearGradient>
                </ImageBackground>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Popular Activities */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Popular Activities</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.activitiesContainer}
          >
            {activities.map((activity) => (
              <TouchableOpacity key={activity.id} style={styles.activityCard}>
                <ImageBackground
                  source={activity.image}
                  style={styles.activityImage}
                  imageStyle={styles.activityImageStyle}
                >
                  <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.8)']}
                    style={styles.activityGradient}
                  >
                    <View style={styles.activityContent}>
                      <Text style={styles.activityTitle}>{activity.title}</Text>
                      <View style={styles.participantsContainer}>
                        <MaterialIcons name="group" size={16} color="#FF9F45" />
                        <Text style={styles.participantsText}>
                          {activity.participants} participants
                        </Text>
                      </View>
                    </View>
                  </LinearGradient>
                </ImageBackground>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 16,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  titleUnderline: {
    height: 2,
    width: 80,
    borderRadius: 1,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 12,
  },
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profilePic: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#333333',
  },
  content: {
    flex: 1,
  },
  categoriesContainer: {
    marginBottom: 24,
  },
  categoriesContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryButton: {
    marginRight: 8,
  },
  categoryGradient: {
    borderRadius: 20,
    padding: 1,
  },
  categoryInner: {
    backgroundColor: '#1A1A1A',
    borderRadius: 19,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  categoryButtonActive: {
    backgroundColor: '#000000',
  },
  categoryText: {
    fontSize: 14,
    color: '#666666',
    fontFamily: 'Montserrat',
  },
  categoryTextActive: {
    color: '#FF9F45',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  venuesContainer: {
    paddingHorizontal: 16,
  },
  venueCard: {
    width: 300,
    height: 200,
    marginRight: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  venueImage: {
    width: '100%',
    height: '100%',
  },
  venueImageStyle: {
    borderRadius: 16,
  },
  venueGradient: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 16,
  },
  venueInfo: {
    gap: 16,
  },
  venueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  venueName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    fontSize: 14,
    color: '#FFFFFF',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 159, 69, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  ratingText: {
    fontSize: 14,
    color: '#FF9F45',
    fontWeight: '600',
  },
  venueFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  priceContainer: {
    gap: 2,
  },
  priceLabel: {
    fontSize: 12,
    color: '#666666',
  },
  price: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  distanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  distanceText: {
    fontSize: 14,
    color: '#666666',
  },
  bookButton: {
    overflow: 'hidden',
    borderRadius: 16,
  },
  bookButtonGradient: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  bookButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  activitiesContainer: {
    paddingHorizontal: 16,
  },
  activityCard: {
    width: 200,
    height: 120,
    marginRight: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  activityImage: {
    width: '100%',
    height: '100%',
  },
  activityImageStyle: {
    borderRadius: 16,
  },
  activityGradient: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 12,
  },
  activityContent: {
    gap: 4,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  participantsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  participantsText: {
    fontSize: 12,
    color: '#FFFFFF',
  },
});
