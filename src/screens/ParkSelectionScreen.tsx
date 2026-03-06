// src/screens/ParkSelectionScreen.tsx

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ImageBackground, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { auth, db } from '../config/firebase';
import { doc, updateDoc } from 'firebase/firestore';

// Data representing the parks shown in Figure B.4
const PARKS = [
    { id: 'yala', name: 'Yala National Park', active: true, image: 'https://images.unsplash.com/photo-1695173987873-6f157a2d6ad1?q=80' },
    { id: 'wilpattu', name: 'Wilpattu National Park', active: false, image: 'https://images.unsplash.com/photo-1670046368526-3b041bb63b03?q=80' },
    { id: 'udawalawe', name: 'Udawalawe National Park', active: false, image: 'https://images.unsplash.com/photo-1716645769260-eb00bc9bed7f?q=80' },
    { id: 'ridiyagama', name: 'Ridiyagama Safari Park', active: false, image: 'https://i0.wp.com/amazinglanka.com/wp/wp-content/uploads/2021/07/ridiyagama-02-1024x575.jpg?ssl=1' },
    { id: 'minneriya', name: 'Minneriya National Park', active: false, image: 'https://minneriyasafari.com/wp-content/uploads/2017/07/Minneriya-National-Park-.jpg' }
];

type Props = {
    navigation: NativeStackNavigationProp<RootStackParamList, 'ParkSelection'>;
};

export default function ParkSelectionScreen({ navigation }: Props) {
    const [selectedPark, setSelectedPark] = useState('yala');
    const [isLoading, setIsLoading] = useState(false);

    const handleEnterPark = async () => {
        setIsLoading(true);
        try {
            const userId = auth.currentUser?.uid;
            
            if (userId) {
                // Update the user's document in Firestore with their chosen park
                const userRef = doc(db, 'users', userId);
                await updateDoc(userRef, {
                    lastSelectedPark: selectedPark
                });
            } else {
                console.warn("No authenticated user found.");
            }

            // Navigate to MainTabs and pass the parkId as a route parameter
            // Ensure your App.tsx RootStackParamList expects this parameter
            navigation.navigate('MainTabs', { parkId: selectedPark });
            
        } catch (error) {
            console.error("Error saving park selection:", error);
            Alert.alert(
                "Sync Error", 
                "We couldn't save your park preference, but you can still enter the app.",
                [{ text: "Continue", onPress: () => navigation.navigate('MainTabs', { parkId: selectedPark }) }]
            );
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Select Your Destination</Text>
                <Text style={styles.subtitle}>Choose a park to download maps and data</Text>
            </View>

            <ScrollView contentContainerStyle={styles.list}>
                {PARKS.map((park) => {
                    const isSelected = selectedPark === park.id;
                    return (
                        <TouchableOpacity 
                            key={park.id} 
                            style={[styles.cardContainer, isSelected && styles.cardSelected]}
                            onPress={() => park.active && setSelectedPark(park.id)}
                            disabled={!park.active || isLoading}
                        >
                            <ImageBackground 
                                source={{ uri: park.image }} 
                                style={styles.cardBackground}
                                imageStyle={{ borderRadius: 12, opacity: park.active ? 0.8 : 0.4 }}
                            >
                                <View style={styles.cardOverlay}>
                                    <View style={styles.cardContent}>
                                        {park.active ? (
                                           <View style={[styles.checkCircle, isSelected && styles.checkCircleActive]}>
                                               {isSelected && <Ionicons name="checkmark" size={16} color="#fff" />}
                                           </View>
                                        ) : (
                                            <Ionicons name="lock-closed-outline" size={24} color="#fff" style={styles.lockIcon} />
                                        )}
                                        <Text style={styles.parkName}>{park.name}</Text>
                                    </View>
                                    
                                    {park.active && (
                                        <View style={styles.activeBadge}>
                                            <Text style={styles.activeText}>Active</Text>
                                        </View>
                                    )}
                                </View>
                            </ImageBackground>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity 
                    style={[styles.enterButton, isLoading && styles.enterButtonDisabled]} 
                    onPress={handleEnterPark}
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.enterButtonText}>Enter Park {'>'}</Text>
                    )}
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8f9fa' },
    header: { padding: 24, paddingBottom: 10 },
    title: { fontSize: 24, fontWeight: 'bold', color: '#333' },
    subtitle: { fontSize: 14, color: '#666', marginTop: 4 },
    list: { paddingHorizontal: 20, paddingBottom: 20 },
    cardContainer: { height: 100, marginBottom: 16, borderRadius: 14, borderWidth: 2, borderColor: 'transparent' },
    cardSelected: { borderColor: '#00C853' },
    cardBackground: { flex: 1, borderRadius: 12, backgroundColor: '#000' },
    cardOverlay: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 12 },
    cardContent: { flexDirection: 'row', alignItems: 'center' },
    checkCircle: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    checkCircleActive: { backgroundColor: '#00C853', borderColor: '#00C853' },
    lockIcon: { marginRight: 12 },
    parkName: { fontSize: 18, fontWeight: 'bold', color: '#fff', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: {width: 0, height: 1}, textShadowRadius: 3 },
    activeBadge: { backgroundColor: '#00C853', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
    activeText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
    footer: { padding: 20, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#f0f0f0' },
    enterButton: { backgroundColor: '#00C853', paddingVertical: 18, borderRadius: 12, alignItems: 'center' },
    enterButtonDisabled: { backgroundColor: '#80E2A9' }, // Lighter green when loading
    enterButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});