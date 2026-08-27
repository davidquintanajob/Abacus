This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Configuración del Entorno

Antes de iniciar el proyecto, es necesario configurar las variables de entorno:

1. **Crear el archivo `.env` a partir del ejemplo:**
   ```bash
   # En Windows (PowerShell)
   Copy-Item .env.example .env

   # En Windows (CMD)
   copy .env.example .env

   # En Linux/Mac
   cp .env.example .env
   ```

2. **Editar el archivo `.env` con tu configuración:**
   ```env
   # API Configuration
   # URL del backend API (local o en la nube)
   # Para desarrollo local: http://localhost:8787 (puerto por defecto del backend)
   # Para producción en la nube: https://tu-backend-api.com
   NEXT_PUBLIC_API_URL=http://localhost:8787

   # Web Server Port
   # Puerto donde correrá la aplicación web
   PORT=3000
   ```

**Importante:**
- La variable `NEXT_PUBLIC_API_URL` define dónde está tu backend API
- Para desarrollo local usa `http://localhost:8787` (el puerto del backend Abacus)
- Para producción en la nube, cambia esta URL a la de tu backend en la nube
- No incluyas el archivo `.env` en el control de versiones (ya está en `.gitignore`)
- El archivo `.env.example` sirve como guía para tus compañeros de equipo

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
