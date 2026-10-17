const sharp = require('sharp');
const fs = require('fs');

const svg = fs.readFileSync('public/favicon.svg');

Promise.all([
  sharp(svg, { density: 300 }).resize(192, 192).png().toFile('public/icon-192.png'),
  sharp(svg, { density: 300 }).resize(512, 512).png().toFile('public/icon-512.png'),
  sharp(svg, { density: 300 })
    .resize(180, 180)
    .flatten({ background: '#ffffff' })
    .png()
    .toFile('public/apple-touch-icon.png'),
])
  .then(() => console.log('icons ok'))
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
