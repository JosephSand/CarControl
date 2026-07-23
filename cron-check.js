const admin = require('firebase-admin');
const { Resend } = require('resend');

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
const resend = new Resend(process.env.RESEND_API_KEY);

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function runCheck() {
  console.log('--- BUSCANDO PERFILES PARA ALERTA ÚNICA ---');
  const snapshot = await db.collectionGroup('profile').get();
  
  let correoEnviado = false; // Candado para enviar solo un correo

  for (const doc of snapshot.docs) {
    if (doc.id === 'data') {
      const userData = doc.data();
      
      // Si encontramos tu email y aún no hemos enviado el correo
      if (userData.contact?.email === 'elunam.esoj7@gmail.com' && !correoEnviado) {
        await resend.emails.send({
          from: 'Asistente <onboarding@resend.dev>',
          to: userData.contact.email,
          subject: 'Reporte de Mantenimiento',
          html: '<p>¡Sistema sincronizado! Tus alertas están funcionando correctamente.</p>'
        });
        console.log('Correo enviado exitosamente a:', userData.contact.email);
        correoEnviado = true; // Bloqueamos envíos futuros en esta ejecución
      }
    }
  }
}

runCheck().catch(console.error);
