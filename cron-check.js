const admin = require('firebase-admin');
const { Resend } = require('resend');

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
const resend = new Resend(process.env.RESEND_API_KEY);

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function runCheck() {
  console.log('--- PRUEBA DE PÁNICO: ENVIANDO CORREO FORZADO ---');
  
  // Cambia ESTE CORREO por el tuyo verificado en Resend
  const MI_CORREO = 'TU_EMAIL_VERIFICADO_DE_RESEND@gmail.com'; 

  try {
    await resend.emails.send({
      from: 'Asistente <onboarding@resend.dev>',
      to: MI_CORREO,
      subject: 'PRUEBA DE CONEXIÓN',
      html: '<h1>El sistema está funcionando correctamente.</h1>'
    });
    console.log('Correo de prueba enviado con éxito a:', MI_CORREO);
  } catch (e) {
    console.error('ERROR AL ENVIAR:', e);
  }
}

runCheck().catch(console.error);
