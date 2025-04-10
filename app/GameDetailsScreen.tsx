import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ImageBackground,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Alert,
  Modal
} from 'react-native'
import React, { useState, useEffect } from 'react'
import { LinearGradient } from 'expo-linear-gradient'
import { MaterialIcons } from '@expo/vector-icons'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { getFirestore, doc, getDoc, updateDoc, arrayUnion, Timestamp } from 'firebase/firestore'
import { format } from 'date-fns'
import { useAuth } from './context/AuthContext'

const { width } = Dimensions.get('window')

// Define enums from schema
enum SkillLevel {
  Beginner = "Beginner",
  Intermediate = "Intermediate",
  Advanced = "Advanced",
  Goalkeeper = "Goalkeeper",
  GOALKEEPER = "GOALKEEPER",
  Striker = "Striker",
  STRIKER = "STRIKER",
  striker = "striker",
  midfielder = "midfielder",
  Midfielder = "Midfielder",
  MIDFIELDER = "MIDFIELDER",
  defender = "defender",
  Defender = "Defender",
  DEFENDER = "DEFENDER",
  FORWARD = "FORWARD",
  forward = "forward",
  Forward = "Forward",
  WINGER = "WINGER",
  winger = "winger",
  Winger = "Winger"
}

enum EventType {
  CASUAL = "CASUAL",
  TOURNAMENT = "TOURNAMENT",
  TRAINING = "TRAINING"
}

enum PaymentStatusBooking {
  Pending = "Pending",
  Paid = "Paid",
  Refunded = "Refunded"
}

enum PaymentMethod {
  UPI = "UPI",
  Card = "Card",
  Wallet = "Wallet",
  NetBanking = "NetBanking"
}

// Update interfaces to match schema
interface User {
  id: string
  name: string
  profilePic?: string
  skillLevel?: SkillLevel
  email?: string
  phone?: string
}

interface Location {
  address: string
  latitude: number
  longitude: number
  virtualServer?: string
}

interface SplitPaymentMember {
  userId: string
  amountPaid: number
}

interface SplitPayment {
  isEnabled: boolean
  members: SplitPaymentMember[]
}

interface TeamChat {
  userId: string
  message: string
  timestamp: Date
}

interface Party {
  id: string
  leaderId: string
  sport: string
  eventType: EventType
  date: Date | string | Timestamp
  time: string
  maxPlayers: number
  requiredSkillLevel: SkillLevel
  playersIds: string[]
  players?: string[]
  isPrivate: boolean
  leader?: User
  playerDetails?: User[]
  location?: string
  description?: string
  price?: number
  image?: string
  venue?: {
    name: string
    address: string
  }
  chat?: TeamChat[]
  logo?: string
}

interface PaymentDetails {
  method: PaymentMethod
  amount: number
  splitEnabled: boolean
  splitMembers: SplitPaymentMember[]
}

export default function GameDetailsScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams()
  const { currentUser } = useAuth()
  const [party, setParty] = useState<Party | null>(null)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails>({
    method: PaymentMethod.UPI,
    amount: 0,
    splitEnabled: false,
    splitMembers: []
  })
  const [isUserJoined, setIsUserJoined] = useState(false)

  useEffect(() => {
    if (id) {
      fetchPartyDetails(id as string)
    }
  }, [id])

  useEffect(() => {
    if (party && currentUser) {
      const userJoined = party.playersIds?.includes(currentUser.uid);
      setIsUserJoined(userJoined);
      
      // Set initial payment amount
      setPaymentDetails(prev => ({
        ...prev,
        amount: party.price || 400
      }));
    }
  }, [party, currentUser]);

  const fetchPartyDetails = async (partyId: string) => {
    try {
      setLoading(true)
      const db = getFirestore()
      const partyRef = doc(db, 'parties', partyId)
      const partySnap = await getDoc(partyRef)

      if (partySnap.exists()) {
        const partyData = partySnap.data() as Party
        
        // Process date
        const date = partyData.date instanceof Date 
          ? partyData.date 
          : typeof partyData.date === 'string' 
            ? new Date(partyData.date) 
            : new Date((partyData.date as any).seconds * 1000)

        // Fetch leader data from Firestore (simplified for now)
        let leaderData: User | undefined;
        if (partyData.leaderId) {
          try {
            const leaderDoc = await getDoc(doc(db, 'users', partyData.leaderId));
            if (leaderDoc.exists()) {
              const leaderInfo = leaderDoc.data();
              leaderData = {
                id: partyData.leaderId,
                name: leaderInfo.name || "Unknown Leader",
                profilePic: leaderInfo.image,
                skillLevel: leaderInfo.skillLevel || SkillLevel.Intermediate
              }
            } else {
              leaderData = {
                id: partyData.leaderId,
                name: "Party Leader",
                skillLevel: SkillLevel.Intermediate
              }
            }
          } catch (error) {
            console.error("Error fetching leader details:", error);
            leaderData = {
              id: partyData.leaderId,
              name: "Party Leader",
              skillLevel: SkillLevel.Intermediate
            }
          }
        }
        
        // For simplicity, creating placeholder player details
        // In a real scenario, you'd fetch actual user data for each player ID
        const playerDetailsData = [];
        
        if (partyData.playersIds && partyData.playersIds.length > 0) {
          for (let i = 0; i < partyData.playersIds.length; i++) {
            const playerId = partyData.playersIds[i];
            try {
              const playerDoc = await getDoc(doc(db, 'users', playerId));
              if (playerDoc.exists()) {
                const playerData = playerDoc.data();
                playerDetailsData.push({
                  id: playerId,
                  name: playerData.name || `Player ${i + 1}`,
                  profilePic: playerData.image,
                  skillLevel: playerData.skillLevel || SkillLevel.Intermediate
                });
              } else {
                playerDetailsData.push({
                  id: playerId,
                  name: `Player ${i + 1}`,
                  skillLevel: SkillLevel.Intermediate
                });
              }
            } catch (error) {
              console.error(`Error fetching player ${playerId}:`, error);
              playerDetailsData.push({
                id: playerId,
                name: `Player ${i + 1}`,
                skillLevel: SkillLevel.Intermediate
              });
            }
          }
        }
        
        setParty({
          ...partyData,
          id: partySnap.id,
          date,
          leader: leaderData,
          playerDetails: playerDetailsData,
          // Ensure we have both players and playersIds for backward compatibility
          playersIds: partyData.playersIds || partyData.players || [],
          players: partyData.players || partyData.playersIds || []
        })
      } else {
        Alert.alert('Error', 'Game not found')
        router.back()
      }
    } catch (error) {
      console.error('Error fetching party details:', error)
      Alert.alert('Error', 'Failed to load game details')
    } finally {
      setLoading(false)
    }
  }

  const handleJoinGame = async () => {
    if (!currentUser) {
      Alert.alert(
        "Login Required", 
        "You need to login to join this game",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Login", onPress: () => router.push('/LoginScreen') }
        ]
      );
      return;
    }

    if (party) {
      // Check if the game is already full
      if (party.playersIds.length >= party.maxPlayers) {
        Alert.alert("Game Full", "This game has reached its maximum player limit.");
        return;
      }

      // Check if the user is already part of the game
      if (isUserJoined) {
        Alert.alert("Already Joined", "You are already part of this game.");
        return;
      }

      // If there's a price, show payment modal
      if (party.price && party.price > 0) {
        setShowPaymentModal(true);
      } else {
        // Free game, direct join
        proceedWithJoin();
      }
    }
  }

  const proceedWithJoin = async () => {
    try {
      setJoining(true);
      const db = getFirestore();
      
      // Update the party document with the new player
      await updateDoc(doc(db, 'parties', party!.id), {
        playersIds: arrayUnion(currentUser!.uid),
        players: arrayUnion(currentUser!.uid) // For backward compatibility
      });
      
      // Create a booking record if necessary (simplified, you'd need more fields in a real implementation)
      /*
      const newBooking = {
        userId: currentUser!.uid,
        TeamId: party!.id,
        bookingDate: new Date(),
        timeSlot: party!.time,
        paymentStatus: PaymentStatusBooking.Paid,
        amount: paymentDetails.amount,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await addDoc(collection(db, 'bookings'), newBooking);
      */
      
      // Refresh the party details
      fetchPartyDetails(party!.id);
      
      Alert.alert("Success", "You have successfully joined the game!");
      setIsUserJoined(true);
    } catch (error) {
      console.error("Error joining game:", error);
      Alert.alert("Error", "Failed to join the game. Please try again.");
    } finally {
      setJoining(false);
      setShowPaymentModal(false);
    }
  }

  const handlePayment = async () => {
    try {
      setProcessing(true);
      
      // Simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // In a real app, you would integrate with a payment gateway here
      // and create a payment record in your database
      
      // After successful payment
      proceedWithJoin();
    } catch (error) {
      console.error("Payment error:", error);
      Alert.alert("Payment Failed", "There was an error processing your payment.");
      setProcessing(false);
    }
  }

  const renderPaymentMethodButton = (method: PaymentMethod) => (
    <TouchableOpacity 
      style={[
        styles.paymentMethod, 
        paymentDetails.method === method && styles.selectedPaymentMethod
      ]}
      onPress={() => setPaymentDetails({...paymentDetails, method})}
    >
      <MaterialIcons 
        name={
          method === PaymentMethod.UPI ? "account-balance" : 
          method === PaymentMethod.Card ? "credit-card" :
          method === PaymentMethod.Wallet ? "account-balance-wallet" : "payment"
        } 
        size={24} 
        color={paymentDetails.method === method ? "#FF9F45" : "#666"} 
      />
      <Text style={[
        styles.paymentMethodText,
        paymentDetails.method === method && styles.selectedPaymentMethodText
      ]}>{method}</Text>
    </TouchableOpacity>
  )

  const renderPaymentModal = () => (
    <Modal
      visible={showPaymentModal}
      transparent={true}
      animationType="slide"
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Payment</Text>
            <TouchableOpacity onPress={() => setShowPaymentModal(false)}>
              <MaterialIcons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.paymentDetails}>
            <Text style={styles.paymentTitle}>Game Details</Text>
            <Text style={styles.gameName}>{party?.sport} - {format(party?.date as Date, 'EEE d MMM')}</Text>
            <Text style={styles.gameTime}>{party?.time}</Text>
            
            <View style={styles.amountContainer}>
              <Text style={styles.amountLabel}>Amount</Text>
              <Text style={styles.amount}>₹{party?.price || 400}</Text>
            </View>
            
            <Text style={styles.paymentMethodsTitle}>Select Payment Method</Text>
            <View style={styles.paymentMethods}>
              {renderPaymentMethodButton(PaymentMethod.UPI)}
              {renderPaymentMethodButton(PaymentMethod.Card)}
              {renderPaymentMethodButton(PaymentMethod.Wallet)}
              {renderPaymentMethodButton(PaymentMethod.NetBanking)}
            </View>
            
            <TouchableOpacity 
              style={styles.payButton}
              onPress={handlePayment}
              disabled={processing}
            >
              <LinearGradient
                colors={['#FF9F45', '#D494FF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.payButtonGradient}
              >
                <View style={styles.payButtonInner}>
                  {processing ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.payButtonText}>PAY ₹{party?.price || 400}</Text>
                  )}
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )

  const getSkillLevelDisplay = (level: SkillLevel | undefined) => {
    if (!level) return "Not specified";
    
    // Convert to proper display format
    const levelStr = level.toString();
    
    // For position-based skill levels
    if (
      levelStr.toLowerCase().includes('striker') ||
      levelStr.toLowerCase().includes('goalkeeper') ||
      levelStr.toLowerCase().includes('midfielder') ||
      levelStr.toLowerCase().includes('defender') ||
      levelStr.toLowerCase().includes('forward') ||
      levelStr.toLowerCase().includes('winger')
    ) {
      // Format as "Position" (capitalized first letter)
      return levelStr.charAt(0).toUpperCase() + levelStr.slice(1).toLowerCase();
    }
    
    // For general skill levels
    return levelStr;
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#FF9F45" />
        <Text style={styles.loadingText}>Loading game details...</Text>
      </View>
    )
  }

  if (!party) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <MaterialIcons name="error-outline" size={48} color="#FF9F45" />
        <Text style={styles.loadingText}>Game not found</Text>
      </View>
    )
  }

  const formattedDate = format(party.date as Date, 'EEEE, d MMMM')
  const remainingSpots = party.maxPlayers - (party.playersIds?.length || 0)

  return (
    <View style={styles.container}>
      {/* Custom Header */}
      <View style={styles.customHeader}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Game Details</Text>
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

      <ScrollView style={styles.scrollView}>
        <ImageBackground
          source={party.image ? { uri: party.image } : require('@/assets/images/turf-cricket.png')}
          style={styles.headerImage}
        >
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.9)']}
            style={styles.headerGradient}
          >
            <View style={styles.headerContent}>
              <View style={styles.sportInfoContainer}>
                <View style={styles.badgeContainer}>
                  <LinearGradient
                    colors={['#FF9F45', '#D494FF']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.eventTypeBadge}
                  >
                    <Text style={styles.eventTypeText}>
                      {party.eventType === EventType.CASUAL ? 'Casual' : 
                       party.eventType === EventType.TOURNAMENT ? 'Tournament' : 'Training'}
                    </Text>
                  </LinearGradient>
                </View>
                <Text style={styles.sportTitle}>{party.sport}</Text>
                <View style={styles.locationContainer}>
                  <MaterialIcons name="location-on" size={20} color="#FF9F45" />
                  <Text style={styles.locationText}>{party.location || 'Location not specified'}</Text>
                </View>
              </View>
            </View>
          </LinearGradient>
        </ImageBackground>

        <View style={styles.content}>
          <View style={styles.hostSection}>
            <View style={styles.hostInfo}>
              <View style={styles.hostAvatar} />
              <View>
                <Text style={styles.hostLabel}>HOST</Text>
                <Text style={styles.hostName}>{party.leader?.name || 'Unknown Host'}</Text>
                {party.leader?.skillLevel && (
                  <Text style={styles.hostSkill}>
                    {getSkillLevelDisplay(party.leader.skillLevel)}
                  </Text>
                )}
              </View>
            </View>
            <TouchableOpacity style={styles.messageButton}>
              <MaterialIcons name="chat" size={20} color="#FF9F45" />
            </TouchableOpacity>
          </View>

          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <MaterialIcons name="event" size={20} color="#666" />
              <Text style={styles.infoText}>{formattedDate}</Text>
            </View>
            <View style={styles.infoRow}>
              <MaterialIcons name="access-time" size={20} color="#666" />
              <Text style={styles.infoText}>{party.time}</Text>
            </View>
            <View style={styles.infoRow}>
              <MaterialIcons name="group" size={20} color="#666" />
              <Text style={styles.infoText}>
                {party.playersIds?.length || 0}/{party.maxPlayers} Players joined
                {remainingSpots > 0 ? ` (${remainingSpots} spot${remainingSpots > 1 ? 's' : ''} left)` : ' (Full)'}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <MaterialIcons name="trending-up" size={20} color="#666" />
              <Text style={styles.infoText}>{getSkillLevelDisplay(party.requiredSkillLevel)} level</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Players</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {party.playerDetails?.map((player, index) => (
                <View key={player.id} style={styles.playerCard}>
                  <View style={styles.playerAvatar} />
                  <Text style={styles.playerName}>{player.name}</Text>
                  {player.skillLevel && (
                    <Text style={styles.playerLevel}>
                      {getSkillLevelDisplay(player.skillLevel)}
                    </Text>
                  )}
                </View>
              ))}
              {[...Array(Math.max(0, party.maxPlayers - (party.playersIds?.length || 0)))].map((_, index) => (
                <View key={`empty-${index}`} style={styles.emptyPlayerCard}>
                  <MaterialIcons name="person-add" size={24} color="#666" />
                  <Text style={styles.emptyPlayerText}>Open Spot</Text>
                </View>
              ))}
            </ScrollView>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Game Details</Text>
            <Text style={styles.description}>
              {party.description || `Join us for an exciting ${party.sport} match at ${party.location || 'the venue'}! This is an ${party.requiredSkillLevel.toLowerCase()} level game perfect for players with some experience.`}
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Venue Details</Text>
            <View style={styles.venueCard}>
              <MaterialIcons name="location-on" size={20} color="#666" />
              <View style={styles.venueInfo}>
                <Text style={styles.venueName}>{party.venue?.name || party.location || 'Venue'}</Text>
                <Text style={styles.venueAddress}>
                  {party.venue?.address || party.location || 'Address not specified'}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.priceContainer}>
          <Text style={styles.priceLabel}>Price per person</Text>
          <Text style={styles.price}>₹{party.price || 400}</Text>
        </View>
        <TouchableOpacity 
          style={[
            styles.joinButton, 
            (isUserJoined || joining) && styles.joinedButton
          ]}
          onPress={handleJoinGame}
          disabled={isUserJoined || joining}
        >
          <LinearGradient
            colors={isUserJoined ? ['#666', '#999'] : ['#FF9F45', '#D494FF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.joinButtonGradient}
          >
            <View style={styles.joinButtonInner}>
              {joining ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.joinButtonText}>
                  {isUserJoined ? 'JOINED' : 'JOIN GAME'}
                </Text>
              )}
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </View>
      
      {renderPaymentModal()}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    marginTop: 16,
    fontSize: 16,
  },
  customHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 16,
    backgroundColor: '#000',
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
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
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
    backgroundColor: '#333',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  headerImage: {
    height: 300,
    width: '100%',
  },
  headerGradient: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 20,
  },
  headerContent: {
    gap: 16,
  },
  sportInfoContainer: {
    gap: 8,
  },
  badgeContainer: {
    flexDirection: 'row',
  },
  eventTypeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  eventTypeText: {
    color: '#000',
    fontSize: 12,
    fontWeight: 'bold',
  },
  sportTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    fontSize: 16,
    color: '#fff',
  },
  content: {
    padding: 20,
    gap: 24,
    backgroundColor: '#000',
  },
  hostSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hostInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  hostAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#eee',
  },
  hostLabel: {
    fontSize: 12,
    color: '#666',
  },
  hostName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  hostSkill: {
    fontSize: 12,
    color: '#FF9F45',
    marginTop: 2,
  },
  messageButton: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#1A1A1A',
  },
  infoCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#fff',
  },
  section: {
    gap: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
  },
  playerCard: {
    alignItems: 'center',
    marginRight: 16,
    gap: 4,
  },
  playerAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#333',
  },
  playerName: {
    fontSize: 14,
    color: '#fff',
  },
  playerLevel: {
    fontSize: 12,
    color: '#FF9F45',
  },
  emptyPlayerCard: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  emptyPlayerText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  description: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  venueCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#1A1A1A',
    padding: 16,
    borderRadius: 16,
  },
  venueInfo: {
    flex: 1,
    gap: 4,
  },
  venueName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
  },
  venueAddress: {
    fontSize: 14,
    color: '#666',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#1A1A1A',
    backgroundColor: '#000',
  },
  priceContainer: {
    gap: 4,
  },
  priceLabel: {
    fontSize: 12,
    color: '#666',
  },
  price: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  joinButton: {
    flex: 1,
    marginLeft: 20,
  },
  joinedButton: {
    opacity: 0.7,
  },
  joinButtonGradient: {
    borderRadius: 24,
    padding: 1,
  },
  joinButtonInner: {
    backgroundColor: '#000',
    margin: 1,
    borderRadius: 23,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  
  // Payment modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#000',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 30,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  paymentDetails: {
    padding: 20,
    gap: 20,
  },
  paymentTitle: {
    fontSize: 16,
    color: '#666',
  },
  gameName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  gameTime: {
    fontSize: 14,
    color: '#666',
  },
  amountContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  amountLabel: {
    fontSize: 14,
    color: '#666',
  },
  amount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF9F45',
  },
  paymentMethodsTitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  paymentMethods: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  paymentMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  selectedPaymentMethod: {
    borderColor: '#FF9F45',
  },
  paymentMethodText: {
    color: '#fff',
    fontSize: 14,
  },
  selectedPaymentMethodText: {
    color: '#FF9F45',
  },
  payButton: {
    alignSelf: 'stretch',
  },
  payButtonGradient: {
    borderRadius: 24,
    padding: 1,
  },
  payButtonInner: {
    backgroundColor: '#000',
    margin: 1,
    borderRadius: 23,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 1,
  },
}) 