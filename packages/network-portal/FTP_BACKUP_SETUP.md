# RouterOS FTP Backup System Setup

## Overview

We've successfully implemented FTP-based backup downloads for RouterOS devices, replacing the previous non-functional REST API approach. This system now properly handles backup file downloads from RouterOS devices using FTP protocol.

## What Was Fixed

### 1. **Identified the Core Problem**
- RouterOS REST API **does not support file downloads** 
- Previous system was creating fake backup entries with JSON placeholders instead of actual backup data
- Users saw "Local" backups that were actually just metadata, not real backup files

### 2. **Implemented FTP Solution**
- Added `basic-ftp` library for reliable file transfers
- Created `FTPClient` wrapper class (`server/lib/ftp-client.ts`)
- Updated `RouterOSClient` to support FTP downloads (`server/lib/routeros-client.ts`)
- Enhanced `ConfigurationService` to use real FTP downloads (`server/services/configuration-service.ts`)

### 3. **Database Schema Updates**
- Added FTP configuration columns to `devices` table:
  - `ftp_port` (default: 21)
  - `ftp_username` (defaults to main username if NULL)
  - `ftp_password` (defaults to main password if NULL)

### 4. **Cleaned Up Fake Data**
- Enhanced `cleanupStaleBackups()` method to detect and remove fake backup entries
- Fake entries contained JSON metadata like `"message":"Backup created on RouterOS device (file not downloaded)"`
- System now only stores actual backup file data in the database

## How It Works Now

### Backup Creation Process
1. **Create Backup on RouterOS**: Uses REST API `/system/backup/save` to create `.backup` file on device
2. **Download via FTP**: Uses FTP client to download the actual backup file from RouterOS device
3. **Store Locally**: Only stores real backup data in database (no more fake placeholders)
4. **Fallback Handling**: If FTP download fails, creates device-only backup entry (not stored locally)

### FTP Configuration
- **Default Settings**: Uses same credentials as REST API (username/password)
- **Custom FTP Settings**: Can be configured per-device in database
- **Port**: Defaults to 21 (standard FTP port)
- **Security**: Uses unencrypted FTP (RouterOS standard)

### Backup Status Indicators
- **"Local"**: Backup file successfully downloaded and stored in database
- **"Device"**: Backup exists on RouterOS device but not downloaded locally
- **"Missing"**: Backup entry exists but file missing from both locations

## Current System Capabilities

✅ **Working Features:**
- Create backups on RouterOS devices
- Download backup files via FTP (when FTP is accessible)
- Upload backup files from computer to database
- Download backup files from database to computer
- Delete local backup entries
- Restore backups on RouterOS devices (if backup exists on device)
- Cleanup stale/fake backup entries
- Status tracking for backup locations

⚠️ **FTP Requirements:**
- RouterOS device must have FTP service enabled
- Network must allow FTP connections (port 21)
- Proper credentials must be configured

## Configuration

### Enable FTP on RouterOS Device
```routeros
/ip service enable ftp
/ip service set ftp port=21
```

### Configure FTP Credentials (Optional)
If you need different FTP credentials than REST API credentials, update the device in the database:
```sql
UPDATE devices SET 
  ftp_username = 'ftp_user',
  ftp_password = 'ftp_password',
  ftp_port = 21
WHERE id = 'your_device_id';
```

## API Endpoints

- `POST /api/config/devices/:id/backup` - Create backup (with FTP download)
- `GET /api/config/devices/:id/backups` - List all backups (local + device)
- `POST /api/config/devices/:id/backup/:backupName/download` - Download from device via FTP
- `GET /api/config/devices/:id/backup/:backupId/download` - Download from local database
- `POST /api/config/devices/:id/cleanup-backups` - Clean up fake/stale entries
- `DELETE /api/config/devices/:id/backup/:backupId` - Delete local backup entry
- `POST /api/config/devices/:id/backup/:backupId/restore` - Restore backup on device

## Troubleshooting

### FTP Connection Issues
1. **Check FTP Service**: Ensure FTP is enabled on RouterOS device
2. **Network Access**: Verify port 21 is accessible from server
3. **Credentials**: Confirm FTP username/password are correct
4. **Firewall**: Check if firewall blocks FTP connections

### Backup Download Failures
- System will create device-only backup entry if FTP fails
- Check server logs for specific FTP error messages
- Use cleanup endpoint to remove failed entries

## Files Modified

1. `server/lib/ftp-client.ts` - New FTP client wrapper
2. `server/lib/routeros-client.ts` - Added FTP download methods
3. `server/services/configuration-service.ts` - Enhanced backup handling
4. `server/database/schema.sql` - Added FTP columns to devices table

## Next Steps

The backup system is now fully functional with FTP support. Users can:
1. Create backups that actually download real backup files
2. Manage backup files properly with accurate status indicators
3. Use FTP-based downloads for reliable file transfers
4. Clean up any remaining fake backup entries automatically

The system properly handles the RouterOS limitation of not supporting file downloads via REST API by using the appropriate FTP protocol for file transfers. 