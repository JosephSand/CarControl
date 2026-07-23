const admin = require('firebase-admin');
const { Resend } = require('resend');

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
const resend = new Resend(process.env.RESEND_API_KEY);

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function runCheck() {
  console.log('--- CONECTANDO A COLECCIÓN: usuarios ---');
  
  const usuariosSnapshot = await db.collection('usuarios').get();

  for (const userDoc of usuariosSnapshot.docs) {
    console.log('Revisando ID de usuario:', userDoc.id);
    
    // Ruta exacta: usuarios -> [ID_USUARIO] -> profile -> data
    const profileSnap = await userDoc.ref.collection('profile').doc('data').get();
    
    if (profileSnap.exists) {
      const userData = profileSnap.data();
      console.log('Datos encontrados para:', userData.contact?.email);
      
      // Verificamos si quiere alertas y si es tu correo
      if (userData.contact?.email === 'elunam.esoj7@gmail.com') {
        await resend.emails.send({
          from: 'Asistente <onboarding@resend.dev>',
          to: userData.contact.email,
          subject: 'Reporte de Mantenimiento',
          html: '<p>¡Éxito! El sistema ha leído tus datos reales de Firebase correctamente.</p>'
        });
        console.log('Correo enviado exitosamente a:', userData.contact.email);
        return; // Terminamos tras enviar el correo de prueba
      }
    } else {
      console.log('No se encontró el documento "profile/data" para este ID.');
    }
  }
  console.log('No se encontró el correo especificado en ninguno de los perfiles.');
}

runCheck().catch(console.error);
