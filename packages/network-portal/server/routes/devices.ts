/**
 * Device Management API Routes
 * 
 * Implements device discovery, CRUD operations, and connection testing
 * for RouterOS devices in the network monitoring portal.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { Database } from 'better-sqlite3';
import { Client as SSHClient } from 'ssh2';
import { createRouterOSClient } from '../lib/routeros-client';
import crypto from 'crypto';
import { generateKeyPairSync } from 'crypto';
import type { 
  RouterOSClientOptions, 
  DeviceStatus,
  SystemMetrics,
  InterfaceMetrics 
} from '../types/routeros';

// ==================== VALIDATION SCHEMAS ====================

const DeviceCreateSchema = z.object({
  name: z.string().min(1, 'Device name is required'),
  ipAddress: z.string().ip('Invalid IP address'),
  port: z.number().int().min(1).max(65535).default(443),
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
  useSSL: z.boolean().default(true),
  comment: z.string().optional()
});

const DeviceUpdateSchema = DeviceCreateSchema.partial();

const DeviceTestConnectionSchema = z.object({
  ipAddress: z.string().ip('Invalid IP address'),
  port: z.number().int().min(1).max(65535).default(443),
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
  useSSL: z.boolean().default(true)
});

const DeviceQuerySchema = z.object({
  status: z.enum(['connected', 'disconnected', 'error', 'connecting']).optional(),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
  search: z.string().optional()
});

// ==================== INTERFACES ====================

interface DeviceRow {
  id: string;
  name: string;
  ip_address: string;
  username: string;
  password: string;
  port: number;
  use_ssl: boolean;
  ssh_private_key?: string | null;
  ssh_public_key?: string | null;
  status: string;
  last_seen: string | null;
  last_error: string | null;
  connection_attempts: number;
  device_type: string | null;
  routeros_version: string | null;
  architecture: string | null;
  board_name: string | null;
  created_at: string;
  updated_at: string;
}

interface DeviceWithStatus {
  id: string;
  name: string;
  ipAddress: string;
  port: number;
  username: string;
  useSSL: boolean;
  status: 'connected' | 'disconnected' | 'error' | 'connecting';
  lastSeen: string | null;
  lastError: string | null;
  connectionAttempts: number;
  deviceType: string | null;
  routerosVersion: string | null;
  architecture: string | null;
  boardName: string | null;
  createdAt: string;
  updatedAt: string;
}

// ==================== HTTPS UPGRADE HELPERS ====================

interface HTTPSUpgradeRecommendation {
  canUpgrade: boolean;
  reason: string;
  currentPort?: number;
  recommendedPort?: number;
  sshAvailable?: boolean;
  sshDiagnostics?: {
    connectionAttempted: boolean;
    connectionError?: string;
    possibleIssues: string[];
    suggestedFixes: string[];
  };
}

/**
 * Check if HTTP connection can be upgraded to HTTPS
 */
async function checkHTTPSUpgradePotential(config: {
  ipAddress: string;
  username: string;
  password: string;
  port: number;
  useSSL: boolean;
}): Promise<HTTPSUpgradeRecommendation> {
  // Already using HTTPS
  if (config.useSSL) {
    return { 
      canUpgrade: false, 
      reason: 'Already using HTTPS' 
    };
  }

  try {
    // Test SSH availability for certificate setup
    const sshResult = await testSSHConnection({
      host: config.ipAddress,
      port: 22, // Standard SSH port
      username: config.username,
      password: config.password
    });

    if (!sshResult.available) {
      return { 
        canUpgrade: false, 
        reason: 'SSH not available for certificate setup',
        currentPort: config.port,
        sshAvailable: false,
        sshDiagnostics: sshResult.diagnostics
      };
    }

    // HTTP connection that can be upgraded
    return {
      canUpgrade: true,
      reason: 'HTTP connection can be upgraded to HTTPS',
      currentPort: config.port,
      recommendedPort: 443,
      sshAvailable: true,
      sshDiagnostics: sshResult.diagnostics
    };
  } catch (error) {
    return {
      canUpgrade: false,
      reason: 'Unable to determine upgrade potential',
      currentPort: config.port,
      sshAvailable: false,
      sshDiagnostics: {
        connectionAttempted: false,
        connectionError: error instanceof Error ? error.message : 'Unknown error',
        possibleIssues: ['Failed to test SSH connectivity'],
        suggestedFixes: ['Check network connectivity and device configuration']
      }
    };
  }
}

/**
 * Test SSH connection availability with detailed diagnostics
 */
async function testSSHConnection(config: {
  host: string;
  port: number;
  username: string;
  password: string;
}): Promise<{
  available: boolean;
  diagnostics: {
    connectionAttempted: boolean;
    connectionError?: string;
    possibleIssues: string[];
    suggestedFixes: string[];
  };
}> {
  return new Promise((resolve) => {
    const ssh = new SSHClient();
    let resolved = false;
    let connectionError: string | undefined;
    const possibleIssues: string[] = [];
    const suggestedFixes: string[] = [];

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        ssh.end();
        possibleIssues.push('SSH connection timeout (5 seconds)');
        suggestedFixes.push('Check if SSH service is running on the device');
        suggestedFixes.push('Verify firewall rules allow SSH traffic on port 22');
        resolve({
          available: false,
          diagnostics: {
            connectionAttempted: true,
            connectionError: 'Connection timeout',
            possibleIssues,
            suggestedFixes
          }
        });
      }
    }, 10000); // Increased timeout to 10 seconds

    ssh.on('ready', () => {
      if (!resolved) {
        resolved = true;
        ssh.end();
        clearTimeout(timeout);
        resolve({
          available: true,
          diagnostics: {
            connectionAttempted: true,
            possibleIssues: [],
            suggestedFixes: []
          }
        });
      }
    });

    ssh.on('error', (error: Error) => {
      if (!resolved) {
        resolved = true;
        ssh.end();
        clearTimeout(timeout);
        
        connectionError = error.message;
        
        // Analyze error for specific issues
        if (error.message.includes('ECONNREFUSED')) {
          possibleIssues.push('SSH service is not running or not accessible');
          suggestedFixes.push('Enable SSH service: /ip service enable ssh');
          suggestedFixes.push('Check SSH service port: /ip service print where name=ssh');
        } else if (error.message.includes('ETIMEDOUT')) {
          possibleIssues.push('Network connectivity issue or firewall blocking SSH');
          suggestedFixes.push('Add firewall rule: /ip firewall filter add action=accept chain=input protocol=tcp dst-port=22 place-before=0');
          suggestedFixes.push('Check if SSH is listening on correct interface');
        } else if (error.message.includes('All configured authentication methods failed')) {
          possibleIssues.push('SSH authentication failed - RouterOS password login disabled');
          suggestedFixes.push('MOST LIKELY: Enable password login: /ip ssh set always-allow-password-login=yes');
          suggestedFixes.push('Check current SSH config: /ip ssh print');
          suggestedFixes.push('Alternative: Check if strong crypto is blocking: /ip ssh set strong-crypto=no');
          suggestedFixes.push('Verify user permissions: /user print detail where name=' + config.username);
          suggestedFixes.push('After fixing, test SSH manually to verify');
        } else if (error.message.includes('Unsupported algorithm')) {
          possibleIssues.push('SSH algorithm compatibility issue');
          suggestedFixes.push('RouterOS version has different supported SSH algorithms');
          suggestedFixes.push('This is automatically handled - retry connection');
          suggestedFixes.push('Check RouterOS SSH config: /ip ssh print');
        } else if (error.message.includes('Authentication')) {
          possibleIssues.push('SSH authentication failed');
          suggestedFixes.push('Verify username and password are correct');
          suggestedFixes.push('Check if SSH login is allowed for this user');
        } else {
          possibleIssues.push(`SSH connection error: ${error.message}`);
          suggestedFixes.push('Check SSH service configuration');
        }
        
        resolve({
          available: false,
          diagnostics: {
            connectionAttempted: true,
            connectionError,
            possibleIssues,
            suggestedFixes
          }
        });
      }
    });

    try {
      console.log(`🔍 Testing SSH connection to ${config.host}:${config.port}...`);
      ssh.connect({
        host: config.host,
        port: config.port,
        username: config.username,
        password: config.password,
        readyTimeout: 8000, // 8 second ready timeout
        algorithms: {
          // Use RouterOS-compatible algorithms (older RouterOS versions need legacy support)
          kex: [
            'diffie-hellman-group14-sha256',
            'diffie-hellman-group14-sha1', 
            'diffie-hellman-group1-sha1', // Legacy support for older RouterOS
            'diffie-hellman-group-exchange-sha256',
            'diffie-hellman-group-exchange-sha1'
          ],
          cipher: [
            'aes128-ctr', 'aes192-ctr', 'aes256-ctr',
            'aes128-cbc', 'aes192-cbc', 'aes256-cbc',
            '3des-cbc' // Legacy support - removed blowfish-cbc as it's not supported in newer versions
          ],
          hmac: [
            'hmac-sha2-256', 'hmac-sha2-512', 
            'hmac-sha1', 'hmac-sha1-96', // Legacy support
            'hmac-md5', 'hmac-md5-96' // Sometimes needed for older RouterOS
          ]
        },
        // Try both password and keyboard-interactive for RouterOS compatibility
        tryKeyboard: true,
        debug: (msg) => console.log(`SSH Debug: ${msg}`)
      });
    } catch (error) {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        possibleIssues.push('Failed to initiate SSH connection');
        suggestedFixes.push('Check network connectivity to device');
        resolve({
          available: false,
          diagnostics: {
            connectionAttempted: true,
            connectionError: error instanceof Error ? error.message : 'Unknown error',
            possibleIssues,
            suggestedFixes
          }
        });
      }
    }
  });
}

/**
 * Generate SSH key pair ON RouterOS device and configure secure SSH access
 * This approach ensures 100% compatibility by using RouterOS's own key generation
 */
async function setupSecureSSHAccess(deviceRow: DeviceRow, database: Database): Promise<{
  success: boolean;
  publicKey?: string;
  privateKey?: string;
  error?: string;
}> {
  try {
    // Only use server-side key generation for security
    console.log('🔐 Setting up SSH key authentication...');
    console.log('🔑 Generating SSH keys on server (more secure approach)...');
    
    const sshConfigResult = await generateSSHKeyOnServerAndUpload({
      host: deviceRow.ip_address,
      username: deviceRow.username,
      password: deviceRow.password,
      deviceId: deviceRow.id
    });

    if (!sshConfigResult.success) {
      console.log('⚠️ SSH key setup failed, continuing with password auth');
      throw new Error(`Failed to configure SSH key: ${sshConfigResult.error}`);
    }

    // Store the private key securely in database (encrypted)
    const encryptedPrivateKey = encryptPrivateKey(sshConfigResult.privateKey!);
    
    database.prepare(`
      UPDATE devices 
      SET ssh_private_key = ?, ssh_public_key = ?, updated_at = ?
      WHERE id = ?
    `).run(encryptedPrivateKey, sshConfigResult.publicKey!, new Date().toISOString(), deviceRow.id);

    return {
      success: true,
      publicKey: sshConfigResult.publicKey!,
      privateKey: sshConfigResult.privateKey!
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Convert PEM public key to OpenSSH format
 * RouterOS expects OpenSSH format: ssh-rsa AAAAB3NzaC1yc2EAAA... comment
 */
function convertToOpenSSHFormat(pemPublicKey: string, comment: string): string {
  try {
    // Use Node.js built-in SSH key conversion
    const keyObject = crypto.createPublicKey(pemPublicKey);
    
    // Export as JWK to get RSA components reliably
    const jwk = keyObject.export({ format: 'jwk' });
    
    if (jwk.kty !== 'RSA' || !jwk.n || !jwk.e) {
      throw new Error('Invalid RSA key format');
    }
    
    // Convert base64url to base64
    const nBase64 = jwk.n.replace(/-/g, '+').replace(/_/g, '/');
    const eBase64 = jwk.e.replace(/-/g, '+').replace(/_/g, '/');
    
    // Decode to get the actual integers
    const nBuffer = Buffer.from(nBase64 + '=='.slice(0, (4 - nBase64.length % 4) % 4), 'base64');
    const eBuffer = Buffer.from(eBase64 + '=='.slice(0, (4 - eBase64.length % 4) % 4), 'base64');
    
    // Create SSH wire format
    const algorithmName = 'ssh-rsa';
    const parts = [];
    
    // Algorithm name (ssh-rsa)
    const algBuffer = Buffer.from(algorithmName);
    const algLenBuffer = Buffer.alloc(4);
    algLenBuffer.writeUInt32BE(algBuffer.length, 0);
    parts.push(algLenBuffer, algBuffer);
    
    // Public exponent (e) - handle leading zeros properly
    let eClean = eBuffer;
    while (eClean.length > 1 && eClean[0] === 0x00) {
      eClean = eClean.slice(1);
    }
    // Add leading zero if high bit is set (to keep it positive in SSH format)
    if (eClean.length > 0 && eClean[0] !== undefined && (eClean[0] & 0x80)) {
      eClean = Buffer.concat([Buffer.from([0x00]), eClean]);
    }
    const eLenBuffer = Buffer.alloc(4);
    eLenBuffer.writeUInt32BE(eClean.length, 0);
    parts.push(eLenBuffer, eClean);
    
    // Modulus (n) - handle leading zeros properly
    let nClean = nBuffer;
    while (nClean.length > 1 && nClean[0] === 0x00) {
      nClean = nClean.slice(1);
    }
    // Add leading zero if high bit is set (to keep it positive in SSH format)
    if (nClean.length > 0 && nClean[0] !== undefined && (nClean[0] & 0x80)) {
      nClean = Buffer.concat([Buffer.from([0x00]), nClean]);
    }
    const nLenBuffer = Buffer.alloc(4);
    nLenBuffer.writeUInt32BE(nClean.length, 0);
    parts.push(nLenBuffer, nClean);
    
    // Combine and base64 encode
    const sshWireFormat = Buffer.concat(parts);
    const base64Key = sshWireFormat.toString('base64');
    
    // Format: ssh-rsa <base64> <comment>
    return `${algorithmName} ${base64Key} ${comment}`;
    
  } catch (error) {
    throw new Error(`Failed to convert PEM key to OpenSSH format: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Encrypt private key for secure storage
 */
function encryptPrivateKey(privateKey: string): string {
  const algorithm = 'aes-256-cbc';
  const password = process.env.SSH_KEY_ENCRYPTION_PASSWORD || 'default-key';
  const key = crypto.scryptSync(password, 'salt', 32);
  const iv = crypto.randomBytes(16);
  
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(privateKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return `${iv.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt private key using the same algorithm and password as encryption
 */
function decryptPrivateKey(encryptedPrivateKey: string): string {
  const algorithm = 'aes-256-cbc';
  const password = process.env.SSH_KEY_ENCRYPTION_PASSWORD || 'default-key';
  const key = crypto.scryptSync(password, 'salt', 32);
  
  const parts = encryptedPrivateKey.split(':');
  if (parts.length !== 2) {
    throw new Error('Invalid encrypted private key format');
  }
  
  const ivHex = parts[0]!;
  const encrypted = parts[1]!;
  const iv = Buffer.from(ivHex, 'hex');
  
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Generate SSH key pair on server and upload to RouterOS device
 * This approach generates keys on the server (more secure) and uploads the public key
 * Updated to use OpenSSH format which RouterOS expects for key import
 */
async function generateSSHKeyOnServerAndUpload(config: {
  host: string;
  username: string;
  password: string;
  deviceId: string;
}): Promise<{ success: boolean; publicKey?: string; privateKey?: string; error?: string }> {
  try {
    console.log(`🔑 Uploading SSH public key file: network-portal-device_${config.deviceId}_rsa.pub`);
    
    // Generate SSH key pair on server using traditional PEM format (PKCS#1) for SSH2 compatibility
    const keyPair = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs1',  // Traditional RSA private key format (SSH2 compatible)
        format: 'pem'
      }
    }) as { publicKey: string; privateKey: string };

    // Convert PEM public key to OpenSSH format (required by RouterOS)
    const openSSHPublicKey = convertToOpenSSHFormat(keyPair.publicKey, `network-portal-${config.deviceId}`);
    
    console.log('🔍 SSH key format: OpenSSH (RouterOS compatible)');

    // Create RouterOS client for file upload
    const client = createRouterOSClient({
      host: config.host,
      port: 80, // Use HTTP for initial setup
      username: config.username,
      password: config.password,
      useSSL: false
    });

    const keyFileName = `network-portal-device_${config.deviceId}_rsa.pub`;
    
    // Upload the OpenSSH format public key via FTP
    const uploadResult = await client.uploadBackupFile(keyFileName, Buffer.from(openSSHPublicKey, 'utf8'));
    
    if (!uploadResult.success) {
      throw new Error(`Failed to upload SSH public key: ${uploadResult.error}`);
    }
    
    console.log('✅ SSH key file uploaded successfully');
    
    // Wait a moment for the file to be fully written to RouterOS file system
    console.log('⏳ Waiting for file to be fully available in RouterOS...');
    await new Promise(resolve => setTimeout(resolve, 1500)); // 1.5 second delay
    
    // Now configure the SSH key via SSH
    return new Promise((resolve) => {
      const ssh = new SSHClient();
      
      ssh.on('ready', () => {
        console.log('🔑 SSH connected, importing server-generated OpenSSH public key...');
        
        // Phase 1: Only import the SSH key (keep password auth enabled for now)
        const phase1Commands: string[] = [
          // Import the OpenSSH format public key for the user (parameter order matters!)
          `/user ssh-keys import public-key-file=${keyFileName} user=${config.username}`
        ];
        
        let commandIndex = 0;
        let outputData = '';
        
        const executePhase1Commands = () => {
          if (commandIndex >= phase1Commands.length) {
            // Phase 1 completed - SSH key imported successfully
            ssh.end();
            
            // Phase 2: Reconnect with SSH key and complete security setup
            executePhase2WithSSHKey();
            return;
          }
          
          const command = phase1Commands[commandIndex];
          if (!command) {
            ssh.end();
            client.close();
            resolve({ success: false, error: `Invalid command at index ${commandIndex}` });
            return;
          }
          
          console.log(`🔧 Executing: ${command}`);
          
          ssh.exec(command, (err, stream) => {
            if (err) {
              ssh.end();
              client.close();
              resolve({ success: false, error: `SSH execution error: ${err.message}` });
              return;
            }
            
            outputData = '';
            
            stream.on('close', (code: number) => {
              // Handle SSH key import failure gracefully for first command (key import)
              if (code !== 0 && commandIndex === 0) {
                console.log(`📤 SSH output: ${outputData}`);
                console.log(`⚠️ SSH key import failed (code ${code}): ${outputData}`);
                ssh.end();
                client.close();
                resolve({ success: false, error: `Failed to import SSH key: ${outputData}` });
                return;
              }
              
              if (code === 0) {
                commandIndex++;
                executePhase1Commands();
              } else {
                ssh.end();
                client.close();
                resolve({ success: false, error: `Command failed with code ${code}: ${outputData}` });
              }
            });
            
            stream.on('data', (data: Buffer) => {
              const output = data.toString();
              outputData += output;
              console.log(`📤 SSH output: ${output}`);
            });
            
            stream.stderr?.on('data', (data: Buffer) => {
              console.log(`📤 SSH stderr: ${data.toString()}`);
            });
          });
        };

        // Phase 2: Reconnect with SSH key and complete security setup
        const executePhase2WithSSHKey = () => {
          console.log('🔑 Phase 2: Reconnecting with SSH key to complete security setup...');
          
          const ssh2 = new SSHClient();
          
          ssh2.on('ready', () => {
            console.log('✅ SSH key authentication successful, completing security setup...');
            
            const phase2Commands = [
              // Disable password authentication for security
              '/ip ssh set always-allow-password-login=no',
              // Enable strong crypto for better security  
              '/ip ssh set strong-crypto=yes',
              // Clean up the uploaded key file
              `/file remove ${keyFileName}`
            ];
            
            let phase2Index = 0;
            
            const executePhase2Command = () => {
              if (phase2Index >= phase2Commands.length) {
                // All commands completed successfully
                ssh2.end();
                client.close();
                resolve({
                  success: true,
                  publicKey: openSSHPublicKey,
                  privateKey: keyPair.privateKey
                });
                return;
              }
              
              const command = phase2Commands[phase2Index];
              if (!command) {
                ssh2.end();
                client.close();
                resolve({ success: false, error: `Invalid command at index ${phase2Index}` });
                return;
              }
              
              console.log(`🔧 Phase 2 - Executing: ${command}`);
              
              ssh2.exec(command, (err, stream) => {
                if (err) {
                  ssh2.end();
                  client.close();
                  resolve({ success: false, error: `Phase 2 SSH execution error: ${err.message}` });
                  return;
                }
                
                let phase2Output = '';
                
                stream.on('close', (code: number) => {
                  // Allow file removal to fail (file might already be processed)
                  if (code !== 0 && phase2Index === 2) {
                    console.log(`📤 File removal failed (expected): ${phase2Output}`);
                  } else if (code !== 0) {
                    ssh2.end();
                    client.close();
                    resolve({ success: false, error: `Phase 2 command failed with code ${code}: ${phase2Output}` });
                    return;
                  }
                  
                  phase2Index++;
                  executePhase2Command();
                });
                
                stream.on('data', (data: Buffer) => {
                  const output = data.toString();
                  phase2Output += output;
                  console.log(`📤 Phase 2 SSH output: ${output}`);
                });
                
                stream.stderr?.on('data', (data: Buffer) => {
                  console.log(`📤 Phase 2 SSH stderr: ${data.toString()}`);
                });
              });
            };
            
            executePhase2Command();
          });
          
          ssh2.on('error', (err) => {
            client.close();
            resolve({ success: false, error: `Phase 2 SSH connection error: ${err.message}` });
          });
          
          // Connect using the SSH key we just imported
          const privateKey = keyPair.privateKey;
          if (!privateKey) {
            client.close();
            resolve({ success: false, error: 'Private key not available for Phase 2 connection' });
            return;
          }
          
          ssh2.connect({
            host: config.host,
            port: 22,
            username: config.username,
            privateKey: privateKey as string,
            timeout: 10000
          });
        };
        
        executePhase1Commands();
      });
      
      ssh.on('error', (err) => {
        client.close();
        resolve({ success: false, error: `SSH connection error: ${err.message}` });
      });
      
      ssh.connect({
        host: config.host,
        port: 22,
        username: config.username,
        password: config.password,
        timeout: 10000
      });
    });
    
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Removed deprecated RouterOS-side key generation function for security
// Only server-side key generation is used now

// Removed deprecated configureSSHKeyOnDevice function - no longer needed

/**
 * Setup HTTPS certificates for a device
 */
async function setupHTTPSForDevice(deviceRow: DeviceRow, database: Database): Promise<{
  success: boolean;
  progress: {
    currentStep: number;
    totalSteps: number;
    message: string;
    isComplete: boolean;
  };
  error?: string;
}> {
  try {
    const totalSteps = 6;
    
    // Create RouterOS client with HTTP connection (current)
    const client = createRouterOSClient({
      host: deviceRow.ip_address,
      port: deviceRow.port || 80,
      username: deviceRow.username,
      password: deviceRow.password,
      useSSL: false // Start with HTTP
    });

    // Step 1: Test current connection
    console.log('🔄 Testing current HTTP connection...');
    const connectionTest = await client.testConnection();
    if (!connectionTest) {
      throw new Error('Cannot connect to device via HTTP');
    }

    // Step 2: Setup SSH key authentication for enhanced security
    console.log('🔑 Setting up SSH key authentication...');
    const sshKeyResult = await setupSecureSSHAccess(deviceRow, database);
    
    if (!sshKeyResult.success) {
      console.warn('⚠️ SSH key setup failed, continuing with password auth:', sshKeyResult.error);
      // Continue with HTTPS setup even if SSH key setup fails
    } else {
      console.log('✅ SSH key authentication configured successfully');
    }

    // Step 3: Setup HTTPS certificates via SSH
    console.log('🔐 Setting up HTTPS certificates...');
    
    // Create a new client with SSH key authentication if available
    let httpsClient = client;
    if (sshKeyResult.success && sshKeyResult.privateKey) {
      console.log('🔑 Creating new client with SSH key authentication for HTTPS setup');
      httpsClient = createRouterOSClient({
        host: deviceRow.ip_address,
        port: deviceRow.port || 80,
        username: deviceRow.username,
        password: deviceRow.password,
        useSSL: false,
        sshPrivateKey: sshKeyResult.privateKey, // This is already decrypted from setupSecureSSHAccess
        sshPublicKey: sshKeyResult.publicKey
      });
    } else if (deviceRow.ssh_private_key) {
      // If SSH key setup didn't run but we have stored keys, use them
      console.log('🔑 Using existing SSH key from database for HTTPS setup');
      const decryptedPrivateKey = decryptPrivateKey(deviceRow.ssh_private_key);
      httpsClient = createRouterOSClient({
        host: deviceRow.ip_address,
        port: deviceRow.port || 80,
        username: deviceRow.username,
        password: deviceRow.password,
        useSSL: false,
        sshPrivateKey: decryptedPrivateKey,
        sshPublicKey: deviceRow.ssh_public_key || undefined
      });
    }
    
    const setupResult = await httpsClient.setupHTTPSCertificatesViaSSH();
    if (!setupResult.success) {
      throw new Error(`Certificate setup failed: ${setupResult.error}`);
    }

    // Step 4: Configure HTTPS service (enable www-ssl on port 443)
    console.log('🔧 Configuring HTTPS service...');
    // This is already done in setupHTTPSCertificatesViaSSH, just logging for clarity

    // Step 5: Security hardening - disable insecure services
    console.log('🔒 Hardening security - disabling insecure services...');
    const hardeningResult = await httpsClient.hardenSecurityServices();
    if (!hardeningResult.success) {
      console.warn('⚠️ Security hardening failed:', hardeningResult.error);
      // Continue even if hardening fails - HTTPS is still configured
    } else {
      console.log('✅ Security hardening completed - HTTP and FTP services disabled');
    }
    
    // Close the HTTPS client if it's different from the original
    if (httpsClient !== client) {
      httpsClient.close();
    }

    // Step 6: Test HTTPS connection and finalize configuration
    console.log('🧪 Testing HTTPS connection...');
    const httpsTest = await client.testHTTPSConnection();
    if (!httpsTest) {
      throw new Error('HTTPS connection test failed after certificate setup');
    }

    console.log('💾 Updating device configuration...');
    database.prepare(`
      UPDATE devices 
      SET use_ssl = ?, port = ?, updated_at = ?
      WHERE id = ?
    `).run(1, 443, new Date().toISOString(), deviceRow.id);

    client.close();

    return {
      success: true,
      progress: {
        currentStep: totalSteps,
        totalSteps: totalSteps,
        message: sshKeyResult.success 
          ? 'HTTPS with SSH key authentication and security hardening configured successfully'
          : 'HTTPS configured successfully (SSH key setup failed, security partially hardened)',
        isComplete: true
      }
    };
  } catch (error) {
    return {
      success: false,
      progress: {
        currentStep: 0,
        totalSteps: 6,
        message: `Setup failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        isComplete: false
      },
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Test connection for an existing device (retrieves password from database)
 */
async function testExistingDeviceConnection(deviceId: string, database: Database): Promise<{
  success: boolean;
  message: string;
  httpsRecommendation?: HTTPSUpgradeRecommendation;
}> {
  try {
    // Get device credentials from database
    const deviceStmt = database.prepare(`
      SELECT id, name, ip_address, username, password, port, use_ssl
      FROM devices 
      WHERE id = ?
    `);
    const deviceRow = deviceStmt.get(deviceId) as DeviceRow | undefined;

    if (!deviceRow) {
      return {
        success: false,
        message: 'Device not found'
      };
    }

    // Test the connection using RouterOS client
    const client = createRouterOSClient({
      host: deviceRow.ip_address,
      port: deviceRow.port,
      username: deviceRow.username,
      password: deviceRow.password,
      useSSL: Boolean(deviceRow.use_ssl)
    });

    const connectionTest = await client.testConnection();
    client.close();

    if (!connectionTest) {
      return {
        success: false,
        message: 'Connection test failed'
      };
    }

    // Check for HTTPS upgrade potential
    const httpsRecommendation = await checkHTTPSUpgradePotential({
      ipAddress: deviceRow.ip_address,
      username: deviceRow.username,
      password: deviceRow.password,
      port: deviceRow.port,
      useSSL: Boolean(deviceRow.use_ssl)
    });

    return {
      success: true,
      message: 'Connection test successful',
      httpsRecommendation
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Connection test failed'
    };
  }
}

// ==================== ROUTE HANDLERS ====================

async function deviceRoutes(fastify: FastifyInstance) {
  const db = fastify.db as Database;

  /**
   * GET /api/devices - List all devices
   */
  fastify.get('/', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['connected', 'disconnected', 'error', 'connecting'] },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
          offset: { type: 'integer', minimum: 0, default: 0 },
          search: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            devices: { type: 'array' },
            total: { type: 'number' },
            limit: { type: 'number' },
            offset: { type: 'number' }
          },
          required: ['devices', 'total', 'limit', 'offset']
        }
      }
    }
  }, async (request: FastifyRequest<{ Querystring: z.infer<typeof DeviceQuerySchema> }>, reply: FastifyReply) => {
    try {
      const { status, search } = request.query;
      const limit = request.query.limit ?? 50;
      const offset = request.query.offset ?? 0;

      let sql = `
        SELECT id, name, ip_address, username, port, use_ssl, status, 
               last_seen, last_error, connection_attempts, device_type,
               routeros_version, architecture, board_name, created_at, updated_at
        FROM devices
        WHERE 1=1
      `;
      const params: any[] = [];

      // Apply filters
      if (status) {
        sql += ` AND status = ?`;
        params.push(status);
      }

      if (search) {
        sql += ` AND (name LIKE ? OR ip_address LIKE ?)`;
        params.push(`%${search}%`, `%${search}%`);
      }

      // Get total count - build a separate count query
      let countSql = `SELECT COUNT(*) as count FROM devices WHERE 1=1`;
      const countParams: any[] = [];

      // Apply the same filters for count
      if (status) {
        countSql += ` AND status = ?`;
        countParams.push(status);
      }

      if (search) {
        countSql += ` AND (name LIKE ? OR ip_address LIKE ?)`;
        countParams.push(`%${search}%`, `%${search}%`);
      }

      const totalResult = db.prepare(countSql).get(...countParams) as { count: number };
      const total = totalResult?.count ?? 0;

      // Add pagination
      sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
      params.push(limit, offset);

      const deviceRows = db.prepare(sql).all(...params) as DeviceRow[];
      
      const devices: DeviceWithStatus[] = deviceRows.map(row => ({
        id: row.id,
        name: row.name,
        ipAddress: row.ip_address,
        port: row.port,
        username: row.username,
        useSSL: Boolean(row.use_ssl),
        status: row.status as DeviceWithStatus['status'],
        lastSeen: row.last_seen,
        lastError: row.last_error,
        connectionAttempts: row.connection_attempts,
        deviceType: row.device_type,
        routerosVersion: row.routeros_version,
        architecture: row.architecture,
        boardName: row.board_name,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));

      reply.send({ devices, total, limit, offset });
    } catch (error) {
      fastify.log.error('DETAILED ERROR IN GET DEVICES:');
      fastify.log.error('Error message:', error instanceof Error ? error.message : String(error));
      fastify.log.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      fastify.log.error('Full error object:', error);
      reply.status(500).send({ error: 'Failed to retrieve devices' });
    }
  });

  /**
   * GET /api/devices/:id - Get specific device
   */
  fastify.get('/:id', {
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            ipAddress: { type: 'string' },
            port: { type: 'number' },
            username: { type: 'string' },
            useSSL: { type: 'boolean' },
            status: { type: 'string', enum: ['connected', 'disconnected', 'error', 'connecting'] },
            lastSeen: { type: ['string', 'null'], format: 'date-time' },
            lastError: { type: ['string', 'null'] },
            connectionAttempts: { type: 'number' },
            deviceType: { type: ['string', 'null'] },
            routerosVersion: { type: ['string', 'null'] },
            architecture: { type: ['string', 'null'] },
            boardName: { type: ['string', 'null'] },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          },
          required: ['id', 'name', 'ipAddress', 'port', 'username', 'useSSL', 'status', 'connectionAttempts', 'createdAt', 'updatedAt']
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          },
          required: ['error']
        }
      }
    }
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;

      const deviceRow = db.prepare(`
        SELECT id, name, ip_address, username, port, use_ssl, status, 
               last_seen, last_error, connection_attempts, device_type,
               routeros_version, architecture, board_name, created_at, updated_at
        FROM devices WHERE id = ?
      `).get(id) as DeviceRow | undefined;

      if (!deviceRow) {
        return reply.status(404).send({ error: 'Device not found' });
      }

      const device: DeviceWithStatus = {
        id: deviceRow.id,
        name: deviceRow.name,
        ipAddress: deviceRow.ip_address,
        port: deviceRow.port,
        username: deviceRow.username,
        useSSL: Boolean(deviceRow.use_ssl),
        status: deviceRow.status as DeviceWithStatus['status'],
        lastSeen: deviceRow.last_seen,
        lastError: deviceRow.last_error,
        connectionAttempts: deviceRow.connection_attempts,
        deviceType: deviceRow.device_type,
        routerosVersion: deviceRow.routeros_version,
        architecture: deviceRow.architecture,
        boardName: deviceRow.board_name,
        createdAt: deviceRow.created_at,
        updatedAt: deviceRow.updated_at
      };

      reply.send(device);
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({ error: 'Failed to retrieve device' });
    }
  });

  /**
   * POST /api/devices - Create new device
   */
  fastify.post('/', {
    schema: {
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1 },
          ipAddress: { type: 'string', format: 'ipv4' },
          port: { type: 'integer', minimum: 1, maximum: 65535, default: 443 },
          username: { type: 'string', minLength: 1 },
          password: { type: 'string', minLength: 1 },
          useSSL: { type: 'boolean', default: true },
          comment: { type: 'string' }
        },
        required: ['name', 'ipAddress', 'username', 'password']
      },
      // Temporarily removing response validation to debug serialization issue
      // response: {
      //   201: { type: 'object' },
      //   400: {
      //     type: 'object',
      //     properties: {
      //       error: { type: 'string' }
      //     },
      //     required: ['error']
      //   },
      //   409: {
      //     type: 'object',
      //     properties: {
      //       error: { type: 'string' }
      //     },
      //     required: ['error']
      //   }
      // }
    }
  }, async (request: FastifyRequest<{ Body: z.infer<typeof DeviceCreateSchema> }>, reply: FastifyReply) => {
    try {
      const deviceData = request.body;

      // Check if device with same IP and port already exists
      const existingDevice = db.prepare(`
        SELECT id FROM devices WHERE ip_address = ? AND port = ?
      `).get(deviceData.ipAddress, deviceData.port);

      if (existingDevice) {
        return reply.status(409).send({ 
          error: 'Device with this IP address and port already exists' 
        });
      }

      // Generate device ID
      const deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Test connection first
      let connectionStatus = 'disconnected';
      let lastError: string | null = null;
      let deviceInfo: { version?: string; boardName?: string; architecture?: string } = {};

      try {
        const client = createRouterOSClient({
          host: deviceData.ipAddress,
          port: deviceData.port,
          username: deviceData.username,
          password: deviceData.password,
          useSSL: deviceData.useSSL,
          timeout: 10000
        });

        const status = await client.getDeviceStatus();
        if (status.status === 'connected') {
          connectionStatus = 'connected';
          deviceInfo = {
            version: status.routerosVersion,
            boardName: status.boardName,
            architecture: status.architecture
          };
        } else {
          lastError = status.lastError || 'Connection failed';
        }

        client.close();
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Connection failed';
      }

      // Insert device into database
      const now = new Date().toISOString();
      const insertStmt = db.prepare(`
        INSERT INTO devices (
          id, name, ip_address, username, password, port, use_ssl,
          status, last_seen, last_error, connection_attempts,
          routeros_version, board_name, architecture, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      insertStmt.run(
        deviceId,
        deviceData.name,
        deviceData.ipAddress,
        deviceData.username,
        deviceData.password, // Note: In production, this should be encrypted
        deviceData.port,
        deviceData.useSSL ? 1 : 0,
        connectionStatus,
        connectionStatus === 'connected' ? now : null,
        lastError,
        connectionStatus === 'connected' ? 0 : 1,
        deviceInfo.version || null,
        deviceInfo.boardName || null,
        deviceInfo.architecture || null,
        now,
        now
      );

      // Return created device
      const device: DeviceWithStatus = {
        id: deviceId,
        name: deviceData.name,
        ipAddress: deviceData.ipAddress,
        port: deviceData.port,
        username: deviceData.username,
        useSSL: deviceData.useSSL,
        status: connectionStatus as DeviceWithStatus['status'],
        lastSeen: connectionStatus === 'connected' ? now : null,
        lastError,
        connectionAttempts: connectionStatus === 'connected' ? 0 : 1,
        deviceType: null,
        routerosVersion: deviceInfo.version || null,
        architecture: deviceInfo.architecture || null,
        boardName: deviceInfo.boardName || null,
        createdAt: now,
        updatedAt: now
      };

      // Start monitoring for the new device if it's connected
      if (connectionStatus === 'connected') {
        try {
          const monitoringService = (fastify as any).monitoringService;
          if (monitoringService) {
            await monitoringService.startMonitoring(deviceId);
            fastify.log.info(`Started monitoring for newly created device ${deviceId}`);
          }
        } catch (monitoringError) {
          fastify.log.warn(`Failed to start monitoring for device ${deviceId}:`, monitoringError);
          // Don't fail the device creation if monitoring startup fails
        }
      }

      reply.status(201);
      reply.header('Content-Type', 'application/json');
      return reply.send(device);
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({ error: 'Failed to create device' });
    }
  });

  /**
   * PUT /api/devices/:id - Update device
   */
  fastify.put('/:id', {
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1 },
          ipAddress: { type: 'string', format: 'ipv4' },
          port: { type: 'integer', minimum: 1, maximum: 65535 },
          username: { type: 'string', minLength: 1 },
          password: { type: 'string', minLength: 1 },
          useSSL: { type: 'boolean' },
          comment: { type: 'string' }
        }
      },
      response: {
        200: { type: 'object' },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          },
          required: ['error']
        }
      }
    }
  }, async (request: FastifyRequest<{ 
    Params: { id: string }; 
    Body: z.infer<typeof DeviceUpdateSchema> 
  }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const updateData = request.body;

      // Check if device exists
      const existingDevice = db.prepare(`
        SELECT id FROM devices WHERE id = ?
      `).get(id);

      if (!existingDevice) {
        return reply.status(404).send({ error: 'Device not found' });
      }

      // Build update query dynamically
      const updateFields: string[] = [];
      const updateValues: any[] = [];

      if (updateData.name !== undefined) {
        updateFields.push('name = ?');
        updateValues.push(updateData.name);
      }
      if (updateData.ipAddress !== undefined) {
        updateFields.push('ip_address = ?');
        updateValues.push(updateData.ipAddress);
      }
      if (updateData.port !== undefined) {
        updateFields.push('port = ?');
        updateValues.push(updateData.port);
      }
      if (updateData.username !== undefined) {
        updateFields.push('username = ?');
        updateValues.push(updateData.username);
      }
      if (updateData.password !== undefined) {
        updateFields.push('password = ?');
        updateValues.push(updateData.password);
      }
      if (updateData.useSSL !== undefined) {
        updateFields.push('use_ssl = ?');
        updateValues.push(updateData.useSSL ? 1 : 0);
      }

      if (updateFields.length === 0) {
        return reply.status(400).send({ error: 'No fields to update' });
      }

      // Add updated_at timestamp
      updateFields.push('updated_at = ?');
      updateValues.push(new Date().toISOString());
      updateValues.push(id);

      // Execute update
      const updateStmt = db.prepare(`
        UPDATE devices SET ${updateFields.join(', ')} WHERE id = ?
      `);
      updateStmt.run(...updateValues);

      // Return updated device
      const deviceRow = db.prepare(`
        SELECT id, name, ip_address, username, port, use_ssl, status, 
               last_seen, last_error, connection_attempts, device_type,
               routeros_version, architecture, board_name, created_at, updated_at
        FROM devices WHERE id = ?
      `).get(id) as DeviceRow;

      const device: DeviceWithStatus = {
        id: deviceRow.id,
        name: deviceRow.name,
        ipAddress: deviceRow.ip_address,
        port: deviceRow.port,
        username: deviceRow.username,
        useSSL: Boolean(deviceRow.use_ssl),
        status: deviceRow.status as DeviceWithStatus['status'],
        lastSeen: deviceRow.last_seen,
        lastError: deviceRow.last_error,
        connectionAttempts: deviceRow.connection_attempts,
        deviceType: deviceRow.device_type,
        routerosVersion: deviceRow.routeros_version,
        architecture: deviceRow.architecture,
        boardName: deviceRow.board_name,
        createdAt: deviceRow.created_at,
        updatedAt: deviceRow.updated_at
      };

      reply.send(device);
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({ error: 'Failed to update device' });
    }
  });

  /**
   * DELETE /api/devices/:id - Delete device
   */
  fastify.delete('/:id', {
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      },
      response: {
        204: { type: 'null' },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          },
          required: ['error']
        }
      }
    }
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;

      const result = db.prepare(`DELETE FROM devices WHERE id = ?`).run(id);

      if (result.changes === 0) {
        return reply.status(404).send({ error: 'Device not found' });
      }

      reply.status(204).send();
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({ error: 'Failed to delete device' });
    }
  });

  /**
   * POST /api/devices/test-connection - Test device connection
   */
  fastify.post('/test-connection', {
    schema: {
      body: {
        type: 'object',
        properties: {
          ipAddress: { type: 'string', format: 'ipv4' },
          port: { type: 'integer', minimum: 1, maximum: 65535, default: 443 },
          username: { type: 'string', minLength: 1 },
          password: { type: 'string', minLength: 1 },
          useSSL: { type: 'boolean', default: true }
        },
        required: ['ipAddress', 'username', 'password']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            status: { type: 'string' },
            message: { type: 'string' },
            deviceInfo: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                version: { type: 'string' },
                boardName: { type: 'string' },
                architecture: { type: 'string' },
                uptime: { type: 'string' }
              }
            },
            httpsRecommendation: {
              type: 'object',
              properties: {
                canUpgrade: { type: 'boolean' },
                reason: { type: 'string' },
                currentPort: { type: 'number' },
                recommendedPort: { type: 'number' },
                sshAvailable: { type: 'boolean' }
              }
            }
          },
          required: ['success', 'status', 'message']
        }
      }
    }
  }, async (request: FastifyRequest<{ Body: z.infer<typeof DeviceTestConnectionSchema> }>, reply: FastifyReply) => {
    try {
      const { ipAddress, port, username, password, useSSL } = request.body;

      const client = createRouterOSClient({
        host: ipAddress,
        port,
        username,
        password,
        useSSL,
        timeout: 10000,
        retryAttempts: 1
      });

      try {
        const deviceStatus = await client.getDeviceStatus();
        
        if (deviceStatus.status === 'connected') {
          // Check for HTTPS upgrade opportunity
          const httpsRecommendation = await checkHTTPSUpgradePotential({
            ipAddress,
            username,
            password,
            port,
            useSSL
          });

          console.log(`🔍 HTTPS upgrade check for ${ipAddress}:${port} (SSL: ${useSSL}):`, httpsRecommendation);

          const response = {
            success: true,
            status: 'connected',
            message: 'Successfully connected to RouterOS device',
            deviceInfo: {
              name: deviceStatus.name,
              version: deviceStatus.routerosVersion,
              boardName: deviceStatus.boardName,
              architecture: deviceStatus.architecture,
              uptime: deviceStatus.uptime
            },
            httpsRecommendation
          };
          
          console.log(`📤 Sending test-connection response:`, JSON.stringify(response, null, 2));
          reply.send(response);
        } else {
          reply.send({
            success: false,
            status: deviceStatus.status,
            message: deviceStatus.lastError || 'Connection failed'
          });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        reply.send({
          success: false,
          status: 'error',
          message: errorMessage
        });
      } finally {
        client.close();
      }
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({ error: 'Failed to test connection' });
    }
  });

  /**
   * POST /api/devices/:id/test - Test connection for existing device
   */
  fastify.post('/:id/test', {
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            status: { type: 'string' },
            message: { type: 'string' },
            deviceInfo: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                version: { type: 'string' },
                boardName: { type: 'string' },
                architecture: { type: 'string' },
                uptime: { type: 'string' }
              }
            }
          },
          required: ['success', 'status', 'message']
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          },
          required: ['error']
        }
      }
    }
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;

      // Get device from database
      const deviceRow = db.prepare(`
        SELECT id, name, ip_address, username, password, port, use_ssl
        FROM devices WHERE id = ?
      `).get(id) as DeviceRow | undefined;

      if (!deviceRow) {
        return reply.status(404).send({ error: 'Device not found' });
      }

      // Test connection using device credentials
      const client = createRouterOSClient({
        host: deviceRow.ip_address,
        port: deviceRow.port,
        username: deviceRow.username,
        password: deviceRow.password,
        useSSL: Boolean(deviceRow.use_ssl),
        timeout: 10000,
        retryAttempts: 1
      });

      try {
        const deviceStatus = await client.getDeviceStatus();
        
        if (deviceStatus.status === 'connected') {
          // Update device status in database
          const now = new Date().toISOString();
          db.prepare(`
            UPDATE devices 
            SET status = ?, last_seen = ?, last_error = NULL, connection_attempts = 0, updated_at = ?
            WHERE id = ?
          `).run('connected', now, now, id);

          reply.send({
            success: true,
            status: 'connected',
            message: 'Successfully connected to RouterOS device',
            deviceInfo: {
              name: deviceStatus.name,
              version: deviceStatus.routerosVersion,
              boardName: deviceStatus.boardName,
              architecture: deviceStatus.architecture,
              uptime: deviceStatus.uptime
            }
          });
        } else {
          // Update device status in database with error
          const now = new Date().toISOString();
          const errorMessage = deviceStatus.lastError || 'Connection failed';
          db.prepare(`
            UPDATE devices 
            SET status = ?, last_error = ?, connection_attempts = connection_attempts + 1, updated_at = ?
            WHERE id = ?
          `).run('error', errorMessage, now, id);

          reply.send({
            success: false,
            status: deviceStatus.status,
            message: errorMessage
          });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        // Update device status in database with error
        const now = new Date().toISOString();
        db.prepare(`
          UPDATE devices 
          SET status = ?, 
            last_error = ?,
            connection_attempts = connection_attempts + 1,
            updated_at = ?
          WHERE id = ?
        `).run('error', errorMessage, now, id);

        reply.send({
          success: false,
          status: 'error',
          message: errorMessage
        });
      } finally {
        client.close();
      }
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({ error: 'Failed to test device connection' });
    }
  });

  /**
   * POST /api/devices/:id/test-connection - Test connection for existing device with HTTPS detection
   */
  fastify.post('/:id/test-connection', {
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      }
    }
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      
      const result = await testExistingDeviceConnection(id, db);
      
      if (result.success) {
        reply.send({
          success: true,
          message: result.message,
          httpsRecommendation: result.httpsRecommendation
        });
      } else {
        reply.status(400).send({
          success: false,
          error: result.message
        });
      }
    } catch (error) {
      console.error('Device connection test error:', error);
      reply.status(500).send({ 
        success: false,
        error: 'Failed to test device connection' 
      });
    }
  });

  /**
   * POST /api/devices/:id/setup-https - Setup HTTPS for device
   */
  fastify.post('/:id/setup-https', {
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            progress: {
              type: 'object',
              properties: {
                currentStep: { type: 'number' },
                totalSteps: { type: 'number' },
                message: { type: 'string' },
                isComplete: { type: 'boolean' }
              }
            }
          },
          required: ['success', 'message']
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          },
          required: ['error']
        }
      }
    }
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;

      // Get device from database
      const deviceRow = db.prepare(`
        SELECT id, name, ip_address, username, password, port, use_ssl
        FROM devices WHERE id = ?
      `).get(id) as DeviceRow | undefined;

      if (!deviceRow) {
        return reply.status(404).send({ error: 'Device not found' });
      }

      // Setup HTTPS certificates for the device
      const result = await setupHTTPSForDevice(deviceRow, db);
      
      if (result.success) {
        // Restart monitoring with new HTTPS configuration
        try {
          const monitoringService = (fastify as any).monitoringService;
          if (monitoringService) {
            console.log(`🔄 Restarting monitoring for device ${id} after HTTPS setup`);
            await monitoringService.restartMonitoring(id);
            console.log(`✅ Monitoring restarted for device ${id} with HTTPS configuration`);
          }
        } catch (monitoringError) {
          console.error(`⚠️ Failed to restart monitoring for device ${id}:`, monitoringError);
          // Don't fail the HTTPS setup if monitoring restart fails
        }

        reply.send({
          success: true,
          message: 'HTTPS setup completed successfully',
          progress: result.progress
        });
      } else {
        reply.status(500).send({
          success: false,
          message: result.error || 'HTTPS setup failed',
          progress: result.progress
        });
      }
    } catch (error) {
      fastify.log.error('HTTPS setup error:', error);
      reply.status(500).send({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /api/devices/:id/status - Get real-time device status
   */
  fastify.get('/:id/status', {
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      },
      response: {
        200: { type: 'object' },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          },
          required: ['error']
        }
      }
    }
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;

      // Get device from database
      const deviceRow = db.prepare(`
        SELECT id, name, ip_address, username, password, port, use_ssl
        FROM devices WHERE id = ?
      `).get(id) as DeviceRow | undefined;

      if (!deviceRow) {
        return reply.status(404).send({ error: 'Device not found' });
      }

      // Create client and get current status
      const client = createRouterOSClient({
        host: deviceRow.ip_address,
        port: deviceRow.port,
        username: deviceRow.username,
        password: deviceRow.password,
        useSSL: Boolean(deviceRow.use_ssl),
        timeout: 5000,
        retryAttempts: 1
      });

      try {
        const deviceStatus = await client.getDeviceStatus();
        
        // Update database with current status
        const now = new Date().toISOString();
        const updateStmt = db.prepare(`
          UPDATE devices SET 
            status = ?, 
            last_seen = ?, 
            last_error = ?,
            routeros_version = ?,
            board_name = ?,
            architecture = ?,
            updated_at = ?
          WHERE id = ?
        `);

        updateStmt.run(
          deviceStatus.status,
          deviceStatus.status === 'connected' ? now : null,
          deviceStatus.lastError,
          deviceStatus.routerosVersion || null,
          deviceStatus.boardName || null,
          deviceStatus.architecture || null,
          now,
          id
        );

        reply.send(deviceStatus);
      } catch (error) {
        // Update database with error status
        const errorMessage = error instanceof Error ? error.message : 'Connection failed';
        const updateStmt = db.prepare(`
          UPDATE devices 
          SET 
            status = ?, 
            last_error = ?,
            connection_attempts = connection_attempts + 1,
            updated_at = ?
          WHERE id = ?
        `);

        updateStmt.run(errorMessage, new Date().toISOString(), id);

        reply.send({
          id,
          name: deviceRow.name,
          ipAddress: deviceRow.ip_address,
          status: 'error',
          lastError: errorMessage,
          connectionAttempts: 0 // Will be updated by database
        });
      } finally {
        client.close();
      }
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({ error: 'Failed to get device status' });
    }
  });

  /**
   * POST /api/devices/discover - Discover RouterOS devices on network
   */
  fastify.post('/discover', {
    schema: {
      body: {
        type: 'object',
        properties: {
          networkRange: { 
            type: 'string', 
            pattern: '^\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\/\\d{1,2}$' 
          },
          port: { type: 'integer', minimum: 1, maximum: 65535, default: 443 },
          useSSL: { type: 'boolean', default: true },
          timeout: { type: 'integer', minimum: 1000, maximum: 30000, default: 5000 }
        },
        required: ['networkRange']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            discoveredDevices: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  ipAddress: { type: 'string' },
                  port: { type: 'number' },
                  reachable: { type: 'boolean' },
                  isRouterOS: { type: 'boolean' },
                  deviceInfo: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      version: { type: 'string' },
                      boardName: { type: 'string' }
                    }
                  }
                }
              }
            },
            totalScanned: { type: 'number' },
            totalReachable: { type: 'number' }
          },
          required: ['discoveredDevices', 'totalScanned', 'totalReachable']
        }
      }
    }
  }, async (request: FastifyRequest<{ 
    Body: {
      networkRange: string;
      port: number;
      useSSL: boolean;
      timeout: number;
    }
  }>, reply: FastifyReply) => {
    try {
      const { networkRange, port, useSSL, timeout } = request.body;

      // Parse CIDR notation
      const [network, prefixLength] = networkRange.split('/');
      
      if (!network || !prefixLength) {
        return reply.status(400).send({ 
          error: 'Invalid CIDR format. Expected format: 192.168.1.0/24' 
        });
      }
      
      const prefix = parseInt(prefixLength, 10);
      
      if (prefix < 24 || prefix > 32) {
        return reply.status(400).send({ 
          error: 'Network range too large. Please use /24 to /32 ranges for discovery.' 
        });
      }

      // Generate IP addresses to scan
      const networkParts = network.split('.').map(Number);
      const hostBits = 32 - prefix;
      const maxHosts = Math.pow(2, hostBits) - 2; // Exclude network and broadcast
      
      if (maxHosts > 254) {
        return reply.status(400).send({ 
          error: 'Network range too large. Maximum 254 hosts supported.' 
        });
      }

      const ipsToScan: string[] = [];
      for (let i = 1; i <= maxHosts; i++) {
        const ip = [...networkParts];
        let carry = i;
        for (let j = 3; j >= 0; j--) {
          if (hostBits > (3 - j) * 8) {
            const bitsInOctet = Math.min(8, hostBits - (3 - j) * 8);
            const currentOctet = ip[j];
            if (currentOctet !== undefined) {
              ip[j] = currentOctet + (carry & ((1 << bitsInOctet) - 1));
            }
            carry >>= bitsInOctet;
          }
        }
        ipsToScan.push(ip.join('.'));
      }

      const discoveredDevices: any[] = [];
      let totalReachable = 0;

      // Scan devices in parallel (with concurrency limit)
      const concurrency = 10;
      for (let i = 0; i < ipsToScan.length; i += concurrency) {
        const batch = ipsToScan.slice(i, i + concurrency);
        
        const results = await Promise.allSettled(
          batch.map(async (ipAddress) => {
            const client = createRouterOSClient({
              host: ipAddress,
              port,
              username: 'admin', // Default username for discovery
              password: '', // Try empty password first
              useSSL,
              timeout,
              retryAttempts: 1
            });

            try {
              // Try to connect with empty password (common default)
              const testResult = await client.testConnection();
              if (testResult) {
                const deviceStatus = await client.getDeviceStatus();
                return {
                  ipAddress,
                  port,
                  reachable: true,
                  isRouterOS: true,
                  deviceInfo: {
                    name: deviceStatus.name,
                    version: deviceStatus.routerosVersion,
                    boardName: deviceStatus.boardName
                  }
                };
              }
            } catch (error) {
              // Device might be RouterOS but require authentication
              if (error instanceof Error && 
                  (error.message.includes('401') || error.message.includes('authentication'))) {
                return {
                  ipAddress,
                  port,
                  reachable: true,
                  isRouterOS: true,
                  deviceInfo: undefined // Requires authentication
                };
              }
            } finally {
              client.close();
            }

    return {
              ipAddress,
              port,
              reachable: false,
              isRouterOS: false
            };
          })
        );

        results.forEach((result) => {
          if (result.status === 'fulfilled') {
            const device = result.value;
            if (device.reachable) {
              totalReachable++;
              if (device.isRouterOS) {
                discoveredDevices.push(device);
              }
            }
          }
        });
      }

      reply.send({
        discoveredDevices,
        totalScanned: ipsToScan.length,
        totalReachable
      });
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({ error: 'Failed to discover devices' });
    }
  });

  /**
   * GET /api/devices/:id/interfaces - Get live interfaces from RouterOS device
   */
  fastify.get('/:id/interfaces', {
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            device: { type: 'object' },
            interfaces: { type: 'array' },
            count: { type: 'number' }
          },
          required: ['device', 'interfaces', 'count']
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          },
          required: ['error']
        }
      }
    }
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;

      const device = db.prepare('SELECT * FROM devices WHERE id = ?').get(id) as DeviceRow;
      if (!device) {
        return reply.status(404).send({ error: 'Device not found' });
      }

      // Create RouterOS client
      const client = createRouterOSClient({
        host: device.ip_address,
        port: device.port,
        username: device.username,
        password: device.password,
        useSSL: Boolean(device.use_ssl),
        timeout: 10000,
        retryAttempts: 2
      });

      try {
        const interfacesResponse = await client.getInterfaces();
        
        if (!interfacesResponse.success) {
          return reply.status(500).send({ 
            error: `Failed to get interfaces: ${interfacesResponse.error}` 
          });
        }

        const interfaces = interfacesResponse.data || [];

        reply.send({
          device: {
            id: device.id,
            name: device.name,
            ip_address: device.ip_address,
            status: device.status
          },
          interfaces,
          count: interfaces.length
        });
      } finally {
        client.close();
      }
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({ error: 'Failed to retrieve device interfaces' });
    }
  });
}

export default deviceRoutes; 