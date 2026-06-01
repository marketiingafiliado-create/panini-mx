// api/mp-config.js — expone la Public Key al frontend de forma segura
module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  res.json({ publicKey: process.env.MP_PUBLIC_KEY });
};
