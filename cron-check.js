const admin = require('firebase-admin');
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function runCheck() {
  console.log('--- BUSCANDO PERFILES ---');
  const usuariosSnapshot = await db.collection('usuarios').get();

  for (const userDoc of usuariosSnapshot.docs) {
    const profileSnap = await userDoc.ref.collection('profile').doc('data').get();
    
    if (profileSnap.exists) {
      const data = profileSnap.data();
      console.log('ID:', userDoc.id);
      console.log('Contenido completo del perfil:', JSON.stringify(data)); // <--- ¡AQUÍ ESTÁ LA CLAVE!
    }
  }
}

runCheck().catch(console.error);
