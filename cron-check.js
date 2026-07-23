const admin = require('firebase-admin');
const { Resend } = require('resend');

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
const resend = new Resend(process.env.RESEND_API_KEY);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const MAINTENANCE_TASKS = [
  { id: 'oil', name: 'Cambio de Aceite y Filtro', intervalKm: 10000 },
  { id: 'tires', name: 'Rotación/Cambio Llantas', intervalKm: 10000 },
  { id: 'cabin_filter', name: 'Filtro de Cabina', intervalKm: 20000 },
  { id: 'engine_filter', name: 'Filtro de Motor', intervalKm: 40000 },
  { id: 'brake_fluid', name: 'Líquido de Frenos', intervalKm: 40000 },
  { id: 'brakes', name: 'Balatas', intervalKm: 30000 },
  { id: 'spark_plugs', name: 'Bujías', intervalKm: 100000 },
  { id: 'battery', name: 'Batería', intervalKm: 20000 }
];

async function runCheck() {
  console.log('Iniciando revisión de mantenimiento...');
  const usersSnapshot = await db.collectionGroup('profile').get();

  if (usersSnapshot.empty) {
    console.log('No se encontraron perfiles.');
    return;
  }

  for (const doc of usersSnapshot.docs) {
    const userData = doc.data();
    if (!userData.contact || !userData.contact.wantsAlerts || !userData.contact.email) continue;

    const currentMileage = userData.currentMileage || 0;
    const vehicleName = `${userData.vehicle?.make || 'Kia'} ${userData.vehicle?.model || 'Soul'}`;
    let overdue = [];
    let upcoming = [];

    MAINTENANCE_TASKS.forEach(task => {
      const lastKm = (userData.services && userData.services[task.id]) || 0;
      const remainingKm = (lastKm + task.intervalKm) - currentMileage;

      if (remainingKm < 0) overdue.push(`${task.name} (Atrasado por ${Math.abs(remainingKm)} km)`);
      else if (remainingKm <= 1500) upcoming.push(`${task.name} (En ${remainingKm} km)`);
    });

    if (overdue.length > 0 || upcoming.length > 0) {
      let htmlContent = `<h2>🚗 Reporte de Telemetría para tu ${vehicleName}</h2>`;
      if (overdue.length > 0) htmlContent += `<h3 style="color: red;">🚨 Urgente (Atrasado)</h3><ul>${overdue.map(t => `<li>${t}</li>`).join('')}</ul>`;
      if (upcoming.length > 0) htmlContent += `<h3 style="color: orange;">⚠️ Próximos</h3><ul>${upcoming.map(t => `<li>${t}</li>`).join('')}</ul>`;

      await resend.emails.send({
        from: 'Sistema de Mantenimiento <onboarding@resend.dev>',
        to: userData.contact.email,
        subject: `⚠️ Alerta de Mantenimiento: ${vehicleName}`,
        html: htmlContent
      });
      console.log(`Correo enviado exitosamente a ${userData.contact.email}`);
    }
  }
}

runCheck().catch(console.error);
