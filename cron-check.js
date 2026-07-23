const admin = require('firebase-admin');
const { Resend } = require('resend');
const twilio = require('twilio');

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
const resend = new Resend(process.env.RESEND_API_KEY);
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const MAINTENANCE_TASKS = [
  { id: 'oil', name: 'Cambio de Aceite', intervalKm: 10000, hex: '#f59e0b' }, 
  { id: 'tires', name: 'Rotación Llantas', intervalKm: 10000, hex: '#10b981' }, 
  { id: 'cabin_filter', name: 'Filtro Cabina', intervalKm: 20000, hex: '#0ea5e9' },
  { id: 'engine_filter', name: 'Filtro Motor', intervalKm: 40000, hex: '#3b82f6' },
  { id: 'brake_fluid', name: 'Líquido Frenos', intervalKm: 40000, hex: '#8b5cf6' },
  { id: 'brakes', name: 'Balatas / Frenos', intervalKm: 30000, hex: '#f43f5e' },
  { id: 'spark_plugs', name: 'Bujías', intervalKm: 100000, hex: '#d946ef' },
  { id: 'battery', name: 'Batería', intervalKm: 20000, hex: '#eab308' }
];

// SOLUCIÓN AQUÍ: Se añadió "nombreServicio" como el quinto parámetro
function generarTarjeta(titulo, mensaje, hexColor, urgencia, nombreServicio) {
  let colorTexto, colorFondo;
  if (urgencia === 'critico') { colorTexto = "#991b1b"; colorFondo = "#fef2f2"; } 
  else if (urgencia === 'aviso') { colorTexto = "#b45309"; colorFondo = "#fffbeb"; }
  else { colorTexto = "#0f766e"; colorFondo = "#f0fdfa"; }

  const html = `
    <div style="background-color: ${colorFondo}; border-radius: 8px; padding: 15px; margin-bottom: 12px; border-left: 5px solid ${hexColor};">
      <h3 style="color: ${colorTexto}; margin-top: 0; margin-bottom: 5px; font-size: 16px;">${titulo}: ${nombreServicio}</h3>
      <p style="color: #3f3f46; margin: 0; font-size: 14px; line-height: 1.4;">${mensaje}</p>
    </div>
  `;
  const texto = `\n- *${titulo}*: ${nombreServicio} -> ${mensaje}`;
  return { html, texto };
}

async function runCheck() {
  console.log('Iniciando escaneo de Telemetría (Fechas, KM y Estimaciones)...');
  const usersSnapshot = await db.collectionGroup('profile').get();
  if (usersSnapshot.empty) return;

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  for (const docSnap of usersSnapshot.docs) {
    const userData = docSnap.data();
    if (!userData.contact || !userData.contact.wantsAlerts) continue;

    const nombreConductor = userData.contact.name || 'Conductor';
    const vehicleName = `${userData.vehicle?.make || 'Kia'} ${userData.vehicle?.model || 'Soul'}`;
    
    let htmlCorreos = '';
    let textoWhatsApp = '';
    let necesitaRecordatorioMensual = false;
    let kilometrajeEstimado = userData.currentMileage || 0;

    // ==============================================================
    // ALGORITMO 1: Estimación Automática (Inactividad > 30 días)
    // ==============================================================
    if (userData.lastMileageUpdate) {
        const lastUpdate = new Date(userData.lastMileageUpdate);
        lastUpdate.setHours(0, 0, 0, 0);
        const diasDesdeUpdate = Math.ceil((hoy.getTime() - lastUpdate.getTime()) / (1000 * 3600 * 24));

        if (diasDesdeUpdate >= 30) {
            necesitaRecordatorioMensual = true;
            let promedioDiario = 15;
            
            const userPath = docSnap.ref.path.replace('/profile/data', ''); 
            const historySnap = await db.collection(`${userPath}/history`).orderBy('date', 'asc').get();
            
            if (historySnap.docs.length >= 2) {
                const primerLog = historySnap.docs[0].data();
                const ultimoLog = historySnap.docs[historySnap.docs.length - 1].data();
                const diasHistorial = Math.ceil((new Date(ultimoLog.date).getTime() - new Date(primerLog.date).getTime()) / (1000 * 3600 * 24));
                if (diasHistorial > 0) promedioDiario = Math.max(5, (ultimoLog.km - primerLog.km) / diasHistorial);
            }
            
            kilometrajeEstimado += Math.round(promedioDiario * diasDesdeUpdate);
            
            await docSnap.ref.update({
                currentMileage: kilometrajeEstimado,
                lastMileageUpdate: hoy.toISOString(),
                isEstimated: true
            });
            console.log(`Kilometraje de ${nombreConductor} auto-estimado a ${kilometrajeEstimado}km`);
        }
    }

    // ==============================================================
    // ALGORITMO 2: Generación de Alertas (Combinación Fecha + KM)
    // ==============================================================
    MAINTENANCE_TASKS.forEach(task => {
      let alertaGenerada = false;

      if (userData.nextDates && userData.nextDates[task.id]) {
        const fecha = new Date(userData.nextDates[task.id]);
        fecha.setHours(0, 0, 0, 0);
        const diasRestantes = Math.ceil((fecha.getTime() - hoy.getTime()) / (1000 * 3600 * 24));

        if (diasRestantes < 0) {
            const res = generarTarjeta("🚨 VENCIDO (CRÍTICO)", `La fecha límite ya pasó. Realízalo lo antes posible para evitar daños mecánicos.`, task.hex, 'critico', task.name);
            htmlCorreos += res.html; textoWhatsApp += res.texto; alertaGenerada = true;
        } else if (diasRestantes <= 15) {
            const res = generarTarjeta("⏰ PRÓXIMO A VENCER", `El servicio está agendado en los próximos ${diasRestantes} días.`, task.hex, 'aviso', task.name);
            htmlCorreos += res.html; textoWhatsApp += res.texto; alertaGenerada = true;
        }
      }

      if (!alertaGenerada) {
          const ultimoKmServicio = (userData.services && userData.services[task.id]) || 0;
          if (ultimoKmServicio > 0) {
              const remainingKm = (ultimoKmServicio + task.intervalKm) - kilometrajeEstimado;
              if (remainingKm < 0) {
                  const res = generarTarjeta("🚨 DESGASTE VENCIDO", `El Odómetro marca ${kilometrajeEstimado} km. Has superado el límite de vida útil por ${Math.abs(remainingKm)} km. ¡Urgente!`, task.hex, 'critico', task.name);
                  htmlCorreos += res.html; textoWhatsApp += res.texto;
              } else if (remainingKm <= 1500) {
                  const res = generarTarjeta("⚠️ DESGASTE PRÓXIMO", `Te quedan solo ${remainingKm} km de vida útil. Ve planificando el servicio.`, task.hex, 'aviso', task.name);
                  htmlCorreos += res.html; textoWhatsApp += res.texto;
              }
          }
      }
    });

    // ==============================================================
    // 3. ENVÍO DE NOTIFICACIONES
    // ==============================================================
    if (htmlCorreos !== '' || necesitaRecordatorioMensual) {
      if (userData.contact.email) {
        let cuerpoHTML = '';
        
        if (necesitaRecordatorioMensual) {
            cuerpoHTML += `
            <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 20px; margin-bottom: 20px; text-align: center;">
                <h3 style="color: #334155; margin-top: 0;">📅 Actualización Mensual Requerida</h3>
                <p style="color: #475569; font-size: 14px;">Ha pasado un mes sin registros. <b>Estimamos tu kilometraje actual en ${kilometrajeEstimado} km</b> basándonos en tu historial de uso.</p>
                <p style="color: #475569; font-size: 14px; font-weight: bold;">Por favor, ingresa a la aplicación para registrar el kilometraje exacto.</p>
            </div>`;
        }
        cuerpoHTML += htmlCorreos;

        const emailCompleto = `
          <div style="font-family: Arial, sans-serif; background-color: #020617; padding: 30px; border-radius: 8px;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden;">
              <div style="background-color: #0ea5e9; padding: 25px; text-align: center;">
                <h1 style="color: white; margin: 0;">🚗 Telemetría Automotriz</h1>
                <p style="color: #e0f2fe; margin: 5px 0 0 0;">${vehicleName}</p>
              </div>
              <div style="padding: 30px;">
                <p style="font-size: 18px; font-weight: bold;">Hola, ${nombreConductor}</p>
                ${cuerpoHTML}
              </div>
            </div>
          </div>
        `;

        try {
            await resend.emails.send({
                from: 'Asistente Vehicular <onboarding@resend.dev>',
                to: userData.contact.email,
                subject: necesitaRecordatorioMensual ? `📅 Reporte Mensual: ${vehicleName}` : `⚠️ Alerta Instantánea: ${vehicleName}`,
                html: emailCompleto
            });
            console.log(`Correo enviado a ${userData.contact.email}`);
        } catch (e) { console.error('Error enviando Resend:', e); }
      }

      if (textoWhatsApp !== '' && process.env.TWILIO_TO_NUMBER) {
        try {
          await twilioClient.messages.create({
            body: `🚗 *${vehicleName}*\nHola ${nombreConductor}, tu vehículo requiere atención inmediata:\n${textoWhatsApp}`,
            from: process.env.TWILIO_FROM_NUMBER,
            to: process.env.TWILIO_TO_NUMBER
          });
          console.log(`WhatsApp enviado.`);
        } catch (e) { console.error('Error enviando Twilio:', e); }
      }
    }
  }
}

runCheck().catch(console.error);
