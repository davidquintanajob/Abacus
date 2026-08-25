import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';

/**
 * Compresses an image to reduce file size (copiada de historia_clinicaModal)
 * Adaptado para Expo Go: verifica disponibilidad de ImageManipulator
 * @param {string} uri - The URI of the image to compress
 * @param {number} quality - Compression quality (0-1), default 0.8
 * @returns {Promise<{uri: string, base64: string|null, width: number, height: number}|null>} Compressed image data or null if not available
 */
export const comprimirImagen = async (uri, quality = 0.8) => {
  try {
    // Verificar si ImageManipulator está disponible (no lo está en Expo Go Android)
    if (!ImageManipulator.manipulateAsync) {
      throw new Error('ImageManipulator no disponible en Expo Go (desarrollo). Funcionará en production build.');
    }

    const fileInfo = await FileSystem.getInfoAsync(uri);
    const sizeBefore = fileInfo.size;

    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1024 } }],
      { compress: quality, format: ImageManipulator.SaveFormat.JPEG, base64: true }
    );

    const compressedFileInfo = await FileSystem.getInfoAsync(result.uri);
    const sizeAfter = compressedFileInfo.size;

    return { uri: result.uri, base64: result.base64, width: result.width, height: result.height };
  } catch (error) {
    console.error('Error en compresión de imagen:', error);
    throw error; // Lanzar error para que el componente maneje el mensaje
  }
};

/**
 * Converts a URI to base64 string (copiada de historia_clinicaModal)
 * @param {string} uri - The URI of the image to convert
 * @returns {Promise<string>} Base64 string
 */
export const uriToBase64 = async (uri) => {
  if (!uri) return '';
  try {
    const enc = (FileSystem.EncodingType && FileSystem.EncodingType.Base64) ? FileSystem.EncodingType.Base64 : 'base64';
    try {
      const b64 = await FileSystem.readAsStringAsync(uri, { encoding: enc });
      return b64;
    } catch (readErr) {
      try {
        const tmpPath = FileSystem.documentDirectory + `tmp_image_${Date.now()}`;
        const dl = await FileSystem.downloadAsync(uri, tmpPath);
        const b64 = await FileSystem.readAsStringAsync(dl.uri, { encoding: 'base64' });
        try { await FileSystem.deleteAsync(dl.uri, { idempotent: true }); } catch (e) { }
        return b64;
      } catch (dlErr) {
        console.warn('Fallo al descargar/leer imagen para base64', dlErr);
        return '';
      }
    }
  } catch (err) {
    console.warn('No se pudo convertir imagen a base64', err);
    return '';
  }
};
