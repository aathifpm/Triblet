import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  Modal,
  Image
} from 'react-native'
import { useRouter } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { MaterialIcons, Ionicons } from '@expo/vector-icons'
import DateTimePicker from '@react-native-community/datetimepicker'
import { getFirestore, collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore'
import { useAuth } from './context/AuthContext'
import GradientText from '@/components/GradientText'
import * as ImagePicker from 'expo-image-picker'
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage'

// Enums
enum SlotStatus {
  Available = 'Available',
  Booked = 'Booked',
  Closed = 'Closed'
}

interface TimeSlot {
  id: string
  date: Date
  time: string
  status: SlotStatus
  price: number
}

interface Venue {
  id: string
  ownerId: string
  name: string
  location: {
    address: string
    latitude: number
    longitude: number
  }
  gamesAvailable: string[]
  pricing: {
    peakHours: number
    offPeakHours: number
  }
  amenities: string[]
  images: string[]
  availableSlots: TimeSlot[]
  createdAt: Date
  updatedAt: Date
}

export default function ManageVenueScreen() {
  const router = useRouter()
  const { currentUser } = useAuth()
  const [isLoading, setIsLoading] = useState(true)
  const [venue, setVenue] = useState<Venue | null>(null)
  const [showAddSlotModal, setShowAddSlotModal] = useState(false)
  const [showEditDetailsModal, setShowEditDetailsModal] = useState(false)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [showTimePicker, setShowTimePicker] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  
  // New slot form state
  const [newSlot, setNewSlot] = useState({
    date: new Date(),
    time: new Date(),
    price: '',
    status: SlotStatus.Available
  })

  // Edit venue details form state
  const [editVenueDetails, setEditVenueDetails] = useState({
    name: '',
    address: '',
    sports: '',
    peakHourRate: '',
    offPeakHourRate: '',
    amenities: '',
    slots: [] as TimeSlot[]
  })

  // Memoize the setEditVenueDetails function to prevent re-renders
  const updateEditVenueDetails = useCallback((field: string, value: string) => {
    setEditVenueDetails(prev => ({
      ...prev,
      [field]: value
    }))
  }, [])

  useEffect(() => {
    if (currentUser) {
      fetchVenueDetails()
    } else {
      router.replace('/LoginScreen')
    }
  }, [currentUser])

  const fetchVenueDetails = async () => {
    try {
      const db = getFirestore()
      const venuesRef = collection(db, 'gamingArenas')
      const q = query(venuesRef, where('ownerId', '==', currentUser?.uid))
      const querySnapshot = await getDocs(q)
      
      if (!querySnapshot.empty) {
        const venueDoc = querySnapshot.docs[0]
        const venueData = venueDoc.data()
        
        setVenue({
          id: venueDoc.id,
          ...venueData,
          createdAt: venueData.createdAt.toDate(),
          updatedAt: venueData.updatedAt.toDate(),
          availableSlots: venueData.availableSlots.map((slot: any) => ({
            ...slot,
            date: slot.date.toDate()
          }))
        } as Venue)

        // Initialize edit form with current values
        setEditVenueDetails({
          name: venueData.name,
          address: venueData.location.address,
          sports: venueData.gamesAvailable.join(', '),
          peakHourRate: venueData.pricing.peakHours.toString(),
          offPeakHourRate: venueData.pricing.offPeakHours.toString(),
          amenities: venueData.amenities.join(', '),
          slots: venueData.availableSlots
        })
      }
    } catch (error) {
      console.error('Error fetching venue details:', error)
      Alert.alert('Error', 'Failed to load venue details')
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddSlot = async () => {
    if (!venue) return

    try {
      const db = getFirestore()
      const venueRef = doc(db, 'gamingArenas', venue.id)
      
      const newSlotData = {
        id: Math.random().toString(36).substr(2, 9),
        date: newSlot.date,
        time: newSlot.time.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit'
        }),
        status: newSlot.status,
        price: parseFloat(newSlot.price)
      }

      const updatedSlots = [...venue.availableSlots, newSlotData]
      
      await updateDoc(venueRef, {
        availableSlots: updatedSlots,
        updatedAt: new Date()
      })

      setVenue({
        ...venue,
        availableSlots: updatedSlots,
        updatedAt: new Date()
      })

      setShowAddSlotModal(false)
      Alert.alert('Success', 'New slot added successfully')
    } catch (error) {
      console.error('Error adding slot:', error)
      Alert.alert('Error', 'Failed to add new slot')
    }
  }

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      })

      if (!result.canceled && result.assets[0].uri) {
        await uploadImage(result.assets[0].uri)
      }
    } catch (error) {
      console.error('Error picking image:', error)
      Alert.alert('Error', 'Failed to pick image')
    }
  }

  const uploadImage = async (uri: string) => {
    if (!venue) return

    try {
      setUploadingImage(true)
      const response = await fetch(uri)
      const blob = await response.blob()
      
      const storage = getStorage()
      const imageRef = ref(storage, `venues/${venue.id}/${Date.now()}`)
      
      await uploadBytes(imageRef, blob)
      const downloadURL = await getDownloadURL(imageRef)
      
      const db = getFirestore()
      const venueRef = doc(db, 'gamingArenas', venue.id)
      
      const updatedImages = [...venue.images, downloadURL]
      await updateDoc(venueRef, { images: updatedImages })
      
      setVenue({
        ...venue,
        images: updatedImages
      })
      
      Alert.alert('Success', 'Image uploaded successfully')
    } catch (error) {
      console.error('Error uploading image:', error)
      Alert.alert('Error', 'Failed to upload image')
    } finally {
      setUploadingImage(false)
    }
  }

  const generateDailySlots = () => {
    const slots: TimeSlot[] = []
    const currentDate = new Date()
    currentDate.setHours(0, 0, 0, 0)

    // Generate slots for the next 7 days
    for (let day = 0; day < 7; day++) {
      const date = new Date(currentDate)
      date.setDate(date.getDate() + day)

      // Generate slots for each hour from 6 AM to 10 PM
      for (let hour = 6; hour <= 22; hour++) {
        const time = `${hour.toString().padStart(2, '0')}:00`
        const isPeakHour = hour >= 17 && hour <= 22 // 5 PM to 10 PM

        slots.push({
          id: `${date.toISOString()}-${time}`,
          date: new Date(date),
          time,
          status: SlotStatus.Available,
          price: isPeakHour ? parseFloat(editVenueDetails.peakHourRate) : parseFloat(editVenueDetails.offPeakHourRate)
        })
      }
    }

    return slots
  }

  const handleUpdateVenueDetails = async () => {
    if (!venue) return

    try {
      const db = getFirestore()
      const venueRef = doc(db, 'gamingArenas', venue.id)
      
      const slots = generateDailySlots()
      
      const updatedVenue = {
        name: editVenueDetails.name,
        location: {
          ...venue.location,
          address: editVenueDetails.address
        },
        gamesAvailable: editVenueDetails.sports.split(',').map(s => s.trim()),
        pricing: {
          peakHours: parseFloat(editVenueDetails.peakHourRate),
          offPeakHours: parseFloat(editVenueDetails.offPeakHourRate)
        },
        amenities: editVenueDetails.amenities.split(',').map(a => a.trim()),
        availableSlots: slots,
        updatedAt: new Date()
      }

      await updateDoc(venueRef, updatedVenue)

      setVenue({
        ...venue,
        ...updatedVenue
      })

      setShowEditDetailsModal(false)
      Alert.alert('Success', 'Venue details updated successfully')
    } catch (error) {
      console.error('Error updating venue details:', error)
      Alert.alert('Error', 'Failed to update venue details')
    }
  }

  const handleDeleteSlot = async (slotId: string) => {
    if (!venue) return

    try {
      const db = getFirestore()
      const venueRef = doc(db, 'gamingArenas', venue.id)
      
      const updatedSlots = venue.availableSlots.filter(slot => slot.id !== slotId)
      
      await updateDoc(venueRef, {
        availableSlots: updatedSlots,
        updatedAt: new Date()
      })

      setVenue({
        ...venue,
        availableSlots: updatedSlots,
        updatedAt: new Date()
      })

      Alert.alert('Success', 'Slot deleted successfully')
    } catch (error) {
      console.error('Error deleting slot:', error)
      Alert.alert('Error', 'Failed to delete slot')
    }
  }

  const AddSlotModal = () => (
    <Modal
      visible={showAddSlotModal}
      animationType="slide"
      transparent
      onRequestClose={() => setShowAddSlotModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add New Slot</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowAddSlotModal(false)}
            >
              <MaterialIcons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Select Date</Text>
              <TouchableOpacity
                style={styles.dateInput}
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={styles.dateText}>
                  {newSlot.date.toLocaleDateString()}
                </Text>
                <MaterialIcons name="event" size={24} color="#FF9F45" />
              </TouchableOpacity>
            </View>

            {showDatePicker && (
              <DateTimePicker
                value={newSlot.date}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                minimumDate={new Date()}
                onChange={(event, selectedDate) => {
                  setShowDatePicker(false)
                  if (selectedDate) {
                    setNewSlot({ ...newSlot, date: selectedDate })
                  }
                }}
              />
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Select Time</Text>
              <TouchableOpacity
                style={styles.dateInput}
                onPress={() => setShowTimePicker(true)}
              >
                <Text style={styles.dateText}>
                  {newSlot.time.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </Text>
                <MaterialIcons name="access-time" size={24} color="#FF9F45" />
              </TouchableOpacity>
            </View>

            {showTimePicker && (
              <DateTimePicker
                value={newSlot.time}
                mode="time"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(event, selectedTime) => {
                  setShowTimePicker(false)
                  if (selectedTime) {
                    setNewSlot({ ...newSlot, time: selectedTime })
                  }
                }}
              />
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Price (₹)</Text>
              <TextInput
                style={styles.textInput}
                value={newSlot.price}
                onChangeText={(text) => setNewSlot({ ...newSlot, price: text })}
                keyboardType="numeric"
                placeholder="Enter price for this slot"
                placeholderTextColor="#666"
              />
            </View>
          </ScrollView>

          <TouchableOpacity
            style={styles.confirmButton}
            onPress={handleAddSlot}
          >
            <LinearGradient
              colors={['#FF9F45', '#D494FF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.confirmGradient}
            >
              <Text style={styles.confirmButtonText}>Add Slot</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )

  const EditDetailsModal = () => (
    <Modal
      visible={showEditDetailsModal}
      animationType="slide"
      transparent
      onRequestClose={() => setShowEditDetailsModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit Venue Details</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowEditDetailsModal(false)}
            >
              <MaterialIcons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Venue Name</Text>
              <TextInput
                style={styles.textInput}
                value={editVenueDetails.name}
                onChangeText={(text) => updateEditVenueDetails('name', text)}
                placeholder="Enter venue name"
                placeholderTextColor="#666"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Address</Text>
              <TextInput
                style={styles.textInput}
                value={editVenueDetails.address}
                onChangeText={(text) => updateEditVenueDetails('address', text)}
                placeholder="Enter venue address"
                placeholderTextColor="#666"
                multiline
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Sports/Games (comma separated)</Text>
              <TextInput
                style={styles.textInput}
                value={editVenueDetails.sports}
                onChangeText={(text) => updateEditVenueDetails('sports', text)}
                placeholder="Enter available sports"
                placeholderTextColor="#666"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Peak Hour Rate (₹)</Text>
              <TextInput
                style={styles.textInput}
                value={editVenueDetails.peakHourRate}
                onChangeText={(text) => updateEditVenueDetails('peakHourRate', text)}
                keyboardType="numeric"
                placeholder="Enter peak hour rate"
                placeholderTextColor="#666"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Off-Peak Hour Rate (₹)</Text>
              <TextInput
                style={styles.textInput}
                value={editVenueDetails.offPeakHourRate}
                onChangeText={(text) => updateEditVenueDetails('offPeakHourRate', text)}
                keyboardType="numeric"
                placeholder="Enter off-peak hour rate"
                placeholderTextColor="#666"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Amenities (comma separated)</Text>
              <TextInput
                style={styles.textInput}
                value={editVenueDetails.amenities}
                onChangeText={(text) => updateEditVenueDetails('amenities', text)}
                placeholder="Enter available amenities"
                placeholderTextColor="#666"
              />
            </View>
          </ScrollView>

          <TouchableOpacity
            style={styles.confirmButton}
            onPress={handleUpdateVenueDetails}
          >
            <LinearGradient
              colors={['#FF9F45', '#D494FF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.confirmGradient}
            >
              <Text style={styles.confirmButtonText}>Update Details</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF9F45" />
      </View>
    )
  }

  if (!venue) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>No venue found</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.title}>MANAGE VENUE</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.venueCard}>
          <TouchableOpacity 
            style={styles.imageContainer} 
            onPress={pickImage}
            disabled={uploadingImage}
          >
            {uploadingImage ? (
              <View style={[styles.venueImage, styles.uploadingContainer]}>
                <ActivityIndicator size="large" color="#FF9F45" />
                <Text style={styles.uploadingText}>Uploading...</Text>
              </View>
            ) : venue.images.length > 0 ? (
              <Image source={{ uri: venue.images[0] }} style={styles.venueImage} />
            ) : (
              <View style={[styles.venueImage, styles.placeholderImage]}>
                <MaterialIcons name="add-photo-alternate" size={48} color="#666" />
                <Text style={styles.placeholderText}>Add Venue Image</Text>
              </View>
            )}
          </TouchableOpacity>
          
          <View style={styles.venueInfo}>
            <View style={styles.venueHeader}>
              <Text style={styles.venueName}>{venue.name}</Text>
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => setShowEditDetailsModal(true)}
              >
                <MaterialIcons name="edit" size={24} color="#FF9F45" />
              </TouchableOpacity>
            </View>

            <View style={styles.locationContainer}>
              <MaterialIcons name="location-on" size={16} color="#FF9F45" />
              <Text style={styles.locationText}>{venue.location.address}</Text>
            </View>

            <View style={styles.detailsContainer}>
              <View style={styles.detailItem}>
                <MaterialIcons name="sports" size={16} color="#FF9F45" />
                <Text style={styles.detailText}>
                  {venue.gamesAvailable.join(', ')}
                </Text>
              </View>

              <View style={styles.detailItem}>
                <MaterialIcons name="attach-money" size={16} color="#FF9F45" />
                <Text style={styles.detailText}>
                  Peak: ₹{venue.pricing.peakHours} | Off-Peak: ₹{venue.pricing.offPeakHours}
                </Text>
              </View>

              {venue.amenities.length > 0 && (
                <View style={styles.detailItem}>
                  <MaterialIcons name="local-offer" size={16} color="#FF9F45" />
                  <Text style={styles.detailText}>
                    {venue.amenities.join(', ')}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        <View style={styles.slotsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Available Slots</Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setShowAddSlotModal(true)}
            >
              <LinearGradient
                colors={['#FF9F45', '#D494FF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.addButtonGradient}
              >
                <MaterialIcons name="add" size={24} color="#FFF" />
                <Text style={styles.addButtonText}>Add Slot</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {venue.availableSlots.length === 0 ? (
            <Text style={styles.noSlotsText}>No slots available</Text>
          ) : (
            venue.availableSlots.map((slot) => (
              <View key={slot.id} style={styles.slotCard}>
                <View style={styles.slotInfo}>
                  <View style={styles.slotDateTime}>
                    <MaterialIcons name="event" size={16} color="#FF9F45" />
                    <Text style={styles.slotText}>
                      {slot.date.toLocaleDateString()}
                    </Text>
                    <MaterialIcons name="access-time" size={16} color="#FF9F45" />
                    <Text style={styles.slotText}>{slot.time}</Text>
                  </View>
                  <View style={styles.slotStatus}>
                    <Text style={[
                      styles.statusText,
                      slot.status === SlotStatus.Available && styles.statusAvailable,
                      slot.status === SlotStatus.Booked && styles.statusBooked,
                      slot.status === SlotStatus.Closed && styles.statusClosed
                    ]}>
                      {slot.status}
                    </Text>
                    <Text style={styles.slotPrice}>₹{slot.price}</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => {
                    Alert.alert(
                      'Delete Slot',
                      'Are you sure you want to delete this slot?',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Delete', onPress: () => handleDeleteSlot(slot.id), style: 'destructive' }
                      ]
                    )
                  }}
                >
                  <MaterialIcons name="delete" size={24} color="#FF5252" />
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <AddSlotModal />
      <EditDetailsModal />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 16,
  },
  backButton: {
    marginRight: 16,
  },
  title: {
    flex: 1,
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  venueCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
  },
  venueImage: {
    width: '100%',
    height: 200,
  },
  imageContainer: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    overflow: 'hidden',
  },
  uploadingContainer: {
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadingText: {
    color: '#FFFFFF',
    marginTop: 10,
    fontSize: 14,
  },
  placeholderImage: {
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#666',
    marginTop: 8,
    fontSize: 14,
  },
  venueInfo: {
    padding: 16,
  },
  venueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  venueName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  editButton: {
    padding: 8,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  locationText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#FFFFFF',
  },
  detailsContainer: {
    gap: 12,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#FFFFFF',
  },
  slotsSection: {
    flex: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  addButton: {
    overflow: 'hidden',
    borderRadius: 20,
  },
  addButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  addButtonText: {
    marginLeft: 4,
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  noSlotsText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 16,
    marginTop: 24,
  },
  slotCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  slotInfo: {
    flex: 1,
  },
  slotDateTime: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  slotText: {
    marginLeft: 8,
    marginRight: 16,
    fontSize: 14,
    color: '#FFFFFF',
  },
  slotStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  statusAvailable: {
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    color: '#4CAF50',
  },
  statusBooked: {
    backgroundColor: 'rgba(255, 152, 0, 0.2)',
    color: '#FF9800',
  },
  statusClosed: {
    backgroundColor: 'rgba(244, 67, 54, 0.2)',
    color: '#F44336',
  },
  slotPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  deleteButton: {
    padding: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
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
  inputGroup: {
    marginBottom: 16,
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
  confirmButton: {
    margin: 16,
    overflow: 'hidden',
    borderRadius: 12,
  },
  confirmGradient: {
    padding: 16,
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  errorText: {
    color: '#FF5252',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 24,
  }
}) 