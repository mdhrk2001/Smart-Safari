// src/screens/HomeScreen.tsx

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { MainTabParamList } from '../../App';
import { auth, db } from '../config/firebase';
import { doc, getDoc } from 'firebase/firestore';

// 1. Strictly type your props to catch the parkId
type HomeScreenProps = {
  navigation: NativeStackNavigationProp<any>;
  route: RouteProp<MainTabParamList, 'Home'>;
};

export default function HomeScreen({ navigation, route }: HomeScreenProps) {
  const { parkId } = route.params;

  // 2. Add state for your dynamic data
  const [parkName, setParkName] = useState('Loading...');
  const [userName, setUserName] = useState('Explorer');
  const [isLoading, setIsLoading] = useState(true);

  // 3. Fetch data when the screen mounts or parkId changes
  useEffect(() => {
    const fetchHomeData = async () => {
      try {
        setIsLoading(true);

        const currentUser = auth.currentUser;

        if (currentUser) {
          // A. Try to get the name from the Auth profile (usually works for Google Sign-In)
          if (currentUser.displayName) {
            setUserName(currentUser.displayName.split(' ')[0]);
          } else {
            // B. If not in Auth, fetch it from our Firestore 'users' collection (for Email Signups)
            const userRef = doc(db, 'users', currentUser.uid);
            const userSnap = await getDoc(userRef);

            if (userSnap.exists() && userSnap.data().name) {
              setUserName(userSnap.data().name.split(' ')[0]);
            } else {
              setUserName('Safari Planner'); // Ultimate fallback
            }
          }
        }

        // C. Fetch the park document we created earlier
        const parkRef = doc(db, 'parks', parkId);
        const parkSnap = await getDoc(parkRef);

        if (parkSnap.exists()) {
          setParkName(parkSnap.data().name); // Sets "Yala National Park"
        } else {
          setParkName('Unknown Park');
          console.warn(`Park document with ID ${parkId} not found in Firestore.`);
        }

      } catch (error) {
        console.error('Error fetching home data:', error);
        setParkName('Offline Mode');
      } finally {
        setIsLoading(false);
      }
    };

    fetchHomeData();
  }, [parkId]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header Section */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Ayubowan, {userName}!</Text>
            <View style={styles.locationTag}>
              <Ionicons name="location-outline" size={16} color="#00C853" />
              {isLoading ? (
                <ActivityIndicator size="small" color="#00C853" style={{ marginLeft: 4 }} />
              ) : (
                <Text style={styles.locationText}> {parkName}</Text>
              )}
            </View>
          </View>
          <View style={styles.weatherTag}>
            <Ionicons name="sunny-outline" size={20} color="#FBC02D" />
            <Text style={styles.weatherText}> 32°C</Text>
          </View>
        </View>

        {/* Hero Card: Start Live Safari */}
        <TouchableOpacity style={styles.heroCard} onPress={() => navigation.navigate('LiveSafari')}>
          <View style={styles.heroContent}>
            <View style={styles.iconBox}>
              <Ionicons name="camera-outline" size={32} color="#fff" />
            </View>
            <View>
              <Text style={styles.heroTitle}>Start Live Safari</Text>
              <Text style={styles.heroSubtitle}>Begin wildlife detection</Text>
            </View>
          </View>
          <Ionicons name="arrow-forward-circle" size={40} color="#ffffff80" />
        </TouchableOpacity>

        {/* Grid Menu: Plan Tour & Diary */}
        <View style={styles.gridContainer}>
          <TouchableOpacity style={styles.gridCard} onPress={() => navigation.navigate('TourPlanner')}>
            <View style={[styles.iconCircle, { backgroundColor: '#E3F2FD' }]}>
              <Ionicons name="map-outline" size={24} color="#1565C0" />
            </View>
            <Text style={styles.gridTitle}>Plan My Tour</Text>
            <Text style={styles.gridSubtitle}>Optimize routes</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.gridCard} onPress={() => navigation.navigate('Diary')}>
            <View style={[styles.iconCircle, { backgroundColor: '#FFF3E0' }]}>
              <Ionicons name="book-outline" size={24} color="#E65100" />
            </View>
            <Text style={styles.gridTitle}>Wildlife Diary</Text>
            <Text style={styles.gridSubtitle}>View sightings</Text>
          </TouchableOpacity>
        </View>

        {/* Stats Section */}
        <View style={styles.statsContainer}>
          <Text style={styles.sectionHeader}>Your Stats</Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>12</Text>
              <Text style={styles.statLabel}>Sightings</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>3</Text>
              <Text style={styles.statLabel}>Tours</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: '#00C853' }]}>8h</Text>
              <Text style={styles.statLabel}>Safari Time</Text>
            </View>
          </View>
        </View>
      </ScrollView>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  scrollContent: { padding: 24, paddingBottom: 100 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  greeting: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  locationTag: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  locationText: { color: '#666', fontSize: 14 },
  weatherTag: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 8, borderRadius: 20 },
  weatherText: { fontWeight: '600', color: '#333' },

  heroCard: { backgroundColor: '#00C853', borderRadius: 20, padding: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
  heroContent: { flexDirection: 'row', alignItems: 'center' },
  iconBox: { width: 50, height: 50, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  heroTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  heroSubtitle: { color: '#e8f5e9', fontSize: 13 },

  gridContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  gridCard: { backgroundColor: '#fff', width: '48%', padding: 16, borderRadius: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  iconCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  gridTitle: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  gridSubtitle: { fontSize: 12, color: '#999', marginTop: 2 },

  statsContainer: { backgroundColor: '#fff', borderRadius: 16, padding: 20 },
  sectionHeader: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 16 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  statItem: { alignItems: 'center' },
  statNumber: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  statLabel: { fontSize: 12, color: '#999', marginTop: 4 },
});