const admin = require('firebase-admin');
const { Resend } = require('resend');
const twilio = require('twilio');

// Asegurarnos de que el JSON es válido
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
const resend = new Resend(process.env.RESEND_API_KEY);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

async function runCheck() {
  console.log('--- INICIANDO ESCANEO DE USUARIOS ---');
  
  // Buscamos en la colección 'usuarios'
  const usersRef = db.collection('usuarios');
  const snapshot = await usersRef.get();

  if (snapshot.empty) {
    console.log('ERROR: No se encontró la colección "usuarios" en Firebase.');
    return;
  }

  for (const userDoc of snapshot.docs) {
    console.log('Revisando usuario:', userDoc.id);
    
    // Accedemos a la subcolección 'profile'
    const profileSnap = await userDoc.ref.collection('profile').doc('data').get();
    
    if (!profileSnap.exists) {
      console.log('No tiene perfil en profile/data');
      continue;
    }

    const userData = profileSnap.data();
    console.log('Perfil encontrado para:', userData.contact?.name || 'Sin nombre');

    if (!userData.contact?.wantsAlerts) {
      console.log('Alertas desactivadas para este usuario.');
      continue;
    }

    console.log('Usuario quiere alertas. Correo:', userData.contact.email);
    // ... aquí iría el resto de tu lógica de envío ...
    console.log('FIN DE REVISIÓN PARA ESTE USUARIO');
  }
}

runCheck().catch(err => console.error('Error crítico:', err));
