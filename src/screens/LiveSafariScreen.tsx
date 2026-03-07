// src/screens/LiveSafariScreen.tsx

import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, useWindowDimensions, ActivityIndicator, Modal, ScrollView, Platform } from 'react-native';
import { Camera, CameraProps, useCameraDevice, useCameraPermission, useFrameProcessor, useCameraFormat } from 'react-native-vision-camera';
import { useTensorflowModel } from 'react-native-fast-tflite';
import { useResizePlugin } from 'vision-camera-resize-plugin';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, useAnimatedProps, AnimatedProps } from 'react-native-reanimated';
import { Worklets } from 'react-native-worklets-core';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GestureHandlerRootView, GestureDetector, Gesture } from 'react-native-gesture-handler';

import { postProcessYOLO, Detection } from '../utils/ObjectDetection';
import { useGeofencing } from '../hooks/useGeofencing';
import { speakNarration, stopNarration } from '../utils/AudioNarrator';

// Firestore Imports
import { db } from '../config/firebase';
import { collection, getDocs } from 'firebase/firestore';

const MODEL_PATH = require('../../assets/models/wildlens.tflite');

const AVAILABLE_LANGUAGES = [
    { code: 'en', label: 'English' },
    { code: 'si', label: 'සිංහල (Sinhala)' },
    { code: 'ta', label: 'தமிழ் (Tamil)' },
    { code: 'es', label: 'Español (Spanish)' }
];

const AnimatedCamera = Animated.createAnimatedComponent(Camera) as React.ComponentClass<
    AnimatedProps<CameraProps>
>;

export default function LiveSafariScreen({ navigation, route }: any) {
    const insets = useSafeAreaInsets();
    const parkId = route?.params?.parkId || 'yala';

    const device = useCameraDevice('back');
    const { hasPermission, requestPermission } = useCameraPermission();

    const format = useCameraFormat(device, [
        { videoResolution: { width: 1280, height: 720 } },
        { fps: 30 }
    ]);

    const { currentZone } = useGeofencing();

    const coreDelegate = Platform.OS === 'ios' ? 'core-ml' : 'default';
    const objectDetection = useTensorflowModel(MODEL_PATH, coreDelegate as any);

    const { resize } = useResizePlugin();
    const { width: screenWidth, height: screenHeight } = useWindowDimensions();

    const [detectedAnimal, setDetectedAnimal] = useState<any | null>(null);
    const [confidenceText, setConfidenceText] = useState("0%");
    const [isLoadingData, setIsLoadingData] = useState(true);
    
    // NEW: State to track audio playback
    const [isPlayingAudio, setIsPlayingAudio] = useState(false);

    const [language, setLanguage] = useState('en');
    const [recentLanguages, setRecentLanguages] = useState<string[]>(['en']);
    const [showLangModal, setShowLangModal] = useState(false);

    const animalDictRef = useRef<Record<number, any>>({});

    const boxTop = useSharedValue(0);
    const boxLeft = useSharedValue(0);
    const boxWidth = useSharedValue(0);
    const boxHeight = useSharedValue(0);
    const isDetected = useSharedValue(false);
    const currentDetectedClass = useSharedValue<number | null>(null);

    const frameCounter = useSharedValue(0);

    const zoom = useSharedValue(1);
    const startZoom = useSharedValue(1);

    useEffect(() => {
        if (device) {
            zoom.value = device.neutralZoom;
        }
    }, [device, zoom]);

    const pinchGesture = Gesture.Pinch()
        .onBegin(() => {
            startZoom.value = zoom.value;
        })
        .onUpdate((event) => {
            if (device) {
                const newZoom = startZoom.value * event.scale;
                zoom.value = Math.max(Math.min(newZoom, device.maxZoom), device.minZoom);
            }
        });

    const animatedCameraProps = useAnimatedProps(() => {
        return {
            zoom: zoom.value,
        } as any;
    }, [zoom]);

    useEffect(() => {
        const loadRecentLanguages = async () => {
            try {
                const saved = await AsyncStorage.getItem('@recent_languages');
                if (saved) {
                    setRecentLanguages(JSON.parse(saved));
                    setLanguage(JSON.parse(saved)[0]);
                }
            } catch (e) {
                console.error("Failed to load languages", e);
            }
        };
        loadRecentLanguages();
        requestPermission();

        const fetchAnimalData = async () => {
            try {
                setIsLoadingData(true);
                const animalsRef = collection(db, 'parks', parkId, 'animals');
                const snapshot = await getDocs(animalsRef);

                const fetchedDict: Record<number, any> = {};
                snapshot.forEach((doc) => {
                    const data = doc.data();
                    if (data.classIndex !== undefined) {
                        fetchedDict[data.classIndex] = { id: doc.id, ...data };
                    }
                });

                animalDictRef.current = fetchedDict;
            } catch (error) {
                console.error("Error fetching animal data:", error);
            } finally {
                setIsLoadingData(false);
            }
        };

        fetchAnimalData();
    }, [parkId]);

    useEffect(() => {
        if (currentZone && currentZone.audioAutoPlay) {
            speakNarration(`Alert: ${currentZone.name}. ${currentZone.alertMessage}`, 'en');
        }
        return () => stopNarration();
    }, [currentZone]);

    const handleSelectLanguage = async (code: string) => {
        setLanguage(code);
        setShowLangModal(false);
        stopNarration();
        setIsPlayingAudio(false); // Reset audio state

        const updatedRecents = [code, ...recentLanguages.filter(lang => lang !== code)].slice(0, 3);
        setRecentLanguages(updatedRecents);

        try {
            await AsyncStorage.setItem('@recent_languages', JSON.stringify(updatedRecents));
        } catch (e) {
            console.error("Failed to save recent languages", e);
        }
    };

    const handleListenPress = () => {
        if (isPlayingAudio) {
            stopNarration();
            setIsPlayingAudio(false);
        } else {
            if (detectedAnimal && detectedAnimal.narration) {
                let audioText = '';
                if (typeof detectedAnimal.narration === 'string') {
                    audioText = detectedAnimal.narration;
                } else {
                    audioText = detectedAnimal.narration[language] || detectedAnimal.narration['en'];
                }
                if (audioText) {
                    setIsPlayingAudio(true);
                    speakNarration(
                        audioText, 
                        language as any,
                        () => setIsPlayingAudio(false), // Reset on done
                        () => setIsPlayingAudio(false)  // Reset on error
                    );
                }
            }
        }
    };

    const getLocalizedName = () => {
        if (!detectedAnimal) return 'Scanning...';
        if (typeof detectedAnimal.name === 'string') return detectedAnimal.name;
        return detectedAnimal.name?.[language] || detectedAnimal.name?.['en'] || 'Unknown Species';
    };

    const updateUIState = Worklets.createRunOnJS((classIndex: number | null, confidence: number) => {
        if (classIndex === null) {
            setDetectedAnimal(null);
            setConfidenceText("");
        } else {
            const animalData = animalDictRef.current[classIndex] || {
                name: { en: 'Unknown Species' },
                scientificName: 'Not registered in database',
                status: 'Unknown'
            };
            setDetectedAnimal(animalData);
            setConfidenceText(`${(confidence * 100).toFixed(0)}%`);
        }
    });

    const frameProcessor = useFrameProcessor((frame) => {
        'worklet';
        if (objectDetection.state !== 'loaded') return;

        frameCounter.value += 1;
        if (frameCounter.value % 10 !== 0) return;

        const resized = resize(frame, { scale: { width: 640, height: 640 }, pixelFormat: 'rgb', dataType: 'float32' });
        const output = objectDetection.model.runSync([resized]);
        const rawData = output[0] as Float32Array;

        const detections = postProcessYOLO(rawData, 640, 640);

        if (detections.length > 0) {
            const topResult = detections[0];

            const scaleX = screenWidth / 640;
            const scaleY = screenHeight / 640;

            boxTop.value = topResult.box.y * scaleY;
            boxLeft.value = topResult.box.x * scaleX;
            boxWidth.value = topResult.box.w * scaleX;
            boxHeight.value = topResult.box.h * scaleY;

            isDetected.value = true;

            if (currentDetectedClass.value !== topResult.classIndex) {
                currentDetectedClass.value = topResult.classIndex;
                updateUIState(topResult.classIndex, topResult.confidence);
            }
        } else {
            isDetected.value = false;
            if (currentDetectedClass.value !== null) {
                currentDetectedClass.value = null;
                updateUIState(null, 0);
            }
        }
    }, [objectDetection, screenWidth, screenHeight]);

    const animatedBoxStyle = useAnimatedStyle(() => ({
        top: withSpring(boxTop.value),
        left: withSpring(boxLeft.value),
        width: withSpring(boxWidth.value),
        height: withSpring(boxHeight.value),
        opacity: isDetected.value ? 1 : 0,
        position: 'absolute',
        borderWidth: 2,
        borderColor: '#00E676',
        zIndex: 10,
    }));

    const renderLanguageItem = (langCode: string) => {
        const langObj = AVAILABLE_LANGUAGES.find(l => l.code === langCode);
        if (!langObj) return null;
        const isSelected = language === langCode;

        return (
            <TouchableOpacity
                key={langCode}
                style={[styles.langListItem, isSelected && styles.langListItemSelected]}
                onPress={() => handleSelectLanguage(langCode)}
            >
                <Text style={[styles.langListText, isSelected && styles.langListTextSelected]}>
                    {langObj.label}
                </Text>
                {isSelected && <Ionicons name="checkmark-circle" size={24} color="#00C853" />}
            </TouchableOpacity>
        );
    };

    if (!hasPermission) return <View style={styles.container}><Text style={{ color: 'white' }}>Requesting Camera...</Text></View>;
    if (device == null) return <View style={styles.container}><Text style={{ color: 'white' }}>Loading Camera...</Text></View>;

    return (
        <GestureHandlerRootView style={styles.container}>
            <GestureDetector gesture={pinchGesture}>
                <AnimatedCamera
                    style={StyleSheet.absoluteFill}
                    device={device}
                    format={format}
                    isActive={true}
                    frameProcessor={frameProcessor}
                    pixelFormat="yuv"
                    videoStabilizationMode="off"
                    animatedProps={animatedCameraProps}
                />
            </GestureDetector>

            <SafeAreaView style={styles.topOverlay} edges={['top']}>
                <TouchableOpacity onPress={() => { stopNarration(); setIsPlayingAudio(false); navigation.goBack(); }} style={styles.iconButton}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>

                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {isLoadingData && <ActivityIndicator color="#fff" style={{ marginRight: 10 }} />}

                    <TouchableOpacity onPress={() => setShowLangModal(true)} style={styles.langButton}>
                        <Ionicons name="language" size={16} color="#fff" style={{ marginRight: 4 }} />
                        <Text style={styles.langText}>{language.toUpperCase()}</Text>
                        <Ionicons name="chevron-down" size={14} color="#fff" style={{ marginLeft: 2 }} />
                    </TouchableOpacity>

                    <View style={styles.liveBadge}>
                        <View style={styles.redDot} />
                        <Text style={styles.liveText}>LIVE AI</Text>
                    </View>
                </View>
            </SafeAreaView>

            <Animated.View style={animatedBoxStyle}>
                <View style={styles.labelTag}>
                    <Text style={styles.labelText}>
                        {getLocalizedName()} <Text style={{ fontWeight: '300' }}>{confidenceText}</Text>
                    </Text>
                </View>
                <View style={[styles.corner, styles.topLeft]} />
                <View style={[styles.corner, styles.topRight]} />
                <View style={[styles.corner, styles.bottomLeft]} />
                <View style={[styles.corner, styles.bottomRight]} />
            </Animated.View>

            {detectedAnimal && (
                <View style={styles.bottomSheet}>
                    <TouchableOpacity style={styles.recordButtonOuter}>
                        <View style={styles.recordButtonInner} />
                    </TouchableOpacity>

                    <View style={styles.animalInfoContainer}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.animalName}>{getLocalizedName()}</Text>
                            <Text style={styles.scientificName}>{detectedAnimal.scientificName || 'Scientific name unavailable'}</Text>
                        </View>
                        <View style={styles.statusBadge}>
                            <Text style={styles.statusText}>{detectedAnimal.status || 'Unknown'}</Text>
                        </View>
                    </View>

                    <View style={styles.actionRow}>
                        <ActionButton
                            icon="information-circle"
                            label="Info"
                            color="#2962FF"
                            onPress={() => {
                                stopNarration();
                                setIsPlayingAudio(false);
                                navigation.navigate('AnimalInfo', { animal: detectedAnimal, language: language });
                            }}
                        />
                        <ActionButton 
                            icon={isPlayingAudio ? "stop" : "volume-high"} 
                            label={isPlayingAudio ? "Stop" : "Listen"} 
                            color={isPlayingAudio ? "#D50000" : "#00C853"} 
                            onPress={handleListenPress} 
                        />
                        <ActionButton icon="book" label="Log" color="#FF9100" />
                        <ActionButton icon="warning" label="Alert" color="#D50000" />
                    </View>
                </View>
            )}

            <Modal visible={showLangModal} animationType="slide" transparent={true} onRequestClose={() => setShowLangModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { paddingBottom: Math.max(insets.bottom, 20) }]}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Select Audio Language</Text>
                            <TouchableOpacity onPress={() => setShowLangModal(false)}>
                                <Ionicons name="close-circle" size={28} color="#999" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={{ width: '100%' }}>
                            <Text style={styles.sectionTitle}>RECENTLY USED</Text>
                            <View style={styles.langGroup}>
                                {recentLanguages.map(renderLanguageItem)}
                            </View>

                            <Text style={styles.sectionTitle}>ALL LANGUAGES</Text>
                            <View style={styles.langGroup}>
                                {AVAILABLE_LANGUAGES.map(lang => renderLanguageItem(lang.code))}
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </GestureHandlerRootView>
    );
}

const ActionButton = ({ icon, label, color, onPress }: { icon: any, label: string, color: string, onPress?: () => void }) => (
    <TouchableOpacity style={styles.actionBtn} onPress={onPress}>
        <View style={[styles.actionIconCircle, { backgroundColor: color }]}>
            <Ionicons name={icon} size={24} color="#fff" />
        </View>
        <Text style={styles.actionLabel}>{label}</Text>
    </TouchableOpacity>
);

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    topOverlay: { position: 'absolute', top: 0, width: '100%', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 10, zIndex: 50 },
    iconButton: { padding: 8, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 20 },
    langButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginRight: 10, height: 32 },
    langText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
    liveBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FF3D00', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, height: 32 },
    redDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff', marginRight: 6 },
    liveText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
    labelTag: { position: 'absolute', top: -30, left: -2, backgroundColor: '#00E676', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 4 },
    labelText: { color: '#000', fontWeight: 'bold', fontSize: 14 },
    corner: { position: 'absolute', width: 20, height: 20, borderColor: '#FF3D00', borderWidth: 4 },
    topLeft: { top: -2, left: -2, borderBottomWidth: 0, borderRightWidth: 0 },
    topRight: { top: -2, right: -2, borderBottomWidth: 0, borderLeftWidth: 0 },
    bottomLeft: { bottom: -2, left: -2, borderTopWidth: 0, borderRightWidth: 0 },
    bottomRight: { bottom: -2, right: -2, borderTopWidth: 0, borderLeftWidth: 0 },
    bottomSheet: { position: 'absolute', bottom: 0, width: '100%', padding: 24, paddingBottom: 40, backgroundColor: 'rgba(0,0,0,0.85)', borderTopLeftRadius: 20, borderTopRightRadius: 20 },
    recordButtonOuter: { position: 'absolute', top: -35, alignSelf: 'center', width: 70, height: 70, borderRadius: 35, borderWidth: 4, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
    recordButtonInner: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#D50000' },
    animalInfoContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: 30 },
    animalName: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
    scientificName: { color: '#bbb', fontSize: 14, fontStyle: 'italic', marginTop: 2 },
    statusBadge: { backgroundColor: '#D50000', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
    statusText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
    actionRow: { flexDirection: 'row', justifyContent: 'space-between' },
    actionBtn: { alignItems: 'center' },
    actionIconCircle: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
    actionLabel: { color: '#fff', fontSize: 12 },
    alertOverlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 20, zIndex: 100 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#1A1A1A', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '70%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
    sectionTitle: { color: '#999', fontSize: 12, fontWeight: 'bold', marginTop: 16, marginBottom: 8, letterSpacing: 1 },
    langGroup: { backgroundColor: '#2C2C2E', borderRadius: 12, overflow: 'hidden' },
    langListItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#3A3A3C' },
    langListItemSelected: { backgroundColor: 'rgba(0, 200, 83, 0.1)' },
    langListText: { color: '#fff', fontSize: 16 },
    langListTextSelected: { color: '#00C853', fontWeight: 'bold' }
});