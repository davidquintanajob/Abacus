# Abacus - Sistema de Gestión

Aplicación móvil de gestión con autenticación de usuarios, desarrollada con React Native/Expo y un backend en Node.js/Express con PostgreSQL.

## 📋 Requisitos Previos

- **Node.js** (v16 o superior)
- **npm** o **yarn**
- **PostgreSQL** (corriendo en puerto 5432)
- **Expo CLI** (opcional, para desarrollo)
- **Emulador Android/iOS** o dispositivo físico con Expo Go

## 🚀 Instalación y Configuración

### 1. Configurar el Backend

Navega al directorio del backend:

```bash
cd Abacus-backend
```

Instala las dependencias:

```bash
npm install
```

Crea el archivo `.env` (copia de `example.env`):

```bash
copy example.env .env
```

Edita `.env` con tus credenciales de PostgreSQL:

```env
# Configuración del servidor
PORT=4000
CORS_OPTIONS=*
ENVIRONMENT=development

# Configuración de JWT
JWT_SECRET=tu_clave_secreta_jwt_super_segura
REFRESH_TOKEN_SECRET=tu_clave_secreta_refresh_token_super_segura

# Configuración de la base de datos
DB_NAME=abacus-bd
DB_USER=postgres
DB_PASSWORD=TU_PASSWORD
DB_HOST=localhost
DB_PORT=5432
DB_DIALECT=postgres
```

**Importante:** Cambia `TU_PASSWORD` por tu contraseña real de PostgreSQL.

Inicia el backend:

```bash
npm run dev
```

El backend correrá en `http://localhost:4000` y la documentación API estará disponible en `http://localhost:4000/api-docs`

### 2. Configurar el Frontend

Desde el directorio raíz del proyecto:

Instala las dependencias:

```bash
npm install
```

### 3. Configurar la URL de la API (CRUCIAL)

El frontend necesita saber dónde está el backend. Esto se configura en `src/config.js`.

**Copia el archivo de ejemplo:**

```bash
copy src\config.example.js src\config.js
```

**Edita `src/config.js` con tu IP local:**

```javascript
export const API_CONFIG = {
  // Para Android emulator: usa tu IP local
  // Para iOS simulator/web: usa localhost
  API_BASE_URL: 'http://TU_IP_LOCAL:4000',
};
```

**Cómo obtener tu IP local:**

- **Windows:** Ejecuta `ipconfig` en CMD y busca "Dirección IPv4" en "Adaptador de LAN inalámbrica Wi-Fi"
- **Mac/Linux:** Ejecuta `ifconfig` o `ip a` y busca tu dirección IPv4

**Ejemplo:**
- Si tu IP es `192.168.1.50`, configura: `API_BASE_URL: 'http://192.168.1.50:4000'`
- Si usas iOS simulator o web: `API_BASE_URL: 'http://localhost:4000'`

### 4. Iniciar la Aplicación

```bash
npm start
```

## � Generar APK para Android (EAS Build)

Para generar un APK instalable en tu dispositivo Android, sigue estos pasos:

### 1. Instalar y Configurar EAS CLI

```bash
npm install -g eas-cli@latest
```

Inicia sesión en tu cuenta de Expo:

```bash
eas login
```

Configura el proyecto (solo la primera vez):

```bash
eas build:configure
```

### 2. Generar APK para Pruebas (Preview)

Este comando genera un APK para distribución interna que puedes instalar directamente en tu dispositivo:

```bash
eas build --platform android --profile preview
```

El APK estará disponible para descargar desde el dashboard de Expo. El proceso toma aproximadamente 10-15 minutos.

### 3. Generar APK para Producción (Opcional)

Para una versión de producción con optimizaciones adicionales:

```bash
eas build --platform android --profile production
```

### 4. Descargar e Instalar el APK

1. Ve al enlace que aparece en la terminal después del build (ej: `https://expo.dev/accounts/tu-usuario/projects/Abacus/builds/...`)
2. Descarga el archivo `.apk` desde el dashboard
3. Transfiere el APK a tu dispositivo Android
4. En tu dispositivo, ve a Configuración > Seguridad y habilita "Fuentes desconocidas"
5. Instala el APK

### Notas Importantes

- **Configuración actual del proyecto:** Este proyecto está configurado solo para Android (sin iOS ni web) para evitar conflictos de build
- **Perfil recomendado:** Usa `preview` para pruebas rápidas. Usa `production` solo para la versión final de la app
- **React Native Reanimated:** El proyecto incluye `react-native-reanimated` con el plugin de Babel configurado en `babel.config.js`
- **Tiempo de build:** Los builds de EAS se ejecutan en la nube y pueden tardar entre 10-20 minutos
- **Archivos necesarios para el build:** Los archivos `.gitignore` y `.easignore` en la raíz del proyecto son **ESSENCIALES** para poder realizar el build correctamente. Estos archivos controlan qué se incluye y qué se excluye del proceso de build de EAS. Sin estos archivos, el build puede fallar o incluir archivos innecesarios que causen problemas.

## �🔧 Solución de Problemas

### Error: "Native module is null, cannot access legacy storage"

Si encuentras este error con AsyncStorage, ejecuta:

```bash
# Limpiar caché de Expo y reinstalar dependencias
rm -rf node_modules
npm install
npx expo start -c
```

Si usas development build, reconstruye la app:
```bash
npx expo prebuild --clean
npx expo run:android  # o expo run:ios
```

Si usas Expo Go, asegúrate de tener la última versión instalada.