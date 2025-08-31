const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json'); // Asegúrate de tener tu archivo de credenciales aquí

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const setFirstAdmin = async () => {
  try {
    const uid = 'TU_UID_AQUI'; // <-- Reemplaza con tu UID
    await admin.auth().setCustomUserClaims(uid, { admin: true });
    console.log(`Claims de administrador asignadas a ${uid}`);
  } catch (error) {
    console.error('Error al asignar el claim de administrador:', error);
  }
};

setFirstAdmin();