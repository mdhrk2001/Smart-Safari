// src/screens/SignupScreen.tsx

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  Modal,
  FlatList,
  Image
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { auth, db } from '../config/firebase';
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  GoogleAuthProvider,
  signInWithCredential
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Signup'>;
};

// Define Country Type
interface CountryData {
  name: string;
  flagUrl: string;
}

// --- Helper Component: Smart Flag Image with Fallback ---
const FlagImage = ({ uri }: { uri: string }) => {
  const [hasError, setHasError] = useState(false);

  // If the image errors out, or the URI is missing, show the globe fallback
  if (hasError || !uri) {
    return (
      <View style={[styles.countryFlag, { backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' }]}>
        <Ionicons name="globe-outline" size={14} color="#999" />
      </View>
    );
  }

  return (
    <Image 
      source={{ uri }} 
      style={styles.countryFlag} 
      onError={() => setHasError(true)} 
    />
  );
};

export default function SignupScreen({ navigation }: Props) {
  // Initialize safe area insets
  const insets = useSafeAreaInsets();

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Selection State
  const [country, setCountry] = useState('');
  const [gender, setGender] = useState('');

  // UI State
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Modal & API State
  const [countries, setCountries] = useState<CountryData[]>([]);
  const [filteredCountries, setFilteredCountries] = useState<CountryData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCountryModal, setShowCountryModal] = useState(false);
  const [showGenderModal, setShowGenderModal] = useState(false);

  const genders = ['Male', 'Female', 'Other', 'Prefer not to say'];

  useEffect(() => {
    // 1. Initialize Google Sign-In
    GoogleSignin.configure({
      webClientId: '537903752022-6vk1p2f0g6e75l9fs61crnhmgv26r6tp.apps.googleusercontent.com',
    });

    // 2. Fetch Countries and their 2-letter codes (cca2)
    fetch('https://restcountries.com/v3.1/all?fields=name,cca2')
      .then(res => res.json())
      .then(data => {
        const countryList = data.map((c: any) => ({
          name: c.name.common,
          // 3. Construct the FlagCDN URL manually using the lowercase cca2 code
          flagUrl: `https://flagcdn.com/w320/${c.cca2.toLowerCase()}.png` 
        })).sort((a: CountryData, b: CountryData) => a.name.localeCompare(b.name));
        
        setCountries(countryList);
        setFilteredCountries(countryList); // Initialize filtered list
      })
      .catch(err => console.log('Error fetching countries:', err));
  }, []);

  // --- Helpers: Validation & Search ---
  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const isStrongPassword = (password: string) => {
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return passwordRegex.test(password);
  };

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    // Use .trim() so accidental spaces don't break the search
    const cleanSearchText = text.trim().toLowerCase();
    setFilteredCountries(
      countries.filter(c => c.name.toLowerCase().includes(cleanSearchText))
    );
  };

  const closeCountryModal = () => {
    setShowCountryModal(false);
    setSearchQuery(''); // Reset search on close
    setFilteredCountries(countries);
  };

  // --- 1. Standard Email Signup ---
  const handleSignup = async () => {
    if (!email || !password || !confirmPassword || !name || !country || !gender) {
      Alert.alert('Error', 'Please fill in all required fields.');
      return;
    }

    if (!isValidEmail(email)) {
      Alert.alert('Invalid Email', 'Please enter a valid email format.');
      return;
    }

    if (!isStrongPassword(password)) {
      Alert.alert(
        'Weak Password',
        'Password must be at least 8 characters long and include an uppercase letter, a lowercase letter, a number, and a special character.'
      );
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Password Mismatch', 'Your passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);

      await setDoc(doc(db, 'users', userCredential.user.uid), {
        uid: userCredential.user.uid,
        name: name,
        email: email.toLowerCase(),
        phoneNumber: phoneNumber,
        country: country,
        gender: gender,
        createdAt: serverTimestamp(),
      });

      await sendEmailVerification(userCredential.user);

      Alert.alert(
        'Account Created!',
        'A verification email has been sent. Please check your inbox and verify your email before logging in.'
      );

      navigation.navigate('Login');
    } catch (error: any) {
      Alert.alert('Signup Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  // --- 2. Google Sign-In Feature ---
  const handleGoogleSignIn = async () => {
    try {
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      const idToken = userInfo.data?.idToken;

      if (!idToken) throw new Error('No ID token found');

      const googleCredential = GoogleAuthProvider.credential(idToken);
      const userCredential = await signInWithCredential(auth, googleCredential);

      await setDoc(doc(db, 'users', userCredential.user.uid), {
        uid: userCredential.user.uid,
        name: userCredential.user.displayName || 'Google User',
        email: userCredential.user.email?.toLowerCase(),
        createdAt: serverTimestamp(),
      }, { merge: true });

      navigation.navigate('ParkSelection');
    } catch (error: any) {
      console.log('Google Sign-In Error:', error);
      Alert.alert('Google Sign-In Failed', 'Unable to sign in with Google right now.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.content}>
          <Text style={styles.header}>Create Account</Text>
          <Text style={styles.subHeader}>Start your wildlife journey</Text>

          <View style={styles.inputContainer}>

            <Text style={styles.label}>Full Name *</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="person-outline" size={20} color="#999" style={styles.icon} />
              <TextInput style={styles.input} placeholder="Your name" placeholderTextColor="#999" value={name} onChangeText={setName} />
            </View>

            <Text style={styles.label}>Email *</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="mail-outline" size={20} color="#999" style={styles.icon} />
              <TextInput style={styles.input} placeholder="your@email.com" placeholderTextColor="#999" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
            </View>

            <Text style={styles.label}>Phone Number</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="call-outline" size={20} color="#999" style={styles.icon} />
              <TextInput style={styles.input} placeholder="+1 234 567 8900" placeholderTextColor="#999" value={phoneNumber} onChangeText={setPhoneNumber} keyboardType="phone-pad" />
            </View>

            {/* Country Selection */}
            <Text style={styles.label}>Country *</Text>
            <TouchableOpacity style={styles.inputWrapper} onPress={() => setShowCountryModal(true)}>
              <Ionicons name="globe-outline" size={20} color="#999" style={styles.icon} />
              <Text style={[styles.input, { color: country ? '#333' : '#999', paddingTop: 16 }]}>
                {country || "Select your country"}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#999" />
            </TouchableOpacity>

            <Text style={styles.label}>Gender *</Text>
            <TouchableOpacity style={styles.inputWrapper} onPress={() => setShowGenderModal(true)}>
              <Ionicons name="male-female-outline" size={20} color="#999" style={styles.icon} />
              <Text style={[styles.input, { color: gender ? '#333' : '#999', paddingTop: 16 }]}>
                {gender || "Select your gender"}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#999" />
            </TouchableOpacity>

            <Text style={styles.label}>Password *</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={20} color="#999" style={styles.icon} />
              <TextInput style={styles.input} placeholder="........" placeholderTextColor="#999" secureTextEntry={!showPassword} value={password} onChangeText={setPassword} />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#999" />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Confirm Password *</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={20} color="#999" style={styles.icon} />
              <TextInput style={styles.input} placeholder="........" placeholderTextColor="#999" secureTextEntry={!showConfirmPassword} value={confirmPassword} onChangeText={setConfirmPassword} />
              <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                <Ionicons name={showConfirmPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#999" />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity style={styles.signupButton} onPress={handleSignup} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.signupButtonText}>Create Account</Text>}
          </TouchableOpacity>

          <View style={styles.dividerContainer}>
            <View style={styles.divider} /><Text style={styles.orText}>or</Text><View style={styles.divider} />
          </View>

          <TouchableOpacity style={styles.googleButton} onPress={handleGoogleSignIn}>
            <Ionicons name="logo-google" size={20} color="#DB4437" />
            <Text style={styles.googleText}> Continue with Google</Text>
          </TouchableOpacity>

          <View style={styles.loginContainer}>
            <Text style={styles.loginText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.loginLink}>Login</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* --- Country Picker Modal --- */}
      <Modal visible={showCountryModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>

          <View style={[styles.modalContent, { paddingBottom: Math.max(insets.bottom, 20) }]}>

            <Text style={styles.modalHeader}>Select Country</Text>

            {/* Country Search Bar */}
            <View style={styles.searchContainer}>
              <Ionicons name="search-outline" size={20} color="#999" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search country..."
                placeholderTextColor="#999"
                value={searchQuery}
                onChangeText={handleSearch}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => handleSearch('')}>
                  <Ionicons name="close-circle" size={20} color="#999" />
                </TouchableOpacity>
              )}
            </View>

            {countries.length === 0 ? (
              <ActivityIndicator color="#00C853" style={{ marginVertical: 20 }} />
            ) : (
              <FlatList
                data={filteredCountries}
                keyExtractor={(item) => item.name}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.modalCountryItem}
                    onPress={() => { setCountry(item.name); closeCountryModal(); }}
                  >
                    {/* Using the new FlagImage component here */}
                    <FlagImage uri={item.flagUrl} />
                    <Text style={styles.modalItemText}>{item.name}</Text>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={<Text style={styles.emptySearchText}>No countries found.</Text>}
              />
            )}
            <TouchableOpacity style={styles.modalCloseButton} onPress={closeCountryModal}>
              <Text style={styles.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* --- Gender Picker Modal --- */}
      <Modal visible={showGenderModal} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>

          <View style={[styles.modalContent, { paddingBottom: Math.max(insets.bottom, 20) }]}>

            <Text style={styles.modalHeader}>Select Gender</Text>
            <FlatList
              data={genders}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => { setGender(item); setShowGenderModal(false); }}
                >
                  <Text style={styles.modalItemText}>{item}</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowGenderModal(false)}>
              <Text style={styles.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  scrollContent: { flexGrow: 1, paddingBottom: 20 },
  content: { padding: 24, justifyContent: 'center', flex: 1 },
  header: { fontSize: 28, fontWeight: 'bold', color: '#333', marginBottom: 8 },
  subHeader: { fontSize: 16, color: '#666', marginBottom: 24 },
  inputContainer: { marginBottom: 10 },
  label: { fontSize: 14, fontWeight: 'bold', color: '#333', marginBottom: 8, marginTop: 12 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 12, paddingHorizontal: 12 },
  icon: { marginRight: 8 },
  input: { flex: 1, paddingVertical: 14, fontSize: 16, color: '#333' },
  signupButton: { backgroundColor: '#00C853', borderRadius: 12, padding: 18, alignItems: 'center', marginTop: 24 },
  signupButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  dividerContainer: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  divider: { flex: 1, height: 1, backgroundColor: '#e0e0e0' },
  orText: { marginHorizontal: 16, color: '#999', fontSize: 14 },
  googleButton: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 12, padding: 16 },
  googleText: { color: '#333', fontSize: 16, fontWeight: 'bold' },
  loginContainer: { flexDirection: 'row', justifyContent: 'center', marginTop: 30, marginBottom: 10 },
  loginText: { color: '#666', fontSize: 14, fontWeight: 'bold' },
  loginLink: { color: '#00C853', fontSize: 14, fontWeight: 'bold' },

  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '80%' },
  modalHeader: { fontSize: 20, fontWeight: 'bold', marginBottom: 16, textAlign: 'center', color: '#333' },
  modalItem: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  modalCountryItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  modalItemText: { fontSize: 16, color: '#333' },
  countryFlag: { width: 32, height: 22, borderRadius: 4, marginRight: 12 },
  modalCloseButton: { marginTop: 16, paddingVertical: 14, backgroundColor: '#f8f9fa', borderRadius: 12, alignItems: 'center' },
  modalCloseText: { color: '#FF3B30', fontSize: 16, fontWeight: 'bold' },

  // Search Bar Styles
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0f0f0', borderRadius: 10, paddingHorizontal: 12, marginBottom: 16 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 16, color: '#333' },
  emptySearchText: { textAlign: 'center', color: '#999', marginTop: 20, fontSize: 16 }
});