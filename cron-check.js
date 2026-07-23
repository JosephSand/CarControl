const admin = require('firebase-admin');
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function pruebaFinal() {
  console.log('--- INTENTANDO LECTURA FORZADA ---');
  try {
    // Intentamos listar los documentos de la colección "usuarios"
    const snapshot = await db.collection('usuarios').get();
    
    if (snapshot.empty) {
      console.log('La colección "usuarios" existe pero no tiene documentos.');
    } else {
      console.log('¡Éxito! Encontré', snapshot.size, 'documentos.');
      // Leer el primer documento
      const doc = snapshot.docs[0];
      console.log('ID del primer doc:', doc.id);
      
      // Intentar leer datos de forma directa
      const data = doc.data();
      console.log('Datos del doc:', JSON.stringify(data));
      
      // Intentar listar subcolecciones del primer documento
      const subs = await doc.ref.listCollections();
      console.log('Subcolecciones encontradas en ese doc:', subs.map(s => s.id));
    }
  } catch (error) {
    console.error('ERROR AL ACCEDER A FIREBASE:', error.message);
  }
}

pruebaFinal();
