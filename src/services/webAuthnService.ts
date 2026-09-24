import { Employee, BiometricCredential } from '../types';
import { getEmployees, saveEmployees } from './storageService';
import { getEmployeeStaffSession, setEmployeeStaffSession } from './employeeStaffService';

// Local storage key for storing device-specific biometric tokens & employee mapping
const DEVICE_BIOMETRIC_REGISTRY_KEY = 'deep_pos_device_biometric_registry';

export interface DeviceBiometricEntry {
  credentialId: string;
  employeeId: string;
  employeeName: string;
  employeeContact: string;
  createdAt: string;
  deviceName: string;
}

/**
 * Converts ArrayBuffer to Base64URL string
 */
export function bufferToBase64Url(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Converts Base64URL string to ArrayBuffer
 */
export function base64UrlToBuffer(base64Url: string): ArrayBuffer {
  let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4;
  if (pad) {
    if (pad === 1) throw new Error('Invalid base64url string');
    base64 += new Array(5 - pad).join('=');
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Converts a UTF-8 string to a Uint8Array
 */
export function stringToUint8Array(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

/**
 * Check if the browser supports WebAuthn API
 */
export function isWebAuthnSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.PublicKeyCredential !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    typeof navigator.credentials !== 'undefined' &&
    typeof navigator.credentials.create === 'function' &&
    typeof navigator.credentials.get === 'function'
  );
}

/**
 * Check if the device has a platform authenticator (Fingerprint, Touch ID, Face ID, Windows Hello)
 */
export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (!isWebAuthnSupported()) return false;
  try {
    if (typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
      const isAvailable = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      return isAvailable;
    }
    return true;
  } catch (err) {
    console.warn('WebAuthn platform check error:', err);
    return false;
  }
}

/**
 * Gets a friendly human-readable biometric method name based on device user agent
 */
export function getBiometricHardwareName(): { name: string; type: 'face' | 'fingerprint' | 'general' } {
  if (typeof navigator === 'undefined') {
    return { name: 'Biometric Scanner', type: 'general' };
  }
  const ua = navigator.userAgent.toLowerCase();
  
  if (/iphone|ipad|ipod/.test(ua)) {
    // Newer iOS devices mostly use Face ID, older use Touch ID
    return { name: 'Face ID / Touch ID', type: 'face' };
  }
  if (/macintosh|mac os x/.test(ua)) {
    return { name: 'Touch ID', type: 'fingerprint' };
  }
  if (/android/.test(ua)) {
    return { name: 'Fingerprint / Face Unlock', type: 'fingerprint' };
  }
  if (/windows/.test(ua)) {
    return { name: 'Windows Hello', type: 'face' };
  }
  return { name: 'Fingerprint / Biometrics', type: 'fingerprint' };
}

/**
 * Loads device-registered biometric credentials from localStorage
 */
export function getDeviceBiometricRegistry(): DeviceBiometricEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(DEVICE_BIOMETRIC_REGISTRY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Saves device-registered biometric credentials to localStorage
 */
export function saveDeviceBiometricRegistry(registry: DeviceBiometricEntry[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(DEVICE_BIOMETRIC_REGISTRY_KEY, JSON.stringify(registry));
  } catch (err) {
    console.error('Failed to save biometric registry', err);
  }
}

/**
 * Check if a specific employee has biometric login registered on this local device or in their profile
 */
export function isEmployeeBiometricRegistered(employeeId: string): boolean {
  // Check in device registry
  const deviceRegistry = getDeviceBiometricRegistry();
  const hasOnDevice = deviceRegistry.some(entry => entry.employeeId === employeeId);
  if (hasOnDevice) return true;

  // Check in employee profile
  const emps = getEmployees();
  const emp = emps.find(e => e.id === employeeId);
  return !!(emp?.biometricCredentials && emp.biometricCredentials.length > 0);
}

/**
 * Registers a new biometric credential for an employee using WebAuthn (navigator.credentials.create)
 */
export async function registerBiometricCredential(
  employee: Employee,
  customDeviceName?: string
): Promise<{ success: boolean; error?: string; credential?: BiometricCredential; employee?: Employee }> {
  if (!isWebAuthnSupported()) {
    return {
      success: false,
      error: 'Web Authentication (WebAuthn) is not supported on this browser or device.'
    };
  }

  try {
    // Generate a secure random 32-byte challenge
    const challenge = window.crypto.getRandomValues(new Uint8Array(32));
    const userIdBuffer = stringToUint8Array(employee.id);
    const hwInfo = getBiometricHardwareName();
    const deviceLabel = customDeviceName || `${hwInfo.name} (${new Date().toLocaleDateString()})`;

    // Standard WebAuthn PublicKeyCredentialCreationOptions
    const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
      challenge,
      rp: {
        name: 'Bhutan POS Staff Portal',
        // Omit id so browser defaults to current effective domain origin
      },
      user: {
        id: userIdBuffer,
        name: employee.contactNo || employee.empCode || employee.fullName,
        displayName: employee.fullName
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' },   // ES256 (Elliptic Curve - standard on iOS/Android)
        { alg: -257, type: 'public-key' }, // RS256 (RSA - Windows Hello)
        { alg: -8, type: 'public-key' }    // Ed25519
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform', // Enforce on-device biometrics (Face ID/Touch ID/Fingerprint)
        userVerification: 'preferred',
        requireResidentKey: false
      },
      timeout: 60000,
      attestation: 'none'
    };

    const rawCredential = await navigator.credentials.create({
      publicKey: publicKeyCredentialCreationOptions
    }) as PublicKeyCredential | null;

    if (!rawCredential) {
      return { success: false, error: 'Biometric registration was not completed.' };
    }

    const credentialIdBase64 = bufferToBase64Url(rawCredential.rawId);
    
    const newBioCredential: BiometricCredential = {
      id: credentialIdBase64,
      rawId: credentialIdBase64,
      type: rawCredential.type,
      createdAt: new Date().toISOString(),
      deviceName: deviceLabel
    };

    // Update employee records in storage
    const emps = getEmployees();
    const targetIdx = emps.findIndex(e => e.id === employee.id);
    let updatedEmp: Employee;

    if (targetIdx !== -1) {
      const existingBio = emps[targetIdx].biometricCredentials || [];
      // Replace or prepend
      const filtered = existingBio.filter(b => b.id !== credentialIdBase64);
      updatedEmp = {
        ...emps[targetIdx],
        biometricCredentials: [newBioCredential, ...filtered]
      };
      emps[targetIdx] = updatedEmp;
      saveEmployees(emps);
    } else {
      updatedEmp = {
        ...employee,
        biometricCredentials: [newBioCredential]
      };
    }

    // Save in device registry
    const registry = getDeviceBiometricRegistry().filter(r => r.credentialId !== credentialIdBase64);
    registry.unshift({
      credentialId: credentialIdBase64,
      employeeId: employee.id,
      employeeName: employee.fullName,
      employeeContact: employee.contactNo,
      createdAt: new Date().toISOString(),
      deviceName: deviceLabel
    });
    saveDeviceBiometricRegistry(registry);

    // Update active staff session if logged in
    const activeSession = getEmployeeStaffSession();
    if (activeSession && activeSession.employee.id === employee.id) {
      setEmployeeStaffSession(updatedEmp, activeSession.companyId);
    }

    return {
      success: true,
      credential: newBioCredential,
      employee: updatedEmp
    };
  } catch (err: any) {
    console.error('Biometric registration error:', err);
    if (err.name === 'NotAllowedError') {
      return { success: false, error: 'Biometric prompt was canceled or timed out.' };
    }
    if (err.name === 'InvalidStateError') {
      return { success: false, error: 'This biometric key is already registered on this device.' };
    }
    if (err.name === 'NotSupportedError') {
      return { success: false, error: 'Biometric hardware is unavailable or not configured.' };
    }
    return {
      success: false,
      error: err.message || 'Failed to complete biometric setup.'
    };
  }
}

/**
 * Authenticates an employee using WebAuthn (navigator.credentials.get)
 * Can authenticate a specific selected employee or any employee registered on this device.
 */
export async function authenticateWithBiometrics(
  targetEmployee?: Employee,
  allEmployees?: Employee[]
): Promise<{ success: boolean; employee?: Employee; error?: string }> {
  if (!isWebAuthnSupported()) {
    return {
      success: false,
      error: 'Biometric authentication is not supported on this browser.'
    };
  }

  const emps = allEmployees && allEmployees.length > 0 ? allEmployees : getEmployees();
  const deviceRegistry = getDeviceBiometricRegistry();

  try {
    const challenge = window.crypto.getRandomValues(new Uint8Array(32));
    
    // Prepare allowCredentials list
    let allowCredentialsList: PublicKeyCredentialDescriptor[] = [];

    if (targetEmployee) {
      // If target employee is known, allow their specific registered credentials
      const empCredentials = targetEmployee.biometricCredentials || [];
      const matchingDeviceCreds = deviceRegistry.filter(r => r.employeeId === targetEmployee.id);
      
      const allCredIds = new Set<string>([
        ...empCredentials.map(c => c.id),
        ...matchingDeviceCreds.map(c => c.credentialId)
      ]);

      allowCredentialsList = Array.from(allCredIds).map(id => ({
        id: base64UrlToBuffer(id),
        type: 'public-key' as const
      }));
    } else {
      // If no specific employee is selected, check all registered device credentials
      const allRegisteredIds = new Set<string>();
      deviceRegistry.forEach(r => allRegisteredIds.add(r.credentialId));
      emps.forEach(e => {
        e.biometricCredentials?.forEach(c => allRegisteredIds.add(c.id));
      });

      allowCredentialsList = Array.from(allRegisteredIds).map(id => ({
        id: base64UrlToBuffer(id),
        type: 'public-key' as const
      }));
    }

    const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
      challenge,
      timeout: 60000,
      userVerification: 'preferred',
      // If we have specific credentials list, supply it; otherwise let browser discover resident keys
      ...(allowCredentialsList.length > 0 ? { allowCredentials: allowCredentialsList } : {})
    };

    const assertion = await navigator.credentials.get({
      publicKey: publicKeyCredentialRequestOptions
    }) as PublicKeyCredential | null;

    if (!assertion) {
      return { success: false, error: 'Biometric verification was not completed.' };
    }

    const assertionIdBase64 = bufferToBase64Url(assertion.rawId);

    // Identify which employee this credential belongs to
    let matchedEmployee: Employee | undefined;

    if (targetEmployee) {
      matchedEmployee = targetEmployee;
    } else {
      // Check device registry first
      const regMatch = deviceRegistry.find(r => r.credentialId === assertionIdBase64);
      if (regMatch) {
        matchedEmployee = emps.find(e => e.id === regMatch.employeeId);
      }

      // If not found in registry, check across employee biometric credentials
      if (!matchedEmployee) {
        matchedEmployee = emps.find(e => 
          e.biometricCredentials?.some(c => c.id === assertionIdBase64)
        );
      }
    }

    if (!matchedEmployee) {
      return {
        success: false,
        error: 'Biometric recognized, but no matching employee profile was found.'
      };
    }

    return {
      success: true,
      employee: matchedEmployee
    };
  } catch (err: any) {
    console.error('Biometric login error:', err);
    if (err.name === 'NotAllowedError') {
      return { success: false, error: 'Biometric recognition was canceled or timed out.' };
    }
    if (err.name === 'InvalidStateError') {
      return { success: false, error: 'Biometric sensor state error. Please try your PIN.' };
    }
    return {
      success: false,
      error: err.message || 'Biometric authentication failed. Please sign in with your PIN.'
    };
  }
}

/**
 * Removes biometric credential for an employee
 */
export function removeBiometricCredential(
  employeeId: string,
  credentialId?: string
): { success: boolean; employee?: Employee } {
  const emps = getEmployees();
  const targetIdx = emps.findIndex(e => e.id === employeeId);
  if (targetIdx === -1) return { success: false };

  const currentEmp = emps[targetIdx];
  const updatedCreds = credentialId
    ? (currentEmp.biometricCredentials || []).filter(c => c.id !== credentialId)
    : [];

  const updatedEmp: Employee = {
    ...currentEmp,
    biometricCredentials: updatedCreds
  };

  emps[targetIdx] = updatedEmp;
  saveEmployees(emps);

  // Update device registry
  const deviceRegistry = getDeviceBiometricRegistry().filter(r => {
    if (r.employeeId !== employeeId) return true;
    if (credentialId && r.credentialId !== credentialId) return true;
    return false;
  });
  saveDeviceBiometricRegistry(deviceRegistry);

  // Update session
  const activeSession = getEmployeeStaffSession();
  if (activeSession && activeSession.employee.id === employeeId) {
    setEmployeeStaffSession(updatedEmp, activeSession.companyId);
  }

  return { success: true, employee: updatedEmp };
}
