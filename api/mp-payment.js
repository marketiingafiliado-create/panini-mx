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
          items: [
            {
              id:         kitId,
              title:      kit.name,
              description:kit.desc,
              quantity:   1,
              unit_price: kit.amount,
            },
          ],
          payer: {
            first_name: nombre.split(' ')[0],
            last_name:  nombre.split(' ').slice(1).join(' ') || 'N/A',
            phone: {
              area_code: telefono.length >= 10 ? telefono.slice(0, 2) : '55',
              number:    telefono.length >= 10 ? telefono.slice(2)    : telefono,
            },
            // ⚠️ SIN city_name ni state_name — MP no los acepta aquí
            address: {
              zip_code:    cp,
              street_name: calle,
            },
          },
        },

        // Ciudad, estado y colonia van SOLO en metadata
        metadata: {
          kit:     kit.name,
          colonia,
          ciudad,
          estado,
        },
      },
    });

    if (result.status === 'approved') {
      return res.json({ success: true, status: 'approved', kit: kit.name, amount: kit.amount });
    }
    if (result.status === 'in_process' || result.status === 'pending') {
      return res.json({ success: true, status: 'pending', kit: kit.name });
    }

    return res.status(400).json({
      error: result.status_detail || 'Pago rechazado. Intenta con otra tarjeta.',
    });

  } catch (err) {
    const cause = err?.cause?.[0];
    const msg   = cause?.description || err?.message || 'Error interno del servidor';
    console.error('MP Error:', JSON.stringify({ msg, cause, status: err?.status }, null, 2));
    return res.status(500).json({ error: msg });
  }
};
