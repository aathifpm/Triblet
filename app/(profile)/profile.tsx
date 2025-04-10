import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native'
import React, { useState, useEffect } from 'react'
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import { useAuth } from '../../app/context/AuthContext'
import { getCurrentUserData, updateUser, SkillLevel } from '../../app/firebase/firestore'

// Define types based on schema
interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  image?: string;
  age?: number;
  preferredGames?: string[];
  skillLevel?: string;
  bio?: string;
  friendIds?: string[];
  badges?: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

export default function Profile() {
  const router = useRouter()
  const { currentUser } = useAuth()
  const [user, setUser] = useState<User | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [activeTab, setActiveTab] = useState('info')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  
  // Form state
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editAge, setEditAge] = useState('')
  const [editBio, setEditBio] = useState('')
  const [editSkillLevel, setEditSkillLevel] = useState('')
  const [editSports, setEditSports] = useState<string[]>([])
  const [newSport, setNewSport] = useState('')

  // Define skill level options
  const skillLevelOptions = [
    SkillLevel.BEGINNER,
    SkillLevel.INTERMEDIATE,
    SkillLevel.ADVANCED,
  ]

  // Load user data from Firestore
  useEffect(() => {
    const fetchUserData = async () => {
      if (!currentUser) {
        router.replace('/LoginScreen')
        return
      }

      try {
        setIsLoading(true)
        const { user: userData, error } = await getCurrentUserData()
        
        if (error) {
          console.error('Error fetching user data:', error)
          Alert.alert('Error', 'Failed to load user data')
        } else if (userData) {
          // Convert Firestore timestamp to Date object if needed
          const userDataWithDates = {
            ...userData,
            createdAt: userData.createdAt ? 
              (userData.createdAt.toDate ? userData.createdAt.toDate() : new Date(userData.createdAt)) : 
              undefined,
            updatedAt: userData.updatedAt ? 
              (userData.updatedAt.toDate ? userData.updatedAt.toDate() : new Date(userData.updatedAt)) : 
              undefined
          }
          
          const typedUser = userDataWithDates as unknown as User
          setUser(typedUser)
          
          // Initialize form state
          setEditName(typedUser.name || '')
          setEditPhone(typedUser.phone || '')
          setEditAge(typedUser.age ? typedUser.age.toString() : '')
          setEditBio(typedUser.bio || '')
          setEditSkillLevel(typedUser.skillLevel || SkillLevel.BEGINNER)
          setEditSports(typedUser.preferredGames || [])
        }
      } catch (error) {
        console.error('Error in fetchUserData:', error)
        Alert.alert('Error', 'Something went wrong while loading user data')
      } finally {
        setIsLoading(false)
      }
    }

    fetchUserData()
  }, [currentUser, router])

  const handleSaveProfile = async () => {
    if (!user || !currentUser) return
    
    try {
      setIsSaving(true)
      
      const updatedUserData = {
        name: editName,
        phone: editPhone,
        age: editAge ? parseInt(editAge, 10) : undefined,
        bio: editBio,
        skillLevel: editSkillLevel,
        preferredGames: editSports,
      }
      
      const { success, error } = await updateUser(user.id, updatedUserData)
      
      if (success) {
        // Update local state
        setUser({
          ...user,
          ...updatedUserData,
          createdAt: user.createdAt,
          updatedAt: new Date()
        })
        
        setIsEditing(false)
        Alert.alert('Success', 'Profile updated successfully')
      } else {
        console.error('Error updating profile:', error)
        Alert.alert('Error', error || 'Failed to update profile')
      }
    } catch (error) {
      console.error('Error saving profile:', error)
      Alert.alert('Error', 'Something went wrong while saving profile data')
    } finally {
      setIsSaving(false)
    }
  }

  const handleAddSport = () => {
    if (!newSport.trim()) {
      Alert.alert('Error', 'Please enter a sport to add')
      return
    }
    
    // Prevent duplicates
    if (editSports.includes(newSport.trim())) {
      Alert.alert('Error', 'This sport is already in your list')
      return
    }
    
    setEditSports([...editSports, newSport.trim()])
    setNewSport('')
  }

  const handleRemoveSport = (sport: string) => {
    setEditSports(editSports.filter(s => s !== sport))
  }

  const renderInfoTab = () => (
    <View style={styles.tabContent}>
      {isEditing ? (
        // Edit mode
        <>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Full Name</Text>
            <TextInput
              style={styles.textInput}
              value={editName}
              onChangeText={(text) => setEditName(text)}
              placeholder="Enter your full name"
              placeholderTextColor="#666666"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Email</Text>
            <TextInput
              style={styles.textInput}
              value={user?.email || ''}
              onChangeText={(text) => setEditName(text)}
              placeholder="Enter your email"
              placeholderTextColor="#666666"
              keyboardType="email-address"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Phone</Text>
            <TextInput
              style={styles.textInput}
              value={editPhone}
              onChangeText={(text) => setEditPhone(text)}
              placeholder="Enter your phone number"
              placeholderTextColor="#666666"
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Age</Text>
            <TextInput
              style={styles.textInput}
              value={editAge}
              onChangeText={(text) => setEditAge(text)}
              placeholder="Enter your age"
              placeholderTextColor="#666666"
              keyboardType="number-pad"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Bio</Text>
            <TextInput
              style={[styles.textInput, styles.textAreaInput]}
              value={editBio}
              onChangeText={(text) => setEditBio(text)}
              placeholder="Tell us about yourself"
              placeholderTextColor="#666666"
              multiline
              numberOfLines={4}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Preferred Sports</Text>
            <View style={styles.sportTagsContainer}>
              {editSports.map((sport, index) => (
                <View key={index} style={styles.sportTag}>
                  <Text style={styles.sportTagText}>{sport}</Text>
                  {isEditing && (
                    <TouchableOpacity
                      style={styles.removeSportButton}
                      onPress={() => handleRemoveSport(sport)}
                    >
                      <MaterialIcons name="close" size={16} color="#FFFFFF" />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
            
            {isEditing && (
              <View style={styles.addSportContainer}>
                <TextInput
                  style={styles.sportInput}
                  value={newSport}
                  onChangeText={setNewSport}
                  placeholder="Add a sport"
                  placeholderTextColor="#666666"
                />
                <TouchableOpacity
                  style={styles.addSportButton}
                  onPress={handleAddSport}
                >
                  <MaterialIcons name="add" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Skill Level</Text>
            <View style={styles.skillLevelSelector}>
              {skillLevelOptions.map((level) => (
                <TouchableOpacity
                  key={level}
                  style={[
                    styles.skillLevelOption,
                    editSkillLevel === level && styles.skillLevelOptionSelected,
                  ]}
                  onPress={() => setEditSkillLevel(level)}
                >
                  <Text
                    style={[
                      styles.skillLevelOptionText,
                      editSkillLevel === level && styles.skillLevelOptionTextSelected,
                    ]}
                  >
                    {level}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, styles.cancelButton]}
              onPress={() => {
                setEditName(user?.name || '')
                setEditPhone(user?.phone || '')
                setEditAge(user?.age?.toString() || '')
                setEditBio(user?.bio || '')
                setEditSkillLevel(user?.skillLevel || SkillLevel.BEGINNER)
                setEditSports(user?.preferredGames || [])
                setIsEditing(false)
              }}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.saveButton]}
              onPress={handleSaveProfile}
            >
              <Text style={styles.saveButtonText}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        // View mode
        <>
          <View style={styles.infoSection}>
            <View style={styles.infoRow}>
              <MaterialIcons name="email" size={20} color="#FF9F45" />
              <Text style={styles.infoLabel}>Email:</Text>
              <Text style={styles.infoValue}>{user?.email}</Text>
            </View>
            
            <View style={styles.infoRow}>
              <MaterialIcons name="phone" size={20} color="#FF9F45" />
              <Text style={styles.infoLabel}>Phone:</Text>
              <Text style={styles.infoValue}>{user?.phone}</Text>
            </View>
            
            {user?.age && (
              <View style={styles.infoRow}>
                <MaterialIcons name="cake" size={20} color="#FF9F45" />
                <Text style={styles.infoLabel}>Age:</Text>
                <Text style={styles.infoValue}>{user.age} years</Text>
              </View>
            )}
            
            <View style={styles.infoRow}>
              <MaterialIcons name="trending-up" size={20} color="#FF9F45" />
              <Text style={styles.infoLabel}>Skill Level:</Text>
              <Text style={styles.infoValue}>{user?.skillLevel}</Text>
            </View>
            
            <View style={styles.infoRow}>
              <MaterialIcons name="people" size={20} color="#FF9F45" />
              <Text style={styles.infoLabel}>Friends:</Text>
              <Text style={styles.infoValue}>{user?.friendIds?.length || 0}</Text>
            </View>
            
            <View style={styles.infoRow}>
              <MaterialIcons name="emoji-events" size={20} color="#FF9F45" />
              <Text style={styles.infoLabel}>Badges:</Text>
              <Text style={styles.infoValue}>{user?.badges?.length || 0}</Text>
            </View>
            
            <View style={styles.infoRow}>
              <MaterialIcons name="date-range" size={20} color="#FF9F45" />
              <Text style={styles.infoLabel}>Member Since:</Text>
              <Text style={styles.infoValue}>
                {user?.createdAt instanceof Date ? 
                  user.createdAt.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  }) : 
                  'N/A'}
              </Text>
            </View>
          </View>
          
          <View style={styles.bioSection}>
            <Text style={styles.bioTitle}>About Me</Text>
            <Text style={styles.bioText}>{user?.bio || 'No bio provided yet.'}</Text>
          </View>
          
          <View style={styles.sportsSection}>
            <Text style={styles.sportsTitle}>Preferred Sports</Text>
            <View style={styles.sportTagsContainer}>
              {editSports.map((sport, index) => (
                <View key={index} style={styles.sportTag}>
                  <Text style={styles.sportTagText}>{sport}</Text>
                </View>
              ))}
            </View>
          </View>
        </>
      )}
    </View>
  )

  const renderFriendsTab = () => (
    <View style={styles.tabContent}>
      <Text style={styles.emptyStateText}>
        Friends list will be implemented in a future update.
      </Text>
    </View>
  )

  const renderBadgesTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.badgesContainer}>
        {user?.badges?.map((badge, index) => (
          <View key={index} style={styles.badgeItem}>
            <View style={styles.badgeIconContainer}>
              <MaterialIcons 
                name={
                  badge === 'Early Adopter' ? 'star' : 
                  badge === 'Tournament Winner' ? 'emoji-events' : 'verified'
                } 
                size={24} 
                color="#FF9F45" 
              />
            </View>
            <Text style={styles.badgeName}>{badge}</Text>
          </View>
        ))}
      </View>
    </View>
  )

  if (isLoading && !isEditing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF9F45" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Profile</Text>
          <LinearGradient
            colors={['#FF9F45', '#D494FF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.titleUnderline}
          />
        </View>
        {!isEditing && (
          <TouchableOpacity onPress={() => setIsEditing(true)} style={styles.editButton}>
            <MaterialIcons name="edit" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={styles.scrollContainer}>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.profilePicContainer}>
            {user?.image ? (
              <Image 
                source={{ uri: user.image }} 
                style={styles.profilePic}
              />
            ) : (
              <View style={styles.profilePicPlaceholder}>
                <MaterialIcons name="person" size={50} color="#666666" />
              </View>
            )}
            {!isEditing && (
              <View style={styles.badgeContainer}>
                <MaterialIcons name="verified" size={24} color="#FF9F45" />
              </View>
            )}
            {isEditing && (
              <TouchableOpacity style={styles.changePicButton}>
                <MaterialIcons name="camera-alt" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            )}
          </View>
          
          {isEditing ? (
            <TextInput
              style={styles.nameInput}
              value={editName}
              onChangeText={(text) => setEditName(text)}
              placeholder="Your Name"
              placeholderTextColor="#666666"
            />
          ) : (
            <Text style={styles.profileName}>{user?.name}</Text>
          )}
          
          {isSaving && isEditing && (
            <ActivityIndicator size="small" color="#FF9F45" style={styles.saveLoader} />
          )}
        </View>

        {/* Tabs */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'info' && styles.activeTabButton]}
            onPress={() => setActiveTab('info')}
          >
            <Text style={[styles.tabButtonText, activeTab === 'info' && styles.activeTabButtonText]}>
              Info
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'friends' && styles.activeTabButton]}
            onPress={() => setActiveTab('friends')}
          >
            <Text style={[styles.tabButtonText, activeTab === 'friends' && styles.activeTabButtonText]}>
              Friends
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'badges' && styles.activeTabButton]}
            onPress={() => setActiveTab('badges')}
          >
            <Text style={[styles.tabButtonText, activeTab === 'badges' && styles.activeTabButtonText]}>
              Badges
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        {activeTab === 'info' && renderInfoTab()}
        {activeTab === 'friends' && renderFriendsTab()}
        {activeTab === 'badges' && renderBadgesTab()}
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
  backButton: {
    padding: 8,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  titleUnderline: {
    height: 2,
    width: 80,
    borderRadius: 1,
  },
  editButton: {
    padding: 8,
  },
  scrollContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#FFFFFF',
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  profilePicContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  profilePic: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#FF9F45',
  },
  profilePicPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#1A1A1A',
    borderWidth: 3,
    borderColor: '#FF9F45',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#000000',
    borderRadius: 12,
    padding: 4,
  },
  changePicButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#FF9F45',
    borderRadius: 15,
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  nameInput: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
    paddingVertical: 4,
    marginBottom: 8,
    width: '80%',
  },
  saveLoader: {
    marginTop: 8,
  },
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
    marginBottom: 16,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  activeTabButton: {
    borderBottomWidth: 2,
    borderBottomColor: '#FF9F45',
  },
  tabButtonText: {
    fontSize: 16,
    color: '#666666',
  },
  activeTabButtonText: {
    color: '#FF9F45',
    fontWeight: 'bold',
  },
  tabContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  infoSection: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
    marginLeft: 8,
    width: 120,
  },
  infoValue: {
    fontSize: 16,
    color: '#CCCCCC',
    flex: 1,
  },
  bioSection: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  bioTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  bioText: {
    fontSize: 16,
    color: '#CCCCCC',
    lineHeight: 22,
  },
  sportsSection: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sportsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  sportTagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sportTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#333333',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 4,
  },
  sportTagText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    padding: 12,
    color: '#FFFFFF',
    fontSize: 16,
  },
  textAreaInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  addSportContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  sportInput: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    color: '#FFFFFF',
    marginRight: 8,
  },
  addSportButton: {
    backgroundColor: '#FF9F45',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  skillLevelSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  skillLevelOption: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  skillLevelOptionSelected: {
    backgroundColor: 'rgba(255, 159, 69, 0.2)',
    borderWidth: 1,
    borderColor: '#FF9F45',
  },
  skillLevelOptionText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  skillLevelOptionTextSelected: {
    color: '#FF9F45',
    fontWeight: 'bold',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    gap: 16,
  },
  actionButton: {
    flex: 1,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#333333',
  },
  saveButton: {
    backgroundColor: '#FF9F45',
  },
  cancelButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginTop: 24,
  },
  badgesContainer: {
    gap: 16,
  },
  badgeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
  },
  badgeIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 159, 69, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  badgeName: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  removeSportButton: {
    padding: 4,
  },
}); 