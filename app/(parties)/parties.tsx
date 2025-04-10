import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Alert,
} from 'react-native'
import React, { useState, useEffect, useCallback } from 'react'
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import { format, isPast, isFuture, parseISO } from 'date-fns'

// Define types based on schema
interface User {
  _id: string;
  fullName: string;
  profilePic?: string;
  skillLevel: 'Beginner' | 'Intermediate' | 'Advanced';
}

interface ChatMessage {
  userId: string;
  message: string;
  timestamp: string;
  user?: User; // Populated field
}

interface Party {
  _id: string;
  leaderId: string;
  sport: string;
  eventType: 'Casual' | 'Tournament' | 'Training';
  date: string;
  time: string;
  maxPlayers: number;
  requiredSkillLevel: 'Beginner' | 'Intermediate' | 'Advanced';
  players: string[];
  isPrivate: boolean;
  chat: ChatMessage[];
  createdAt: string;
  updatedAt: string;
  // Populated fields
  leader?: User;
  playerDetails?: User[];
}

// Mock data (replace with actual data from your backend)
const mockUsers: Record<string, User> = {
  '1': {
    _id: '1',
    fullName: 'John Doe',
    profilePic: 'https://example.com/john.jpg',
    skillLevel: 'Intermediate',
  },
  '2': {
    _id: '2',
    fullName: 'Jane Smith',
    profilePic: 'https://example.com/jane.jpg',
    skillLevel: 'Advanced',
  },
  '3': {
    _id: '3',
    fullName: 'Mike Johnson',
    profilePic: 'https://example.com/mike.jpg',
    skillLevel: 'Beginner',
  },
  '4': {
    _id: '4',
    fullName: 'Sarah Wilson',
    profilePic: 'https://example.com/sarah.jpg',
    skillLevel: 'Intermediate',
  },
}

const mockParties: Party[] = [
  {
    _id: '1',
    leaderId: '1',
    sport: 'Cricket',
    eventType: 'Casual',
    date: '2025-03-15',
    time: '18:00',
    maxPlayers: 11,
    requiredSkillLevel: 'Intermediate',
    players: ['1', '2', '3', '4'],
    isPrivate: false,
    chat: [
      {
        userId: '1',
        message: 'Hey everyone! Looking forward to the game.',
        timestamp: '2025-03-14T10:00:00Z',
      },
      {
        userId: '2',
        message: 'Me too! Should we bring our own equipment?',
        timestamp: '2025-03-14T10:05:00Z',
      },
    ],
    createdAt: '2025-03-01',
    updatedAt: '2025-03-14',
  },
  {
    _id: '2',
    leaderId: '1',
    sport: 'Football',
    eventType: 'Training',
    date: '2025-03-20',
    time: '17:00',
    maxPlayers: 14,
    requiredSkillLevel: 'Beginner',
    players: ['1', '3'],
    isPrivate: true,
    chat: [],
    createdAt: '2025-03-10',
    updatedAt: '2025-03-10',
  },
  {
    _id: '3',
    leaderId: '2',
    sport: 'Basketball',
    eventType: 'Tournament',
    date: '2025-02-15',
    time: '16:00',
    maxPlayers: 10,
    requiredSkillLevel: 'Advanced',
    players: ['1', '2', '4'],
    isPrivate: false,
    chat: [],
    createdAt: '2025-02-01',
    updatedAt: '2025-02-10',
  },
]

export default function Parties() {
  const router = useRouter()
  const [parties, setParties] = useState<Party[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState<'hosting' | 'joined' | 'past'>('hosting')

  // Fetch parties data from backend (replace with actual API call)
  useEffect(() => {
    fetchParties()
  }, [])

  const fetchParties = () => {
    setIsLoading(true)
    // Simulating API call
    setTimeout(() => {
      // Populate user data
      const populatedParties = mockParties.map(party => ({
        ...party,
        leader: mockUsers[party.leaderId],
        playerDetails: party.players.map(playerId => mockUsers[playerId]),
        chat: party.chat.map(msg => ({
          ...msg,
          user: mockUsers[msg.userId],
        })),
      }))
      setParties(populatedParties)
      setIsLoading(false)
    }, 1000)
  }

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    // Simulating API call
    setTimeout(() => {
      fetchParties()
      setRefreshing(false)
    }, 1000)
  }, [])

  const filteredParties = parties.filter(party => {
    const partyDate = parseISO(party.date);
    const today = new Date();
    const isPastParty = isPast(partyDate) && partyDate.toDateString() !== today.toDateString();
    
    if (activeTab === 'hosting') {
      return party.leaderId === '1' && !isPastParty; // Replace '1' with actual user ID
    } else if (activeTab === 'joined') {
      return party.players.includes('1') && party.leaderId !== '1' && !isPastParty; // Replace '1' with actual user ID
    } else {
      return isPastParty && (party.leaderId === '1' || party.players.includes('1')); // Replace '1' with actual user ID
    }
  })

  const handleLeaveParty = (partyId: string) => {
    Alert.alert(
      'Leave Party',
      'Are you sure you want to leave this party?',
      [
        {
          text: 'No',
          style: 'cancel',
        },
        {
          text: 'Yes, Leave',
          style: 'destructive',
          onPress: () => {
            // Simulate API call to leave party
            setIsLoading(true)
            setTimeout(() => {
              const updatedParties = parties.map(party => 
                party._id === partyId 
                  ? { ...party, players: party.players.filter(id => id !== '1') } // Replace '1' with actual user ID
                  : party
              )
              setParties(updatedParties)
              setIsLoading(false)
              Alert.alert('Success', 'You have left the party.')
            }, 1000)
          },
        },
      ]
    )
  }

  const handleCancelParty = (partyId: string) => {
    Alert.alert(
      'Cancel Party',
      'Are you sure you want to cancel this party? All players will be notified.',
      [
        {
          text: 'No',
          style: 'cancel',
        },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: () => {
            // Simulate API call to cancel party
            setIsLoading(true)
            setTimeout(() => {
              setParties(parties.filter(party => party._id !== partyId))
              setIsLoading(false)
              Alert.alert('Success', 'Party cancelled successfully.')
            }, 1000)
          },
        },
      ]
    )
  }

  const handleViewPartyDetails = (partyId: string) => {
    // Navigate to party details page
    // router.push(`/(parties)/details/${partyId}`)
    Alert.alert('View Details', `Viewing details for party ${partyId}`)
  }

  const handleOpenChat = (partyId: string) => {
    // Navigate to party chat page
    // router.push(`/(parties)/chat/${partyId}`)
    Alert.alert('Open Chat', `Opening chat for party ${partyId}`)
  }

  const renderPartyItem = ({ item }: { item: Party }) => {
    const partyDate = parseISO(item.date);
    const isPastParty = isPast(partyDate) && partyDate.toDateString() !== new Date().toDateString();
    const formattedDate = format(partyDate, 'EEE, MMM d, yyyy');
    const isLeader = item.leaderId === '1'; // Replace '1' with actual user ID
    
    return (
      <TouchableOpacity 
        style={styles.partyCard}
        onPress={() => handleViewPartyDetails(item._id)}
        activeOpacity={0.8}
      >
        {/* Party Header */}
        <View style={styles.partyHeader}>
          <View style={styles.partyTypeContainer}>
            <MaterialIcons 
              name={
                item.sport.toLowerCase() === 'cricket' ? 'sports-cricket' :
                item.sport.toLowerCase() === 'football' ? 'sports-soccer' :
                item.sport.toLowerCase() === 'basketball' ? 'sports-basketball' :
                'sports'
              } 
              size={24} 
              color="#FF9F45" 
            />
            <View style={styles.partyTypeInfo}>
              <Text style={styles.sportName}>{item.sport}</Text>
              <View style={styles.eventTypeContainer}>
                <Text style={styles.eventTypeText}>{item.eventType}</Text>
                {item.isPrivate && (
                  <MaterialIcons name="lock" size={12} color="#666666" style={styles.lockIcon} />
                )}
              </View>
            </View>
          </View>
          <View style={styles.partyStatusContainer}>
            <Text style={styles.playerCount}>
              {item.players.length}/{item.maxPlayers}
            </Text>
            <Text style={styles.skillLevelText}>{item.requiredSkillLevel}</Text>
          </View>
        </View>

        {/* Party Details */}
        <View style={styles.partyDetails}>
          <View style={styles.detailRow}>
            <MaterialIcons name="event" size={16} color="#FF9F45" />
            <Text style={styles.detailText}>{formattedDate}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <MaterialIcons name="access-time" size={16} color="#FF9F45" />
            <Text style={styles.detailText}>{item.time}</Text>
          </View>

          {/* Players */}
          <View style={styles.playersContainer}>
            <Text style={styles.playersTitle}>Players:</Text>
            <View style={styles.playersList}>
              {item.playerDetails?.map((player, index) => (
                <View key={player._id} style={styles.playerItem}>
                  {player.profilePic ? (
                    <Image 
                      source={{ uri: player.profilePic }} 
                      style={styles.playerAvatar}
                    />
                  ) : (
                    <View style={styles.playerAvatarPlaceholder}>
                      <MaterialIcons name="person" size={12} color="#666666" />
                    </View>
                  )}
                  <Text style={styles.playerName}>
                    {player.fullName}
                    {player._id === item.leaderId && ' (Leader)'}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* Latest Message */}
          {item.chat.length > 0 && (
            <TouchableOpacity 
              style={styles.latestMessage}
              onPress={() => handleOpenChat(item._id)}
            >
              <MaterialIcons name="chat" size={16} color="#FF9F45" />
              <Text style={styles.messageText} numberOfLines={1}>
                {item.chat[item.chat.length - 1].user?.fullName}: {item.chat[item.chat.length - 1].message}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.partyActions}>
          {!isPastParty && (
            isLeader ? (
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => handleCancelParty(item._id)}
              >
                <Text style={styles.cancelButtonText}>Cancel Party</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity 
                style={styles.leaveButton}
                onPress={() => handleLeaveParty(item._id)}
              >
                <Text style={styles.leaveButtonText}>Leave Party</Text>
              </TouchableOpacity>
            )
          )}
          
          <TouchableOpacity 
            style={styles.chatButton}
            onPress={() => handleOpenChat(item._id)}
          >
            <Text style={styles.chatButtonText}>Open Chat</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.detailsButton}
            onPress={() => handleViewPartyDetails(item._id)}
          >
            <Text style={styles.detailsButtonText}>Details</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    )
  }

  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <MaterialIcons name="groups" size={64} color="#333333" />
      <Text style={styles.emptyTitle}>No Parties Found</Text>
      <Text style={styles.emptyText}>
        {activeTab === 'hosting' 
          ? "You're not hosting any parties." 
          : activeTab === 'joined' 
            ? "You haven't joined any parties." 
            : "You don't have any past parties."}
      </Text>
      <TouchableOpacity 
        style={styles.createPartyButton}
        onPress={() => router.push('/(tabs)/join')}
      >
        <LinearGradient
          colors={['#FF9F45', '#D494FF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.createPartyGradient}
        >
          <Text style={styles.createPartyText}>Create Party</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  )

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>My Parties</Text>
          <LinearGradient
            colors={['#FF9F45', '#D494FF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.titleUnderline}
          />
        </View>
        <TouchableOpacity 
          style={styles.createButton}
          onPress={() => router.push('/(tabs)/join')}
        >
          <MaterialIcons name="add" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'hosting' && styles.activeTabButton]}
          onPress={() => setActiveTab('hosting')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'hosting' && styles.activeTabButtonText]}>
            Hosting
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'joined' && styles.activeTabButton]}
          onPress={() => setActiveTab('joined')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'joined' && styles.activeTabButtonText]}>
            Joined
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'past' && styles.activeTabButton]}
          onPress={() => setActiveTab('past')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'past' && styles.activeTabButtonText]}>
            Past
          </Text>
        </TouchableOpacity>
      </View>

      {/* Parties List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF9F45" />
          <Text style={styles.loadingText}>Loading parties...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredParties}
          renderItem={renderPartyItem}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.partiesList}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderEmptyList}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#FF9F45"
              colors={["#FF9F45"]}
            />
          }
        />
      )}
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
  createButton: {
    padding: 8,
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
  partiesList: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    flexGrow: 1,
  },
  partyCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  partyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  partyTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  partyTypeInfo: {
    marginLeft: 12,
  },
  sportName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  eventTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  eventTypeText: {
    fontSize: 14,
    color: '#999999',
  },
  lockIcon: {
    marginLeft: 4,
  },
  partyStatusContainer: {
    alignItems: 'flex-end',
  },
  playerCount: {
    fontSize: 16,
    color: '#FF9F45',
    fontWeight: 'bold',
  },
  skillLevelText: {
    fontSize: 12,
    color: '#999999',
    marginTop: 4,
  },
  partyDetails: {
    padding: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#CCCCCC',
    marginLeft: 8,
  },
  playersContainer: {
    marginTop: 8,
  },
  playersTitle: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
    marginBottom: 8,
  },
  playersList: {
    gap: 8,
  },
  playerItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playerAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 8,
  },
  playerAvatarPlaceholder: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#333333',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  playerName: {
    fontSize: 14,
    color: '#CCCCCC',
  },
  latestMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#333333',
    borderRadius: 8,
    padding: 8,
    marginTop: 12,
  },
  messageText: {
    fontSize: 14,
    color: '#CCCCCC',
    marginLeft: 8,
    flex: 1,
  },
  partyActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#333333',
    padding: 12,
    gap: 8,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: 'rgba(255, 69, 58, 0.1)',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#FF453A',
    fontSize: 14,
    fontWeight: '500',
  },
  leaveButton: {
    flex: 1,
    backgroundColor: 'rgba(255, 159, 69, 0.1)',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  leaveButtonText: {
    color: '#FF9F45',
    fontSize: 14,
    fontWeight: '500',
  },
  chatButton: {
    flex: 1,
    backgroundColor: '#333333',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  chatButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  detailsButton: {
    flex: 1,
    backgroundColor: '#333333',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  detailsButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#999999',
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 32,
  },
  createPartyButton: {
    width: '60%',
  },
  createPartyGradient: {
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  createPartyText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
}); 