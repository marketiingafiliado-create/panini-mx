const { MercadoPagoConfig, Payment } = require('mercadopago');

const KITS = {
  'kit-basico':        { amount: 329,  name: 'Kit Básico',       desc: '1 Álbum + 10 sobres (~70 cromos)' },
  'kit-inicial':       { amount: 749,  name: 'Kit Inicial',       desc: '1 Álbum + 1 Caja (30 sobres)' },
  'kit-campeon':       { amount: 1199, name: 'Kit Campeón',       desc: '1 Álbum + 2 Cajas (60 sobres)' },
  'kit-coleccionista': { amount: 1899, name: 'Kit Coleccionista', desc: '1 Álbum + 3 Cajas (90 sobres)' },
  'golden-edition':    { amount: 4199, name: 'Golden Edition',    desc: '1 Álbum Pasta Dorada + 6 Cajas' },
  'kit-estadio':       { amount: 5699, name: 'Kit Estadio',       desc: '1 Álbum Edición Especial + 250 sobres' },
};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    kitId, nombre, email, telefono,
    calle, colonia, cp, ciudad, estado,
    token, installments, issuer_id, payment_method_id,
  } = req.body;

  const kit = KITS[kitId];
  if (!kit)   return res.status(400).json({ error: 'Kit no válido' });
  if (!token) return res.status(400).json({ error: 'Token de tarjeta faltante' });

  try {
    const client  = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
    const payment = new Payment(client);

    const result = await payment.create({
      body: {
        transaction_amount: kit.amount,
        token,
        description: `Panini Mundial 2026 — ${kit.name}`,
        installments: parseInt(installments) || 1,
        payment_method_id,
        issuer_id: issuer_id || undefined,
        payer: {
          email,
          first_name: nombre.split(' ')[0],
          last_name:  nombre.split(' ').slice(1).join(' ') || 'N/A',
          phone: {
            area_code: telefono.length >= 10 ? telefono.slice(0, 2) : '55',
            number:    telefono.length >= 10 ? telefono.slice(2)    : telefono,
          },
          address: {
            street_name: calle,
            zip_code:    cp,
          },
        },
        additional_info: {
          items: [{
            id:          kitId,
            title:       kit.name,
            description: kit.desc,
            quantity:    1,
            unit_price:  kit.amount,
          }],
          payer: {
            first_name: nombre.split(' ')[0],
            last_name:  nombre.split(' ').slice(1).join(' ') || 'N/A',
            address: {
              zip_code:    cp,
              street_name: calle,
            },
          },
        },
        metadata: { kit: kit.name, colonia, ciudad, estado },
      },
    });

    // Log completo para debug
    console.log('MP Result:', JSON.stringify({
      id:            result.id,
      status:        result.status,
      status_detail: result.status_detail,
    }));

    // Cualquier pago creado (approved, in_process, pending) = éxito para el usuario
    // Solo rechazamos si status es explícitamente 'rejected'
    if (result.status === 'rejected') {
      return res.status(400).json({
        error: traducirError(result.status_detail),
      });
    }

    // approved, in_process, pending → redirigir a success
    return res.json({
      success:       true,
      status:        result.status,
      status_detail: result.status_detail,
      payment_id:    result.id,
      kit:           kit.name,
      amount:        kit.amount,
    });

  } catch (err) {
    const cause = err?.cause?.[0];
    const msg   = cause?.description || err?.message || 'Error interno del servidor';
    console.error('MP Error:', JSON.stringify({ msg, cause, status: err?.status }, null, 2));
    return res.status(500).json({ error: msg });
  }
};

function traducirError(detail) {
  const errores = {
    'cc_rejected_bad_filled_card_number': 'Número de tarjeta incorrecto.',
    'cc_rejected_bad_filled_date':        'Fecha de vencimiento incorrecta.',
    'cc_rejected_bad_filled_other':       'Datos de la tarjeta incorrectos.',
    'cc_rejected_bad_filled_security_code':'Código de seguridad incorrecto.',
    'cc_rejected_blacklist':              'Tarjeta bloqueada. Usa otra tarjeta.',
    'cc_rejected_call_for_authorize':     'Tarjeta requiere autorización. Llama a tu banco.',
    'cc_rejected_card_disabled':          'Tarjeta desactivada. Contacta a tu banco.',
    'cc_rejected_duplicated_payment':     'Pago duplicado. Espera unos minutos.',
    'cc_rejected_high_risk':              'Pago rechazado por seguridad. Usa otra tarjeta.',
    'cc_rejected_insufficient_amount':    'Fondos insuficientes.',
    'cc_rejected_invalid_installments':   'Número de cuotas no permitido.',
    'cc_rejected_max_attempts':           'Demasiados intentos. Usa otra tarjeta.',
    'cc_rejected_other_reason':           'Pago rechazado. Intenta con otra tarjeta.',
  };
  return errores[detail] || `Pago rechazado (${detail}). Intenta con otra tarjeta.`;
}
