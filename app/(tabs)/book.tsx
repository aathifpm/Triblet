import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ImageBackground,
  Modal,
  TextInput,
  Platform,
  Alert,
} from 'react-native'
import React, { useState } from 'react'
import { MaterialIcons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import DateTimePicker from '@react-native-community/datetimepicker'

interface Venue {
  id: number;
  name: string;
  location: string;
  image: any;
  sport: string;
  rating: number;
  price: string;
  distance: string;
  amenities: string[];
  maxPlayers: number;
}

export default function Book() {
  const router = useRouter()
  const [selectedCategory, setSelectedCategory] = useState<string>('All')
  const [showBookingModal, setShowBookingModal] = useState(false)
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [showTimePicker, setShowTimePicker] = useState(false)
  const [bookingDetails, setBookingDetails] = useState({
    date: new Date(),
    time: new Date(),
    duration: '1',
    players: '4',
  })

  const categories = ['All', 'Cricket', 'Football', 'Basketball', 'Tennis']

  const venues = [
    {
      id: 1,
      name: 'Hiranandani Cricket Ground',
      location: 'Powai, Mumbai',
      image: require('@/assets/images/turf-cricket.png'),
      sport: 'Cricket',
      rating: 4.8,
      price: '₹400/hr',
      distance: '2.5 km',
      amenities: ['Parking', 'Changing Room', 'First Aid', 'Floodlights'],
      maxPlayers: 22,
    },
    {
      id: 2,
      name: 'Turf Park',
      location: 'Andheri, Mumbai',
      image: require('@/assets/images/turf-cricket.png'),
      sport: 'Football',
      rating: 4.5,
      price: '₹800/hr',
      distance: '4.2 km',
      amenities: ['Parking', 'Changing Room', 'Cafe', 'Floodlights'],
      maxPlayers: 14,
    },
  ]

  const handleBookNow = (venue: Venue) => {
    setSelectedVenue(venue)
    setShowBookingModal(true)
  }

  const handleConfirmBooking = () => {
    // Here you would typically make an API call to create the booking
    Alert.alert(
      'Booking Confirmed',
      'Your venue has been booked successfully!',
      [{ text: 'OK', onPress: () => setShowBookingModal(false) }]
    )
  }

  const BookingModal = () => (
    <Modal
      visible={showBookingModal}
      animationType="slide"
      transparent
      onRequestClose={() => setShowBookingModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Book Venue</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowBookingModal(false)}
            >
              <MaterialIcons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            {/* Venue Summary */}
            <View style={styles.venueSummary}>
              <Image
                source={selectedVenue?.image}
                style={styles.modalVenueImage}
              />
              <View style={styles.venueSummaryContent}>
                <Text style={styles.modalVenueName}>{selectedVenue?.name}</Text>
                <View style={styles.modalLocationContainer}>
                  <MaterialIcons name="location-on" size={16} color="#FF9F45" />
                  <Text style={styles.modalLocationText}>
                    {selectedVenue?.location}
                  </Text>
                </View>
              </View>
            </View>

            {/* Date Selection */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Select Date</Text>
              <TouchableOpacity
                style={styles.dateInput}
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={styles.dateText}>
                  {bookingDetails.date.toLocaleDateString()}
                </Text>
                <MaterialIcons name="event" size={24} color="#FF9F45" />
              </TouchableOpacity>
              {showDatePicker && (
                <DateTimePicker
                  value={bookingDetails.date}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  minimumDate={new Date()}
                  onChange={(event, selectedDate) => {
                    setShowDatePicker(false)
                    if (selectedDate) {
                      setBookingDetails({ ...bookingDetails, date: selectedDate })
                    }
                  }}
                />
              )}
            </View>

            {/* Time Selection */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Select Time</Text>
              <TouchableOpacity
                style={styles.dateInput}
                onPress={() => setShowTimePicker(true)}
              >
                <Text style={styles.dateText}>
                  {bookingDetails.time.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
                <MaterialIcons name="access-time" size={24} color="#FF9F45" />
              </TouchableOpacity>
              {showTimePicker && (
                <DateTimePicker
                  value={bookingDetails.time}
                  mode="time"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(event, selectedTime) => {
                    setShowTimePicker(false)
                    if (selectedTime) {
                      setBookingDetails({ ...bookingDetails, time: selectedTime })
                    }
                  }}
                />
              )}
            </View>

            {/* Duration */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Duration (hours)</Text>
              <TextInput
                style={styles.textInput}
                keyboardType="numeric"
                value={bookingDetails.duration}
                onChangeText={(text) =>
                  setBookingDetails({ ...bookingDetails, duration: text })
                }
                placeholder="Enter duration"
                placeholderTextColor="#666"
              />
            </View>

            {/* Number of Players */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Number of Players</Text>
              <TextInput
                style={styles.textInput}
                keyboardType="numeric"
                value={bookingDetails.players}
                onChangeText={(text) =>
                  setBookingDetails({ ...bookingDetails, players: text })
                }
                placeholder="Enter number of players"
                placeholderTextColor="#666"
              />
              <Text style={styles.maxPlayersText}>
                Maximum {selectedVenue?.maxPlayers} players allowed
              </Text>
            </View>

            {/* Amenities */}
            <View style={styles.amenitiesSection}>
              <Text style={styles.sectionTitle}>Amenities</Text>
              <View style={styles.amenitiesList}>
                {selectedVenue?.amenities.map((amenity, index) => (
                  <View key={index} style={styles.amenityItem}>
                    <MaterialIcons name="check-circle" size={20} color="#FF9F45" />
                    <Text style={styles.amenityText}>{amenity}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Price Breakdown */}
            <View style={styles.priceBreakdown}>
              <Text style={styles.sectionTitle}>Price Breakdown</Text>
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Venue Charges</Text>
                <Text style={styles.priceValue}>
                  ₹{parseInt(selectedVenue?.price?.replace('₹', '').replace('/hr', '') || '0') * parseInt(bookingDetails.duration)}
                </Text>
              </View>
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>GST (18%)</Text>
                <Text style={styles.priceValue}>
                  ₹{(parseInt(selectedVenue?.price?.replace('₹', '').replace('/hr', '') || '0') * parseInt(bookingDetails.duration) * 0.18).toFixed(2)}
                </Text>
              </View>
              <View style={[styles.priceRow, styles.totalRow]}>
                <Text style={styles.totalLabel}>Total Amount</Text>
                <Text style={styles.totalValue}>
                  ₹{(parseInt(selectedVenue?.price?.replace('₹', '').replace('/hr', '') || '0') * parseInt(bookingDetails.duration) * 1.18).toFixed(2)}
                </Text>
              </View>
            </View>
          </ScrollView>

          {/* Confirm Button */}
          <TouchableOpacity
            style={styles.confirmButton}
            onPress={handleConfirmBooking}
          >
            <LinearGradient
              colors={['#FF9F45', '#D494FF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.confirmGradient}
            >
              <View style={styles.confirmButtonInner}>
                <Text style={styles.confirmButtonText}>Confirm Booking</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Book Venue</Text>
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

      {/* Venues List */}
      <ScrollView style={styles.venuesContainer}>
        {venues.map((venue) => (
          <TouchableOpacity key={venue.id} style={styles.venueCard}>
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
                      onPress={() => handleBookNow(venue)}
                    >
                      <LinearGradient
                        colors={['#FF9F45', '#D494FF']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.bookButtonGradient}
                      >
                        <View style={styles.bookButtonInner}>
                          <Text style={styles.bookButtonText}>Book Now</Text>
                        </View>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                </View>
              </LinearGradient>
            </ImageBackground>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <BookingModal />
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
    borderWidth: 1,
    borderColor: '#FF9F45',
  },
  profilePic: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#333333',
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
    overflow: 'hidden',
  },
  categoryGradient: {
    borderRadius: 20,
    padding: 1.5,
  },
  categoryInner: {
    backgroundColor: '#000000',
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
  venuesContainer: {
    paddingHorizontal: 16,
  },
  venueCard: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    height: 200,
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
    borderRadius: 24,
  },
  bookButtonGradient: {
    borderRadius: 24,
    padding: 1.5,
  },
  bookButtonInner: {
    backgroundColor: '#000000',
    borderRadius: 23,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  bookButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  closeButton: {
    padding: 8,
  },
  modalBody: {
    padding: 16,
  },
  venueSummary: {
    flexDirection: 'row',
    marginBottom: 24,
    gap: 12,
  },
  modalVenueImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
  },
  venueSummaryContent: {
    flex: 1,
    justifyContent: 'center',
  },
  modalVenueName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  modalLocationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  modalLocationText: {
    fontSize: 14,
    color: '#FFFFFF',
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    color: '#FFFFFF',
    marginBottom: 8,
  },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#000000',
    borderRadius: 12,
    padding: 12,
  },
  dateText: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  textInput: {
    backgroundColor: '#000000',
    borderRadius: 12,
    padding: 12,
    color: '#FFFFFF',
    fontSize: 16,
  },
  maxPlayersText: {
    fontSize: 12,
    color: '#666666',
    marginTop: 4,
  },
  amenitiesSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  amenitiesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  amenityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#000000',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  amenityText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  priceBreakdown: {
    marginBottom: 24,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  priceValue: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  totalRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  totalLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  totalValue: {
    color: '#FF9F45',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    margin: 16,
    overflow: 'hidden',
    borderRadius: 24,
  },
  confirmGradient: {
    borderRadius: 24,
    padding: 1.5,
  },
  confirmButtonInner: {
    backgroundColor: '#000000',
    borderRadius: 23,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});
