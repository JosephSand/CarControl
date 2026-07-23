const admin = require('firebase-admin');
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function caceria() {
  console.log('--- BUSCANDO EN LA RAÍZ ---');
  const collections = await db.listCollections();
  
  if (collections.length === 0) {
    console.log('¡La base de datos está totalmente vacía!');
  } else {
    for (let col of collections) {
      console.log('Encontré una colección llamada:', col.id);
      const docs = await col.listDocuments();
      console.log(`  - Tiene ${docs.length} documentos.`);
      if (docs.length > 0) {
        const snap = await docs[0].get();
        console.log(`  - Ejemplo de ID en esta colección: ${snap.id}`);
      }
    }
  }
}
caceria().catch(console.error);
