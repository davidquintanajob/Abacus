'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../hooks/useToast';
import { Header } from '../../components/layout/Header';
import { SidebarNavigation } from '../../components/layout/SidebarNavigation';
import { Toast } from '../../components/common/Toast';
import { useResponsive } from '../../hooks/useResponsive';
import { 
  ArrowLeft, 
  Camera, 
  Keyboard, 
  Plus, 
  Trash2, 
  RefreshCw, 
  X, 
  Info,
  Check,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

export default function BarcodeScannerPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { colors, isDark } = useTheme();
  const { toast, showToast, hideToast } = useToast();
  const { isMobile, isTablet, isDesktop } = useResponsive();
  
  const [scannedCodes, setScannedCodes] = useState<Array<{ codigo_barras_ean: string; nota: string | null }>>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [showTutorial, setShowTutorial] = useState(true);
  const [newNota, setNewNota] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isManualMode, setIsManualMode] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [isScanning, setIsScanning] = useState(true);
  const [scanBuffer, setScanBuffer] = useState<string[]>([]);
  const [scanCount, setScanCount] = useState(0);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [carouselIndex2, setCarouselIndex2] = useState(0);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const tutorialSteps = [
    'Paso 1: Tome todas las variantes del mismo producto que tenga en su tienda',
    'Paso 2: Busque y escanee el código de barras de cada uno de estos productos',
    'Paso 3: (Opcional) Agregue una nota para identificar el color o sabor del producto en el código'
  ];

  const step1Images = [
    '/whatsapp_3.jpeg',
    '/whatsapp_2.jpeg',
    '/whatsapp_5.jpeg'
  ];

  const step2Images = [
    '/whatsapp_1.jpeg',
    '/whatsapp_4.jpeg',
    '/whatsapp_6.jpeg'
  ];

  useEffect(() => {
    // Check for existing codes from URL params
    const existingCodesParam = searchParams.get('existingCodes');
    if (existingCodesParam) {
      try {
        const existingCodes = JSON.parse(decodeURIComponent(existingCodesParam));
        setScannedCodes(existingCodes);
        setShowTutorial(false);
      } catch (error) {
        console.error('Error parsing existing codes:', error);
      }
    }
  }, [searchParams]);

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
      }, 2000);
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
      }, 2000);
      return () => clearInterval(interval);
    } else {
      setCarouselIndex2(0);
    }
  }, [showTutorial, currentStep]);

  useEffect(() => {
    if (!isManualMode && showBarcodeScannerModal) {
      startCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isManualMode]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' }, 
        audio: false 
      });
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Wait for video to be ready before playing
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current) {
            videoRef.current.play().catch(error => {
              console.error('Error playing video:', error);
            });
          }
        };
      }
      
      detectBarcode();
    } catch (error) {
      console.error('Error accessing camera:', error);
      showToast({ type: 'error', message: 'No se pudo acceder a la cámara' });
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const detectBarcode = async () => {
    if (!videoRef.current || !isScanning || isManualMode) return;
    
    if ('BarcodeDetector' in window) {
      try {
        const barcodeDetector = new (window as any).BarcodeDetector();
        const barcodes = await barcodeDetector.detect(videoRef.current);
        
        if (barcodes.length > 0) {
          const rawCode = barcodes[0].rawValue;
          handleBarcodeScanned(rawCode);
          return;
        }
      } catch (error) {
        console.error('Barcode detection error:', error);
      }
    }
    
    requestAnimationFrame(detectBarcode);
  };

  const handleBarcodeScanned = async (rawCode: string) => {
    if (!isScanning) return;

    try {
      const updatedBuffer = [...scanBuffer, rawCode];
      setScanBuffer(updatedBuffer);
      setScanCount(updatedBuffer.length);

      if (updatedBuffer.length >= 3) {
        setIsScanning(false);
        
        const codeCounts: { [key: string]: number } = {};
        updatedBuffer.forEach(code => {
          const normalizedCode = code.trim();
          codeCounts[normalizedCode] = (codeCounts[normalizedCode] || 0) + 1;
        });

        let winningCode = null;
        let maxCount = 0;
        for (const [code, count] of Object.entries(codeCounts)) {
          if (count > maxCount) {
            maxCount = count;
            winningCode = code;
          }
        }

        setScanBuffer([]);
        setScanCount(0);

        if (winningCode) {
          const codeExists = scannedCodes.some(
            codigo => codigo.codigo_barras_ean.trim().toLowerCase() === winningCode.trim().toLowerCase()
          );
          
          if (codeExists) {
            showToast({ type: 'warning', message: 'Este código ya está escaneado' });
          } else {
            const newCode = {
              codigo_barras_ean: winningCode,
              nota: null
            };
            setScannedCodes(prev => [...prev, newCode]);
            showToast({ type: 'success', message: 'Código escaneado correctamente' });
          }
        }

        setTimeout(() => {
          setIsScanning(true);
        }, 1500);
      } else {
        showToast({ 
          type: 'warning', 
          message: `Escaneo ${updatedBuffer.length}/3 - Mantén el código en la cámara` 
        });
      }
    } catch (error) {
      console.error('Error processing barcode:', error);
      showToast({ type: 'error', message: 'Error al procesar código' });
      setScanBuffer([]);
      setScanCount(0);
      setTimeout(() => {
        setIsScanning(true);
      }, 1500);
    }
  };

  const handleAddManualCode = () => {
    if (!manualCode.trim()) {
      showToast({ type: 'warning', message: 'El código es requerido' });
      return;
    }

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
    showToast({ type: 'success', message: 'Código agregado correctamente' });
  };

  const generateRandomEAN13 = () => {
    let code = '';
    for (let i = 0; i < 12; i++) {
      code += Math.floor(Math.random() * 10);
    }

    let sum = 0;
    for (let i = 0; i < 12; i++) {
      const digit = parseInt(code[i]);
      if (i % 2 === 0) {
        sum += digit * 1;
      } else {
        sum += digit * 3;
      }
    }
    const checksum = (10 - (sum % 10)) % 10;

    const fullCode = code + checksum;
    setManualCode(fullCode);
    showToast({ type: 'success', message: 'Código aleatorio generado' });
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

  const handleSaveNota = (index: number) => {
    setScannedCodes(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], nota: newNota.trim() || null };
      return updated;
    });
    setNewNota('');
    setEditingIndex(null);
    showToast({ type: 'success', message: 'Nota guardada' });
  };

  const handleDeleteCode = (index: number) => {
    setScannedCodes(prev => prev.filter((_, i) => i !== index));
    showToast({ type: 'success', message: 'Código eliminado' });
  };

  const handleFinish = () => {
    // Store codes in sessionStorage for the calling page to retrieve
    sessionStorage.setItem('scannedCodes', JSON.stringify(scannedCodes));
    router.back();
  };

  const handleBack = () => {
    stopCamera();
    router.back();
  };

  const showBarcodeScannerModal = !isManualMode;

  const isDarkMode = typeof isDark === 'boolean' ? isDark : isDark === 'true';

  const maxWidth = isDesktop ? '1200px' : isTablet ? '900px' : '100%';

  return (
    <div className="min-h-screen" style={{ backgroundColor: colors.background }}>
      <Header 
        showBackButton={true}
        onBackPress={handleBack}
        isDark={isDarkMode}
        title="Escanear Códigos"
      />
      <SidebarNavigation />
      <Toast
        visible={toast.visible}
        type={toast.type}
        message={toast.message}
        code={toast.code}
        duration={toast.duration}
        onHide={hideToast}
        toastKey={toast.key}
      />

      {/* Main Container with same width as form pages */}
      <div className="mx-auto" style={{ maxWidth, padding: isMobile ? '16px' : '24px', marginTop: '24px' }}>

        <div className="flex flex-col" style={{ minHeight: 'calc(100vh - 120px)' }}>
        {/* Camera Section - Top Half */}
        {showBarcodeScannerModal && (
          <div className="relative mx-auto" style={{ 
            width: isDesktop ? '400px' : '100%',
            height: isDesktop ? '400px' : '40vh', 
            backgroundColor: '#000',
            borderRadius: '12px',
            overflow: 'hidden'
          }}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative w-48 h-48">
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white" />
              </div>
            </div>
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white text-center">
              <p className="text-sm font-semibold">Apunta al código de barras</p>
            </div>
          </div>
        )}

        {/* Manual Input Section */}
        {isManualMode && (
          <div 
            className="flex flex-col items-center justify-center p-6 mx-auto"
            style={{ 
              width: isDesktop ? '400px' : '100%',
              height: isDesktop ? '400px' : '40vh', 
              backgroundColor: colors.surface,
              borderRadius: '12px'
            }}
          >
            <h2 className="text-lg font-semibold mb-4" style={{ color: colors.onSurface }}>
              Ingresar código manualmente
            </h2>
            <input
              type="text"
              className="w-full rounded-lg px-4 py-3 border focus:outline-none focus:ring-2 text-center"
              style={{ 
                backgroundColor: colors.background, 
                color: colors.onSurface, 
                borderColor: colors.outlineVariant
              }}
              placeholder="Ingrese el código (solo números)"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              maxLength={13}
            />
            <div className="flex gap-3 mt-4 w-full">
              <button
                className="flex-1 rounded-lg px-4 py-3 flex items-center justify-center gap-2 transition-colors hover:opacity-90"
                style={{ backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD' }}
                onClick={generateRandomEAN13}
              >
                <RefreshCw size={16} style={{ color: isDarkMode ? colors.primary : '#1976D2' }} />
                <span className="text-sm" style={{ color: isDarkMode ? colors.primary : '#1976D2' }}>
                  Generar código
                </span>
              </button>
              <button
                className="flex-1 rounded-lg px-4 py-3 flex items-center justify-center gap-2 transition-colors hover:opacity-90"
                style={{ backgroundColor: colors.primary, color: '#fff' }}
                onClick={handleAddManualCode}
              >
                <Plus size={16} />
                <span className="text-sm">Agregar código</span>
              </button>
            </div>
          </div>
        )}

        {/* Toggle Button */}
        <div className="flex justify-center py-2" style={{ backgroundColor: colors.surface }}>
          <button
            className="flex items-center gap-2 px-6 py-3 rounded-full transition-colors hover:opacity-90"
            style={{ backgroundColor: colors.primary, color: '#fff' }}
            onClick={() => {
              setIsManualMode(!isManualMode);
              if (!isManualMode) {
                stopCamera();
              } else {
                startCamera();
              }
            }}
          >
            {isManualMode ? <Camera size={20} /> : <Keyboard size={20} />}
            <span className="text-sm font-medium">
              {isManualMode ? 'Usar cámara' : 'Ingresar manualmente'}
            </span>
          </button>
        </div>

        {/* Bottom Section - Tutorial or Code List */}
        <div 
          className="flex-1 overflow-y-auto"
          style={{ backgroundColor: colors.surface }}
        >
          {showTutorial ? (
            /* Tutorial Section */
            <div className="flex flex-col h-full p-6">
              <div 
                className="rounded-2xl p-6 mb-4 flex-1 flex flex-col justify-center"
                style={{ backgroundColor: colors.background }}
              >
                <p className="text-lg text-center mb-6" style={{ color: colors.onSurface }}>
                  {tutorialSteps[currentStep]}
                </p>
                {currentStep === 0 && (
                  <div className="relative w-full h-48 mb-4 rounded-lg overflow-hidden">
                    <img 
                      src={step1Images[carouselIndex]} 
                      alt="Tutorial Step 1"
                      className="w-full h-full object-contain"
                    />
                    <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex gap-2">
                      {step1Images.map((_, index) => (
                        <div
                          key={index}
                          className="w-2 h-2 rounded-full"
                          style={{ 
                            backgroundColor: index === carouselIndex ? colors.primary : colors.outlineVariant 
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}
                {currentStep === 1 && (
                  <div className="relative w-full h-48 mb-4 rounded-lg overflow-hidden">
                    <img 
                      src={step2Images[carouselIndex2]} 
                      alt="Tutorial Step 2"
                      className="w-full h-full object-contain"
                    />
                    <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex gap-2">
                      {step2Images.map((_, index) => (
                        <div
                          key={index}
                          className="w-2 h-2 rounded-full"
                          style={{ 
                            backgroundColor: index === carouselIndex2 ? colors.primary : colors.outlineVariant 
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 mb-4">
                <button
                  className="flex-1 rounded-lg px-4 py-3 flex items-center justify-center gap-2 transition-colors hover:opacity-90"
                  style={{ 
                    backgroundColor: currentStep === 0 ? colors.outlineVariant : (isDarkMode ? colors.primaryContainer : '#E3F2FD'),
                    color: currentStep === 0 ? colors.outline : (isDarkMode ? colors.primary : '#1976D2')
                  }}
                  onClick={handlePreviousStep}
                  disabled={currentStep === 0}
                >
                  <ChevronLeft size={20} />
                  <span>Anterior</span>
                </button>

                <button
                  className="flex-1 rounded-lg px-4 py-3 flex items-center justify-center gap-2 transition-colors hover:opacity-90"
                  style={{ backgroundColor: colors.primary, color: '#fff' }}
                  onClick={currentStep === tutorialSteps.length - 1 ? () => setShowTutorial(false) : handleNextStep}
                >
                  <span>{currentStep === tutorialSteps.length - 1 ? 'Finalizar' : 'Siguiente'}</span>
                  {currentStep === tutorialSteps.length - 1 ? <Check size={20} /> : <ChevronRight size={20} />}
                </button>
              </div>

              <button
                className="w-full py-3 rounded-lg border transition-colors hover:opacity-90"
                style={{ borderColor: colors.outline, color: colors.outline }}
                onClick={() => setShowTutorial(false)}
              >
                Omitir tutorial
              </button>
            </div>
          ) : (
            /* Scanned Codes List Section */
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: colors.outlineVariant }}>
                <h2 className="font-semibold" style={{ color: colors.onSurface }}>
                  Códigos escaneados ({scannedCodes.length})
                </h2>
                <button
                  className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors hover:opacity-90"
                  style={{ backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD' }}
                  onClick={() => setShowTutorial(true)}
                >
                  <Info size={18} style={{ color: isDarkMode ? colors.primary : '#1976D2' }} />
                  <span className="text-sm" style={{ color: isDarkMode ? colors.primary : '#1976D2' }}>
                    Ver tutorial
                  </span>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                {scannedCodes.length === 0 ? (
                  <p className="text-center py-8" style={{ color: colors.outline }}>
                    No hay códigos escaneados
                  </p>
                ) : (
                  <div className="space-y-3">
                    {scannedCodes.map((codigo, index) => (
                      <div 
                        key={index}
                        className="flex items-center gap-3 p-3 rounded-lg"
                        style={{ backgroundColor: colors.background, borderColor: colors.outlineVariant, border: '1px solid' }}
                      >
                        <div className="flex-1">
                          <p className="font-medium text-sm" style={{ color: colors.onSurface }}>
                            {codigo.codigo_barras_ean}
                          </p>
                          {editingIndex === index ? (
                            <input
                              type="text"
                              className="w-full mt-1 rounded px-2 py-1 text-sm"
                              style={{ 
                                backgroundColor: colors.surface, 
                                color: colors.onSurface, 
                                borderColor: colors.outlineVariant 
                              }}
                              placeholder="Agregar nota"
                              value={newNota}
                              onChange={(e) => setNewNota(e.target.value)}
                              onBlur={() => handleSaveNota(index)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveNota(index);
                              }}
                              autoFocus
                            />
                          ) : (
                            <button
                              onClick={() => {
                                setEditingIndex(index);
                                setNewNota(codigo.nota || '');
                              }}
                              className="text-sm mt-1"
                              style={{ color: colors.outline }}
                            >
                              {codigo.nota || 'Agregar nota'}
                            </button>
                          )}
                        </div>
                        <button
                          className="p-2 rounded-lg transition-colors hover:opacity-80"
                          style={{ backgroundColor: isDarkMode ? colors.errorContainer : '#FFEBEE' }}
                          onClick={() => handleDeleteCode(index)}
                        >
                          <Trash2 size={16} style={{ color: colors.error }} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-4 border-t" style={{ borderColor: colors.outlineVariant }}>
                <button
                  className="w-full rounded-lg px-4 py-3 transition-colors hover:opacity-90"
                  style={{ backgroundColor: colors.primary, color: '#fff' }}
                  onClick={handleFinish}
                  disabled={scannedCodes.length === 0}
                >
                  Finalizar ({scannedCodes.length})
                </button>
              </div>
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}
