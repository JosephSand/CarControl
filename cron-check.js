const admin = require('firebase-admin');
const { Resend } = require('resend');

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
const resend = new Resend(process.env.RESEND_API_KEY);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Ya no necesitamos los intervalKm aquí porque usaremos fechas exactas
const MAINTENANCE_TASKS = [
  { id: 'oil', name: 'Cambio de Aceite y Filtro' },
  { id: 'tires', name: 'Rotación/Cambio Llantas' },
  { id: 'cabin_filter', name: 'Filtro de Cabina' },
  { id: 'engine_filter', name: 'Filtro de Motor' },
  { id: 'brake_fluid', name: 'Líquido de Frenos' },
  { id: 'brakes', name: 'Balatas' },
  { id: 'spark_plugs', name: 'Bujías' },
  { id: 'battery', name: 'Batería' }
];

function obtenerPlantillaRecordatorio(nombreServicio, diasRestantes) {
  let titulo, mensaje, colorTexto, colorFondo;

  if (diasRestantes < 0) {
    titulo = "🚨 Mantenimiento Vencido (Riesgo de Daño)";
    mensaje = `El periodo para realizar el servicio de <b>${nombreServicio}</b> ya pasó. Debes realizar este cambio y registrar el evento en la aplicación de inmediato. Circular en estas condiciones podría causar daños mecánicos severos o permanentes al vehículo.`;
    colorTexto = "#991b1b"; colorFondo = "#fef2f2";
  } else if (diasRestantes === 1) {
    titulo = "⏰ ¡Es Mañana!";
    mensaje = `Tu servicio de <b>${nombreServicio}</b> está programado para mañana. Asegúrate de tener todo listo.`;
    colorTexto = "#c2410c"; colorFondo = "#fff7ed";
  } else if (diasRestantes > 1 && diasRestantes <= 7) {
    titulo = "🗓️ Faltan menos de 7 días";
    mensaje = `Tienes menos de una semana para realizar el <b>${nombreServicio}</b>. Es buen momento para agendar tu visita al taller.`;
    colorTexto = "#b45309"; colorFondo = "#fffbeb";
  } else if (diasRestantes > 7 && diasRestantes <= 15) {
    titulo = "👀 En 15 días";
    mensaje = `En aproximadamente dos semanas tu vehículo necesitará el servicio de <b>${nombreServicio}</b>. Mantén este pendiente en tu radar.`;
    colorTexto = "#1d4ed8"; colorFondo = "#eff6ff";
  } else if (diasRestantes > 15 && diasRestantes <= 30) {
    titulo = "ℹ️ Próximo mes";
    mensaje = `Falta un mes para tu próximo <b>${nombreServicio}</b>. Te avisaremos conforme se acerque la fecha.`;
    colorTexto = "#0f766e"; colorFondo = "#f0fdfa";
  } else {
    return null; // Falta más de un mes, no enviamos nada aún
  }

  return `
    <div style="background-color: ${colorFondo}; border-radius: 8px; padding: 20px; margin-bottom: 15px; border-left: 5px solid ${colorTexto};">
      <h3 style="color: ${colorTexto}; margin-top: 0; margin-bottom: 10px; font-size: 18px;">${titulo}</h3>
      <p style="color: #3f3f46; margin: 0; font-size: 15px; line-height: 1.5;">${mensaje}</p>
    </div>
  `;
}

async function runCheck() {
  console.log('Iniciando revisión diaria por fechas...');
  const usersSnapshot = await db.collectionGroup('profile').get();
  if (usersSnapshot.empty) return;

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0); // Normalizamos a la medianoche para contar días enteros

  for (const doc of usersSnapshot.docs) {
    const userData = doc.data();
    
    // Si no quiere alertas o no tiene correo, saltamos al siguiente
    if (!userData.contact || !userData.contact.wantsAlerts || !userData.contact.email) continue;

    const nombreConductor = userData.contact.name || 'Conductor'; // <-- AQUÍ USAMOS EL NOMBRE
    const vehicleName = `${userData.vehicle?.make || 'Kia'} ${userData.vehicle?.model || 'Soul'}`;
    let alertasGeneradasHTML = '';

    // Revisamos cada tarea de mantenimiento para ver si tiene fecha agendada
    MAINTENANCE_TASKS.forEach(task => {
      // Asumimos que guardas las fechas futuras en "nextDates"
      if (userData.nextDates && userData.nextDates[task.id]) {
        const fechaProgramada = new Date(userData.nextDates[task.id]);
        fechaProgramada.setHours(0, 0, 0, 0);
        
        // Calculamos cuántos días faltan
        const milisegundosRestantes = fechaProgramada.getTime() - hoy.getTime();
        const diasRestantes = Math.ceil(milisegundosRestantes / (1000 * 3600 * 24));

        const tarjetaHTML = obtenerPlantillaRecordatorio(task.name, diasRestantes);
        if (tarjetaHTML) {
          alertasGeneradasHTML += tarjetaHTML;
        }
      }
    });

    // Si se generó al menos una alerta, enviamos el correo
    if (alertasGeneradasHTML !== '') {
      const htmlContent = `
        <div style="font-family: 'Segoe UI', Tahoma, sans-serif; background-color: #f4f4f5; padding: 30px; border-radius: 8px;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
            <div style="background-color: #0ea5e9; padding: 25px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">🚗 Reporte de Telemetría</h1>
              <p style="color: #e0f2fe; margin: 8px 0 0 0; font-size: 16px; font-weight: 500;">${vehicleName}</p>
            </div>
            <div style="padding: 30px;">
              <p style="color: #3f3f46; font-size: 18px; margin-top: 0; font-weight: 700;">Hola, ${nombreConductor}</p>
              <p style="color: #52525b; font-size: 15px; line-height: 1.6; margin-bottom: 25px;">
                Este es tu asistente de mantenimiento inteligente. Según tu calendario, hemos detectado las siguientes notificaciones importantes:
              </p>
              
              ${alertasGeneradasHTML}
              
            </div>
          </div>
        </div>
      `;

      await resend.emails.send({
        from: 'Asistente Kia Soul <onboarding@resend.dev>',
        to: userData.contact.email,
        subject: `Notificación de Mantenimiento: ${vehicleName}`,
        html: htmlContent
      });
      console.log(`Correo enviado a ${nombreConductor} (${userData.contact.email})`);
    }
  }
}

runCheck().catch(console.error);
