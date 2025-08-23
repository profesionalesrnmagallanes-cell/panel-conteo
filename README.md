# Panel en tiempo real (Next.js + Firestore)

## 1) Qué necesitas
- Un proyecto Firebase (ya lo tienes: `conteo-en-vivo`) con Firestore habilitado.

## 2) Dónde está tu configuración
- Ya viene dentro de `lib/firebase.ts` (apiKey y projectId de tu proyecto).

## 3) Cómo desplegar (Vercel)
1. Sube estos archivos a tu repo `panel-conteo` en GitHub (uno por uno).
2. Ve a https://vercel.com → “Add New → Project” → importa `panel-conteo`.
3. Vercel detecta Next.js → “Deploy”. Listo. Obtienes una URL pública.

## 4) Probar en vivo (sin app móvil)
En Firebase Console → Firestore → crea **colección** `resultados` y agrega un **documento** con:
- `eleccionId`: `2025`
- `localId`: `LAB-PA`
- `mesaId`: `LAB-PA-M1`
- `cargoId`: `PRE`
- `candidatoId`: `PRE-0001`
- `votos`: `10` (número)

Guarda. Abre tu URL de Vercel: verás el cambio al instante.
