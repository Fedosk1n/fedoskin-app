import * as THREE from 'three';
import { loadUntexturedModel } from './city3d-festival-art.js?v=3';

export async function loadWayfinding() {
  return loadUntexturedModel('./anim/city-wayfinding.glb?v=1').catch(error => {
    console.warn('City sign mounts unavailable', error);
    return null;
  });
}

// Lettering follows the installed mesh and respects the camera's normal depth test.
export function plaqueInk(parent, text, { width, height, x = 0, y = 0, z = 0, yaw = 0, color = '#e1cda5', symbol }) {
  const sheet = document.createElement('canvas');
  sheet.width = 768;
  sheet.height = Math.max(80, Math.round(768 * height / width));
  const canvas = sheet.getContext('2d'), middle = sheet.height / 2;
  canvas.font = `700 ${Math.min(95, Math.round(sheet.height * .64))}px Inter, system-ui, sans-serif`;
  canvas.textBaseline = 'middle';
  canvas.textAlign = 'center';
  canvas.fillStyle = color;
  const left = symbol ? 104 : 14;
  canvas.fillText(text, (left + sheet.width) / 2, middle, sheet.width - left - 24);
  if (symbol === 'exit') {
    canvas.strokeStyle = color;
    canvas.lineWidth = 6;
    canvas.lineJoin = 'round';
    canvas.lineCap = 'round';
    const y = middle;
    canvas.strokeRect(65, y - 23, 22, 46);
    canvas.beginPath();
    canvas.arc(52, y - 18, 4, 0, Math.PI * 2);
    canvas.stroke();
    canvas.beginPath();
    canvas.moveTo(36, y - 3); canvas.lineTo(44, y - 8); canvas.lineTo(53, y - 7); canvas.lineTo(63, y);
    canvas.moveTo(53, y - 7); canvas.lineTo(47, y + 6); canvas.lineTo(58, y + 20);
    canvas.moveTo(47, y + 6); canvas.lineTo(37, y + 18);
    canvas.stroke();
  }
  const map = new THREE.CanvasTexture(sheet);
  map.colorSpace = THREE.SRGBColorSpace;
  const decal = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({
    map, transparent: true, depthWrite: false, toneMapped: false,
  }));
  decal.position.set(x, y, z);
  decal.rotation.y = yaw;
  parent.add(decal);
  return decal;
}

export function mountSign(model, name, parent, x, y, z) {
  const node = model?.getObjectByName(name);
  if (!node) return null;
  const mount = node.clone(true);
  mount.position.set(x,y,z);
  parent.add(mount);
  return mount;
}
