// Envío de emails del sistema (por ahora, solo la recuperación de contraseña).
// Usa la API HTTP de Resend (https://resend.com): Railway bloquea el SMTP saliente en
// los planes más baratos, así que no se depende de un servidor de correo.
// Sin RESEND_API_KEY (en desarrollo) el email se muestra en la consola del backend.
async function enviarMail({ para, asunto, texto }) {
  if (!process.env.RESEND_API_KEY) {
    console.log(`\n[email sin enviar: falta RESEND_API_KEY]\nPara: ${para}\nAsunto: ${asunto}\n\n${texto}\n`);
    return;
  }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.MAIL_FROM || 'Agendip <onboarding@resend.dev>',
      to: [para],
      subject: asunto,
      text: texto,
    }),
  });
  if (!r.ok) throw new Error(`Resend respondió ${r.status}: ${await r.text()}`);
}

module.exports = { enviarMail };
