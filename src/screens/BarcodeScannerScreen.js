import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert, Modal, KeyboardAvoidingView, Platform, Keyboard, Dimensions, Image, Vibration } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeContext';
import { Card } from '../components/common/Card';
import { Ionicons } from '@expo/vector-icons';
import { useResponsive } from '../hooks/useResponsive';
import { useToast } from '../hooks/useToast';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Audio } from 'expo-av';
import { Asset } from 'expo-asset';

const BarcodeScannerContent = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { colors, isDark } = useTheme();
  const responsive = useResponsive();
  const { toast, showToast, hideToast } = useToast();
  const [permission, requestPermission] = useCameraPermissions();
  const [onCodeScanned, setOnCodeScanned] = useState(null);

  const [scannedCodes, setScannedCodes] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [showTutorial, setShowTutorial] = useState(true);
  const [newNota, setNewNota] = useState('');
  const [editingIndex, setEditingIndex] = useState(null);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [isManualMode, setIsManualMode] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [carouselIndex2, setCarouselIndex2] = useState(0);
  const [sound, setSound] = useState();
  const [isScanning, setIsScanning] = useState(true);

  useFocusEffect(
    React.useCallback(() => {
      const params = route.params;
      if (params?.onCodeScanned) {
        setOnCodeScanned(() => params.onCodeScanned);
      }
      if (params?.existingCodes && params.existingCodes.length > 0) {
        setScannedCodes(params.existingCodes);
        setShowTutorial(false);
      }
      return () => {
        setOnCodeScanned(null);
      };
    }, [route.params])
  );

  const tutorialSteps = [
    'Paso 1: Tome todas las variantes del mismo producto que tenga en su tienda',
    'Paso 2: Busque y escanee el código de barras de cada uno de estos productos',
    'Paso 3: (Opcional) Agregue una nota para identificar el color o sabor del producto en el código'
  ];

  const step1Images = [
    require('../../assets/WhatsApp Image 2026-07-21 at 9.33.18 PM (1).jpeg'),
    require('../../assets/WhatsApp Image 2026-07-21 at 9.33.18 PM.jpeg'),
    require('../../assets/WhatsApp Image 2026-07-21 at 9.33.19 PM.jpeg')
  ];

  const step2Images = [
    require('../../assets/WhatsApp Image 2026-07-21 at 9.33.17 PM.jpeg'),
    require('../../assets/WhatsApp Image 2026-07-21 at 9.33.18 PM (2).jpeg'),
    require('../../assets/WhatsApp Image 2026-07-21 at 9.33.20 PM.jpeg')
  ];

  useEffect(() => {
    if (scannedCodes.length > 0) {
      setShowTutorial(false);
    }
  }, [scannedCodes.length]);

  // Auto-rotate carousel for step 1
  useEffect(() => {
    if (showTutorial && currentStep === 0) {
      const interval = setInterval(() => {
        setCarouselIndex(prev => (prev + 1) % step1Images.length);
      }, 2000); // Change image every 2 seconds
      return () => clearInterval(interval);
    } else {
      setCarouselIndex(0);
    }
  }, [showTutorial, currentStep]);

  // Auto-rotate carousel for step 2
  useEffect(() => {
    if (showTutorial && currentStep === 1) {
      const interval = setInterval(() => {
        setCarouselIndex2(prev => (prev + 1) % step2Images.length);
      }, 2000); // Change image every 2 seconds
      return () => clearInterval(interval);
    } else {
      setCarouselIndex2(0);
    }
  }, [showTutorial, currentStep]);

  // Load sound
  useEffect(() => {
    const loadSound = async () => {
      try {
        const asset = Asset.fromModule(require('../../assets/beep.mp3'));
        await asset.downloadAsync();
        const { sound } = await Audio.Sound.createAsync(
          { uri: asset.localUri || asset.uri },
          { shouldPlay: false }
        );
        setSound(sound);
      } catch (error) {
        console.log('Error loading sound:', error);
      }
    };

    loadSound();

    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, []);

  const playSound = async () => {
    if (sound) {
      try {
        await sound.replayAsync();
      } catch (error) {
        console.log('Error playing sound:', error);
      }
    }
  };

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
      setIsKeyboardVisible(true);
    });
    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      setIsKeyboardVisible(false);
    });

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  const handleBarcodeScanned = ({ data }) => {
    if (!isScanning) return;

    const codeExists = scannedCodes.some(
      codigo => codigo.codigo_barras_ean.trim().toLowerCase() === data.trim().toLowerCase()
    );
    
    if (codeExists) {
      showToast({ type: 'warning', message: 'Este código ya está escaneado' });
      return;
    }

    const newCode = {
      codigo_barras_ean: data.trim(),
      nota: null
    };

    setScannedCodes(prev => [...prev, newCode]);
    if (Platform.OS === 'android') {
      Vibration.vibrate(100);
    }
    playSound();
    showToast({ type: 'success', message: 'Código escaneado correctamente' });

    // Disable scanning for 1.5 seconds to prevent rapid consecutive scans
    setIsScanning(false);
    setTimeout(() => {
      setIsScanning(true);
    }, 1500);
  };

  const handleAddManualCode = () => {
    if (!manualCode.trim()) {
      showToast({ type: 'warning', message: 'El código es requerido' });
      return;
    }

    // Validate that the code contains only numbers
    if (!/^\d+$/.test(manualCode.trim())) {
      showToast({ type: 'error', message: 'El código debe contener solo números' });
      return;
    }

    const codeExists = scannedCodes.some(
      codigo => codigo.codigo_barras_ean.trim().toLowerCase() === manualCode.trim().toLowerCase()
    );
    
    if (codeExists) {
      showToast({ type: 'warning', message: 'Este código ya está escaneado' });
      return;
    }

    const newCode = {
      codigo_barras_ean: manualCode.trim(),
      nota: null
    };

    setScannedCodes(prev => [...prev, newCode]);
    setManualCode('');
    if (Platform.OS === 'android') {
      Vibration.vibrate(100);
    }
    playSound();
    showToast({ type: 'success', message: 'Código agregado correctamente' });
  };

  const handleNextStep = () => {
    if (currentStep < tutorialSteps.length - 1) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePreviousStep = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSaveNota = (index) => {
    setScannedCodes(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], nota: newNota.trim() || null };
      return updated;
    });
    setNewNota('');
    setEditingIndex(null);
    showToast({ type: 'success', message: 'Nota guardada' });
  };

  const handleDeleteCode = (index) => {
    Alert.alert(
      'Eliminar Código',
      '¿Estás seguro de que quieres eliminar este código?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            setScannedCodes(prev => prev.filter((_, i) => i !== index));
            showToast({ type: 'success', message: 'Código eliminado' });
          },
        },
      ]
    );
  };

  const handleFinish = () => {
    if (onCodeScanned && typeof onCodeScanned === 'function') {
      onCodeScanned(scannedCodes);
    }
    navigation.goBack();
  };

  const isDarkMode = typeof isDark === 'boolean' ? isDark : isDark === 'true';

  if (!permission) {
    const styles = createStyles(responsive);
    return (
      <View style={[styles.safeArea, { backgroundColor: colors.background }]}>
        <StatusBar style={isDarkMode ? 'light' : 'dark'} />
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          <Text style={[styles.message, { color: colors.onSurface }]}>
            Solicitando permiso de cámara...
          </Text>
        </View>
      </View>
    );
  }

  if (!permission.granted) {
    const styles = createStyles(responsive);
    
    const handleRequestPermission = () => {
      requestPermission();
    };
    
    return (
      <View style={[styles.safeArea, { backgroundColor: colors.background }]}>
        <StatusBar style={isDarkMode ? 'light' : 'dark'} />
        <View style={[styles.container, styles.permissionContainer, { backgroundColor: colors.background }]}>
          <Text style={[styles.message, { color: colors.onSurface }]}>
            Necesitamos permiso para usar la cámara
          </Text>
          <TouchableOpacity
            style={[styles.permissionButton, { backgroundColor: colors.primary }]}
            onPress={handleRequestPermission}
          >
            <Text style={styles.permissionButtonText}>Conceder permiso</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const styles = createStyles(responsive);

  const SimpleHeader = () => (
    <View style={[styles.simpleHeader, { backgroundColor: colors.surface, borderBottomColor: colors.outlineVariant }]}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
        <Ionicons name="arrow-back" size={24} color={colors.primary} />
      </TouchableOpacity>
      <Text style={[styles.headerTitle, { color: colors.primary }]}>Escanear Códigos</Text>
      <View style={styles.headerSpacer} />
    </View>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      
      <SimpleHeader />

      <View style={styles.container}>
        {/* Camera Section - Top Half */}
        {(!isKeyboardVisible || isManualMode) && (
          <View style={styles.cameraContainer}>
            {!isManualMode ? (
              <>
                <CameraView
                  style={styles.camera}
                  barcodeScannerSettings={{
                    barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39'],
                  }}
                  onBarcodeScanned={isScanning ? handleBarcodeScanned : undefined}
                />
                <View style={styles.cameraOverlay}>
                  <View style={[styles.corner, styles.topLeft]} />
                  <View style={[styles.corner, styles.topRight]} />
                  <View style={[styles.corner, styles.bottomLeft]} />
                  <View style={[styles.corner, styles.bottomRight]} />
                  <Text style={[styles.cameraHint, { color: '#fff' }]}>
                    Apunta al código de barras
                  </Text>
                </View>
              </>
            ) : (
              <View style={[styles.manualInputContainer, { backgroundColor: colors.surface }]}>
                <Text style={[styles.manualInputTitle, { color: colors.onSurface }]}>
                  Ingresar código manualmente
                </Text>
                <TextInput
                  style={[styles.manualCodeInput, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                  placeholder="Ingrese el código (solo números)"
                  placeholderTextColor={colors.outline}
                  value={manualCode}
                  onChangeText={setManualCode}
                  keyboardType="numeric"
                  maxLength={13}
                />
                <TouchableOpacity
                  style={[styles.addManualCodeButton, { backgroundColor: colors.primary }]}
                  onPress={handleAddManualCode}
                >
                  <Ionicons name="add" size={responsive.responsiveWidth(20)} color="#fff" />
                  <Text style={[styles.addManualCodeButtonText, { color: '#fff' }]}>
                    Agregar código
                  </Text>
                </TouchableOpacity>
              </View>
            )}
            
            {/* Toggle Button */}
            <TouchableOpacity
              style={[styles.toggleModeButton, { backgroundColor: colors.surface }]}
              onPress={() => setIsManualMode(!isManualMode)}
            >
              <Ionicons 
                name={isManualMode ? "camera" : "keypad"} 
                size={responsive.responsiveWidth(20)} 
                color={colors.primary} 
              />
              <Text style={[styles.toggleModeButtonText, { color: colors.primary }]}>
                {isManualMode ? 'Usar cámara' : 'Ingresar manualmente'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Bottom Section - Tutorial or Code List */}
        <View style={[styles.bottomSection, { backgroundColor: colors.surface, flex: isKeyboardVisible ? 1 : 1 }]}>
          {showTutorial && !isKeyboardVisible ? (
            /* Tutorial Section */
            <View style={styles.tutorialContainer}>
              <Card style={[styles.tutorialCard, { backgroundColor: colors.background }]}>
                <Text style={[styles.tutorialText, { color: colors.onSurface }]}>
                  {tutorialSteps[currentStep]}
                </Text>
                {currentStep === 0 && (
                  <View style={styles.imageCarousel}>
                    <Image 
                      source={step1Images[carouselIndex]} 
                      style={styles.carouselImage}
                      resizeMode="contain"
                    />
                    <View style={styles.carouselDots}>
                      {step1Images.map((_, index) => (
                        <View
                          key={index}
                          style={[
                            styles.carouselDot,
                            { backgroundColor: index === carouselIndex ? colors.primary : colors.outlineVariant }
                          ]}
                        />
                      ))}
                    </View>
                  </View>
                )}
                {currentStep === 1 && (
                  <View style={styles.imageCarousel}>
                    <Image 
                      source={step2Images[carouselIndex2]} 
                      style={styles.carouselImage}
                      resizeMode="contain"
                    />
                    <View style={styles.carouselDots}>
                      {step2Images.map((_, index) => (
                        <View
                          key={index}
                          style={[
                            styles.carouselDot,
                            { backgroundColor: index === carouselIndex2 ? colors.primary : colors.outlineVariant }
                          ]}
                        />
                      ))}
                    </View>
                  </View>
                )}
              </Card>

              <View style={styles.navigationButtons}>
                <TouchableOpacity
                  style={[
                    styles.navButton,
                    { backgroundColor: currentStep === 0 ? colors.outlineVariant : (isDarkMode ? colors.primaryContainer : '#E3F2FD') }
                  ]}
                  onPress={handlePreviousStep}
                  disabled={currentStep === 0}
                >
                  <Ionicons 
                    name="chevron-back" 
                    size={responsive.responsiveWidth(20)} 
                    color={currentStep === 0 ? colors.outline : (isDarkMode ? colors.primary : '#1976D2')} 
                  />
                  <Text style={[
                    styles.navButtonText, 
                    { color: currentStep === 0 ? colors.outline : (isDarkMode ? colors.primary : '#1976D2') }
                  ]}>
                    Anterior
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.navButton,
                    { backgroundColor: colors.primary }
                  ]}
                  onPress={currentStep === tutorialSteps.length - 1 ? () => setShowTutorial(false) : handleNextStep}
                >
                  <Text style={[styles.navButtonText, { color: '#fff' }]}>
                    {currentStep === tutorialSteps.length - 1 ? 'Finalizar' : 'Siguiente'}
                  </Text>
                  <Ionicons 
                    name={currentStep === tutorialSteps.length - 1 ? "checkmark" : "chevron-forward"}
                    size={responsive.responsiveWidth(20)} 
                    color="#fff" 
                  />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.skipButton, { borderColor: colors.outline }]}
                onPress={() => setShowTutorial(false)}
              >
                <Text style={[styles.skipButtonText, { color: colors.outline }]}>
                  Omitir tutorial
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* Scanned Codes List Section */
            <View style={styles.codesListContainer}>
              <View style={styles.codesListHeader}>
                <Text style={[styles.codesListTitle, { color: colors.onSurface }]}>
                  Códigos escaneados ({scannedCodes.length})
                </Text>
                <TouchableOpacity
                  style={[styles.showTutorialButton, { backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD' }]}
                  onPress={() => setShowTutorial(true)}
                >
                  <Ionicons name="information-circle" size={responsive.responsiveWidth(18)} color={isDarkMode ? colors.primary : '#1976D2'} />
                  <Text style={[styles.showTutorialButtonText, { color: isDarkMode ? colors.primary : '#1976D2' }]}>
                    Ver tutorial
                  </Text>
                </TouchableOpacity>
              </View>

              <ScrollView 
                style={styles.codesList}
                contentContainerStyle={styles.codesListContent}
                showsVerticalScrollIndicator={true}
                keyboardShouldPersistTaps="always"
                nestedScrollEnabled={true}
              >
                {scannedCodes.length === 0 ? (
                  <Text style={[styles.emptyText, { color: colors.outline }]}>
                    No hay códigos escaneados
                  </Text>
                ) : (
                  scannedCodes.map((codigo, index) => (
                    <View key={index} style={[styles.codeItem, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}>
                      <View style={styles.codeItemContent}>
                        <Text style={[styles.codeText, { color: colors.onSurface }]}>
                          {codigo.codigo_barras_ean}
                        </Text>
                        {editingIndex === index ? (
                          <TextInput
                            style={[styles.notaInput, { backgroundColor: colors.surface, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                            placeholder="Agregar nota"
                            placeholderTextColor={colors.outline}
                            value={newNota}
                            onChangeText={setNewNota}
                            onSubmitEditing={() => handleSaveNota(index)}
                            returnKeyType="done"
                          />
                        ) : (
                          <TouchableOpacity onPress={() => {
                            setEditingIndex(index);
                            setNewNota(codigo.nota || '');
                          }}>
                            <Text style={[styles.notaText, { color: colors.outline }]}>
                              {codigo.nota || 'Agregar nota'}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                      <TouchableOpacity
                        style={[styles.deleteButton, { backgroundColor: isDarkMode ? colors.errorContainer : '#FFEBEE' }]}
                        onPress={() => handleDeleteCode(index)}
                      >
                        <Ionicons name="close" size={responsive.responsiveWidth(16)} color={colors.error} />
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </ScrollView>

              {!isKeyboardVisible && (
                <TouchableOpacity
                  style={[styles.finishButton, { backgroundColor: colors.primary }]}
                  onPress={handleFinish}
                  disabled={scannedCodes.length === 0}
                >
                  <Text style={[styles.finishButtonText, { color: '#fff' }]}>
                    Finalizar ({scannedCodes.length})
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
};

const createStyles = (responsive) => StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  permissionContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentWrapper: {
    flex: 1,
  },
  simpleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  headerSpacer: {
    width: 40,
  },
  mainContainer: {
    flex: 1,
    marginTop: 60, // Space for header
  },
  message: {
    fontSize: responsive.responsiveWidth(16),
    textAlign: 'center',
    marginBottom: responsive.responsiveHeight(20),
  },
  permissionButton: {
    paddingHorizontal: responsive.responsiveWidth(30),
    paddingVertical: responsive.responsiveHeight(15),
    borderRadius: responsive.responsiveWidth(10),
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: responsive.responsiveWidth(16),
    fontWeight: '600',
  },
  cameraContainer: {
    height: responsive.responsiveHeight(250),
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  corner: {
    position: 'absolute',
    width: responsive.responsiveWidth(60),
    height: responsive.responsiveHeight(60),
    borderColor: '#fff',
    borderWidth: responsive.responsiveWidth(3),
  },
  topLeft: {
    top: responsive.responsiveHeight(80),
    left: responsive.responsiveWidth(40),
    borderBottomWidth: 0,
    borderRightWidth: 0,
  },
  topRight: {
    top: responsive.responsiveHeight(80),
    right: responsive.responsiveWidth(40),
    borderBottomWidth: 0,
    borderLeftWidth: 0,
  },
  bottomLeft: {
    bottom: responsive.responsiveHeight(80),
    left: responsive.responsiveWidth(40),
    borderTopWidth: 0,
    borderRightWidth: 0,
  },
  bottomRight: {
    bottom: responsive.responsiveHeight(80),
    right: responsive.responsiveWidth(40),
    borderTopWidth: 0,
    borderLeftWidth: 0,
  },
  cameraHint: {
    fontSize: responsive.responsiveWidth(14),
    marginTop: responsive.responsiveHeight(20),
    textAlign: 'center',
  },
  manualInputContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: responsive.responsiveWidth(20),
  },
  manualInputTitle: {
    fontSize: responsive.responsiveWidth(16),
    fontWeight: '600',
    marginBottom: responsive.responsiveHeight(20),
  },
  manualCodeInput: {
    width: '100%',
    padding: responsive.responsiveWidth(15),
    borderRadius: responsive.responsiveWidth(10),
    borderWidth: 1,
    fontSize: responsive.responsiveWidth(16),
    marginBottom: responsive.responsiveHeight(15),
    textAlign: 'center',
  },
  addManualCodeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: responsive.responsiveWidth(20),
    paddingVertical: responsive.responsiveHeight(12),
    borderRadius: responsive.responsiveWidth(10),
  },
  addManualCodeButtonText: {
    color: '#fff',
    fontSize: responsive.responsiveWidth(14),
    fontWeight: '600',
    marginLeft: responsive.responsiveWidth(8),
  },
  toggleModeButton: {
    position: 'absolute',
    bottom: responsive.responsiveHeight(20),
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: responsive.responsiveWidth(15),
    paddingVertical: responsive.responsiveHeight(10),
    borderRadius: responsive.responsiveWidth(20),
    alignSelf: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  toggleModeButtonText: {
    fontSize: responsive.responsiveWidth(12),
    fontWeight: '600',
    marginLeft: responsive.responsiveWidth(5),
  },
  bottomSection: {
    flex: 1,
    borderTopLeftRadius: responsive.responsiveWidth(20),
    borderTopRightRadius: responsive.responsiveWidth(20),
    paddingHorizontal: responsive.responsiveWidth(20),
    paddingTop: responsive.responsiveHeight(20),
    paddingBottom: responsive.responsiveHeight(30),
  },
  tutorialContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  tutorialCard: {
    padding: responsive.responsiveWidth(12),
    marginBottom: responsive.responsiveHeight(20),
  },
  tutorialText: {
    fontSize: responsive.responsiveWidth(14),
    textAlign: 'center',
    lineHeight: responsive.responsiveHeight(20),
    marginBottom: responsive.responsiveHeight(15),
  },
  imageCarousel: {
    alignItems: 'center',
    marginTop: responsive.responsiveHeight(10),
  },
  carouselImage: {
    width: '100%',
    height: responsive.responsiveHeight(200),
    borderRadius: responsive.responsiveWidth(10),
  },
  carouselDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: responsive.responsiveHeight(10),
  },
  carouselDot: {
    width: responsive.responsiveWidth(8),
    height: responsive.responsiveWidth(8),
    borderRadius: responsive.responsiveWidth(4),
    marginHorizontal: responsive.responsiveWidth(4),
  },
  navigationButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: responsive.responsiveHeight(15),
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: responsive.responsiveWidth(20),
    paddingVertical: responsive.responsiveHeight(12),
    borderRadius: responsive.responsiveWidth(10),
  },
  navButtonText: {
    fontSize: responsive.responsiveWidth(14),
    fontWeight: '600',
    marginHorizontal: responsive.responsiveWidth(5),
  },
  skipButton: {
    alignSelf: 'center',
    paddingHorizontal: responsive.responsiveWidth(20),
    paddingVertical: responsive.responsiveHeight(10),
    borderRadius: responsive.responsiveWidth(10),
    borderWidth: 1,
  },
  skipButtonText: {
    fontSize: responsive.responsiveWidth(14),
  },
  codesListContainer: {
    flex: 1,
  },
  codesListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: responsive.responsiveHeight(15),
  },
  codesListTitle: {
    fontSize: responsive.responsiveWidth(18),
    fontWeight: '600',
  },
  showTutorialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: responsive.responsiveWidth(12),
    paddingVertical: responsive.responsiveHeight(8),
    borderRadius: responsive.responsiveWidth(8),
  },
  showTutorialButtonText: {
    fontSize: responsive.responsiveWidth(12),
    marginLeft: responsive.responsiveWidth(5),
  },
  codesList: {
    flex: 1,
    marginBottom: responsive.responsiveHeight(20),
    maxHeight: responsive.responsiveHeight(500),
  },
  codesListContent: {
    paddingBottom: responsive.responsiveHeight(20),
  },
  emptyText: {
    textAlign: 'center',
    fontSize: responsive.responsiveWidth(14),
    marginTop: responsive.responsiveHeight(20),
  },
  codeItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: responsive.responsiveWidth(15),
    borderRadius: responsive.responsiveWidth(10),
    marginBottom: responsive.responsiveHeight(10),
    borderWidth: 1,
  },
  codeItemContent: {
    flex: 1,
  },
  codeText: {
    fontSize: responsive.responsiveWidth(14),
    fontWeight: '600',
    marginBottom: responsive.responsiveHeight(5),
  },
  notaText: {
    fontSize: responsive.responsiveWidth(12),
    fontStyle: 'italic',
  },
  notaInput: {
    fontSize: responsive.responsiveWidth(12),
    padding: responsive.responsiveWidth(8),
    borderRadius: responsive.responsiveWidth(5),
    borderWidth: 1,
    marginTop: responsive.responsiveHeight(5),
  },
  deleteButton: {
    padding: responsive.responsiveWidth(8),
    borderRadius: responsive.responsiveWidth(8),
    marginLeft: responsive.responsiveWidth(10),
  },
  finishButton: {
    paddingVertical: responsive.responsiveHeight(15),
    borderRadius: responsive.responsiveWidth(10),
    alignItems: 'center',
  },
  finishButtonText: {
    fontSize: responsive.responsiveWidth(16),
    fontWeight: '600',
  },
});

export const BarcodeScannerScreen = () => {
  return (
    <BarcodeScannerContent />
  );
};
