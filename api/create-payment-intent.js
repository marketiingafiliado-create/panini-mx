const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const KITS = {
  'price_1TbP1GRqTGFmxmfbLRg3SoGS': { amount: 32900,  name: 'Kit Básico',        imagen: 'imgi_4_kit-basico.png' },
  'price_1TbP3RRqTGFmxmfbV0gsP9bZ': { amount: 74900,  name: 'Kit Inicial',        imagen: 'imgi_5_kit-iniciante.png' },
  'price_1TbP4pRqTGFmxmfb30xZ9a5k': { amount: 119900, name: 'Kit Campeón',        imagen: 'imgi_6_kit-campeao.png' },
  'price_1TbP6iRqTGFmxmfbRSCyaeTg': { amount: 189900, name: 'Kit Coleccionista',  imagen: 'imgi_3_kit-colecionador.png' },
  'price_1TbP8URqTGFmxmfbnDhTd5Tp': { amount: 419900, name: 'Golden Edition',     imagen: 'imgi_7_kit-capa-dourada.png' },
  'price_1TbP9URqTGFmxmfbBijVSSfQ': { amount: 569900, name: 'Kit Estadio',        imagen: 'imgi_8_kit-estadio.png' },
};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { priceId, nombre, email } = req.body;
  const kit = KITS[priceId];

  if (!kit) return res.status(400).json({ error: 'Kit no válido' });

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: kit.amount,
      currency: 'mxn',
      receipt_email: email,
      metadata: {
        kit: kit.name,
        cliente: nombre,
        email: email,
      },
      description: `Panini Mundial 2026 — ${kit.name}`,
    });

    res.json({ clientSecret: paymentIntent.client_secret, kit: kit.name });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
