const admin = require('firebase-admin');
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function encontrarDatosReales() {
  console.log('--- BUSCANDO EN LA RUTA PROFUNDA ---');
  try {
    const usuarios = await db.collection('usuarios').get();
    
    for (const doc of usuarios.docs) {
      console.log('Entrando al usuario ID:', doc.id);
      // Aquí está el cambio: buscamos dentro de la subcolección 'profile' del usuario
      const profile = await doc.ref.collection('profile').doc('data').get();
      
      if (profile.exists) {
        console.log('¡DATOS ENCONTRADOS en ID:', doc.id);
        console.log('Contenido:', JSON.stringify(profile.data()));
      } else {
        console.log('El usuario', doc.id, 'no tiene profile/data');
      }
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
}

encontrarDatosReales();
