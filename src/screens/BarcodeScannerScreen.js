import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert, Modal, KeyboardAvoidingView, Platform, Keyboard, Dimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeContext';
import { Card } from '../components/common/Card';
import { Ionicons } from '@expo/vector-icons';
import { useResponsive } from '../hooks/useResponsive';
import { useToast } from '../hooks/useToast';
import { CameraView, useCameraPermissions } from 'expo-camera';

const BarcodeScannerContent = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { colors, isDark } = useTheme();
  const responsive = useResponsive();
  const { toast, showToast, hideToast } = useToast();
  const [permission, requestPermission] = useCameraPermissions();
  const [onCodeScanned, setOnCodeScanned] = useState(null);

  useFocusEffect(
    React.useCallback(() => {
      const params = route.params;
      if (params?.onCodeScanned) {
        setOnCodeScanned(() => params.onCodeScanned);
      }
      return () => {
        setOnCodeScanned(null);
      };
    }, [route.params])
  );

  const [scannedCodes, setScannedCodes] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [showTutorial, setShowTutorial] = useState(true);
  const [newNota, setNewNota] = useState('');
  const [editingIndex, setEditingIndex] = useState(null);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  const tutorialSteps = [
    'Paso 1: Agrupa todos los productos del mismo tipo, aunque distintos sabores o colores',
    'Paso 2: Voltealos de tal forma que veas su código de barra',
    'Paso 3: Escanea con la cámara el código de barra de cada producto y agrega una nota a estos si lo deseas'
  ];

  useEffect(() => {
    if (scannedCodes.length > 0) {
      setShowTutorial(false);
    }
  }, [scannedCodes.length]);

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
    showToast({ type: 'success', message: 'Código escaneado correctamente' });
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
    return (
      <View style={[styles.safeArea, { backgroundColor: colors.background }]}>
        <StatusBar style={isDarkMode ? 'light' : 'dark'} />
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          <Text style={[styles.message, { color: colors.onSurface }]}>
            Necesitamos permiso para usar la cámara
          </Text>
          <TouchableOpacity
            style={[styles.permissionButton, { backgroundColor: colors.primary }]}
            onPress={requestPermission}
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
        {!isKeyboardVisible && (
          <View style={styles.cameraContainer}>
            <CameraView
              style={styles.camera}
              barcodeScannerSettings={{
                barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39'],
              }}
              onBarcodeScanned={handleBarcodeScanned}
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
          </View>
        )}

        {/* Bottom Section - Tutorial or Code List */}
        <View style={[styles.bottomSection, { backgroundColor: colors.surface, flex: isKeyboardVisible ? 1 : 1 }]}>
          {showTutorial ? (
            /* Tutorial Section */
            <View style={styles.tutorialContainer}>
              <View style={styles.stepIndicator}>
                {tutorialSteps.map((_, index) => (
                  <View
                    key={index}
                    style={[
                      styles.stepDot,
                      { backgroundColor: index === currentStep ? colors.primary : colors.outlineVariant }
                    ]}
                  />
                ))}
              </View>
              
              <Card style={[styles.tutorialCard, { backgroundColor: colors.background }]}>
                <Text style={[styles.tutorialText, { color: colors.onSurface }]}>
                  {tutorialSteps[currentStep]}
                </Text>
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
                  onPress={handleNextStep}
                  disabled={currentStep === tutorialSteps.length - 1}
                >
                  <Text style={[styles.navButtonText, { color: '#fff' }]}>
                    Siguiente
                  </Text>
                  <Ionicons 
                    name="chevron-forward" 
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

              <TouchableOpacity
                style={[styles.finishButton, { backgroundColor: colors.primary }]}
                onPress={handleFinish}
                disabled={scannedCodes.length === 0}
              >
                <Text style={[styles.finishButtonText, { color: '#fff' }]}>
                  Finalizar ({scannedCodes.length})
                </Text>
              </TouchableOpacity>
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
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: responsive.responsiveHeight(20),
  },
  stepDot: {
    width: responsive.responsiveWidth(10),
    height: responsive.responsiveWidth(10),
    borderRadius: responsive.responsiveWidth(5),
    marginHorizontal: responsive.responsiveWidth(5),
  },
  tutorialCard: {
    padding: responsive.responsiveWidth(20),
    marginBottom: responsive.responsiveHeight(20),
  },
  tutorialText: {
    fontSize: responsive.responsiveWidth(16),
    textAlign: 'center',
    lineHeight: responsive.responsiveHeight(24),
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
