const admin = require('firebase-admin');
const { Resend } = require('resend');

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
const resend = new Resend(process.env.RESEND_API_KEY);

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function runCheck() {
  console.log('--- BUSCANDO PERFILES EN "profile" ---');
  
  // collectionGroup busca en CUALQUIER lugar que tenga una carpeta llamada 'profile'
  const snapshot = await db.collectionGroup('profile').get();
  
  if (snapshot.empty) {
    console.log('No encontré ninguna carpeta "profile".');
    return;
  }

  for (const doc of snapshot.docs) {
    // Si el documento se llama "data" como definiste en tu App
    if (doc.id === 'data') {
      const userData = doc.data();
      console.log('Usuario encontrado con email:', userData.contact?.email);
      
      if (userData.contact?.email === 'elunam.esoj7@gmail.com') {
        await resend.emails.send({
          from: 'Asistente <onboarding@resend.dev>',
          to: userData.contact.email,
          subject: '¡Reporte Exitoso!',
          html: '<p>El robot finalmente ha encontrado tus datos navegando por la colección "users"!</p>'
        });
        console.log('Correo enviado a:', userData.contact.email);
      }
    }
  }
}

runCheck().catch(console.error);
