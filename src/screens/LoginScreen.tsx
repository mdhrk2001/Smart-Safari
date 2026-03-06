// src/screens/LoginScreen.tsx

import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { auth, db } from '../config/firebase'; 
import {
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithCredential
} from 'firebase/auth';
// Added getDoc to safely check if the user already exists
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore'; 
import { GoogleSignin } from '@react-native-google-signin/google-signin';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Login'>;
};

export default function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Initialize Google Sign-In
  useEffect(() => {
    GoogleSignin.configure({
      webClientId: '537903752022-6vk1p2f0g6e75l9fs61crnhmgv26r6tp.apps.googleusercontent.com',
    });
  }, []);

  // --- Helpers: Validation ---
  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // --- 1. Standard Email Login ---
  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password.');
      return;
    }

    if (!isValidEmail(email)) {
      Alert.alert('Invalid Email', 'Please enter a valid email format.');
      return;
    }

    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);

      if (!userCredential.user.emailVerified) {
        await signOut(auth);
        Alert.alert('Verification Required', 'Please verify your email address before accessing the app.');
        setLoading(false);
        return;
      }

      navigation.navigate('ParkSelection');
    } catch (error: any) {
      Alert.alert('Login Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  // --- 2. Forgot Password Feature ---
  const handleForgotPassword = async () => {
    if (!email) {
      Alert.alert('Email Required', 'Please enter your email address in the field above to reset your password.');
      return;
    }

    if (!isValidEmail(email)) {
      Alert.alert('Invalid Email', 'Please enter a valid email format.');
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      Alert.alert('Reset Email Sent', 'Check your inbox for a link to reset your password.');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  // --- 3. Google Sign-In Feature ---
  const handleGoogleSignIn = async () => {
    try {
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      const idToken = userInfo.data?.idToken;

      if (!idToken) throw new Error('No ID token found');

      const googleCredential = GoogleAuthProvider.credential(idToken);
      const userCredential = await signInWithCredential(auth, googleCredential);

      // --- NEW LOGIC: Check if user exists before setting data ---
      const userRef = doc(db, 'users', userCredential.user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        // First-time Google login: Create document matching the SignupScreen schema
        await setDoc(userRef, {
          uid: userCredential.user.uid,
          name: userCredential.user.displayName || 'Google User',
          email: userCredential.user.email?.toLowerCase(),
          phoneNumber: '', // Init empty to match schema
          country: '',     // Init empty to match schema
          gender: '',      // Init empty to match schema
          createdAt: serverTimestamp(), // Stamp creation time
        });
      } else {
        // Returning user: Only update the lastLogin timestamp so we don't erase existing data
        await setDoc(userRef, {
          lastLogin: serverTimestamp(),
        }, { merge: true });
      }

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
          <Text style={styles.header}>Login to WildLens</Text>
          <Text style={styles.subHeader}>Continue your wildlife adventure</Text>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Email</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="mail-outline" size={20} color="#999" style={styles.icon} />
              <TextInput
                style={styles.input}
                placeholder="your@email.com"
                placeholderTextColor="#999"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <Text style={styles.label}>Password</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={20} color="#999" style={styles.icon} />
              <TextInput
                style={styles.input}
                placeholder="........"
                placeholderTextColor="#999"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color="#999"
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity onPress={handleForgotPassword}>
              <Text style={styles.forgotPass}>Forgot Password?</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.loginButton}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.loginButtonText}>Login</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.orText}>or</Text>

          <TouchableOpacity style={styles.googleButton} onPress={handleGoogleSignIn}>
            <Ionicons name="logo-google" size={20} color="#DB4437" />
            <Text style={styles.googleText}> Continue with Google</Text>
          </TouchableOpacity>

          <View style={styles.bottomTextContainer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
              <Text style={styles.createAccount}>Create Account</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  scrollContent: { flexGrow: 1 },
  content: { padding: 24, justifyContent: 'center', flex: 1 },
  header: { fontSize: 28, fontWeight: 'bold', color: '#333', marginBottom: 8 },
  subHeader: { fontSize: 16, color: '#666', marginBottom: 40 },
  inputContainer: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: 'bold', color: '#333', marginBottom: 8, marginTop: 16 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 12, paddingHorizontal: 12 },
  icon: { marginRight: 8 },
  input: { flex: 1, paddingVertical: 16, fontSize: 16, color: '#333' },
  forgotPass: { color: '#00C853', textAlign: 'right', marginTop: 12, fontWeight: 'bold' },
  loginButton: { backgroundColor: '#00C853', borderRadius: 12, padding: 18, alignItems: 'center', marginTop: 24 },
  loginButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  orText: { textAlign: 'center', color: '#999', marginVertical: 20 },
  googleButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 16,
  },
  googleText: { color: '#333', fontSize: 16, fontWeight: 'bold' },
  footerText: { color: '#999', fontWeight: 'bold' },
  bottomTextContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginVertical: 20 },
  createAccount: { color: '#00C853', fontWeight: 'bold' },
});