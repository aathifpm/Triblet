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
  
  // Football specific roles
  GOALKEEPER = 'GOALKEEPER',
  DEFENDER = 'DEFENDER',
  MIDFIELDER = 'MIDFIELDER',
  FORWARD = 'FORWARD',
  STRIKER = 'STRIKER',
  WINGER = 'WINGER'
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
  number: number;
  skillLevel: SkillLevel;
  stats: {
    goals: number;
    assists: number;
    yellowCards: number;
    redCards: number;
    saves?: number;
    cleanSheets?: number;
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
  formation: string;
  captain?: string;
  stats: {
    matches: number;
    wins: number;
    draws: number;
    losses: number;
    goalsFor: number;
    goalsAgainst: number;
    points: number;
  };
}

export default function FootballTeam() {
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
    skillCategory: 'all' // 'all', 'general', 'football'
  });
  const [newTeam, setNewTeam] = useState<Partial<Team>>({
    name: '',
    game: 'Football',
    eventType: EventType.TOURNAMENT,
    maxPlayers: 11,
    playersIds: [],
    chat: [],
    isPrivate: false,
    formation: '4-4-2',
    stats: {
      matches: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      points: 0,
    }
  });
  const [newPlayer, setNewPlayer] = useState<Partial<Player>>({
    name: '',
    number: 1,
    skillLevel: SkillLevel.GOALKEEPER,
    stats: {
      goals: 0,
      assists: 0,
      yellowCards: 0,
      redCards: 0,
      saves: 0,
      cleanSheets: 0,
    },
  });
  const [showCreateUserForm, setShowCreateUserForm] = useState(false);
  const [newUser, setNewUser] = useState<Partial<User>>({
    name: '',
    email: '',
    skillLevel: SkillLevel.Beginner,
    preferredGames: ['Football'],
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
          game: data.game || 'Football',
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
          formation: data.formation || '4-4-2',
          captain: data.captain || '',
          stats: {
            matches: data.stats?.matches || 0,
            wins: data.stats?.wins || 0,
            draws: data.stats?.draws || 0,
            losses: data.stats?.losses || 0,
            goalsFor: data.stats?.goalsFor || 0,
            goalsAgainst: data.stats?.goalsAgainst || 0,
            points: data.stats?.points || 0,
          }
        });
      });
      
      console.log("Teams loaded:", teamsData.map(t => ({ 
        id: t.id, 
        name: t.name, 
        captain: t.captain,
        players: t.playersIds.length
      })));
      
      setTeams(teamsData);

      // Extract all player IDs from the teams and fetch their data
      const allPlayerIds = teamsData.flatMap(team => team.playersIds).filter(Boolean);
      if (allPlayerIds.length > 0) {
        await fetchUsersByIds(allPlayerIds);
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

  const handleCreateTeam = async () => {
    try {
      if (!newTeam.name || !currentUser) {
        Alert.alert('Error', 'Please enter team name');
        return;
      }

      const team = {
        ...newTeam,
        createdById: currentUser.uid || currentUser.id || '',
        tournamentId,
        date: new Date(),
        time: new Date().toLocaleTimeString(),
        playersIds: [],
        chat: [],
        stats: {
          matches: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          goalsFor: 0,
          goalsAgainst: 0,
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

  const handleAddPlayer = async () => {
    try {
      if (!selectedTeam || !newPlayer.name || !newPlayer.number || !newPlayer.skillLevel) {
        Alert.alert('Error', 'Please fill in all required fields');
        return;
      }

      const player: Player = {
        id: Math.random().toString(36).substr(2, 9),
        name: newPlayer.name,
        number: newPlayer.number,
        skillLevel: newPlayer.skillLevel as SkillLevel,
        stats: newPlayer.stats as Player['stats'],
      };

      const updateData = {
        playersIds: [...selectedTeam.playersIds, player.id]
      };

      await updateDoc(doc(db, 'teams', selectedTeam.id), updateData);
      setShowAddPlayerForm(false);
      setNewPlayer({
        name: '',
        number: selectedTeam.playersIds.length + 1,
        skillLevel: SkillLevel.GOALKEEPER,
        stats: {
          goals: 0,
          assists: 0,
          yellowCards: 0,
          redCards: 0,
          saves: 0,
          cleanSheets: 0,
        },
      });
      loadTeams();
    } catch (error) {
      console.error('Error adding player:', error);
      Alert.alert('Error', 'Failed to add player');
    }
  };

  const handleUpdateFormation = async (teamId: string, formation: string) => {
    try {
      if (!teamId) {
        Alert.alert('Error', 'Invalid team');
        return;
      }

      await updateDoc(doc(db, 'teams', teamId), { formation });
      loadTeams();
    } catch (error) {
      console.error('Error updating formation:', error);
      Alert.alert('Error', 'Failed to update formation');
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
      
      // Process user IDs in batches to avoid exceeding Firestore limits
      const batchSize = 10;
      for (let i = 0; i < userIds.length; i += batchSize) {
        const batch = userIds.slice(i, i + batchSize);
        
        // Get users by their document IDs
        for (const userId of batch) {
          try {
            const userDoc = await getDoc(doc(db, 'users', userId));
            if (userDoc.exists()) {
              const data = userDoc.data();
              usersData[userId] = {
                id: userDoc.id,
                name: data.name,
                email: data.email,
                image: data.image,
                skillLevel: data.skillLevel,
                preferredGames: data.preferredGames
              };
            }
          } catch (err) {
            console.error(`Error fetching user ${userId}:`, err);
          }
        }
      }
      
      setUsersMap(prev => ({...prev, ...usersData}));
    } catch (error) {
      console.error('Error fetching users by IDs:', error);
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

      console.log(`Setting captain for team ${teamId} to player ${playerId}`);
      
      // Get the team document first to verify it exists
      const teamRef = doc(db, 'teams', teamId);
      const teamDoc = await getDoc(teamRef);
      
      if (!teamDoc.exists()) {
        Alert.alert('Error', 'Team not found');
        return;
      }
      
      // Update the captain field
      await updateDoc(teamRef, {
        captain: playerId
      });
      
      // Update the local state immediately for better UX
      setTeams(currentTeams => 
        currentTeams.map(team => 
          team.id === teamId 
            ? { ...team, captain: playerId } 
            : team
        )
      );
      
      // Also update selectedTeam if it's the one being modified
      if (selectedTeam && selectedTeam.id === teamId) {
        setSelectedTeam({
          ...selectedTeam,
          captain: playerId
        });
      }
      
      Alert.alert('Success', 'Team captain has been updated');
      
      // Reload teams data to ensure everything is in sync
      loadTeams();
    } catch (error) {
      console.error('Error setting captain:', error);
      Alert.alert('Error', 'Failed to set captain. Please try again.');
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
          game: teamData.game || 'Football',
          eventType: teamData.eventType || EventType.TOURNAMENT,
          date: teamData.date ? new Date(teamData.date) : new Date(),
          time: teamData.time || '',
          maxPlayers: teamData.maxPlayers || 11,
          chat: teamData.chat || [],
          isPrivate: teamData.isPrivate || false,
          formation: teamData.formation || '4-4-2',
          stats: {
            matches: teamData.stats?.matches || 0,
            wins: teamData.stats?.wins || 0,
            draws: teamData.stats?.draws || 0,
            losses: teamData.stats?.losses || 0,
            goalsFor: teamData.stats?.goalsFor || 0,
            goalsAgainst: teamData.stats?.goalsAgainst || 0,
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
    
    const footballSkills = [
      SkillLevel.GOALKEEPER,
      SkillLevel.DEFENDER,
      SkillLevel.MIDFIELDER,
      SkillLevel.FORWARD,
      SkillLevel.STRIKER,
      SkillLevel.WINGER
    ];
    
    switch(filters.skillCategory) {
      case 'general':
        return generalSkills;
      case 'football':
        return footballSkills;
      default:
        return [...generalSkills, ...footballSkills];
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
        preferredGames: newUser.preferredGames || ['Football'],
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
        preferredGames: ['Football'],
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
          <View style={styles.formationSelector}>
            <Text style={styles.label}>Formation:</Text>
            <View style={styles.formationOptions}>
              {['4-4-2', '4-3-3', '3-5-2', '5-3-2', '4-2-3-1'].map((formation) => (
                <TouchableOpacity
                  key={formation}
                  style={[
                    styles.formationOption,
                    newTeam.formation === formation && styles.selectedFormation,
                  ]}
                  onPress={() => setNewTeam({ ...newTeam, formation: formation })}
                >
                  <Text style={styles.formationText}>{formation}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={styles.switchContainer}>
            <Text style={styles.switchLabel}>Private Team:</Text>
            <Switch
              value={newTeam.isPrivate || false}
              onValueChange={(value) => setNewTeam({ ...newTeam, isPrivate: value })}
              trackColor={{ false: '#333333', true: '#FF9F45' }}
              thumbColor={newTeam.isPrivate ? '#D494FF' : '#666666'}
            />
          </View>
          <TouchableOpacity style={styles.button} onPress={handleCreateTeam}>
            <LinearGradient
              colors={['#FF9F45', '#D494FF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.buttonGradient}
            >
              <Text style={styles.buttonText}>Create Team</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      {teams.length > 0 ? (
        <View style={styles.teamsList}>
          {teams.map((team) => (
            <View key={team.id} style={styles.teamCard}>
              <View style={{padding: 16}}>
                <Text style={styles.teamName}>{team.name}</Text>
                <Text style={styles.teamInfo}>Formation: {team.formation}</Text>
                <Text style={styles.teamInfo}>Players: {team.playersIds.length}/{team.maxPlayers}</Text>
                
                <TouchableOpacity
                  style={styles.teamButton}
                  onPress={() => {
                    setSelectedTeam(team);
                    setShowAddPlayerForm(true);
                  }}
                >
                  <LinearGradient
                    colors={['#FF9F45', '#D494FF']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.buttonGradient}
                  >
                    <Text style={styles.buttonText}>Add Players</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>

              {team.playersIds.length > 0 && (
                <View style={styles.playersSection}>
                  <Text style={styles.sectionTitle}>Team Players</Text>
                  {team.playersIds.map((playerId) => {
                    const user = usersMap[playerId];
                    const isCaptain = team.captain === playerId;
                    
                    return (
                      <View key={playerId} style={styles.playerItem}>
                        <View style={styles.userAvatarContainer}>
                          {user?.image ? (
                            <Image 
                              source={{ uri: user.image }} 
                              style={styles.userAvatar} 
                            />
                          ) : (
                            <View style={styles.userAvatarPlaceholder}>
                              <Text style={styles.avatarPlaceholderText}>
                                {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
                              </Text>
                            </View>
                          )}
                        </View>
                        <View style={styles.playerInfo}>
                          <View style={styles.playerNameRow}>
                            <Text style={styles.playerName}>{user?.name || 'Unknown Player'}</Text>
                            {isCaptain && (
                              <View style={styles.inlineCaptainBadge}>
                                <MaterialIcons name="star" size={16} color="#FFD700" />
                              </View>
                            )}
                          </View>
                          {user?.skillLevel && <Text style={styles.playerRole}>{user.skillLevel}</Text>}
                          {isCaptain && (
                            <View style={styles.captainBadge}>
                              <MaterialIcons name="star" size={16} color="#FFD700" />
                              <Text style={styles.captainText}>Captain</Text>
                            </View>
                          )}
                        </View>
                        {!isCaptain && (
                          <TouchableOpacity
                            style={styles.captainButton}
                            onPress={() => handleSetCaptain(team.id, playerId)}
                          >
                            <Text style={styles.captainButtonText}>Make Captain</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.emptyState}>
          <MaterialIcons name="sports-soccer" size={48} color="#666666" />
          <Text style={styles.emptyText}>No teams found</Text>
          <Text style={styles.emptySubText}>Create a team to get started</Text>
        </View>
      )}

      <Modal
        visible={showAddPlayerForm}
        animationType="slide"
        transparent={false}
      >
        <View style={{flex: 1, backgroundColor: '#000000'}}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Players to {selectedTeam?.name}</Text>
            <LinearGradient
              colors={['#FF9F45', '#D494FF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.modalTitleUnderline}
            />
            <TouchableOpacity onPress={() => setShowAddPlayerForm(false)}>
              <MaterialIcons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.filterContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search users by name or email"
              placeholderTextColor="#666666"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            <TouchableOpacity 
              style={[
                styles.filterButton,
                showFilters && styles.filterButtonActive
              ]}
              onPress={() => setShowFilters(!showFilters)}
            >
              <MaterialIcons name="filter-list" size={24} color={showFilters ? "#FFFFFF" : "#FF9F45"} />
            </TouchableOpacity>
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
            <View style={styles.filtersContainer}>
              <Text style={styles.filterTitle}>Filters</Text>
              
              <View style={styles.filterRow}>
                <Text style={styles.filterLabel}>Game:</Text>
                <View style={styles.filterOptions}>
                  <TouchableOpacity
                    style={[
                      styles.filterOption,
                      filters.game === 'Football' && styles.selectedFilterOption
                    ]}
                    onPress={() => handleFilterChange('game', 'Football')}
                  >
                    <Text style={[
                      styles.filterOptionText,
                      filters.game === 'Football' && styles.filterOptionTextActive
                    ]}>Football</Text>
                  </TouchableOpacity>
                </View>
              </View>
              
              <View style={styles.filterRow}>
                <Text style={styles.filterLabel}>Skill Category:</Text>
                <View style={styles.filterOptions}>
                  <TouchableOpacity
                    style={[
                      styles.filterOption,
                      filters.skillCategory === 'all' && styles.selectedFilterOption
                    ]}
                    onPress={() => handleFilterChange('skillCategory', 'all')}
                  >
                    <Text style={[
                      styles.filterOptionText,
                      filters.skillCategory === 'all' && styles.filterOptionTextActive
                    ]}>All</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.filterOption,
                      filters.skillCategory === 'general' && styles.selectedFilterOption
                    ]}
                    onPress={() => handleFilterChange('skillCategory', 'general')}
                  >
                    <Text style={[
                      styles.filterOptionText,
                      filters.skillCategory === 'general' && styles.filterOptionTextActive
                    ]}>General</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.filterOption,
                      filters.skillCategory === 'football' && styles.selectedFilterOption
                    ]}
                    onPress={() => handleFilterChange('skillCategory', 'football')}
                  >
                    <Text style={[
                      styles.filterOptionText,
                      filters.skillCategory === 'football' && styles.filterOptionTextActive
                    ]}>Football</Text>
                  </TouchableOpacity>
                </View>
              </View>
              
              <View style={styles.filterRow}>
                <Text style={styles.filterLabel}>Skill Level:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.skillLevelsScroll}>
                  <View style={styles.filterOptions}>
                    {getSkillLevelsByCategory().map((skill) => (
                      <TouchableOpacity
                        key={skill}
                        style={[
                          styles.filterOption,
                          filters.skillLevel === skill && styles.selectedFilterOption
                        ]}
                        onPress={() => handleFilterChange('skillLevel', skill)}
                      >
                        <Text style={[
                          styles.filterOptionText,
                          filters.skillLevel === skill && styles.filterOptionTextActive
                        ]}>{skill}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
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

          <View style={styles.createUserSection}>
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
                  <Text style={styles.createUserText}>Create New User</Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {loadingUsers ? (
            <ActivityIndicator size="large" color="#FF9F45" style={styles.loadingIndicator} />
          ) : (
            users.length > 0 ? (
              <FlatList
                data={users}
                keyExtractor={(item) => item.id}
                renderItem={renderUserItem}
                style={styles.usersList}
              />
            ) : (
              <View style={styles.noUsersContainer}>
                <Text style={styles.noUsersText}>No users found matching your criteria</Text>
              </View>
            )
          )}

          {selectedUsers.length > 0 && (
            <View style={styles.selectedCountContainer}>
              <Text style={styles.selectedCountText}>
                {selectedUsers.length} user{selectedUsers.length !== 1 ? 's' : ''} selected
              </Text>
            </View>
          )}

          <View style={{
            padding: 16,
            borderTopWidth: 1,
            borderTopColor: '#333333',
            gap: 8
          }}>
            <TouchableOpacity
              style={[styles.button, selectedUsers.length === 0 && styles.disabledButton]}
              onPress={handleAddPlayers}
              disabled={selectedUsers.length === 0}
            >
              <LinearGradient
                colors={['#FF9F45', '#D494FF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.buttonGradient}
              >
                <Text style={styles.buttonText}>
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

      <Modal
        visible={showCreateUserForm}
        animationType="slide"
        transparent={false}
      >
        <View style={{flex: 1, backgroundColor: '#000000'}}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Create New User</Text>
            <LinearGradient
              colors={['#FF9F45', '#D494FF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.modalTitleUnderline}
            />
            <TouchableOpacity onPress={() => setShowCreateUserForm(false)}>
              <MaterialIcons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <ScrollView style={{flex: 1, padding: 16}}>
            <View style={{marginBottom: 16}}>
              <Text style={styles.label}>Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter name"
                placeholderTextColor="#666666"
                value={newUser.name}
                onChangeText={(text) => setNewUser({ ...newUser, name: text })}
              />
            </View>

            <View style={{marginBottom: 16}}>
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

            <View style={styles.skillLevelSelector}>
              <Text style={styles.label}>Skill Level:</Text>
              <View style={styles.skillCategoryButtons || styles.filterOptions}>
                {[
                  { id: 'all', label: 'All Skills' },
                  { id: 'general', label: 'General' },
                  { id: 'football', label: 'Football' }
                ].map(category => (
                  <TouchableOpacity
                    key={category.id}
                    style={[
                      styles.filterOption,
                      filters.skillCategory === category.id && styles.selectedFilterOption
                    ]}
                    onPress={() => handleFilterChange('skillCategory', category.id)}
                  >
                    <Text style={[
                      styles.filterOptionText,
                      filters.skillCategory === category.id && styles.filterOptionTextActive
                    ]}>
                      {category.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginTop: 12}}>
                <View style={styles.skillOptions}>
                  {getSkillLevelsByCategory().map((skill) => (
                    <TouchableOpacity
                      key={skill}
                      style={[
                        styles.skillOption,
                        newUser.skillLevel === skill && styles.selectedSkillOption,
                      ]}
                      onPress={() => setNewUser({ ...newUser, skillLevel: skill })}
                    >
                      <Text style={[
                        styles.filterOptionText,
                        newUser.skillLevel === skill && styles.filterOptionTextActive
                      ]}>{skill}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            <View style={{marginBottom: 16}}>
              <Text style={styles.label}>Game Preferences</Text>
              <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8}}>
                {['Football', 'Cricket', 'Basketball', 'Volleyball'].map(game => {
                  const isSelected = newUser.preferredGames?.includes(game) || false;
                  return (
                    <TouchableOpacity
                      key={game}
                      style={[
                        styles.filterOption,
                        isSelected && styles.selectedFilterOption
                      ]}
                      onPress={() => {
                        const currentGames = newUser.preferredGames || [];
                        const updatedGames = isSelected
                          ? currentGames.filter(g => g !== game)
                          : [...currentGames, game];
                        setNewUser({ ...newUser, preferredGames: updatedGames });
                      }}
                    >
                      <Text style={[
                        styles.filterOptionText,
                        isSelected && styles.filterOptionTextActive
                      ]}>
                        {game}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={{marginBottom: 16}}>
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
                    This will create a user profile that can be added to teams. In a production app, an invitation email would be sent to the user.
                  </Text>
                </View>
              )}
            </View>
          </ScrollView>
          
          <View style={{
            padding: 16,
            borderTopWidth: 1,
            borderTopColor: '#333333',
            gap: 8
          }}>
            <TouchableOpacity
              style={styles.button}
              onPress={createNewUser}
              disabled={loadingUsers}
            >
              <LinearGradient
                colors={['#FF9F45', '#D494FF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.buttonGradient}
              >
                {loadingUsers ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.buttonText}>Create User</Text>
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
  formationSelector: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#FFFFFF',
  },
  formationOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  formationOption: {
    backgroundColor: '#000000',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333333',
  },
  selectedFormation: {
    backgroundColor: '#FF9F45',
    borderColor: '#FF9F45',
  },
  formationText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  switchLabel: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    color: '#FFFFFF',
  },
  button: {
    marginBottom: 8,
    borderRadius: 8,
    overflow: 'hidden',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonGradient: {
    padding: 16,
    alignItems: 'center',
  },
  teamsList: {
    marginTop: 16,
  },
  teamCard: {
    backgroundColor: '#1A1A1A',
    margin: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  teamName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  teamInfo: {
    color: '#666666',
    fontSize: 14,
    marginBottom: 8,
  },
  buttonGroup: {
    marginTop: 16,
    marginBottom: 16,
  },
  teamButton: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  playersSection: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#333333',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  playerItem: {
    backgroundColor: '#000000',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  playerInfo: {
    flex: 1,
  },
  playerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  playerRole: {
    color: '#666666',
    fontSize: 14,
  },
  captainButton: {
    backgroundColor: 'rgba(255, 159, 69, 0.2)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  captainButtonText: {
    color: '#FF9F45',
    fontSize: 12,
    fontWeight: 'bold',
  },
  captainBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  captainText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFD700',
    marginLeft: 4,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    marginTop: 64,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubText: {
    color: '#666666',
    fontSize: 14,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#000000',
    width: '90%',
    maxHeight: '90%',
    borderRadius: 12,
    overflow: 'hidden',
  },
  modalHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  modalTitleUnderline: {
    height: 2,
    width: 80,
    borderRadius: 1,
    marginTop: 4,
  },
  searchContainer: {
    padding: 16,
  },
  filterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
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
  },
  filterButton: {
    backgroundColor: '#1A1A1A',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333333',
    marginLeft: 8,
  },
  filterButtonActive: {
    backgroundColor: '#FF9F45',
    borderColor: '#FF9F45',
  },
  filtersContainer: {
    backgroundColor: '#1A1A1A',
    margin: 16,
    padding: 16,
    borderRadius: 12,
  },
  filterTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  filterRow: {
    marginBottom: 16,
  },
  filterLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterOption: {
    backgroundColor: '#000000',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#333333',
  },
  selectedFilterOption: {
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
  skillLevelsScroll: {
    marginTop: 8,
  },
  resetFiltersButton: {
    alignSelf: 'center',
    marginTop: 16,
    padding: 8,
  },
  resetFiltersText: {
    color: '#FF4545',
    fontSize: 14,
    fontWeight: '500',
  },
  createUserSection: {
    padding: 16,
  },
  createUserButton: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  createUserGradient: {
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
  createUserText: {
    color: '#FF9F45',
    fontSize: 14,
    fontWeight: 'bold',
  },
  createUserActionButton: {
    borderRadius: 8,
    overflow: 'hidden',
    marginTop: 16,
  },
  createUserActionGradient: {
    padding: 16,
    alignItems: 'center',
  },
  createUserActionText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingIndicator: {
    marginVertical: 16,
  },
  usersList: {
    maxHeight: 350,
    padding: 16,
  },
  noUsersContainer: {
    padding: 16,
    alignItems: 'center',
  },
  noUsersText: {
    color: '#666666',
    fontSize: 14,
    textAlign: 'center',
  },
  selectedCountContainer: {
    padding: 16,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#333333',
  },
  selectedCountText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF9F45',
  },
  addPlayersButton: {
    borderRadius: 8,
    overflow: 'hidden',
    margin: 16,
  },
  addPlayersGradient: {
    padding: 16,
    alignItems: 'center',
  },
  addPlayersText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  disabledButton: {
    opacity: 0.5,
  },
  skillLevelSelector: {
    marginBottom: 16,
  },
  skillCategoryButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  skillOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  skillOption: {
    backgroundColor: '#000000',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#333333',
  },
  selectedSkillOption: {
    backgroundColor: '#FF9F45',
    borderColor: '#FF9F45',
  },
  skillOptionText: {
    color: '#666666',
    fontSize: 14,
  },
  skillOptionTextActive: {
    color: '#FFFFFF',
    fontWeight: '500',
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
  userItemInOtherTeam: {
    opacity: 0.6,
  },
  userAvatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    overflow: 'hidden',
  },
  userAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
  },
  userAvatarPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
    backgroundColor: '#333333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarPlaceholderText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  userEmail: {
    fontSize: 14,
    color: '#666666',
  },
  userSkill: {
    fontSize: 12,
    color: '#FF9F45',
    marginTop: 4,
  },
  otherTeamsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
    gap: 4,
  },
  otherTeamBadge: {
    backgroundColor: 'rgba(255, 69, 69, 0.2)',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 12,
  },
  otherTeamBadgeText: {
    fontSize: 10,
    color: '#FF4545',
    fontWeight: '500',
  },
  inlineCaptainBadge: {
    marginLeft: 4,
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
  cancelButton: {
    backgroundColor: '#333333',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
}); 