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
const allowedOrigins = ['https://albumoficial.com', 'https://www.albumoficial.com', 'https://panini-mx.vercel.app'];
const origin = req.headers.origin;
if (allowedOrigins.includes(origin)) {
  res.setHeader('Access-Control-Allow-Origin', origin);
}
res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { priceId, nombre, email, telefono, calle, colonia, cp, ciudad, estado } = req.body;
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
        telefono: telefono || '',
        direccion: `${calle}, Col. ${colonia}, CP ${cp}`,
        ciudad: ciudad || '',
        estado: estado || '',
      },
      shipping: {
        name: nombre,
        phone: telefono || '',
        address: {
          line1: calle || '',
          line2: `Col. ${colonia}`,
          city: ciudad || '',
          state: estado || '',
          postal_code: cp || '',
          country: 'MX',
        },
      },
      description: `Panini Mundial 2026 — ${kit.name}`,
    });

    // Fire Meta Conversions API - Purchase event
    try {
      const pixelId = process.env.META_PIXEL_ID;
      const accessToken = process.env.META_ACCESS_TOKEN;
      if (pixelId && accessToken) {
        const crypto = require('crypto');
        const hashData = (val) => val ? crypto.createHash('sha256').update(val.toLowerCase().trim()).digest('hex') : null;
        const metaPayload = {
          data: [{
            event_name: 'Purchase',
            event_time: Math.floor(Date.now() / 1000),
            action_source: 'website',
            event_source_url: 'https://albumoficial.com/checkout',
            user_data: {
              em: email ? [hashData(email)] : [],
              ph: telefono ? [hashData(telefono.replace(/\D/g,''))] : [],
              fn: nombre ? [hashData(nombre.split(' ')[0])] : [],
              ln: nombre && nombre.split(' ').length > 1 ? [hashData(nombre.split(' ').slice(1).join(' '))] : [],
              ct: ciudad ? [hashData(ciudad)] : [],
              st: estado ? [hashData(estado)] : [],
              zp: cp ? [hashData(cp)] : [],
              country: [hashData('mx')],
            },
            custom_data: {
              currency: 'MXN',
              value: kit.amount / 100,
              content_name: kit.name,
              content_type: 'product',
              contents: [{ id: priceId, quantity: 1, item_price: kit.amount / 100 }],
            },
          }],
        };
        await fetch(`https://graph.facebook.com/v18.0/${pixelId}/events?access_token=${accessToken}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(metaPayload),
        });
      }
    } catch (metaErr) {
      console.error('Meta API error:', metaErr.message);
    }

    res.json({ clientSecret: paymentIntent.client_secret, kit: kit.name });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
