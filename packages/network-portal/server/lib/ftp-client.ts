import { Client } from 'basic-ftp';

export interface FTPConfig {
  host: string;
  port?: number;
  user: string;
  password: string;
  secure?: boolean;
}

export class FTPClient {
  private config: FTPConfig;

  constructor(config: FTPConfig) {
    this.config = {
      port: 21,
      secure: false,
      ...config
    };
  }

  /**
   * Download a file from the RouterOS device via FTP
   */
  async downloadFile(remoteFilePath: string): Promise<Buffer> {
    const client = new Client();
    
    try {
      // Connect to FTP server
      await client.access({
        host: this.config.host,
        port: this.config.port,
        user: this.config.user,
        password: this.config.password,
        secure: this.config.secure
      });

      console.log(`Connected to FTP server at ${this.config.host}:${this.config.port}`);

      // Download file to buffer
      const chunks: Buffer[] = [];
      const { Writable } = await import('stream');
      
      const writeStream = new Writable({
        write(chunk: Buffer, encoding, callback) {
          chunks.push(chunk);
          callback();
        }
      });
      
      await client.downloadTo(writeStream, remoteFilePath);
      const fileBuffer = Buffer.concat(chunks);
      console.log(`Downloaded file ${remoteFilePath}, size: ${fileBuffer.length} bytes`);
      
      return fileBuffer;
    } catch (error) {
      console.error(`FTP download error for ${remoteFilePath}:`, error);
      throw new Error(`Failed to download file via FTP: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      client.close();
    }
  }

  /**
   * List files in a directory
   */
  async listFiles(remotePath: string = '/'): Promise<any[]> {
    const client = new Client();
    
    try {
      await client.access({
        host: this.config.host,
        port: this.config.port,
        user: this.config.user,
        password: this.config.password,
        secure: this.config.secure
      });

      const files = await client.list(remotePath);
      return files;
    } catch (error) {
      console.error(`FTP list error for ${remotePath}:`, error);
      throw new Error(`Failed to list files via FTP: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      client.close();
    }
  }

  /**
   * Upload a file to the RouterOS device via FTP
   */
  async uploadFile(remoteFilePath: string, fileData: Buffer): Promise<void> {
    const client = new Client();
    
    try {
      // Connect to FTP server
      await client.access({
        host: this.config.host,
        port: this.config.port,
        user: this.config.user,
        password: this.config.password,
        secure: this.config.secure
      });

      console.log(`Connected to FTP server at ${this.config.host}:${this.config.port} for upload`);

      // Upload file from buffer
      const { Readable } = await import('stream');
      
      const readStream = new Readable({
        read() {
          this.push(fileData);
          this.push(null); // Signal end of stream
        }
      });
      
      await client.uploadFrom(readStream, remoteFilePath);
      console.log(`Uploaded file ${remoteFilePath}, size: ${fileData.length} bytes`);
    } catch (error) {
      console.error(`FTP upload error for ${remoteFilePath}:`, error);
      throw new Error(`Failed to upload file via FTP: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      client.close();
    }
  }

  /**
   * Test FTP connection
   */
  async testConnection(): Promise<boolean> {
    const client = new Client();
    
    try {
      await client.access({
        host: this.config.host,
        port: this.config.port,
        user: this.config.user,
        password: this.config.password,
        secure: this.config.secure
      });
      
      console.log(`FTP connection test successful for ${this.config.host}`);
      return true;
    } catch (error) {
      console.error(`FTP connection test failed for ${this.config.host}:`, error);
      return false;
    } finally {
      client.close();
    }
  }
} 