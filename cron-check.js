const admin = require('firebase-admin');
const { Resend } = require('resend');

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
const resend = new Resend(process.env.RESEND_API_KEY);

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function runCheck() {
  console.log('--- BUSCANDO DATOS EN FIREBASE ---');
  
  // Buscamos tus usuarios
  const snapshot = await db.collection('usuarios').get();

  for (const userDoc of snapshot.docs) {
    const profileSnap = await userDoc.ref.collection('profile').doc('data').get();
    
    if (profileSnap.exists) {
      const userData = profileSnap.data();
      console.log('Usuario detectado:', userData.contact?.email);
      
      // Aquí el robot revisa si hay alertas pendientes
      if (userData.contact?.email === 'elunam.esoj7@gmail.com') {
        await resend.emails.send({
          from: 'Asistente <onboarding@resend.dev>',
          to: userData.contact.email,
          subject: 'Reporte de Mantenimiento',
          html: '<p>Tu sistema de telemetría está conectado y funcionando correctamente con tus datos reales.</p>'
        });
        console.log('Correo real enviado a:', userData.contact.email);
      }
    }
  }
}

runCheck().catch(console.error);
