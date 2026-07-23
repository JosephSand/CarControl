const admin = require('firebase-admin');
const { Resend } = require('resend');

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
const resend = new Resend(process.env.RESEND_API_KEY);

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// Lista de mantenimientos
const TASKS = [
  { id: 'oil', name: 'Cambio de Aceite', interval: 10000 },
  { id: 'tires', name: 'Rotación de Llantas', interval: 10000 },
  { id: 'battery', name: 'Revisión de Batería', interval: 20000 }
  // Puedes agregar más aquí...
];

async function runCheck() {
  console.log('--- INICIANDO GESTOR DE MANTENIMIENTO ---');
  
  // 1. Limpieza
  const users = await db.collection('users').get();
  for (const doc of users.docs) {
    const profile = await doc.ref.collection('profile').get();
    if (profile.empty) await doc.ref.delete();
  }

  // 2. Revisión de alertas
  const snapshot = await db.collectionGroup('profile').get();
  const hoy = new Date();

  for (const doc of snapshot.docs) {
    if (doc.id !== 'data') continue;
    
    const data = doc.data();
    if (!data.contact?.email) continue;

    let alertas = [];
    let recordarKm = false;

    // Lógica de fechas (1 mes, 2 semanas, 1 semana, 1 día)
    const hitos = [30, 14, 7, 1];
    
    TASKS.forEach(task => {
        const proximaFecha = new Date(data.nextDates?.[task.id]);
        const diffTime = proximaFecha - hoy;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 0) alertas.push({ text: `${task.name} está VENCIDO`, color: '#e11d48' });
        else if (hitos.includes(diffDays)) alertas.push({ text: `${task.name} vence en ${diffDays} días`, color: '#d97706' });
    });

    // Recordatorio mensual de KM
    const ultimaActualizacion = new Date(data.lastUpdate || hoy);
    if ((hoy - ultimaActualizacion) / (1000 * 60 * 60 * 24) > 30) recordarKm = true;

    // 3. Envío de Correo con diseño profesional
    if (alertas.length > 0 || recordarKm) {
        await resend.emails.send({
            from: 'Tu Asistente Vehicular <onboarding@resend.dev>',
            to: data.contact.email,
            subject: '🚗 Estado de tu Vehículo',
            html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 15px; overflow: hidden;">
                <div style="background: #0ea5e9; color: white; padding: 20px; text-align: center;"><h1>Estado del Vehículo</h1></div>
                <div style="padding: 20px;">
                    ${recordarKm ? `<p style="background: #fef3c7; padding: 10px; border-radius: 5px;">📅 <b>Recordatorio:</b> Hace un mes no actualizas tu kilometraje. ¡Hazlo hoy para mayor precisión!</p>` : ''}
                    ${alertas.map(a => `<p style="border-left: 5px solid ${a.color}; padding-left: 10px; margin: 10px 0;">${a.text}</p>`).join('')}
                    <a href="https://tu-app-url.com" style="display: block; background: #0ea5e9; color: white; text-align: center; padding: 10px; border-radius: 5px; text-decoration: none; margin-top: 20px;">Ver en la App</a>
                </div>
            </div>`
        });
        console.log(`Reporte enviado a ${data.contact.email}`);
    }
  }
}

runCheck().catch(console.error);
