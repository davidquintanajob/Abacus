import { NativeModules, Platform } from 'react-native';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

const { ExportModule } = NativeModules;

class ExportService {
  constructor() {
    this._isNativeModuleAvailable = null;
    this._isExpoGo = null;
  }

  /**
   * Detecta si está ejecutándose en Expo Go usando expo-constants
   * @returns {boolean} true si es Expo Go
   */
  isExpoGo() {
    if (this._isExpoGo !== null) {
      return this._isExpoGo;
    }
    
    // Usar expo-constants para detectar el entorno oficialmente
    this._isExpoGo = Constants.appOwnership === 'expo';
    return this._isExpoGo;
  }

  /**
   * Verifica si el módulo nativo está disponible
   * @returns {boolean} true si está disponible
   */
  isNativeModuleAvailable() {
    if (this._isNativeModuleAvailable !== null) {
      return this._isNativeModuleAvailable;
    }
    
    this._isNativeModuleAvailable = !!ExportModule;
    return this._isNativeModuleAvailable;
  }

  /**
   * Guarda un archivo usando MediaStore (producción)
   * @param {Object} options - Opciones del archivo
   * @returns {Promise<Object>} Resultado con success, method, path, filename
   */
  async saveWithMediaStore({ filename, mimeType, base64 }) {
    try {
      const uri = await ExportModule.saveFile({ filename, mimeType, base64 });
      return {
        success: true,
        method: 'MediaStore',
        path: uri,
        filename,
        message: 'Archivo guardado correctamente en Descargas.'
      };
    } catch (error) {
      console.error('Error saving with MediaStore:', error);
      return {
        success: false,
        method: 'MediaStore',
        error: 'No fue posible guardar el archivo automáticamente.'
      };
    }
  }

  /**
   * Guarda un archivo en cache y abre Sharing (Expo Go)
   * @param {Object} options - Opciones del archivo
   * @returns {Promise<Object>} Resultado con success, method, uri, filename
   */
  async saveWithSharing({ filename, mimeType, base64 }) {
    try {
      // Guardar en cache primero
      const cacheDir = FileSystem.cacheDirectory;
      const tempUri = `${cacheDir}${filename}`;
      await FileSystem.writeAsStringAsync(tempUri, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Abrir Sharing
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        throw new Error('Sharing no disponible');
      }

      await Sharing.shareAsync(tempUri, {
        mimeType,
        dialogTitle: 'Guardar documento',
      });

      return {
        success: true,
        method: 'Sharing',
        uri: tempUri,
        filename,
        message: 'Abre el diálogo para guardar o compartir el archivo.'
      };
    } catch (error) {
      console.error('Error saving with Sharing:', error);
      return {
        success: false,
        method: 'Sharing',
        error: 'No fue posible abrir el menú para compartir.'
      };
    }
  }

  /**
   * Guarda un archivo en cache (fallback cuando Sharing no está disponible)
   * @param {Object} options - Opciones del archivo
   * @returns {Promise<Object>} Resultado con success, method, path, filename
   */
  async saveToCache({ filename, mimeType, base64 }) {
    try {
      const cacheDir = FileSystem.cacheDirectory;
      const fileUri = `${cacheDir}${filename}`;
      await FileSystem.writeAsStringAsync(fileUri, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      return {
        success: true,
        method: 'Cache',
        path: fileUri,
        filename,
        message: `Archivo guardado temporalmente en: ${fileUri}`
      };
    } catch (error) {
      console.error('Error saving to cache:', error);
      return {
        success: false,
        method: 'Cache',
        error: 'No fue posible guardar el archivo.'
      };
    }
  }

  /**
   * Guarda un archivo detectando automáticamente el método más apropiado
   * @param {Object} options - Opciones del archivo
   * @param {string} options.filename - Nombre del archivo
   * @param {string} options.mimeType - Tipo MIME del archivo
   * @param {string} options.base64 - Contenido del archivo en base64
   * @returns {Promise<Object>} Resultado con success, method, path/uri, filename, message
   */
  async saveFile({ filename, mimeType, base64 }) {
    if (Platform.OS !== 'android') {
      return {
        success: false,
        method: 'None',
        error: 'ExportService solo está disponible en Android'
      };
    }

    // Si existe módulo nativo, usar MediaStore (producción)
    if (this.isNativeModuleAvailable()) {
      const result = await this.saveWithMediaStore({ filename, mimeType, base64 });
      if (result.success) {
        return result;
      }
    }

    // Si es Expo Go o no hay módulo nativo, usar Sharing
    const sharingResult = await this.saveWithSharing({ filename, mimeType, base64 });
    if (sharingResult.success) {
      return sharingResult;
    }

    // Fallback: guardar en cache
    const cacheResult = await this.saveToCache({ filename, mimeType, base64 });
    if (cacheResult.success) {
      return {
        ...cacheResult,
        message: 'No fue posible guardar automáticamente. El archivo está en cache temporal.'
      };
    }

    // Todos los métodos fallaron
    return {
      success: false,
      method: 'None',
      error: 'No fue posible guardar el archivo por ningún método.'
    };
  }

  /**
   * Guarda un archivo PDF
   * @param {string} filename - Nombre del archivo
   * @param {string} pdfBase64 - Contenido PDF en base64
   * @returns {Promise<Object>} Resultado con success, method, path/uri, filename, message
   */
  async savePdf(filename, pdfBase64) {
    return this.saveFile({
      filename,
      mimeType: 'application/pdf',
      base64: pdfBase64
    });
  }

  /**
   * Guarda un archivo Excel
   * @param {string} filename - Nombre del archivo
   * @param {string} excelBase64 - Contenido Excel en base64
   * @returns {Promise<Object>} Resultado con success, method, path/uri, filename, message
   */
  async saveExcel(filename, excelBase64) {
    return this.saveFile({
      filename,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      base64: excelBase64
    });
  }

  /**
   * Guarda un archivo CSV
   * @param {string} filename - Nombre del archivo
   * @param {string} csvBase64 - Contenido CSV en base64
   * @returns {Promise<Object>} Resultado con success, method, path/uri, filename, message
   */
  async saveCsv(filename, csvBase64) {
    return this.saveFile({
      filename,
      mimeType: 'text/csv',
      base64: csvBase64
    });
  }

  /**
   * Guarda un archivo de texto
   * @param {string} filename - Nombre del archivo
   * @param {string} textBase64 - Contenido de texto en base64
   * @returns {Promise<Object>} Resultado con success, method, path/uri, filename, message
   */
  async saveText(filename, textBase64) {
    return this.saveFile({
      filename,
      mimeType: 'text/plain',
      base64: textBase64
    });
  }

  /**
   * Guarda una imagen PNG
   * @param {string} filename - Nombre del archivo
   * @param {string} imageBase64 - Contenido de imagen en base64
   * @returns {Promise<Object>} Resultado con success, method, path/uri, filename, message
   */
  async savePng(filename, imageBase64) {
    return this.saveFile({
      filename,
      mimeType: 'image/png',
      base64: imageBase64
    });
  }

  /**
   * Guarda una imagen JPEG
   * @param {string} filename - Nombre del archivo
   * @param {string} imageBase64 - Contenido de imagen en base64
   * @returns {Promise<Object>} Resultado con success, method, path/uri, filename, message
   */
  async saveJpeg(filename, imageBase64) {
    return this.saveFile({
      filename,
      mimeType: 'image/jpeg',
      base64: imageBase64
    });
  }

  /**
   * Guarda una imagen (detecta tipo automáticamente)
   * @param {string} filename - Nombre del archivo
   * @param {string} imageBase64 - Contenido de imagen en base64
   * @returns {Promise<Object>} Resultado con success, method, path/uri, filename, message
   */
  async saveImage(filename, imageBase64) {
    const mimeType = filename.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
    return this.saveFile({
      filename,
      mimeType,
      base64: imageBase64
    });
  }

  /**
   * Verifica si el módulo nativo está disponible
   * @returns {boolean} true si está disponible
   */
  checkAvailability() {
    return this.isNativeModuleAvailable();
  }

  /**
   * Obtiene el entorno actual
   * @returns {string} 'expo-go' | 'production'
   */
  getEnvironment() {
    return this.isExpoGo() ? 'expo-go' : 'production';
  }
}

// Exportar una instancia única
export default new ExportService();
