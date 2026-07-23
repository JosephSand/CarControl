const admin = require('firebase-admin');
const { Resend } = require('resend');

// Configuración inicial
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
const resend = new Resend(process.env.RESEND_API_KEY);
const URL_APP = "https://josephsand.github.io/CarControl/";

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// Configuración de tareas
const TASKS = [
  { id: 'oil', name: 'Cambio de Aceite' },
  { id: 'tires', name: 'Rotación de Llantas' },
  { id: 'battery', name: 'Revisión de Batería' }
];

async function runCheck() {
  console.log('--- INICIANDO GESTOR DE FLOTA: MANTENIMIENTO & LIMPIEZA ---');

  // 1. Limpieza de usuarios huérfanos
  const users = await db.collection('users').get();
  for (const doc of users.docs) {
    const profile = await doc.ref.collection('profile').get();
    if (profile.empty) await doc.ref.delete();
  }

  // 2. Revisión de perfiles
  const snapshot = await db.collectionGroup('profile').get();
  const hoy = new Date();

  for (const doc of snapshot.docs) {
    if (doc.id !== 'data') continue;
    const data = doc.data();
    if (!data.contact?.email) continue;

    let alertas = [];
    let recordarKm = false;

    // Calcular alertas de fechas
    if (data.nextDates) {
      TASKS.forEach(task => {
        if (data.nextDates[task.id]) {
          const proxima = new Date(data.nextDates[task.id]);
          const diffDays = Math.ceil((proxima - hoy) / (1000 * 60 * 60 * 24));

          if (diffDays < 0) alertas.push({ text: `${task.name} está VENCIDO`, color: '#e11d48' });
          else if ([30, 14, 7, 1].includes(diffDays)) alertas.push({ text: `${task.name} vence en ${diffDays} días`, color: '#d97706' });
        }
      });
    }

    // Recordatorio mensual de KM
    const ultima = data.lastUpdate ? new Date(data.lastUpdate) : hoy;
    if ((hoy - ultima) / (1000 * 60 * 60 * 24) > 30) recordarKm = true;

    // 3. Envío de correo con diseño profesional
    if (alertas.length > 0 || recordarKm) {
      await resend.emails.send({
        from: 'Asistente Vehicular <onboarding@resend.dev>',
        to: data.contact.email,
        subject: '🚗 Estado de tu Vehículo',
        html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 15px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <div style="background: #0ea5e9; color: white; padding: 25px; text-align: center;">
                <h1 style="margin: 0; font-size: 24px;">Reporte Vehicular</h1>
            </div>
            <div style="padding: 30px; background: #ffffff;">
                ${recordarKm ? `
                    <div style="background: #fef3c7; border-left: 5px solid #d97706; padding: 15px; margin-bottom: 20px;">
                        <p style="margin: 0; color: #92400e;">📅 <b>Actualización pendiente:</b> Hace más de un mes no registras tu odómetro.</p>
                    </div>` : ''}
                
                ${alertas.length > 0 ? `
                    <h2 style="color: #333; font-size: 18px; margin-bottom: 15px;">Alertas de mantenimiento:</h2>
                    ${alertas.map(a => `
                        <div style="border-left: 5px solid ${a.color}; background: #f9fafb; padding: 12px; margin-bottom: 10px; border-radius: 0 5px 5px 0;">
                            <span style="font-weight: bold; color: #374151;">${a.text}</span>
                        </div>
                    `).join('')}` : ''}
                
                <a href="${URL_APP}" style="display: block; background: #0ea5e9; color: white; text-align: center; padding: 15px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 30px;">ACCEDER A LA APP</a>
            </div>
            <div style="text-align: center; padding: 20px; font-size: 12px; color: #9ca3af;">
                Gestionado por tu Sistema de Telemetría.
            </div>
        </div>`
      });
      console.log(`Reporte enviado a ${data.contact.email}`);
    }
  }
}

runCheck().catch(console.error);
