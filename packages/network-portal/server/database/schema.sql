-- RouterOS Network Portal Database Schema
-- SQLite database for storing device configurations, monitoring data, and alerts

-- Device management
CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,                 -- UUID for device
  name TEXT NOT NULL,                  -- Human-readable device name
  ip_address TEXT NOT NULL,            -- Router IP address
  username TEXT NOT NULL,              -- RouterOS username
  password TEXT NOT NULL,              -- Encrypted password
  port INTEGER DEFAULT 443,            -- API port (443 for HTTPS, 80 for HTTP)
  use_ssl BOOLEAN DEFAULT true,        -- Use HTTPS
  api_path TEXT DEFAULT '/rest',       -- API base path
  ftp_port INTEGER DEFAULT 21,         -- FTP port for backup downloads
  ftp_username TEXT,                   -- FTP username (defaults to main username if NULL)
  ftp_password TEXT,                   -- FTP password (defaults to main password if NULL)
  ssh_private_key TEXT,                -- Encrypted SSH private key for key-based auth
  ssh_public_key TEXT,                 -- SSH public key stored on device
  status TEXT DEFAULT 'disconnected',  -- 'connected', 'disconnected', 'error'
  last_seen DATETIME,                  -- Last successful connection
  last_error TEXT,                     -- Last error message
  connection_attempts INTEGER DEFAULT 0, -- Failed connection attempts
  device_type TEXT,                    -- Router model/type
  routeros_version TEXT,               -- RouterOS version
  architecture TEXT,                   -- CPU architecture
  board_name TEXT,                     -- Board model
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(ip_address, port)
);

-- System resource monitoring
CREATE TABLE IF NOT EXISTS system_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL,
  cpu_load REAL,                       -- CPU usage percentage
  free_memory INTEGER,                 -- Free memory in bytes
  total_memory INTEGER,                -- Total memory in bytes
  free_hdd_space INTEGER,              -- Free storage in bytes
  total_hdd_space INTEGER,             -- Total storage in bytes
  uptime TEXT,                         -- System uptime
  temperature REAL,                    -- System temperature (if available)
  voltage REAL,                        -- System voltage (if available)
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);

-- Interface monitoring
CREATE TABLE IF NOT EXISTS interface_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL,
  interface_name TEXT NOT NULL,        -- Interface name (ether1, wlan1, etc.)
  interface_type TEXT,                 -- Interface type (ether, wlan, bridge, etc.)
  status TEXT,                         -- running, disabled, etc.
  rx_bytes INTEGER DEFAULT 0,          -- Received bytes
  tx_bytes INTEGER DEFAULT 0,          -- Transmitted bytes
  rx_packets INTEGER DEFAULT 0,        -- Received packets
  tx_packets INTEGER DEFAULT 0,        -- Transmitted packets
  rx_errors INTEGER DEFAULT 0,         -- Receive errors
  tx_errors INTEGER DEFAULT 0,         -- Transmit errors
  rx_drops INTEGER DEFAULT 0,          -- Receive drops
  tx_drops INTEGER DEFAULT 0,          -- Transmit drops
  link_speed TEXT,                     -- Link speed (1Gbps, 100Mbps, etc.)
  mac_address TEXT,                    -- Interface MAC address
  mtu INTEGER,                         -- Maximum transmission unit
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);

-- Network configuration
CREATE TABLE IF NOT EXISTS ip_addresses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL,
  interface_name TEXT NOT NULL,
  address TEXT NOT NULL,               -- IP address with CIDR (192.168.1.1/24)
  network TEXT,                        -- Network address
  is_dynamic BOOLEAN DEFAULT false,    -- Dynamic or static
  is_disabled BOOLEAN DEFAULT false,   -- Disabled status
  comment TEXT,                        -- Configuration comment
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);

-- Routing table
CREATE TABLE IF NOT EXISTS routes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL,
  dst_address TEXT NOT NULL,           -- Destination network
  gateway TEXT,                        -- Gateway IP
  distance INTEGER,                    -- Administrative distance
  interface_name TEXT,                 -- Outgoing interface
  is_active BOOLEAN DEFAULT false,     -- Active route
  is_dynamic BOOLEAN DEFAULT false,    -- Dynamic route
  is_connected BOOLEAN DEFAULT false,  -- Connected route
  route_type TEXT,                     -- static, ospf, bgp, rip, etc.
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);

-- DHCP leases
CREATE TABLE IF NOT EXISTS dhcp_leases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL,
  server_name TEXT,                    -- DHCP server name
  address TEXT NOT NULL,               -- Assigned IP address
  mac_address TEXT NOT NULL,           -- Client MAC address
  client_id TEXT,                      -- DHCP client ID
  hostname TEXT,                       -- Client hostname
  expires_after TEXT,                  -- Lease expiration
  is_dynamic BOOLEAN DEFAULT true,     -- Dynamic or static lease
  is_active BOOLEAN DEFAULT true,      -- Active lease
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);

-- WiFi clients (for wireless routers)
CREATE TABLE IF NOT EXISTS wifi_clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL,
  interface_name TEXT NOT NULL,        -- WiFi interface
  mac_address TEXT NOT NULL,           -- Client MAC address
  ip_address TEXT,                     -- Client IP address
  signal_strength INTEGER,             -- Signal strength in dBm
  tx_rate TEXT,                        -- Transmission rate
  rx_rate TEXT,                        -- Reception rate
  uptime TEXT,                         -- Connection uptime
  bytes_sent INTEGER DEFAULT 0,       -- Bytes sent to client
  bytes_received INTEGER DEFAULT 0,   -- Bytes received from client
  ssid TEXT,                          -- Connected SSID
  is_authorized BOOLEAN DEFAULT false, -- Authentication status
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);

-- Alert rules configuration
CREATE TABLE IF NOT EXISTS alert_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT,                      -- Device ID (NULL for global rules)
  name TEXT NOT NULL,                  -- Rule name
  metric_type TEXT NOT NULL,           -- system, interface, custom
  metric_name TEXT NOT NULL,           -- cpu_load, rx_bytes, etc.
  condition TEXT NOT NULL,             -- 'greater_than', 'less_than', 'equals'
  threshold REAL NOT NULL,             -- Threshold value
  severity TEXT NOT NULL,              -- 'low', 'medium', 'high', 'critical'
  is_enabled BOOLEAN DEFAULT true,     -- Rule enabled status
  notification_channels TEXT,          -- JSON array of notification channels
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);

-- Alert instances
CREATE TABLE IF NOT EXISTS alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL,
  rule_id INTEGER,                     -- Associated rule ID
  alert_type TEXT NOT NULL,            -- system, interface, security, etc.
  severity TEXT NOT NULL,              -- low, medium, high, critical
  title TEXT NOT NULL,                 -- Alert title
  message TEXT NOT NULL,               -- Alert description
  metric_value REAL,                   -- Value that triggered alert
  is_acknowledged BOOLEAN DEFAULT false, -- Acknowledgment status
  acknowledged_by TEXT,                -- User who acknowledged
  acknowledged_at DATETIME,            -- Acknowledgment timestamp
  resolved_at DATETIME,                -- Resolution timestamp
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
  FOREIGN KEY (rule_id) REFERENCES alert_rules(id) ON DELETE SET NULL
);

-- Configuration backups
CREATE TABLE IF NOT EXISTS configuration_backups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL,
  backup_name TEXT NOT NULL,           -- Backup file name
  backup_data TEXT NOT NULL,           -- Backup content (base64 or text)
  backup_type TEXT DEFAULT 'manual',   -- manual, scheduled, auto
  file_size INTEGER,                   -- Backup file size
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);

-- Configuration change tracking
CREATE TABLE IF NOT EXISTS configuration_changes (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  section TEXT NOT NULL,              -- ip_address, route, firewall, interface, backup, nat, address_list
  action TEXT NOT NULL,               -- create, update, delete
  item_id TEXT,                       -- RouterOS object ID
  changes TEXT NOT NULL,              -- JSON data
  user_name TEXT,                     -- User who made the change
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  applied BOOLEAN DEFAULT false,      -- Whether change was applied
  rollback_data TEXT,                 -- JSON data for rollback
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);

-- Terminal session management
CREATE TABLE IF NOT EXISTS terminal_sessions (
  id TEXT PRIMARY KEY,                -- Session UUID
  device_id TEXT NOT NULL,            -- Associated device
  user_id TEXT,                       -- User who created the session (optional)
  session_name TEXT,                  -- User-defined session name
  status TEXT DEFAULT 'active',       -- active, disconnected, closed
  authentication_method TEXT,         -- password, ssh_key
  start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  end_time DATETIME,                  -- When session ended
  last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
  total_duration INTEGER DEFAULT 0,   -- Total session duration in seconds
  command_count INTEGER DEFAULT 0,    -- Number of commands executed
  bytes_transmitted INTEGER DEFAULT 0, -- Total bytes sent/received
  client_info TEXT,                   -- JSON with client details (IP, browser, etc.)
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Terminal session history and command logging
CREATE TABLE IF NOT EXISTS terminal_session_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  log_type TEXT NOT NULL,             -- command, output, system, error
  content TEXT NOT NULL,              -- Command or output content
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  sequence_number INTEGER NOT NULL,   -- Order within session
  is_input BOOLEAN DEFAULT false,     -- true for user input, false for output
  command_duration INTEGER,           -- Time taken for command (ms)
  FOREIGN KEY (session_id) REFERENCES terminal_sessions(id) ON DELETE CASCADE
);

-- Terminal session bookmarks (for important commands/outputs)
CREATE TABLE IF NOT EXISTS terminal_session_bookmarks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  log_id INTEGER NOT NULL,            -- Reference to specific log entry
  bookmark_name TEXT NOT NULL,        -- User-defined bookmark name
  description TEXT,                   -- Optional description
  tags TEXT,                          -- JSON array of tags
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES terminal_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (log_id) REFERENCES terminal_session_logs(id) ON DELETE CASCADE
);

-- Terminal session exports
CREATE TABLE IF NOT EXISTS terminal_session_exports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  export_name TEXT NOT NULL,
  export_format TEXT NOT NULL,        -- json, txt, html, csv
  export_data TEXT NOT NULL,          -- Exported content
  export_settings TEXT,               -- JSON export configuration
  file_size INTEGER,                  -- Export file size
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES terminal_sessions(id) ON DELETE CASCADE
);

-- NAT Rules Table
CREATE TABLE IF NOT EXISTS nat_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL,
  chain TEXT NOT NULL DEFAULT 'srcnat',
  action TEXT NOT NULL,
  src_address TEXT,
  dst_address TEXT,
  src_port TEXT,
  dst_port TEXT,
  protocol TEXT,
  out_interface TEXT,
  in_interface TEXT,
  to_addresses TEXT,
  to_ports TEXT,
  comment TEXT,
  disabled INTEGER DEFAULT 0,
  ros_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);

-- Address Lists Table
CREATE TABLE IF NOT EXISTS address_lists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL,
  list_name TEXT NOT NULL,
  address TEXT NOT NULL,
  comment TEXT,
  disabled INTEGER DEFAULT 0,
  ros_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);

-- Connection Tracking Table (for monitoring)
CREATE TABLE IF NOT EXISTS connection_tracking (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL,
  src_address TEXT,
  dst_address TEXT,
  src_port INTEGER,
  dst_port INTEGER,
  protocol TEXT,
  state TEXT,
  tcp_state TEXT,
  connection TEXT,                     -- Connection tracking state (SAC, SC, C, etc.)
  timeout INTEGER,
  orig_bytes INTEGER,
  repl_bytes INTEGER,
  orig_packets INTEGER,
  repl_packets INTEGER,
  orig_rate TEXT,
  repl_rate TEXT,
  assured INTEGER DEFAULT 0,           -- Boolean as integer
  seen_reply INTEGER DEFAULT 0,        -- Boolean as integer
  collected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);

-- IPsec Policies Table
CREATE TABLE IF NOT EXISTS ipsec_policies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL,
  src_address TEXT,
  dst_address TEXT,
  protocol TEXT DEFAULT 'all',
  action TEXT DEFAULT 'encrypt',
  tunnel INTEGER DEFAULT 1,
  peer_name TEXT,
  proposal_name TEXT,
  ph2_state TEXT,                      -- Phase 2 state (established, connecting, no-phase2, etc.)
  comment TEXT,
  disabled INTEGER DEFAULT 0,
  ros_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);

-- IPsec Peers Table
CREATE TABLE IF NOT EXISTS ipsec_peers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL,
  name TEXT NOT NULL,
  address TEXT,
  local_address TEXT,
  exchange_mode TEXT DEFAULT 'ike2',
  profile_name TEXT,
  passive INTEGER DEFAULT 0,
  comment TEXT,
  disabled INTEGER DEFAULT 0,
  ros_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);

-- IPsec Profiles Table
CREATE TABLE IF NOT EXISTS ipsec_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL,
  name TEXT NOT NULL,
  dh_group TEXT DEFAULT 'modp2048',
  enc_algorithm TEXT DEFAULT 'aes-256',
  hash_algorithm TEXT DEFAULT 'sha256',
  lifetime TEXT DEFAULT '1d',
  nat_traversal INTEGER DEFAULT 1,
  dpd_interval TEXT DEFAULT '8s',
  dpd_maximum_failures INTEGER DEFAULT 4,
  comment TEXT,
  disabled INTEGER DEFAULT 0,
  ros_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);

-- IPsec Active Peers Table (for monitoring)
CREATE TABLE IF NOT EXISTS ipsec_active_peers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL,
  remote_address TEXT,
  local_address TEXT,
  state TEXT,
  uptime TEXT,
  rx_bytes BIGINT,
  tx_bytes BIGINT,
  last_seen TEXT,
  responder INTEGER,
  collected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);

-- IPsec Identities Table
CREATE TABLE IF NOT EXISTS ipsec_identities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL,
  peer_name TEXT NOT NULL,
  auth_method TEXT DEFAULT 'pre-shared-key',
  secret TEXT,
  certificate TEXT,
  generate_policy TEXT DEFAULT 'port-strict',
  match_by TEXT DEFAULT 'remote-id',
  mode_config TEXT,
  policy_template_group TEXT,
  my_id TEXT,
  remote_id TEXT,
  comment TEXT,
  disabled INTEGER DEFAULT 0,
  ros_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);

-- IPsec Proposals Table
CREATE TABLE IF NOT EXISTS ipsec_proposals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL,
  name TEXT NOT NULL,
  auth_algorithms TEXT DEFAULT 'sha256',
  enc_algorithms TEXT DEFAULT 'aes-256-cbc',
  pfs_group TEXT DEFAULT 'modp2048',
  lifetime TEXT DEFAULT '30m',
  comment TEXT,
  disabled INTEGER DEFAULT 0,
  ros_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);

-- User settings and preferences
CREATE TABLE IF NOT EXISTS user_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  setting_key TEXT NOT NULL,           -- Setting name (e.g., 'traffic_monitoring_default')
  setting_value TEXT NOT NULL,         -- Setting value (JSON string)
  device_id TEXT,                      -- Device-specific setting (NULL for global)
  user_id TEXT DEFAULT 'default',      -- User identifier (for future multi-user support)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
  UNIQUE(setting_key, device_id, user_id)
);

-- Authentication tables
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,                 -- UUID
  username TEXT NOT NULL UNIQUE,       -- Login username
  email TEXT NOT NULL UNIQUE,          -- Email address
  password_hash TEXT NOT NULL,         -- Hashed password
  full_name TEXT,                      -- Full display name
  role TEXT NOT NULL DEFAULT 'user',   -- admin, operator, user, viewer
  is_active BOOLEAN DEFAULT true,      -- Account enabled
  failed_login_attempts INTEGER DEFAULT 0, -- Failed login counter
  locked_until DATETIME,               -- Account lock expiration
  last_login DATETIME,                 -- Last successful login
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  -- User management fields added by migrations
  first_name TEXT,                     -- First name
  last_name TEXT,                      -- Last name
  phone TEXT,                          -- Phone number
  department TEXT,                     -- Department/team
  notes TEXT,                          -- Admin notes about user
  account_status TEXT DEFAULT 'active', -- active, inactive, locked
  password_reset_required BOOLEAN DEFAULT false, -- Force password reset
  last_password_change DATETIME,       -- When password was last changed
  account_locked_until DATETIME,       -- Account lock expiration (different from locked_until)
  email_verified BOOLEAN DEFAULT false, -- Email verification status
  two_factor_enabled BOOLEAN DEFAULT false, -- 2FA enabled
  avatar_url TEXT,                     -- Profile picture URL
  preferences TEXT                     -- JSON user preferences
);

-- User sessions and authentication
CREATE TABLE IF NOT EXISTS user_sessions (
  id TEXT PRIMARY KEY,                 -- Session ID (JWT token ID)
  user_id TEXT NOT NULL,               -- User identifier
  ip_address TEXT,                     -- Client IP address
  user_agent TEXT,                     -- Client user agent
  expires_at DATETIME NOT NULL,        -- Session expiration
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  -- Enhanced session tracking fields added by migrations
  device_info TEXT,                    -- Device information
  location TEXT,                       -- Geographic location
  is_active BOOLEAN DEFAULT true,      -- Session active status
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- User management audit table
CREATE TABLE IF NOT EXISTS user_management_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_user_id TEXT NOT NULL,         -- Admin who performed the action
  target_user_id TEXT,                 -- User who was affected (NULL for bulk operations)
  action TEXT NOT NULL,                -- create, update, delete, reset_password, etc.
  details TEXT,                        -- JSON details of the action
  ip_address TEXT,                     -- Admin's IP address
  user_agent TEXT,                     -- Admin's user agent
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- API keys for programmatic access
CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,                 -- UUID
  user_id TEXT NOT NULL,               -- Owner user ID
  name TEXT NOT NULL,                  -- Key name/description
  key_hash TEXT NOT NULL,              -- Hashed API key
  permissions TEXT,                    -- JSON permissions array
  last_used DATETIME,                  -- Last usage timestamp
  expires_at DATETIME,                 -- Key expiration (NULL = never)
  is_active BOOLEAN DEFAULT true,      -- Key enabled status
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Login attempt tracking
CREATE TABLE IF NOT EXISTS login_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL,              -- Attempted username
  ip_address TEXT NOT NULL,            -- Client IP
  user_agent TEXT,                     -- Client user agent
  success BOOLEAN NOT NULL,            -- Login success/failure
  failure_reason TEXT,                 -- Reason for failure
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Device groups for organization
CREATE TABLE IF NOT EXISTS device_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,           -- Group name
  description TEXT,                    -- Group description
  color TEXT DEFAULT '#3b82f6',       -- Group color for UI
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Device group memberships
CREATE TABLE IF NOT EXISTS device_group_memberships (
  device_id TEXT NOT NULL,
  group_id INTEGER NOT NULL,
  PRIMARY KEY (device_id, group_id),
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
  FOREIGN KEY (group_id) REFERENCES device_groups(id) ON DELETE CASCADE
);

-- Historical data aggregation for performance
CREATE TABLE IF NOT EXISTS metric_aggregates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL,
  metric_type TEXT NOT NULL,           -- system, interface
  metric_name TEXT NOT NULL,           -- cpu_load, tx_bytes, etc.
  aggregation_period TEXT NOT NULL,    -- hourly, daily, weekly
  avg_value REAL,                      -- Average value
  min_value REAL,                      -- Minimum value
  max_value REAL,                      -- Maximum value
  sample_count INTEGER DEFAULT 0,      -- Number of samples
  period_start DATETIME NOT NULL,      -- Aggregation period start
  period_end DATETIME NOT NULL,        -- Aggregation period end
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);

-- Database indexes for performance
CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(status);
CREATE INDEX IF NOT EXISTS idx_devices_ip_address ON devices(ip_address);
CREATE INDEX IF NOT EXISTS idx_system_metrics_device_timestamp ON system_metrics(device_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_interface_metrics_device_timestamp ON interface_metrics(device_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_alerts_device_created ON alerts(device_id, created_at);
CREATE INDEX IF NOT EXISTS idx_alerts_severity_acknowledged ON alerts(severity, is_acknowledged);
CREATE INDEX IF NOT EXISTS idx_metric_aggregates_device_period ON metric_aggregates(device_id, aggregation_period, period_start);
CREATE INDEX IF NOT EXISTS idx_config_changes_device_timestamp ON configuration_changes(device_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_config_changes_section ON configuration_changes(section);
CREATE INDEX IF NOT EXISTS idx_user_settings_key_device ON user_settings(setting_key, device_id, user_id);

-- Authentication indexes
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_login_attempts_username ON login_attempts(username);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts(ip_address);
CREATE INDEX IF NOT EXISTS idx_login_attempts_created ON login_attempts(created_at);

-- User management indexes
CREATE INDEX IF NOT EXISTS idx_users_account_status ON users(account_status);
CREATE INDEX IF NOT EXISTS idx_users_department ON users(department);
CREATE INDEX IF NOT EXISTS idx_users_first_name ON users(first_name);
CREATE INDEX IF NOT EXISTS idx_users_last_name ON users(last_name);
CREATE INDEX IF NOT EXISTS idx_sessions_is_active ON user_sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_sessions_device_info ON user_sessions(device_info);

-- Indexes for NAT rules, address lists, and connection tracking
CREATE INDEX IF NOT EXISTS idx_nat_rules_device_id ON nat_rules(device_id);
CREATE INDEX IF NOT EXISTS idx_nat_rules_chain ON nat_rules(chain);
CREATE INDEX IF NOT EXISTS idx_nat_rules_ros_id ON nat_rules(ros_id);
CREATE INDEX IF NOT EXISTS idx_address_lists_device_id ON address_lists(device_id);
CREATE INDEX IF NOT EXISTS idx_address_lists_list_name ON address_lists(list_name);
CREATE INDEX IF NOT EXISTS idx_connection_tracking_device_id ON connection_tracking(device_id);
CREATE INDEX IF NOT EXISTS idx_connection_tracking_collected_at ON connection_tracking(collected_at);

-- Indexes for IPsec tables
CREATE INDEX IF NOT EXISTS idx_ipsec_policies_device_id ON ipsec_policies(device_id);
CREATE INDEX IF NOT EXISTS idx_ipsec_policies_ros_id ON ipsec_policies(ros_id);
CREATE INDEX IF NOT EXISTS idx_ipsec_peers_device_id ON ipsec_peers(device_id);
CREATE INDEX IF NOT EXISTS idx_ipsec_peers_name ON ipsec_peers(name);
CREATE INDEX IF NOT EXISTS idx_ipsec_peers_ros_id ON ipsec_peers(ros_id);
CREATE INDEX IF NOT EXISTS idx_ipsec_profiles_device_id ON ipsec_profiles(device_id);
CREATE INDEX IF NOT EXISTS idx_ipsec_profiles_name ON ipsec_profiles(name);
CREATE INDEX IF NOT EXISTS idx_ipsec_profiles_ros_id ON ipsec_profiles(ros_id);
CREATE INDEX IF NOT EXISTS idx_ipsec_active_peers_device_id ON ipsec_active_peers(device_id);
CREATE INDEX IF NOT EXISTS idx_ipsec_active_peers_collected_at ON ipsec_active_peers(collected_at);
CREATE INDEX IF NOT EXISTS idx_ipsec_identities_device_id ON ipsec_identities(device_id);
CREATE INDEX IF NOT EXISTS idx_ipsec_identities_peer_name ON ipsec_identities(peer_name);
CREATE INDEX IF NOT EXISTS idx_ipsec_identities_ros_id ON ipsec_identities(ros_id);
CREATE INDEX IF NOT EXISTS idx_ipsec_proposals_device_id ON ipsec_proposals(device_id);
CREATE INDEX IF NOT EXISTS idx_ipsec_proposals_name ON ipsec_proposals(name);
CREATE INDEX IF NOT EXISTS idx_ipsec_proposals_ros_id ON ipsec_proposals(ros_id);

-- Terminal session indexes
CREATE INDEX IF NOT EXISTS idx_terminal_sessions_device_id ON terminal_sessions(device_id);
CREATE INDEX IF NOT EXISTS idx_terminal_sessions_user_id ON terminal_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_terminal_sessions_status ON terminal_sessions(status);
CREATE INDEX IF NOT EXISTS idx_terminal_sessions_start_time ON terminal_sessions(start_time);
CREATE INDEX IF NOT EXISTS idx_terminal_sessions_last_activity ON terminal_sessions(last_activity);

CREATE INDEX IF NOT EXISTS idx_terminal_session_logs_session_id ON terminal_session_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_terminal_session_logs_timestamp ON terminal_session_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_terminal_session_logs_sequence ON terminal_session_logs(session_id, sequence_number);
CREATE INDEX IF NOT EXISTS idx_terminal_session_logs_type ON terminal_session_logs(log_type);

CREATE INDEX IF NOT EXISTS idx_terminal_session_bookmarks_session_id ON terminal_session_bookmarks(session_id);
CREATE INDEX IF NOT EXISTS idx_terminal_session_bookmarks_created ON terminal_session_bookmarks(created_at);

CREATE INDEX IF NOT EXISTS idx_terminal_session_exports_session_id ON terminal_session_exports(session_id);
CREATE INDEX IF NOT EXISTS idx_terminal_session_exports_created ON terminal_session_exports(created_at);

-- User management audit indexes (must be after table creation)
CREATE INDEX IF NOT EXISTS idx_user_audit_admin_user ON user_management_audit(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_user_audit_target_user ON user_management_audit(target_user_id);
CREATE INDEX IF NOT EXISTS idx_user_audit_action ON user_management_audit(action);
CREATE INDEX IF NOT EXISTS idx_user_audit_created ON user_management_audit(created_at);

-- Disk management configuration
CREATE TABLE IF NOT EXISTS disk_management_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  setting_key TEXT NOT NULL UNIQUE,
  setting_value TEXT NOT NULL,
  data_type TEXT DEFAULT 'string',
  description TEXT,
  category TEXT DEFAULT 'general',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Data retention policies
CREATE TABLE IF NOT EXISTS data_retention_policies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  data_type TEXT NOT NULL UNIQUE,
  max_age_days INTEGER NOT NULL,
  max_records INTEGER,
  compression_enabled BOOLEAN DEFAULT false,
  archival_enabled BOOLEAN DEFAULT false,
  cleanup_frequency TEXT DEFAULT 'daily',
  is_enabled BOOLEAN DEFAULT true,
  description TEXT,
  category TEXT DEFAULT 'general',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Disk usage history
CREATE TABLE IF NOT EXISTS disk_usage_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  total_size INTEGER NOT NULL,
  wal_size INTEGER DEFAULT 0,
  shm_size INTEGER DEFAULT 0,
  table_count INTEGER NOT NULL,
  index_count INTEGER DEFAULT 0,
  cleanup_operations INTEGER DEFAULT 0,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Data cleanup logs
CREATE TABLE IF NOT EXISTS data_cleanup_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  operation_type TEXT NOT NULL,
  data_type TEXT NOT NULL,
  records_affected INTEGER DEFAULT 0,
  bytes_freed INTEGER DEFAULT 0,
  duration_ms INTEGER DEFAULT 0,
  status TEXT DEFAULT 'success',
  error_message TEXT,
  started_at DATETIME NOT NULL,
  completed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create triggers for updated_at timestamps
CREATE TRIGGER IF NOT EXISTS update_devices_updated_at 
    AFTER UPDATE ON devices 
    BEGIN 
        UPDATE devices SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_alert_rules_updated_at 
    AFTER UPDATE ON alert_rules 
    BEGIN 
        UPDATE alert_rules SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_users_updated_at 
    AFTER UPDATE ON users 
    BEGIN 
        UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END; 