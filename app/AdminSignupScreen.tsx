import React, { useState, useRef } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Image,
  Alert,
  ScrollView,
  ActivityIndicator,
  Dimensions
} from 'react-native'
import { useRouter } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import GradientText from '@/components/GradientText'
import { registerWithEmailAndPassword, updateUserProfile } from './firebase/auth'
import { createUser, UserRole } from './firebase/firestore'
import { collection, addDoc } from 'firebase/firestore'
import { getFirestore } from 'firebase/firestore'

const { width } = Dimensions.get('window')

export default function AdminSignupScreen() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [step, setStep] = useState(1)
  
  // Form fields - Personal Information
  const [mobileNumber, setMobileNumber] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // Form fields - Venue Information
  const [venueName, setVenueName] = useState('')
  const [venueAddress, setVenueAddress] = useState('')
  const [venueSports, setVenueSports] = useState('')
  const [peakHourRate, setPeakHourRate] = useState('')
  const [offPeakHourRate, setOffPeakHourRate] = useState('')

  // Validation states - Personal Information
  const [mobileNumberError, setMobileNumberError] = useState('')
  const [fullNameError, setFullNameError] = useState('')
  const [emailError, setEmailError] = useState('')
  const [passwordError, setPasswordError] = useState('')

  // Validation states - Venue Information
  const [venueNameError, setVenueNameError] = useState('')
  const [venueAddressError, setVenueAddressError] = useState('')
  const [venueSportsError, setVenueSportsError] = useState('')
  const [peakHourRateError, setPeakHourRateError] = useState('')
  const [offPeakHourRateError, setOffPeakHourRateError] = useState('')
  
  // Refs for focus management
  const fullNameRef = useRef<TextInput>(null)
  const emailRef = useRef<TextInput>(null)
  const passwordRef = useRef<TextInput>(null)
  const venueNameRef = useRef<TextInput>(null)
  const venueAddressRef = useRef<TextInput>(null)
  const venueSportsRef = useRef<TextInput>(null)
  const peakHourRateRef = useRef<TextInput>(null)
  const offPeakHourRateRef = useRef<TextInput>(null)

  // Email validation function
  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Phone validation function
  const isValidPhone = (phone: string) => {
    const phoneRegex = /^\d{10}$/;
    return phoneRegex.test(phone);
  };

  // Password strength checker
  const getPasswordStrength = (password: string): {strength: 'weak' | 'medium' | 'strong', message: string} => {
    if (password.length < 6) {
      return { strength: 'weak', message: 'Password is too short' };
    }
    
    let score = 0;
    if (password.length >= 8) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;
    
    if (score === 4) return { strength: 'strong', message: 'Strong password' };
    if (score >= 2) return { strength: 'medium', message: 'Medium strength password' };
    return { strength: 'weak', message: 'Weak password' };
  };

  const validateField = (field: string, value: string): boolean => {
    switch (field) {
      case 'mobileNumber':
        if (!value) {
          setMobileNumberError('Mobile number is required');
          return false;
        } else if (!isValidPhone(value)) {
          setMobileNumberError('Please enter a valid 10-digit mobile number');
          return false;
        }
        setMobileNumberError('');
        return true;
      
      case 'fullName':
        if (!value) {
          setFullNameError('Full name is required');
          return false;
        } else if (value.length < 3) {
          setFullNameError('Name must be at least 3 characters');
          return false;
        }
        setFullNameError('');
        return true;
      
      case 'email':
        if (!value) {
          setEmailError('Email is required');
          return false;
        } else if (!isValidEmail(value)) {
          setEmailError('Please enter a valid email address');
          return false;
        }
        setEmailError('');
        return true;
      
      case 'password':
        if (!value) {
          setPasswordError('Password is required');
          return false;
        } else if (value.length < 6) {
          setPasswordError('Password must be at least 6 characters');
          return false;
        }
        const strength = getPasswordStrength(value);
        if (strength.strength === 'weak') {
          setPasswordError(strength.message);
          return false;
        }
        setPasswordError('');
        return true;
      
      case 'venueName':
        if (!value) {
          setVenueNameError('Venue name is required');
          return false;
        } else if (value.length < 3) {
          setVenueNameError('Venue name must be at least 3 characters');
          return false;
        }
        setVenueNameError('');
        return true;

      case 'venueAddress':
        if (!value) {
          setVenueAddressError('Venue address is required');
          return false;
        } else if (value.length < 10) {
          setVenueAddressError('Please enter a complete address');
          return false;
        }
        setVenueAddressError('');
        return true;

      case 'venueSports':
        if (!value) {
          setVenueSportsError('Sports/games are required');
          return false;
        }
        setVenueSportsError('');
        return true;

      case 'peakHourRate':
        if (!value) {
          setPeakHourRateError('Peak hour rate is required');
          return false;
        } else if (isNaN(Number(value)) || Number(value) <= 0) {
          setPeakHourRateError('Please enter a valid amount');
          return false;
        }
        setPeakHourRateError('');
        return true;

      case 'offPeakHourRate':
        if (!value) {
          setOffPeakHourRateError('Off-peak hour rate is required');
          return false;
        } else if (isNaN(Number(value)) || Number(value) <= 0) {
          setOffPeakHourRateError('Please enter a valid amount');
          return false;
        }
        setOffPeakHourRateError('');
        return true;
      
      default:
        return true;
    }
  };

  const handleContinue = () => {
    if (step === 1) {
      const isPhoneValid = validateField('mobileNumber', mobileNumber);
      const isNameValid = validateField('fullName', fullName);
      const isEmailValid = validateField('email', email);
      const isPasswordValid = validateField('password', password);
      
      if (isPhoneValid && isNameValid && isEmailValid && isPasswordValid) {
        setStep(2);
      }
    } else if (step === 2) {
      const isVenueNameValid = validateField('venueName', venueName);
      const isVenueAddressValid = validateField('venueAddress', venueAddress);
      const isVenueSportsValid = validateField('venueSports', venueSports);
      const isPeakRateValid = validateField('peakHourRate', peakHourRate);
      const isOffPeakRateValid = validateField('offPeakHourRate', offPeakHourRate);
      
      if (isVenueNameValid && isVenueAddressValid && isVenueSportsValid && isPeakRateValid && isOffPeakRateValid) {
        handleSignup();
      }
    }
  };

  const handleSignup = async () => {
    setIsLoading(true);
    setError('');

    try {
      const { user, error: registerError } = await registerWithEmailAndPassword(email, password);
      
      if (registerError) {
        Alert.alert('Registration Error', registerError);
        setError(registerError);
      } else if (user) {
        // Update user profile with the full name
        await updateUserProfile(fullName);
        
        // Create user document in Firestore with ADMIN role
        const userData = {
          name: fullName,
          email: user.email,
          phone: mobileNumber,
          role: UserRole.ADMIN,
          createdAt: new Date(),
          lastLogin: new Date()
        };
        
        await createUser(user.uid, userData);
        
        // Create the venue document
        const sportsArray = venueSports.split(',').map(sport => sport.trim());
        
        // Create venue in Firestore
        const db = getFirestore();
        const venueData = {
          ownerId: user.uid,
          name: venueName,
          location: {
            address: venueAddress,
            latitude: 0, // These can be updated later
            longitude: 0
          },
          gamesAvailable: sportsArray,
          pricing: {
            peakHours: parseFloat(peakHourRate),
            offPeakHours: parseFloat(offPeakHourRate)
          },
          amenities: [],
          images: [],
          availableSlots: [],
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        await addDoc(collection(db, 'gamingArenas'), venueData);
        
        // Successfully registered and set up profile
        Alert.alert(
          'Success', 
          'Account and venue created successfully!',
          [
            {
              text: 'Continue to Login',
              onPress: () => router.push('/LoginScreen')
            }
          ]
        );
      }
    } catch (error) {
      console.error('Error during registration:', error);
      Alert.alert('Registration Error', 'Something went wrong. Please try again.');
      setError('Something went wrong during registration');
    } finally {
      setIsLoading(false);
    }
  };

  const renderPasswordStrengthBar = () => {
    if (!password) return null;
    
    const strength = getPasswordStrength(password);
    let barColor = '#ff5252';
    let widthValue = 0.33;
    
    if (strength.strength === 'medium') {
      barColor = '#FFA500';
      widthValue = 0.66;
    } else if (strength.strength === 'strong') {
      barColor = '#4CAF50';
      widthValue = 1;
    }
    
    return (
      <View style={styles.passwordStrengthContainer}>
        <View style={styles.passwordStrengthBar}>
          <View style={[styles.passwordStrengthFill, { width: `${widthValue * 100}%`, backgroundColor: barColor }]} />
        </View>
        <Text style={[styles.passwordStrengthText, { color: barColor }]}>
          {strength.message}
        </Text>
      </View>
    );
  };

  const goBack = () => {
    if (step === 2) {
      setStep(1);
    } else {
      router.back();
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.innerContainer}>
          <View style={styles.header}>
            <TouchableOpacity onPress={goBack} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="white" />
            </TouchableOpacity>
            <Text style={styles.title}>VENUE OWNER SIGNUP</Text>
            <View style={styles.progressIndicator}>
              <View style={[styles.progressDot, step >= 1 && styles.activeDot]} />
              <View style={styles.progressLine} />
              <View style={[styles.progressDot, step >= 2 && styles.activeDot]} />
            </View>
          </View>

          <View style={styles.formContainer}>
            <LinearGradient
              colors={['#FF9F45', '#D494FF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.welcomeGradientBorder}
            >
              <View style={styles.welcomeInner}>
                <GradientText style={styles.welcomeText}>
                  {step === 1 ? 'Welcome venue owner,' : 'Tell us about your venue'}
                </GradientText>
                <GradientText style={styles.subText}>
                  {step === 1 
                    ? "Let's get you set up to offer bookings." 
                    : "Let's add your venue to our platform."}
                </GradientText>
              </View>
            </LinearGradient>

            <View style={styles.logoContainer}>
              <Image
                source={require('../assets/images/TribletLogo.png')}
                style={styles.logo}
                resizeMode='contain'
              />
            </View>

            {step === 1 ? (
              <View style={styles.inputContainer}>
                <View>
                  <View style={[styles.inputWrapper, mobileNumberError ? styles.inputError : null]}>
                    <Ionicons name="call-outline" size={20} color="#666" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder='Your Mobile Number'
                      placeholderTextColor='#666'
                      keyboardType='phone-pad'
                      value={mobileNumber}
                      onChangeText={(text) => {
                        setMobileNumber(text);
                        validateField('mobileNumber', text);
                      }}
                      onSubmitEditing={() => fullNameRef.current?.focus()}
                      returnKeyType="next"
                      maxLength={10}
                    />
                  </View>
                  {mobileNumberError ? <Text style={styles.errorText}>{mobileNumberError}</Text> : null}
                </View>
                
                <View>
                  <View style={[styles.inputWrapper, fullNameError ? styles.inputError : null]}>
                    <Ionicons name="person-outline" size={20} color="#666" style={styles.inputIcon} />
                    <TextInput
                      ref={fullNameRef}
                      style={styles.input}
                      placeholder='Your Full Name'
                      placeholderTextColor='#666'
                      value={fullName}
                      onChangeText={(text) => {
                        setFullName(text);
                        validateField('fullName', text);
                      }}
                      onSubmitEditing={() => emailRef.current?.focus()}
                      returnKeyType="next"
                    />
                  </View>
                  {fullNameError ? <Text style={styles.errorText}>{fullNameError}</Text> : null}
                </View>

                <View>
                  <View style={[styles.inputWrapper, emailError ? styles.inputError : null]}>
                    <Ionicons name="mail-outline" size={20} color="#666" style={styles.inputIcon} />
                    <TextInput
                      ref={emailRef}
                      style={styles.input}
                      placeholder='Your Email Address'
                      placeholderTextColor='#666'
                      keyboardType='email-address'
                      autoCapitalize='none'
                      value={email}
                      onChangeText={(text) => {
                        setEmail(text);
                        validateField('email', text);
                      }}
                      onSubmitEditing={() => passwordRef.current?.focus()}
                      returnKeyType="next"
                    />
                  </View>
                  {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}
                </View>
                
                <View>
                  <View style={[styles.inputWrapper, passwordError ? styles.inputError : null]}>
                    <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
                    <TextInput
                      ref={passwordRef}
                      style={styles.input}
                      placeholder='Your Password'
                      placeholderTextColor='#666'
                      secureTextEntry={!showPassword}
                      value={password}
                      onChangeText={(text) => {
                        setPassword(text);
                        validateField('password', text);
                      }}
                      returnKeyType="done"
                    />
                    <TouchableOpacity 
                      style={styles.passwordToggle}
                      onPress={() => setShowPassword(!showPassword)}
                    >
                      <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#666" />
                    </TouchableOpacity>
                  </View>
                  {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}
                  {password ? renderPasswordStrengthBar() : null}
                </View>
              </View>
            ) : (
              <View style={styles.inputContainer}>
                <View>
                  <View style={[styles.inputWrapper, venueNameError ? styles.inputError : null]}>
                    <Ionicons name="business-outline" size={20} color="#666" style={styles.inputIcon} />
                    <TextInput
                      ref={venueNameRef}
                      style={styles.input}
                      placeholder='Venue Name'
                      placeholderTextColor='#666'
                      value={venueName}
                      onChangeText={(text) => {
                        setVenueName(text);
                        validateField('venueName', text);
                      }}
                      onSubmitEditing={() => venueAddressRef.current?.focus()}
                      returnKeyType="next"
                    />
                  </View>
                  {venueNameError ? <Text style={styles.errorText}>{venueNameError}</Text> : null}
                </View>
                
                <View>
                  <View style={[styles.inputWrapper, venueAddressError ? styles.inputError : null]}>
                    <Ionicons name="location-outline" size={20} color="#666" style={styles.inputIcon} />
                    <TextInput
                      ref={venueAddressRef}
                      style={styles.input}
                      placeholder='Venue Address'
                      placeholderTextColor='#666'
                      value={venueAddress}
                      onChangeText={(text) => {
                        setVenueAddress(text);
                        validateField('venueAddress', text);
                      }}
                      onSubmitEditing={() => venueSportsRef.current?.focus()}
                      returnKeyType="next"
                      multiline
                    />
                  </View>
                  {venueAddressError ? <Text style={styles.errorText}>{venueAddressError}</Text> : null}
                </View>

                <View>
                  <View style={[styles.inputWrapper, venueSportsError ? styles.inputError : null]}>
                    <Ionicons name="football-outline" size={20} color="#666" style={styles.inputIcon} />
                    <TextInput
                      ref={venueSportsRef}
                      style={styles.input}
                      placeholder='Sports/Games (comma separated)'
                      placeholderTextColor='#666'
                      value={venueSports}
                      onChangeText={(text) => {
                        setVenueSports(text);
                        validateField('venueSports', text);
                      }}
                      onSubmitEditing={() => peakHourRateRef.current?.focus()}
                      returnKeyType="next"
                    />
                  </View>
                  {venueSportsError ? <Text style={styles.errorText}>{venueSportsError}</Text> : null}
                </View>

                <View style={styles.rateContainer}>
                  <View style={styles.rateInputContainer}>
                    <View style={[styles.inputWrapper, styles.halfInput, peakHourRateError ? styles.inputError : null]}>
                      <Ionicons name="trending-up-outline" size={20} color="#666" style={styles.inputIcon} />
                      <TextInput
                        ref={peakHourRateRef}
                        style={styles.input}
                        placeholder='Peak Rate (₹)'
                        placeholderTextColor='#666'
                        keyboardType='numeric'
                        value={peakHourRate}
                        onChangeText={(text) => {
                          setPeakHourRate(text);
                          validateField('peakHourRate', text);
                        }}
                        onSubmitEditing={() => offPeakHourRateRef.current?.focus()}
                        returnKeyType="next"
                      />
                    </View>
                    <View style={[styles.inputWrapper, styles.halfInput, offPeakHourRateError ? styles.inputError : null]}>
                      <Ionicons name="trending-down-outline" size={20} color="#666" style={styles.inputIcon} />
                      <TextInput
                        ref={offPeakHourRateRef}
                        style={styles.input}
                        placeholder='Off-Peak Rate (₹)'
                        placeholderTextColor='#666'
                        keyboardType='numeric'
                        value={offPeakHourRate}
                        onChangeText={(text) => {
                          setOffPeakHourRate(text);
                          validateField('offPeakHourRate', text);
                        }}
                        returnKeyType="done"
                      />
                    </View>
                  </View>
                  <View style={styles.rateErrorContainer}>
                    {peakHourRateError ? <Text style={styles.errorText}>{peakHourRateError}</Text> : null}
                    {offPeakHourRateError ? <Text style={[styles.errorText, styles.rightError]}>{offPeakHourRateError}</Text> : null}
                  </View>
                </View>
              </View>
            )}

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <LinearGradient
              colors={['#FF9F45', '#D494FF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.continueGradientBorder}
            >
              <TouchableOpacity
                style={[
                  styles.continueButton,
                  isLoading && styles.continueButtonDisabled,
                ]}
                onPress={handleContinue}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.continueText}>
                    {step === 1 ? 'CONTINUE' : 'CREATE ACCOUNT'}
                  </Text>
                )}
              </TouchableOpacity>
            </LinearGradient>

            <View style={styles.loginContainer}>
              <Text style={styles.loginText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => router.push('/LoginScreen')}>
                <GradientText style={styles.loginLink}>Login</GradientText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  scrollContainer: {
    flexGrow: 1,
  },
  innerContainer: {
    flex: 1,
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    position: 'relative',
  },
  backButton: {
    position: 'absolute',
    left: 0,
    zIndex: 10,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    flex: 1,
  },
  progressIndicator: {
    position: 'absolute',
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#333',
  },
  activeDot: {
    backgroundColor: '#FF9F45',
  },
  progressLine: {
    width: 15,
    height: 2,
    backgroundColor: '#333',
    marginHorizontal: 5,
  },
  formContainer: {
    flex: 1,
  },
  welcomeGradientBorder: {
    borderRadius: 50,
    padding: 1,
    marginBottom: 30,
  },
  welcomeInner: {
    backgroundColor: '#000000',
    borderRadius: 50,
    padding: 16,
  },
  welcomeText: {
    textAlign: 'center',
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  subText: {
    textAlign: 'center',
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  logoContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  logo: {
    width: 80,
    height: 80,
  },
  inputContainer: {
    gap: 15,
    marginBottom: 25,
  },
  inputWrapper: {
    backgroundColor: '#1A1A1A',
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1A1A1A',
  },
  inputError: {
    borderColor: '#FF5252',
  },
  inputIcon: {
    marginLeft: 15,
  },
  input: {
    flex: 1,
    padding: 15,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
    height: 50,
  },
  passwordToggle: {
    padding: 15,
  },
  errorText: {
    color: '#FF5252',
    fontSize: 12,
    marginTop: 5,
    marginLeft: 15,
  },
  rightError: {
    textAlign: 'right',
    marginRight: 15,
    marginLeft: 0,
  },
  rateContainer: {
    width: '100%',
  },
  rateInputContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  rateErrorContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfInput: {
    width: '48%',
  },
  passwordStrengthContainer: {
    marginTop: 10,
    marginLeft: 15,
  },
  passwordStrengthBar: {
    height: 5,
    backgroundColor: '#333',
    borderRadius: 3,
    overflow: 'hidden',
    width: '100%',
  },
  passwordStrengthFill: {
    height: '100%',
    borderRadius: 3,
  },
  passwordStrengthText: {
    fontSize: 12,
    marginTop: 5,
  },
  continueGradientBorder: {
    borderRadius: 25,
    padding: 1,
    width: '50%',
    alignSelf: 'center',
    marginBottom: 15,
  },
  continueButton: {
    backgroundColor: '#000000',
    borderRadius: 24,
    padding: 14,
    alignItems: 'center',
  },
  continueButtonDisabled: {
    opacity: 0.7,
  },
  continueText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  loginContainer: {
    marginTop: 25,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginText: {
    color: 'white',
    fontWeight: '500',
    fontSize: 14,
  },
  loginLink: {
    fontSize: 14,
    fontWeight: '500',
  },
}) 