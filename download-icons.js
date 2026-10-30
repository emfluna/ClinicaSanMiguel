import fs from 'fs';
import path from 'path';

const iconUrl = 'https://cdn-icons-png.flaticon.com/512/3063/3063167.png';
const publicDir = path.join(process.cwd(), 'public');
const icon192 = path.join(publicDir, 'icon-192.png');
const icon512 = path.join(publicDir, 'icon-512.png');

async function downloadIcon() {
  try {
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }

    if (fs.existsSync(icon192) && fs.existsSync(icon512)) {
      console.log('Icon files icon-192.png and icon-512.png already exist in public/. Skipping download.');
      return;
    }

    console.log(`Fetching icon from: ${iconUrl}`);
    const response = await fetch(iconUrl);
    if (!response.ok) {
      console.warn(`Failed to fetch icon: ${response.statusText}`);
      return;
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    fs.writeFileSync(icon192, buffer);
    fs.writeFileSync(icon512, buffer);
    
    console.log('Successfully saved icon-192.png and icon-512.png inside /public directory.');
  } catch (error) {
    console.warn('Note: Could not download external icons during build (using defaults):', error?.message || error);
  }
}

downloadIcon();
