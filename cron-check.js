const admin = require('firebase-admin');

// 1. Conexión explícita
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

async function debugDatabase() {
  console.log('--- DIAGNÓSTICO PROFUNDO ---');
  
  try {
    // Intentamos listar las colecciones raíz para ver si 'usuarios' existe
    const collections = await db.listCollections();
    const colNames = collections.map(col => col.id);
    console.log('Colecciones encontradas en la raíz:', colNames);

    if (!colNames.includes('usuarios')) {
      console.log('¡ERROR CRÍTICO! La colección "usuarios" no existe en la raíz de tu Firestore.');
      return;
    }

    // Si existe, intentamos entrar al primer usuario
    const users = await db.collection('usuarios').limit(1).get();
    if (users.empty) {
      console.log('La colección "usuarios" está vacía.');
    } else {
      console.log('¡Éxito! Encontré al menos un usuario.');
      const userDoc = users.docs[0];
      const profile = await userDoc.ref.collection('profile').doc('data').get();
      
      if (profile.exists) {
        console.log('Perfil encontrado:', profile.data());
      } else {
        console.log('No existe el documento profile/data dentro del usuario:', userDoc.id);
      }
    }
  } catch (e) {
    console.error('Error al conectar con Firestore:', e.message);
  }
}

debugDatabase();
