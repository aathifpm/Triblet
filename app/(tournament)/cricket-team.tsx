import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  TextInput,
  Modal,
  Image,
  ActivityIndicator,
  FlatList,
  Switch,
} from 'react-native';
import { getFirestore, collection, addDoc, getDocs, query, where, updateDoc, doc, limit, orderBy, setDoc, getDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { getAuth, createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { LinearGradient } from 'expo-linear-gradient';

enum SkillLevel {
  // General skill levels
  Beginner = 'Beginner',
  Intermediate = 'Intermediate',
  Advanced = 'Advanced',
  
  // Cricket specific roles
  BATSMAN = 'BATSMAN',
  BOWLER = 'BOWLER',
  ALL_ROUNDER = 'ALL_ROUNDER',
  WICKET_KEEPER = 'WICKET_KEEPER',
  
  // Football specific roles
  Goalkeeper = 'Goalkeeper',
  GOALKEEPER = 'GOALKEEPER',
  Striker = 'Striker',
  STRIKER = 'STRIKER',
  striker = 'striker',
  midfielder = 'midfielder',
  Midfielder = 'Midfielder',
  MIDFIELDER = 'MIDFIELDER',
  defender = 'defender',
  Defender = 'Defender',
  DEFENDER = 'DEFENDER',
  FORWARD = 'FORWARD',
  forward = 'forward',
  Forward = 'Forward',
  WINGER = 'WINGER',
  winger = 'winger',
  Winger = 'Winger',
}

enum EventType {
  CASUAL = 'CASUAL',
  TOURNAMENT = 'TOURNAMENT',
  TRAINING = 'TRAINING'
}

interface User {
  id: string;
  name?: string;
  email: string;
  image?: string;
  skillLevel?: SkillLevel;
  preferredGames?: string[];
  age?: number;
  bio?: string;
  teamsInTournament?: { [teamId: string]: string }; // teamId: teamName
}

interface Player {
  id: string;
  name: string;
  skillLevel: SkillLevel;
  stats: {
    matches: number;
    runs: number;
    wickets: number;
    catches: number;
    stumpings: number;
  };
}

interface TeamChat {
  userId: string;
  message: string;
  timestamp: Date;
}

interface Team {
  id: string;
  createdById: string;
  name: string;
  game: string;
  eventType: EventType;
  date: Date;
  time: string;
  maxPlayers: number;
  requiredSkillLevel?: SkillLevel;
  playersIds: string[];
  chat: TeamChat[];
  isPrivate: boolean;
  tournamentId?: string;
  logo?: string;
  captain?: string;
  stats: {
    matches: number;
    wins: number;
    losses: number;
    points: number;
  };
}

export default function CricketTeam() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showAddPlayerForm, setShowAddPlayerForm] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [usersMap, setUsersMap] = useState<{[key: string]: User}>({});
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    game: '',
    skillLevel: '',
    skillCategory: 'all' // 'all', 'general', 'cricket', 'football'
  });
  const [newTeam, setNewTeam] = useState<Partial<Team>>({
    name: '',
    game: 'Cricket',
    eventType: EventType.TOURNAMENT,
    maxPlayers: 11,
    playersIds: [],
    chat: [],
    isPrivate: false,
    stats: {
      matches: 0,
      wins: 0,
      losses: 0,
      points: 0,
    }
  });
  const [showCreateUserForm, setShowCreateUserForm] = useState(false);
  const [newUser, setNewUser] = useState<Partial<User>>({
    name: '',
    email: '',
    skillLevel: SkillLevel.Beginner,
    preferredGames: ['Cricket'],
  });
  const [sendInviteEmail, setSendInviteEmail] = useState(true);
  const [playersInOtherTeams, setPlayersInOtherTeams] = useState<{[playerId: string]: string[]}>({});
  const [allowSelectFromOtherTeams, setAllowSelectFromOtherTeams] = useState(false);

  const { currentUser } = useAuth();
  const router = useRouter();
  const { tournamentId, teamId, action } = useLocalSearchParams();
  const db = getFirestore();
  const auth = getAuth();

  useEffect(() => {
    if (tournamentId) {
      loadTeams();
      if (showAddPlayerForm) {
        loadPlayersInOtherTeams();
      }
    }
  }, [tournamentId, showAddPlayerForm]);

  useEffect(() => {
    if (showAddPlayerForm) {
      fetchUsers();
    }
  }, [showAddPlayerForm, searchQuery, filters]);

  const loadTeams = async () => {
    try {
      const teamsRef = collection(db, 'teams');
      const q = query(teamsRef, where('tournamentId', '==', tournamentId));
      const querySnapshot = await getDocs(q);
      
      const teamsData: Team[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        teamsData.push({
          id: doc.id,
          createdById: data.createdById || '',
          name: data.name || '',
          game: data.game || 'Cricket',
          eventType: data.eventType || EventType.TOURNAMENT,
          date: data.date ? new Date(data.date) : new Date(),
          time: data.time || '',
          maxPlayers: data.maxPlayers || 11,
          requiredSkillLevel: data.requiredSkillLevel,
          playersIds: data.playersIds || [],
          chat: data.chat || [],
          isPrivate: data.isPrivate || false,
          tournamentId: data.tournamentId,
          logo: data.logo,
          captain: data.captain,
          stats: {
            matches: data.stats?.matches || 0,
            wins: data.stats?.wins || 0,
            losses: data.stats?.losses || 0,
            points: data.stats?.points || 0,
          }
        });
      });
      
      setTeams(teamsData);

      const playerIds: string[] = teamsData.flatMap(team => team.playersIds);
      if (playerIds.length > 0) {
        await fetchUsersByIds(playerIds);
      }

      if (teamId) {
        const team = teamsData.find(t => t.id === teamId);
        if (team) {
          setSelectedTeam(team);
        }
      }

      if (action === 'create') {
        setShowCreateForm(true);
      }
    } catch (error) {
      console.error('Error loading teams:', error);
      Alert.alert('Error', 'Failed to load teams');
    }
  };

  const fetchUsers = async () => {
    try {
      setLoadingUsers(true);
      const usersRef = collection(db, 'users');
      
      let queryConstraints = [];
      
      if (filters.game) {
        queryConstraints.push(where('preferredGames', 'array-contains', filters.game));
      }
      
      if (filters.skillLevel) {
        queryConstraints.push(where('skillLevel', '==', filters.skillLevel));
      }
      
      if (searchQuery) {
        queryConstraints.push(orderBy('name'));
      }
      
      queryConstraints.push(limit(20));
      
      const q = query(usersRef, ...queryConstraints);
      
      const querySnapshot = await getDocs(q);
      
      const usersData: User[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        usersData.push({
          id: doc.id,
          name: data.name,
          email: data.email,
          image: data.image,
          skillLevel: data.skillLevel,
          preferredGames: data.preferredGames,
          age: data.age,
          bio: data.bio,
        });
      });
      
      if (searchQuery) {
        const filteredUsers = usersData.filter(user => 
          user.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
          user.email.toLowerCase().includes(searchQuery.toLowerCase())
        );
        setUsers(filteredUsers);
      } else {
        setUsers(usersData);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      Alert.alert('Error', 'Failed to fetch users');
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchUsersByIds = async (userIds: string[]) => {
    if (userIds.length === 0) return;
    
    try {
      const usersData: {[key: string]: User} = {};
      
      const batchSize = 10;
      for (let i = 0; i < userIds.length; i += batchSize) {
        const batch = userIds.slice(i, i + batchSize);
        
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('id', 'in', batch));
        const querySnapshot = await getDocs(q);
        
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          usersData[doc.id] = {
            id: doc.id,
            name: data.name,
            email: data.email,
            image: data.image,
            skillLevel: data.skillLevel,
            preferredGames: data.preferredGames
          };
        });
      }
      
      setUsersMap(prev => ({...prev, ...usersData}));
    } catch (error) {
      console.error('Error fetching users by IDs:', error);
    }
  };

  const handleCreateTeam = async () => {
    try {
      if (!newTeam.name) {
        Alert.alert('Error', 'Please enter team name');
        return;
      }

      if (!currentUser?.uid) {
        Alert.alert('Error', 'You must be logged in to create a team');
        return;
      }

      const team = {
        ...newTeam,
        createdById: currentUser.uid,
        tournamentId,
        date: new Date(),
        time: new Date().toLocaleTimeString(),
        playersIds: [],
        chat: [],
        stats: {
          matches: 0,
          wins: 0,
          losses: 0,
          points: 0,
        }
      };

      const docRef = await addDoc(collection(db, 'teams'), team);
      setShowCreateForm(false);
      
      if (action === 'create') {
        router.back();
      } else {
        loadTeams();
      }
    } catch (error) {
      console.error('Error creating team:', error);
      Alert.alert('Error', 'Failed to create team');
    }
  };

  const handleAddPlayers = async () => {
    try {
      if (!selectedTeam || selectedUsers.length === 0) {
        Alert.alert('Error', 'Please select at least one player');
        return;
      }

      // Get the current team's players to avoid duplicates
      const teamDoc = await getDoc(doc(db, 'teams', selectedTeam.id));
      if (!teamDoc.exists()) {
        Alert.alert('Error', 'Team not found');
        return;
      }

      const currentPlayers = teamDoc.data().playersIds || [];
      const newPlayers = selectedUsers.filter(id => !currentPlayers.includes(id));
      const updatedPlayerIds = [...currentPlayers, ...newPlayers];

      // Update the team document with the new players
      await updateDoc(doc(db, 'teams', selectedTeam.id), {
        playersIds: updatedPlayerIds
      });

      // Reset UI state
      setShowAddPlayerForm(false);
      setSelectedUsers([]);
      setAllowSelectFromOtherTeams(false);
      
      // Reload teams to reflect changes
      await loadTeams();

    } catch (error) {
      console.error('Error adding players:', error);
      Alert.alert('Error', 'Failed to add players');
    }
  };

  const handleSetCaptain = async (teamId: string, playerId: string) => {
    try {
      if (!teamId || !playerId) {
        Alert.alert('Error', 'Invalid team or player');
        return;
      }

      await updateDoc(doc(db, 'teams', teamId), {
        captain: playerId
      });
      loadTeams();
    } catch (error) {
      console.error('Error setting captain:', error);
      Alert.alert('Error', 'Failed to set captain');
    }
  };

  const loadPlayersInOtherTeams = async () => {
    try {
      const teamsRef = collection(db, 'teams');
      const q = query(teamsRef, where('tournamentId', '==', tournamentId));
      const querySnapshot = await getDocs(q);
      
      const playerTeams: {[playerId: string]: string[]} = {};
      
      querySnapshot.forEach((docSnapshot) => {
        const teamData = docSnapshot.data();
        // Skip if it's the current team or if playersIds is undefined
        if (teamData.id === selectedTeam?.id || !teamData.playersIds) {
          return;
        }

        // Ensure we have valid team data
        const team: Team = {
          id: docSnapshot.id,
          name: teamData.name || 'Unnamed Team',
          playersIds: teamData.playersIds || [],
          createdById: teamData.createdById || '',
          game: teamData.game || 'Cricket',
          eventType: teamData.eventType || EventType.TOURNAMENT,
          date: teamData.date ? new Date(teamData.date) : new Date(),
          time: teamData.time || '',
          maxPlayers: teamData.maxPlayers || 11,
          chat: teamData.chat || [],
          isPrivate: teamData.isPrivate || false,
          stats: {
            matches: teamData.stats?.matches || 0,
            wins: teamData.stats?.wins || 0,
            losses: teamData.stats?.losses || 0,
            points: teamData.stats?.points || 0,
          }
        };

        // Only process if the team has players
        if (Array.isArray(team.playersIds)) {
          team.playersIds.forEach((playerId) => {
            if (!playerTeams[playerId]) {
              playerTeams[playerId] = [];
            }
            playerTeams[playerId].push(team.name);
          });
        }
      });
      
      setPlayersInOtherTeams(playerTeams);
    } catch (error) {
      console.error('Error loading players in other teams:', error);
      Alert.alert('Error', 'Failed to load players from other teams');
    }
  };

  const toggleUserSelection = (userId: string) => {
    if (playersInOtherTeams[userId] && !allowSelectFromOtherTeams) {
      Alert.alert(
        'Player in Other Team',
        'This player is already in another team. Do you want to enable selection of players from other teams?',
        [
          {
            text: 'Cancel',
            style: 'cancel'
          },
          {
            text: 'Enable',
            onPress: () => {
              setAllowSelectFromOtherTeams(true);
              setSelectedUsers([...selectedUsers, userId]);
            }
          }
        ]
      );
      return;
    }

    if (selectedUsers.includes(userId)) {
      setSelectedUsers(selectedUsers.filter(id => id !== userId));
    } else {
      setSelectedUsers([...selectedUsers, userId]);
    }
  };

  const renderUserItem = ({ item }: { item: User }) => {
    const isSelected = selectedUsers.includes(item.id);
    const teamsIn = playersInOtherTeams[item.id];
    const isInOtherTeam = teamsIn && teamsIn.length > 0;

    return (
      <TouchableOpacity 
        style={[
          styles.userItem, 
          isSelected && styles.selectedUserItem,
          isInOtherTeam && !allowSelectFromOtherTeams && styles.userItemInOtherTeam
        ]}
        onPress={() => toggleUserSelection(item.id)}
      >
        <View style={styles.userAvatarContainer}>
          {item.image ? (
            <Image 
              source={{ uri: item.image }} 
              style={styles.userAvatar} 
            />
          ) : (
            <View style={styles.userAvatarPlaceholder}>
              <Text style={styles.avatarPlaceholderText}>
                {item.name ? item.name.charAt(0).toUpperCase() : 'U'}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.name || 'Unnamed User'}</Text>
          <Text style={styles.userEmail}>{item.email}</Text>
          {item.skillLevel && (
            <Text style={styles.userSkill}>{item.skillLevel}</Text>
          )}
          {isInOtherTeam && (
            <View style={styles.otherTeamsContainer}>
              {teamsIn.map((teamName, index) => (
                <View key={index} style={styles.otherTeamBadge}>
                  <Text style={styles.otherTeamBadgeText}>{teamName}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
        <MaterialIcons 
          name={isSelected ? "check-circle" : "radio-button-unchecked"} 
          size={24} 
          color={isSelected ? "#2196F3" : isInOtherTeam && !allowSelectFromOtherTeams ? "#666666" : "#CCCCCC"} 
        />
      </TouchableOpacity>
    );
  };

  const resetFilters = () => {
    setFilters({
      game: '',
      skillLevel: '',
      skillCategory: 'all'
    });
  };
  
  const handleFilterChange = (filterType: 'game' | 'skillLevel' | 'skillCategory', value: string) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: value === prev[filterType] ? '' : value
    }));
  };

  // Helper function to group skill levels by category
  const getSkillLevelsByCategory = () => {
    const generalSkills = [SkillLevel.Beginner, SkillLevel.Intermediate, SkillLevel.Advanced];
    
    const cricketSkills = [
      SkillLevel.BATSMAN, 
      SkillLevel.BOWLER, 
      SkillLevel.ALL_ROUNDER, 
      SkillLevel.WICKET_KEEPER
    ];
    
    const footballSkills = [
      SkillLevel.Goalkeeper, SkillLevel.GOALKEEPER,
      SkillLevel.Striker, SkillLevel.STRIKER, SkillLevel.striker,
      SkillLevel.midfielder, SkillLevel.Midfielder, SkillLevel.MIDFIELDER,
      SkillLevel.defender, SkillLevel.Defender, SkillLevel.DEFENDER,
      SkillLevel.FORWARD, SkillLevel.forward, SkillLevel.Forward,
      SkillLevel.WINGER, SkillLevel.winger, SkillLevel.Winger
    ];
    
    switch(filters.skillCategory) {
      case 'general':
        return generalSkills;
      case 'cricket':
        return cricketSkills;
      case 'football':
        return footballSkills;
      default:
        return [...generalSkills, ...cricketSkills, ...footballSkills];
    }
  };

  const createNewUser = async () => {
    if (!newUser.name || !newUser.email) {
      Alert.alert('Error', 'Please enter name and email');
      return;
    }

    // Simple email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newUser.email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    try {
      setLoadingUsers(true);
      const db = getFirestore();
      
      // Check if user with this email already exists in Firestore
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', newUser.email));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        Alert.alert('Error', 'A user with this email already exists');
        setLoadingUsers(false);
        return;
      }
      
      let newUserId;
      
      // Instead of creating the auth account directly, which logs out the current user,
      // we'll just create a Firestore user and handle the invitation separately
      if (sendInviteEmail) {
        // Just generate a document ID for the new user
        newUserId = doc(collection(db, 'users')).id;
        
        // TODO: In a real app, you'd send an email invite via a server function
        // For now, we'll just show a message that would normally be sent
        Alert.alert(
          'Invitation Info',
          `In a production app, an email would be sent to ${newUser.email} with instructions to join the team.`
        );
      } else {
        // Just generate a document ID for Firestore
        newUserId = doc(collection(db, 'users')).id;
      }
      
      // Create the new user in Firestore
      const userData: User = {
        id: newUserId,
        name: newUser.name,
        email: newUser.email,
        skillLevel: newUser.skillLevel,
        preferredGames: newUser.preferredGames || ['Cricket'],
      };
      
      await setDoc(doc(db, 'users', newUserId), userData);
      
      // Add the new user to selected users
      setSelectedUsers([...selectedUsers, newUserId]);
      
      // Add to local state
      setUsers([...users, userData]);
      setUsersMap(prev => ({...prev, [newUserId]: userData}));
      
      // Reset form and close modal
      setNewUser({
        name: '',
        email: '',
        skillLevel: SkillLevel.Beginner,
        preferredGames: ['Cricket'],
      });
      setShowCreateUserForm(false);
      
      Alert.alert('Success', 'New user profile created and added to selection');
    } catch (error) {
      console.error('Error creating new user:', error);
      Alert.alert('Error', 'Failed to create new user');
    } finally {
      setLoadingUsers(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <TouchableOpacity
        style={styles.createButton}
        onPress={() => setShowCreateForm(true)}
      >
        <LinearGradient
          colors={['#FF9F45', '#D494FF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.createButtonGradient}
        >
          <View style={styles.createButtonInner}>
            <MaterialIcons name="add" size={24} color="#FF9F45" />
            <Text style={styles.createButtonText}>Create Team</Text>
          </View>
        </LinearGradient>
      </TouchableOpacity>

      {showCreateForm && (
        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Team Name"
            placeholderTextColor="#666666"
            value={newTeam.name}
            onChangeText={(text) => setNewTeam({ ...newTeam, name: text })}
          />
          <TouchableOpacity style={styles.submitButton} onPress={handleCreateTeam}>
            <LinearGradient
              colors={['#FF9F45', '#D494FF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.submitButtonGradient}
            >
              <Text style={styles.submitButtonText}>Create</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      {teams.map((team) => (
        <View key={team.id} style={styles.teamCard}>
          <View style={styles.teamHeader}>
            <Text style={styles.teamName}>{team.name}</Text>
            <View style={styles.teamStats}>
              <View style={styles.statItem}>
                <MaterialIcons name="group" size={16} color="#666666" />
                <Text style={styles.statText}>{team.playersIds.length} Players</Text>
              </View>
              <View style={styles.statItem}>
                <MaterialIcons name="sports" size={16} color="#666666" />
                <Text style={styles.statText}>{team.stats.matches} Matches</Text>
              </View>
              <View style={styles.statItem}>
                <MaterialIcons name="emoji-events" size={16} color="#666666" />
                <Text style={styles.statText}>{team.stats.wins} Wins</Text>
              </View>
            </View>
            
            <TouchableOpacity
              style={styles.addPlayerButton}
              onPress={() => {
                setSelectedTeam(team);
                setShowAddPlayerForm(true);
              }}
            >
              <LinearGradient
                colors={['#FF9F45', '#D494FF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.addPlayerGradient}
              >
                <View style={styles.addPlayerInner}>
                  <MaterialIcons name="person-add" size={18} color="#FF9F45" />
                  <Text style={styles.addPlayerButtonText}>Add Player</Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          <View style={styles.playersList}>
            <View style={styles.playersHeader}>
              <Text style={styles.playersTitle}>Players</Text>
              <LinearGradient
                colors={['#FF9F45', '#D494FF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.titleUnderline}
              />
            </View>
            
            {team.playersIds.map((playerId) => (
              <View key={playerId} style={styles.playerCard}>
                <View style={styles.playerAvatarContainer}>
                  {usersMap[playerId]?.image ? (
                    <Image 
                      source={{ uri: usersMap[playerId].image }} 
                      style={styles.playerAvatar}
                    />
                  ) : (
                    <View style={styles.playerAvatarPlaceholder}>
                      <MaterialIcons name="person" size={20} color="#666666" />
                    </View>
                  )}
                </View>
                <View style={styles.playerInfo}>
                  <Text style={styles.playerName}>
                    {usersMap[playerId]?.name || 'Unknown Player'}
                  </Text>
                  <Text style={styles.playerEmail}>
                    {usersMap[playerId]?.email || ''}
                  </Text>
                  {team.captain === playerId && (
                    <View style={styles.captainBadge}>
                      <Text style={styles.captainBadgeText}>Captain</Text>
                    </View>
                  )}
                </View>
                {!team.captain && (
                  <TouchableOpacity
                    style={styles.setCaptainButton}
                    onPress={() => handleSetCaptain(team.id, playerId)}
                  >
                    <Text style={styles.setCaptainButtonText}>Make Captain</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        </View>
      ))}

      <Modal visible={showCreateUserForm} animationType="slide">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Create New User</Text>
            <LinearGradient
              colors={['#FF9F45', '#D494FF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.modalTitleUnderline}
            />
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter name"
                placeholderTextColor="#666666"
                value={newUser.name}
                onChangeText={(text) => setNewUser({ ...newUser, name: text })}
              />
            </View>
            
            <View style={styles.formGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter email"
                placeholderTextColor="#666666"
                value={newUser.email}
                onChangeText={(text) => setNewUser({ ...newUser, email: text })}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
            
            <View style={styles.formGroup}>
              <Text style={styles.label}>Skill Level</Text>
              <View style={styles.skillCategoryButtons}>
                {[
                  { id: 'all', label: 'All Skills' },
                  { id: 'general', label: 'General' },
                  { id: 'cricket', label: 'Cricket' },
                  { id: 'football', label: 'Football' }
                ].map(category => (
                  <TouchableOpacity
                    key={category.id}
                    style={[
                      styles.skillCategoryButton,
                      filters.skillCategory === category.id && styles.skillCategoryButtonActive
                    ]}
                    onPress={() => handleFilterChange('skillCategory', category.id)}
                  >
                    <Text
                      style={[
                        styles.skillCategoryButtonText,
                        filters.skillCategory === category.id && styles.skillCategoryButtonTextActive
                      ]}
                    >
                      {category.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false} 
                style={styles.skillLevelContainer}
              >
                {getSkillLevelsByCategory().map(skill => (
                  <TouchableOpacity
                    key={skill}
                    style={[
                      styles.filterOption,
                      newUser.skillLevel === skill && styles.filterOptionActive
                    ]}
                    onPress={() => setNewUser({ ...newUser, skillLevel: skill })}
                  >
                    <Text
                      style={[
                        styles.filterOptionText,
                        newUser.skillLevel === skill && styles.filterOptionTextActive
                      ]}
                    >
                      {skill}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            
            <View style={styles.formGroup}>
              <Text style={styles.label}>Game Preferences</Text>
              <View style={styles.gamePreferencesContainer}>
                {['Cricket', 'Football', 'Basketball', 'Volleyball'].map(game => {
                  const isSelected = newUser.preferredGames?.includes(game) || false;
                  return (
                    <TouchableOpacity
                      key={game}
                      style={[
                        styles.filterOption,
                        isSelected && styles.filterOptionActive
                      ]}
                      onPress={() => {
                        const currentGames = newUser.preferredGames || [];
                        const updatedGames = isSelected
                          ? currentGames.filter(g => g !== game)
                          : [...currentGames, game];
                        setNewUser({ ...newUser, preferredGames: updatedGames });
                      }}
                    >
                      <Text
                        style={[
                          styles.filterOptionText,
                          isSelected && styles.filterOptionTextActive
                        ]}
                      >
                        {game}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
            
            <View style={styles.formGroup}>
              <View style={styles.switchContainer}>
                <Switch
                  value={sendInviteEmail}
                  onValueChange={setSendInviteEmail}
                  trackColor={{ false: "#333333", true: "#FF9F45" }}
                  thumbColor={sendInviteEmail ? "#FFFFFF" : "#666666"}
                />
                <Text style={styles.switchLabel}>
                  Create full account and send invitation email
                </Text>
              </View>
              
              {sendInviteEmail && (
                <View style={styles.infoBox}>
                  <MaterialIcons name="info-outline" size={18} color="#FF9F45" />
                  <Text style={styles.infoText}>
                    This will create a user account and send an email to set a password. The user can then log in to the app with this email.
                  </Text>
                </View>
              )}
            </View>
          </ScrollView>
          
          <View style={styles.modalActions}>
            <TouchableOpacity 
              style={styles.submitButton} 
              onPress={createNewUser}
              disabled={loadingUsers}
            >
              <LinearGradient
                colors={['#FF9F45', '#D494FF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.submitButtonGradient}
              >
                {loadingUsers ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.submitButtonText}>Create User</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowCreateUserForm(false)}
              disabled={loadingUsers}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showAddPlayerForm} animationType="slide">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Players</Text>
            <LinearGradient
              colors={['#FF9F45', '#D494FF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.modalTitleUnderline}
            />
          </View>

          <View style={styles.searchContainer}>
            <View style={styles.filterContainer}>
              <TextInput
                style={styles.searchInput}
                placeholder="Search players by name..."
                placeholderTextColor="#666666"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              
              <TouchableOpacity
                style={[styles.filterButton, showFilters && styles.filterButtonActive]}
                onPress={() => setShowFilters(!showFilters)}
              >
                <MaterialIcons
                  name="filter-list"
                  size={24}
                  color={showFilters ? "#FFFFFF" : "#FF9F45"}
                />
              </TouchableOpacity>
            </View>
          </View>
          
          <View style={styles.otherTeamsToggleContainer}>
            <Switch
              value={allowSelectFromOtherTeams}
              onValueChange={setAllowSelectFromOtherTeams}
              trackColor={{ false: "#333333", true: "#FF9F45" }}
              thumbColor={allowSelectFromOtherTeams ? "#FFFFFF" : "#666666"}
            />
            <Text style={styles.otherTeamsToggleLabel}>
              Allow selecting players from other teams
            </Text>
          </View>
          
          {showFilters && (
            <View style={styles.filtersPanel}>
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>Game</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterOptions}>
                  {['Cricket', 'Football', 'Basketball', 'Volleyball'].map(game => (
                    <TouchableOpacity
                      key={game}
                      style={[
                        styles.filterOption,
                        filters.game === game && styles.filterOptionActive
                      ]}
                      onPress={() => handleFilterChange('game', game)}
                    >
                      <Text
                        style={[
                          styles.filterOptionText,
                          filters.game === game && styles.filterOptionTextActive
                        ]}
                      >
                        {game}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>Skill Level</Text>
                <View style={styles.skillCategoryButtons}>
                  {[
                    { id: 'all', label: 'All Skills' },
                    { id: 'general', label: 'General' },
                    { id: 'cricket', label: 'Cricket' },
                    { id: 'football', label: 'Football' }
                  ].map(category => (
                    <TouchableOpacity
                      key={category.id}
                      style={[
                        styles.skillCategoryButton,
                        filters.skillCategory === category.id && styles.skillCategoryButtonActive
                      ]}
                      onPress={() => handleFilterChange('skillCategory', category.id)}
                    >
                      <Text
                        style={[
                          styles.skillCategoryButtonText,
                          filters.skillCategory === category.id && styles.skillCategoryButtonTextActive
                        ]}
                      >
                        {category.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterOptions}>
                  {getSkillLevelsByCategory().map(skill => (
                    <TouchableOpacity
                      key={skill}
                      style={[
                        styles.filterOption,
                        filters.skillLevel === skill && styles.filterOptionActive
                      ]}
                      onPress={() => handleFilterChange('skillLevel', skill)}
                    >
                      <Text
                        style={[
                          styles.filterOptionText,
                          filters.skillLevel === skill && styles.filterOptionTextActive
                        ]}
                      >
                        {skill}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              
              <TouchableOpacity
                style={styles.resetFiltersButton}
                onPress={resetFilters}
              >
                <Text style={styles.resetFiltersText}>Reset Filters</Text>
              </TouchableOpacity>
            </View>
          )}
          
          <TouchableOpacity 
            style={styles.createUserButton}
            onPress={() => setShowCreateUserForm(true)}
          >
            <LinearGradient
              colors={['#FF9F45', '#D494FF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.createUserGradient}
            >
              <View style={styles.createUserInner}>
                <MaterialIcons name="person-add" size={18} color="#FF9F45" />
                <Text style={styles.createUserButtonText}>Create New User</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
          
          {loadingUsers ? (
            <ActivityIndicator size="large" color="#FF9F45" style={styles.loadingIndicator} />
          ) : (
            <FlatList
              data={users}
              renderItem={renderUserItem}
              keyExtractor={(item) => item.id}
              style={styles.usersList}
              contentContainerStyle={styles.usersListContent}
              ListEmptyComponent={
                <Text style={styles.emptyListText}>
                  No users found. Try a different search or filter, or create a new user.
                </Text>
              }
            />
          )}
          
          <View style={styles.modalActions}>
            <TouchableOpacity 
              style={styles.submitButton} 
              onPress={handleAddPlayers}
            >
              <LinearGradient
                colors={['#FF9F45', '#D494FF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.submitButtonGradient}
              >
                <Text style={styles.submitButtonText}>
                  Add {selectedUsers.length ? `(${selectedUsers.length})` : ''} Players
                </Text>
              </LinearGradient>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                setShowAddPlayerForm(false);
                setSelectedUsers([]);
              }}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  createButton: {
    margin: 16,
  },
  createButtonGradient: {
    borderRadius: 24,
    padding: 1,
  },
  createButtonInner: {
    backgroundColor: '#000000',
    borderRadius: 23,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  createButtonText: {
    color: '#FF9F45',
    fontSize: 16,
    fontWeight: 'bold',
  },
  form: {
    backgroundColor: '#1A1A1A',
    margin: 16,
    padding: 16,
    borderRadius: 12,
  },
  input: {
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: '#333333',
    padding: 12,
    marginBottom: 16,
    borderRadius: 8,
    color: '#FFFFFF',
  },
  submitButton: {
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 8,
  },
  submitButtonGradient: {
    padding: 16,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 'bold',
  },
  teamCard: {
    backgroundColor: '#1A1A1A',
    margin: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  teamHeader: {
    padding: 16,
  },
  teamName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  teamStats: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    color: '#666666',
    fontSize: 14,
  },
  addPlayerButton: {
    margin: 16,
  },
  addPlayerGradient: {
    borderRadius: 8,
    padding: 1,
  },
  addPlayerInner: {
    backgroundColor: '#000000',
    borderRadius: 7,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addPlayerButtonText: {
    color: '#FF9F45',
    fontSize: 14,
    fontWeight: 'bold',
  },
  playersList: {
    padding: 16,
  },
  playersHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  playersTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  titleUnderline: {
    height: 2,
    width: 40,
    borderRadius: 1,
  },
  playerCard: {
    backgroundColor: '#000000',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  playerAvatarContainer: {
    marginRight: 12,
  },
  playerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  playerAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#333333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  playerEmail: {
    fontSize: 14,
    color: '#666666',
  },
  captainBadge: {
    backgroundColor: 'rgba(255, 159, 69, 0.2)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  captainBadgeText: {
    color: '#FF9F45',
    fontSize: 12,
    fontWeight: '500',
  },
  setCaptainButton: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  setCaptainGradient: {
    padding: 8,
  },
  setCaptainButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
  modal: {
    flex: 1,
    backgroundColor: '#000000',
  },
  modalHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  modalTitleUnderline: {
    height: 2,
    width: 80,
    borderRadius: 1,
  },
  searchContainer: {
    padding: 16,
  },
  searchInput: {
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#333333',
    padding: 12,
    borderRadius: 8,
    color: '#FFFFFF',
    flex: 1,
    marginRight: 8,
  },
  filterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingTop: 0,
  },
  filterButton: {
    backgroundColor: '#1A1A1A',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333333',
  },
  filterButtonActive: {
    backgroundColor: '#FF9F45',
    borderColor: '#FF9F45',
  },
  filtersPanel: {
    backgroundColor: '#1A1A1A',
    margin: 16,
    marginTop: 0,
    padding: 16,
    borderRadius: 12,
  },
  filterSection: {
    marginBottom: 16,
  },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  filterOptions: {
    flexDirection: 'row',
    paddingBottom: 8,
  },
  filterOption: {
    backgroundColor: '#000000',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#333333',
  },
  filterOptionActive: {
    backgroundColor: '#FF9F45',
    borderColor: '#FF9F45',
  },
  filterOptionText: {
    color: '#666666',
    fontSize: 14,
  },
  filterOptionTextActive: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  skillCategoryButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  skillCategoryButton: {
    backgroundColor: '#000000',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#333333',
  },
  skillCategoryButtonActive: {
    backgroundColor: '#673AB7',
    borderColor: '#673AB7',
  },
  skillCategoryButtonText: {
    color: '#666666',
    fontSize: 12,
  },
  skillCategoryButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  resetFiltersButton: {
    alignSelf: 'center',
    marginTop: 12,
    padding: 8,
  },
  resetFiltersText: {
    color: '#FF4545',
    fontSize: 14,
    fontWeight: '500',
  },
  createUserButton: {
    margin: 16,
    marginTop: 0,
  },
  createUserGradient: {
    borderRadius: 8,
    padding: 1,
  },
  createUserInner: {
    backgroundColor: '#000000',
    borderRadius: 7,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  createUserButtonText: {
    color: '#FF9F45',
    fontSize: 14,
    fontWeight: 'bold',
  },
  usersList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  usersListContent: {
    paddingBottom: 16,
  },
  userItem: {
    backgroundColor: '#1A1A1A',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectedUserItem: {
    backgroundColor: '#333333',
  },
  userAvatarContainer: {
    marginRight: 12,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  userAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#333333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarPlaceholderText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#666666',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 4,
  },
  userSkill: {
    color: '#FF9F45',
    fontSize: 12,
  },
  emptyListText: {
    textAlign: 'center',
    color: '#666666',
    fontSize: 14,
    marginTop: 32,
  },
  modalActions: {
    padding: 16,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#1A1A1A',
  },
  cancelButton: {
    backgroundColor: '#f44336',
    padding: 16,
    borderRadius: 8,
    marginTop: 8,
  },
  cancelButtonText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 'bold',
  },
  roleButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  roleButton: {
    padding: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    marginBottom: 8,
  },
  roleButtonActive: {
    backgroundColor: '#e0e0e0',
  },
  skillLevelContainer: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  loadingIndicator: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#FFFFFF',
  },
  skillOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'white',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#DDDDDD',
  },
  skillOptionActive: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  skillOptionText: {
    color: '#555555',
  },
  skillOptionTextActive: {
    color: 'white',
    fontWeight: '500',
  },
  gamePreferencesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  gameOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'white',
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#DDDDDD',
  },
  gameOptionActive: {
    backgroundColor: '#FF9800',
    borderColor: '#FF9800',
  },
  gameOptionText: {
    color: '#555555',
  },
  gameOptionTextActive: {
    color: 'white',
    fontWeight: '500',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  checkboxLabel: {
    marginLeft: 10,
    fontSize: 16,
    color: '#333',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 159, 69, 0.1)',
    borderRadius: 8,
    padding: 12,
    alignItems: 'flex-start',
  },
  infoText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.7,
    lineHeight: 20,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  switchLabel: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    color: '#FFFFFF',
  },
  userItemInOtherTeam: {
    opacity: 0.5,
  },
  otherTeamsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4,
  },
  otherTeamBadge: {
    backgroundColor: 'rgba(255, 69, 69, 0.2)',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 12,
  },
  otherTeamBadgeText: {
    color: '#FF4545',
    fontSize: 12,
    fontWeight: '500',
  },
  otherTeamsToggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    padding: 12,
    marginHorizontal: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  otherTeamsToggleLabel: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    color: '#FFFFFF',
  },
}); 