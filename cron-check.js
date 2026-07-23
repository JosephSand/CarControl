const admin = require('firebase-admin');
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function diagnosticoFinal() {
  console.log('--- LEYENDO DOCUMENTOS DIRECTOS DE "usuarios" ---');
  const snapshot = await db.collection('usuarios').get();

  for (const doc of snapshot.docs) {
    console.log('Documento ID:', doc.id);
    const data = doc.data();
    console.log('¿Qué hay dentro?:', JSON.stringify(data));
    
    // También listamos por si acaso las subcolecciones, para ver si tienen otro nombre
    const subcols = await doc.ref.listCollections();
    for (let sub of subcols) {
        console.log('  -> Encontré subcolección:', sub.id);
        const subdocs = await sub.listDocuments();
        if(subdocs.length > 0) {
            const snap = await subdocs[0].get();
            console.log(`     -> Ejemplo de doc en subcolección: ${snap.id}`);
        }
    }
  }
}

diagnosticoFinal().catch(console.error);
