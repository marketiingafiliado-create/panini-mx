const mercadopago = require('mercadopago');

const KITS = {
  'kit-basico':        { amount: 329,  name: 'Kit Básico',        desc: '1 Álbum + 10 sobres (~70 cromos)' },
  'kit-inicial':       { amount: 749,  name: 'Kit Inicial',        desc: '1 Álbum + 1 Caja (30 sobres)' },
  'kit-campeon':       { amount: 1199, name: 'Kit Campeón',        desc: '1 Álbum + 2 Cajas (60 sobres)' },
  'kit-coleccionista': { amount: 1899, name: 'Kit Coleccionista',  desc: '1 Álbum + 3 Cajas (90 sobres)' },
  'golden-edition':    { amount: 4199, name: 'Golden Edition',     desc: '1 Álbum Pasta Dorada + 6 Cajas' },
  'kit-estadio':       { amount: 5699, name: 'Kit Estadio',        desc: '1 Álbum Edición Especial + 250 sobres' },
};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { kitId, nombre, email, telefono, calle, colonia, cp, ciudad, estado, token, installments, issuer_id, payment_method_id } = req.body;
  const kit = KITS[kitId];
  if (!kit) return res.status(400).json({ error: 'Kit no válido' });

  try {
    const client = new mercadopago.MercadoPagoConfig({
      accessToken: process.env.MP_ACCESS_TOKEN,
    });

    const payment = new mercadopago.Payment(client);

    const result = await payment.create({
      body: {
        transaction_amount: kit.amount,
        token,
        description: `Panini Mundial 2026 — ${kit.name}`,
        installments: parseInt(installments) || 1,
        payment_method_id,
        issuer_id,
        payer: {
          email,
          first_name: nombre.split(' ')[0],
          last_name: nombre.split(' ').slice(1).join(' ') || '',
          phone: { number: telefono },
          address: {
            street_name: calle,
            zip_code: cp,
          },
        },
        additional_info: {
          payer: {
            address: {
              street_name: calle,
              zip_code: cp,
              city_name: ciudad,
              state_name: estado,
            },
          },
        },
        metadata: {
          kit: kit.name,
          colonia,
          ciudad,
          estado,
        },
      },
    });

    if (result.status === 'approved') {
      res.json({ success: true, status: 'approved', kit: kit.name, amount: kit.amount });
    } else if (result.status === 'in_process' || result.status === 'pending') {
      res.json({ success: true, status: 'pending', kit: kit.name });
    } else {
      res.status(400).json({ error: result.status_detail || 'Pago rechazado' });
    }
  } catch (err) {
    console.error('MP Error:', err);
    res.status(500).json({ error: err.message });
  }
};
