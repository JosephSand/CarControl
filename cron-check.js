const admin = require('firebase-admin');
const { Resend } = require('resend');

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
const resend = new Resend(process.env.RESEND_API_KEY);

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// 1. Función para limpiar usuarios que no tienen ni rastro de perfil
async function limpiarPerfilesVacios() {
  console.log('--- INICIANDO LIMPIEZA DE PERFILES ---');
  const usersSnapshot = await db.collection('users').get();
  
  for (const userDoc of usersSnapshot.docs) {
    const profileSnapshot = await userDoc.ref.collection('profile').get();
    
    // Solo borramos si el usuario NO tiene ninguna subcolección 'profile'
    if (profileSnapshot.empty) {
      console.log(`Borrando usuario huérfano: ${userDoc.id}`);
      await userDoc.ref.delete();
    }
  }
}

// 2. Función principal de alertas
async function runCheck() {
  // Primero limpiamos la base de datos
  await limpiarPerfilesVacios();

  console.log('--- BUSCANDO PERFILES PARA ALERTA ---');
  const snapshot = await db.collectionGroup('profile').get();
  
  let correoEnviado = false;

  for (const doc of snapshot.docs) {
    if (doc.id === 'data') {
      const userData = doc.data();
      
      if (userData.contact?.email === 'elunam.esoj7@gmail.com' && !correoEnviado) {
        await resend.emails.send({
          from: 'Asistente <onboarding@resend.dev>',
          to: userData.contact.email,
          subject: 'Reporte de Mantenimiento',
          html: '<p>Tu sistema está limpio y funcionando. ¡Alerta activa!</p>'
        });
        console.log('Correo de mantenimiento enviado a:', userData.contact.email);
        correoEnviado = true;
      }
    }
  }
}

runCheck().catch(console.error);
