// Browser shim for Node.js 'os' module
// GramJS calls os.type(), os.release(), os.hostname()
export function type() {
  return 'Browser';
}

export function release() {
  return navigator.userAgent || 'unknown';
}

export function hostname() {
  return window.location?.hostname || 'localhost';
}

export function platform() {
  return 'browser';
}

export function arch() {
  return 'wasm';
}

export function cpus() {
  return [{ model: 'browser', speed: 0 }];
}

export function totalmem() {
  return navigator.deviceMemory ? navigator.deviceMemory * 1024 * 1024 * 1024 : 0;
}

export function freemem() {
  return 0;
}

export function homedir() {
  return '/';
}

export function tmpdir() {
  return '/tmp';
}

export function endianness() {
  return 'LE';
}

export function networkInterfaces() {
  return {};
}

export default {
  type,
  release,
  hostname,
  platform,
  arch,
  cpus,
  totalmem,
  freemem,
  homedir,
  tmpdir,
  endianness,
  networkInterfaces,
  EOL: '\n',
};
