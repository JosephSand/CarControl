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
      
      // 1. Formateamos las listas de mantenimiento
      const overdueList = overdue.map(t => `<li style="margin-bottom: 8px;">${t}</li>`).join('');
      const upcomingList = upcoming.map(t => `<li style="margin-bottom: 8px;">${t}</li>`).join('');

      // 2. Construimos la Plantilla HTML
      const htmlContent = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f5; padding: 30px; border-radius: 8px;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
            
            <!-- Encabezado Azul -->
            <div style="background-color: #0ea5e9; padding: 25px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">🚗 Reporte de Telemetría</h1>
              <p style="color: #e0f2fe; margin: 8px 0 0 0; font-size: 16px; font-weight: 500;">${vehicleName}</p>
            </div>

            <!-- Cuerpo del Mensaje -->
            <div style="padding: 30px;">
              <p style="color: #3f3f46; font-size: 16px; margin-top: 0;">Hola,</p>
              <p style="color: #52525b; font-size: 15px; line-height: 1.6;">Este es el escaneo automático de mantenimiento preventivo. Aquí tienes el estado actual de los componentes:</p>

              <!-- Sección de Atrasados (Rojo) -->
              ${overdue.length > 0 ? `
                <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 15px 20px; margin-top: 25px; border-radius: 0 8px 8px 0;">
                  <h3 style="color: #b91c1c; margin: 0 0 10px 0; font-size: 18px;">🚨 Atención Urgente</h3>
                  <ul style="color: #7f1d1d; margin: 0; padding-left: 20px; font-size: 15px;">
                    ${overdueList}
                  </ul>
                </div>
              ` : ''}

              <!-- Sección de Próximos (Amarillo/Naranja) -->
              ${upcoming.length > 0 ? `
                <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 15px 20px; margin-top: 25px; border-radius: 0 8px 8px 0;">
                  <h3 style="color: #b45309; margin: 0 0 10px 0; font-size: 18px;">⚠️ Próximos Servicios</h3>
                  <ul style="color: #92400e; margin: 0; padding-left: 20px; font-size: 15px;">
                    ${upcomingList}
                  </ul>
                </div>
              ` : ''}
              
            </div>

            <!-- Pie de Página -->
            <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="color: #94a3b8; font-size: 13px; margin: 0;">Generado automáticamente por el Sistema de Mantenimiento</p>
            </div>

          </div>
        </div>
      `;

      // 3. Enviamos el correo con la nueva plantilla a Resend
      await resend.emails.send({
        from: 'Control de Auto <onboarding@resend.dev>',
        to: userData.contact.email,
        subject: `⚠️ Alerta de Servicio: ${vehicleName}`,
        html: htmlContent
      });
      console.log(`Correo enviado exitosamente a ${userData.contact.email}`);
    }
  }
}

runCheck().catch(console.error);
