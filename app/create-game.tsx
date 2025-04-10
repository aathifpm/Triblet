import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Image,
  Modal,
  ActivityIndicator,
  Platform,
  Alert,
  Switch,
} from 'react-native'
import React, { useState, useEffect } from 'react'
import { LinearGradient } from 'expo-linear-gradient'
import { MaterialIcons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import DateTimePicker from '@react-native-community/datetimepicker'
import { useAuth } from './context/AuthContext'
import { 
  getFirestore, 
  collection, 
  addDoc, 
  Timestamp 
} from 'firebase/firestore'
import { 
  getStorage, 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from 'firebase/storage'
import { format } from 'date-fns'

interface GameData {
  sport: string;
  location: string;
  date: Date;
  time: Date;
  maxPlayers: string;
  level: string;
  price: string;
  description: string;
  image: string | null;
  imageUrl: string;
}

interface FormErrors {
  sport?: string;
  location?: string;
  maxPlayers?: string;
  price?: string;
  description?: string;
  imageUrl?: string;
}

export default function CreateGameScreen() {
  const router = useRouter()
  const { currentUser } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [showTimePicker, setShowTimePicker] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})
  const [uploadingImage, setUploadingImage] = useState(false)
  const [useImageUrl, setUseImageUrl] = useState(false)

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!currentUser) {
      Alert.alert('Authentication Required', 'Please login to create games');
      router.replace('/LoginScreen');
    }
  }, [currentUser]);

  const [gameData, setGameData] = useState<GameData>({
    sport: '',
    location: '',
    date: new Date(),
    time: new Date(),
    maxPlayers: '',
    level: 'Beginner',
    price: '',
    description: '',
    image: null,
    imageUrl: '',
  })

  const [showLevelPicker, setShowLevelPicker] = useState(false)
  const [showSportPicker, setShowSportPicker] = useState(false)
  
  const skillLevels = ['Beginner', 'Intermediate', 'Advanced']
  const sportsList = [
    'Cricket', 'Football', 'Basketball', 'Tennis', 
    'Badminton', 'Table Tennis', 'Volleyball', 'Swimming'
  ]

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {}

    if (!gameData.sport) {
      newErrors.sport = 'Sport is required'
    }
    if (!gameData.location) {
      newErrors.location = 'Location is required'
    }
    if (!gameData.maxPlayers) {
      newErrors.maxPlayers = 'Maximum players is required'
    } else if (parseInt(gameData.maxPlayers) < 2) {
      newErrors.maxPlayers = 'Minimum 2 players required'
    }
    if (!gameData.price) {
      newErrors.price = 'Price is required'
    }
    if (!gameData.description) {
      newErrors.description = 'Description is required'
    }
    
    if (useImageUrl && !gameData.imageUrl) {
      newErrors.imageUrl = 'Image URL is required when using URL option'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Upload image to Firebase Storage
  const uploadImage = async (uri: string): Promise<string> => {
    setUploadingImage(true);
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      
      const storage = getStorage();
      const fileExtension = uri.split('.').pop();
      const fileName = `game_images/${Date.now()}.${fileExtension}`;
      const storageRef = ref(storage, fileName);
      
      await uploadBytes(storageRef, blob);
      const downloadURL = await getDownloadURL(storageRef);
      return downloadURL;
    } catch (error) {
      console.error('Error uploading image:', error);
      throw error;
    } finally {
      setUploadingImage(false);
    }
  };

  const handleImagePick = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Sorry, we need camera roll permissions to make this work!');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });

      if (!result.canceled) {
        setGameData({ ...gameData, image: result.assets[0].uri });
      }
    } catch (error) {
      Alert.alert('Error', 'Error picking image. Please try again.');
    }
  };

  const handleCreateGame = async () => {
    if (!validateForm()) {
      Alert.alert('Error', 'Please fill in all required fields correctly');
      return;
    }

    if (!currentUser) {
      Alert.alert('Authentication Required', 'Please login to create games');
      router.replace('/LoginScreen');
      return;
    }

    setIsLoading(true);
    try {
      // Format time for storage in Firestore
      const timeString = format(gameData.time, 'h:mm a');
      
      // Get image URL based on selected method
      let imageUrl = null;
      
      if (useImageUrl) {
        // Use the directly provided URL
        imageUrl = gameData.imageUrl;
      } else if (gameData.image) {
        // Try to upload the image to Firebase Storage
        try {
          imageUrl = await uploadImage(gameData.image);
        } catch (error) {
          console.error('Error uploading to Firebase Storage:', error);
          Alert.alert(
            'Storage Error', 
            'Could not upload to Firebase Storage. Consider using the URL option instead.',
            [{ text: 'OK' }]
          );
          setIsLoading(false);
          return;
        }
      }

      // Create party document in Firestore
      const db = getFirestore();
      const partiesCollection = collection(db, 'parties');
      
      const newParty = {
        leaderId: currentUser.uid,
        sport: gameData.sport,
        eventType: 'Casual',
        location: gameData.location,
        date: Timestamp.fromDate(gameData.date),
        time: timeString,
        maxPlayers: parseInt(gameData.maxPlayers),
        requiredSkillLevel: gameData.level,
        players: [currentUser.uid], // Leader is first player
        isPrivate: false,
        price: parseInt(gameData.price),
        description: gameData.description,
        image: imageUrl,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };
      
      const docRef = await addDoc(partiesCollection, newParty);
      
      Alert.alert(
        'Success', 
        'Game created successfully!', 
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      console.error('Error creating game:', error);
      Alert.alert('Error', 'Failed to create game. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  const renderSportPicker = () => {
    if (!showSportPicker) return null;

    return (
      <Modal
        visible={showSportPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSportPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Sport</Text>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setShowSportPicker(false)}
              >
                <MaterialIcons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            {sportsList.map((sport) => (
              <TouchableOpacity
                key={sport}
                style={[
                  styles.levelOption,
                  gameData.sport === sport && styles.selectedLevel
                ]}
                onPress={() => {
                  setGameData({ ...gameData, sport });
                  setShowSportPicker(false);
                  setErrors({ ...errors, sport: undefined });
                }}
              >
                <Text
                  style={[
                    styles.levelOptionText,
                    gameData.sport === sport && styles.selectedLevelText
                  ]}
                >
                  {sport}
                </Text>
                {gameData.sport === sport && (
                  <MaterialIcons name="check" size={20} color="#FF9F45" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>
    );
  };

  const renderLevelPicker = () => {
    if (!showLevelPicker) return null;

    return (
      <Modal
        visible={showLevelPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowLevelPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Skill Level</Text>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setShowLevelPicker(false)}
              >
                <MaterialIcons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            {skillLevels.map((level) => (
              <TouchableOpacity
                key={level}
                style={[
                  styles.levelOption,
                  gameData.level === level && styles.selectedLevel
                ]}
                onPress={() => {
                  setGameData({ ...gameData, level });
                  setShowLevelPicker(false);
                }}
              >
                <Text
                  style={[
                    styles.levelOptionText,
                    gameData.level === level && styles.selectedLevelText
                  ]}
                >
                  {level}
                </Text>
                {gameData.level === level && (
                  <MaterialIcons name="check" size={20} color="#FF9F45" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>
    );
  };

  const renderImagePicker = () => {
    if (useImageUrl) {
      return (
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Image URL</Text>
          <TextInput
            style={[styles.input, errors.imageUrl && styles.inputError]}
            placeholder="Enter image URL"
            placeholderTextColor="#666"
            value={gameData.imageUrl}
            onChangeText={(text) => {
              setGameData({ ...gameData, imageUrl: text });
              setErrors({ ...errors, imageUrl: undefined });
            }}
          />
          {gameData.imageUrl ? (
            <Image
              source={{ uri: gameData.imageUrl }}
              style={styles.urlPreviewImage}
              onError={() => Alert.alert('Invalid URL', 'The image URL provided is invalid or inaccessible.')}
            />
          ) : null}
          {errors.imageUrl && (
            <Text style={styles.errorText}>{errors.imageUrl}</Text>
          )}
        </View>
      );
    }

    return (
      <TouchableOpacity 
        style={[
          styles.imagePickerButton,
          gameData.image ? styles.imagePickerWithImage : styles.imagePickerEmpty
        ]} 
        onPress={handleImagePick}
      >
        {gameData.image ? (
          <>
            <Image source={{ uri: gameData.image }} style={styles.previewImage} />
            <View style={styles.imageOverlay}>
              <MaterialIcons name="edit" size={24} color="#fff" />
              <Text style={styles.imageOverlayText}>Change Photo</Text>
            </View>
          </>
        ) : (
          <View style={styles.imagePlaceholder}>
            <MaterialIcons name="add-photo-alternate" size={32} color="#666" />
            <Text style={styles.imagePlaceholderText}>Add Game Photo</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Create Game</Text>
          <LinearGradient
            colors={['#FF9F45', '#D494FF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.titleUnderline}
          />
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.imageOptionToggle}>
          <Text style={styles.imageOptionText}>
            {useImageUrl ? "Use Image URL" : "Upload Image"}
          </Text>
          <Switch
            trackColor={{ false: "#1A1A1A", true: "#FF9F45" }}
            thumbColor={useImageUrl ? "#fff" : "#fff"}
            ios_backgroundColor="#1A1A1A"
            onValueChange={() => setUseImageUrl(!useImageUrl)}
            value={useImageUrl}
          />
        </View>

        {renderImagePicker()}

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Sport</Text>
            <TouchableOpacity 
              style={[styles.dropdownButton, errors.sport && styles.inputError]}
              onPress={() => setShowSportPicker(true)}
            >
              <Text style={[
                styles.dropdownButtonText,
                !gameData.sport && styles.placeholderText
              ]}>
                {gameData.sport || "Select sport"}
              </Text>
              <MaterialIcons name="arrow-drop-down" size={24} color="#FF9F45" />
            </TouchableOpacity>
            {errors.sport && (
              <Text style={styles.errorText}>{errors.sport}</Text>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Location</Text>
            <TextInput
              style={[styles.input, errors.location && styles.inputError]}
              placeholder="Enter location"
              placeholderTextColor="#666"
              value={gameData.location}
              onChangeText={(text) => {
                setGameData({ ...gameData, location: text });
                setErrors({ ...errors, location: undefined });
              }}
            />
            {errors.location && (
              <Text style={styles.errorText}>{errors.location}</Text>
            )}
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.label}>Date</Text>
              <TouchableOpacity 
                style={styles.dropdownButton}
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={styles.dropdownButtonText}>
                  {gameData.date.toLocaleDateString()}
                </Text>
                <MaterialIcons name="event" size={24} color="#FF9F45" />
              </TouchableOpacity>
              {showDatePicker && (
                <DateTimePicker
                  value={gameData.date}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(event, selectedDate) => {
                    setShowDatePicker(false);
                    if (selectedDate) {
                      setGameData({ ...gameData, date: selectedDate });
                    }
                  }}
                  minimumDate={new Date()}
                />
              )}
            </View>

            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.label}>Time</Text>
              <TouchableOpacity 
                style={styles.dropdownButton}
                onPress={() => setShowTimePicker(true)}
              >
                <Text style={styles.dropdownButtonText}>
                  {gameData.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
                <MaterialIcons name="access-time" size={24} color="#FF9F45" />
              </TouchableOpacity>
              {showTimePicker && (
                <DateTimePicker
                  value={gameData.time}
                  mode="time"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(event, selectedTime) => {
                    setShowTimePicker(false);
                    if (selectedTime) {
                      setGameData({ ...gameData, time: selectedTime });
                    }
                  }}
                />
              )}
            </View>
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.label}>Max Players</Text>
              <TextInput
                style={[styles.input, errors.maxPlayers && styles.inputError]}
                placeholder="12"
                placeholderTextColor="#666"
                keyboardType="numeric"
                value={gameData.maxPlayers}
                onChangeText={(text) => {
                  setGameData({ ...gameData, maxPlayers: text });
                  setErrors({ ...errors, maxPlayers: undefined });
                }}
              />
              {errors.maxPlayers && (
                <Text style={styles.errorText}>{errors.maxPlayers}</Text>
              )}
            </View>

            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.label}>Price per person</Text>
              <TextInput
                style={[styles.input, errors.price && styles.inputError]}
                placeholder="₹"
                placeholderTextColor="#666"
                keyboardType="numeric"
                value={gameData.price}
                onChangeText={(text) => {
                  setGameData({ ...gameData, price: text });
                  setErrors({ ...errors, price: undefined });
                }}
              />
              {errors.price && (
                <Text style={styles.errorText}>{errors.price}</Text>
              )}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Skill Level</Text>
            <TouchableOpacity 
              style={styles.dropdownButton}
              onPress={() => setShowLevelPicker(true)}
            >
              <Text style={styles.dropdownButtonText}>{gameData.level}</Text>
              <MaterialIcons name="arrow-drop-down" size={24} color="#FF9F45" />
            </TouchableOpacity>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea, errors.description && styles.inputError]}
              placeholder="Describe your game..."
              placeholderTextColor="#666"
              multiline
              numberOfLines={4}
              value={gameData.description}
              onChangeText={(text) => {
                setGameData({ ...gameData, description: text });
                setErrors({ ...errors, description: undefined });
              }}
            />
            {errors.description && (
              <Text style={styles.errorText}>{errors.description}</Text>
            )}
          </View>
        </View>
      </ScrollView>

      {renderSportPicker()}
      {renderLevelPicker()}

      <View style={styles.footer}>
        <TouchableOpacity 
          style={[styles.createButton, isLoading && styles.createButtonDisabled]}
          onPress={handleCreateGame}
          disabled={isLoading || uploadingImage}
        >
          <LinearGradient
            colors={['#FF9F45', '#D494FF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.createButtonGradient}
          >
            <View style={styles.createButtonInner}>
              {isLoading || uploadingImage ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.createButtonText}>CREATE GAME</Text>
              )}
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleContainer: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  titleUnderline: {
    height: 2,
    width: 40,
    borderRadius: 1,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  imagePickerButton: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePlaceholderText: {
    color: '#666',
    marginTop: 8,
  },
  form: {
    gap: 20,
  },
  inputGroup: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 16,
  },
  label: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 12,
    color: '#fff',
    fontSize: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#1A1A1A',
  },
  createButton: {
    width: '100%',
  },
  createButtonGradient: {
    borderRadius: 24,
    padding: 1,
  },
  createButtonInner: {
    backgroundColor: '#000',
    margin: 1,
    borderRadius: 23,
    padding: 14,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  dropdownButton: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownButtonText: {
    color: '#fff',
    fontSize: 16,
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
    padding: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  closeButton: {
    padding: 8,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  levelOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  selectedLevel: {
    backgroundColor: 'rgba(255,159,69,0.1)',
  },
  levelOptionText: {
    color: '#fff',
    fontSize: 16,
  },
  selectedLevelText: {
    color: '#FF9F45',
    fontWeight: '600',
  },
  imagePickerEmpty: {
    borderWidth: 2,
    borderColor: '#1A1A1A',
    borderStyle: 'dashed',
  },
  imagePickerWithImage: {
    borderWidth: 0,
  },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0,
  },
  imageOverlayText: {
    color: '#fff',
    marginTop: 8,
    fontSize: 14,
  },
  inputError: {
    borderWidth: 1,
    borderColor: '#FF4545',
  },
  errorText: {
    color: '#FF4545',
    fontSize: 12,
    marginTop: 4,
  },
  placeholderText: {
    color: '#666',
  },
  createButtonDisabled: {
    opacity: 0.7,
  },
  imageOptionToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: '#1A1A1A',
    padding: 12,
    borderRadius: 12,
  },
  imageOptionText: {
    color: '#fff',
    fontSize: 16,
  },
  urlPreviewImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginTop: 8,
  },
}) 