# WireGuard Migration Troubleshooting Guide - Step 5.1 Ping Issues

## Problem Description
Pings from Sub903 to PP1 Backend (192.168.102.x) are failing during Step 5.1 connectivity testing.

## Systematic Troubleshooting Steps

### Step 1: Verify WireGuard Interface Status

**On Sub903 Router:**
```bash
# Check if WireGuard interface is up and running
/interface wireguard print detail
/interface wireguard peers print detail

# Check interface status
/interface print where name~"Sub903WireGuardInt"

# Look for any error messages
/log print where topics~"wireguard"
```

**Expected Output:**
- Interface should show `R` (running) status
- Peer should show recent handshake time
- No error messages in logs

### Step 2: Verify WireGuard Peer Configuration

**On Main Router (NCU_ROUTER):**
```bash
# Check Sub903 peer configuration
/interface wireguard peers print detail where name="Sub903_EscadaPeer1"

# Verify allowed addresses include both networks
# Should include: 10.144.144.3/32,192.168.120.0/24,192.168.101.0/24,192.168.102.0/24
```

**On Sub903 Router:**
```bash
# Check main router peer configuration  
/interface wireguard peers print detail where interface="Sub903WireGuardInt"

# Verify allowed addresses include target network
# Should include: 0.0.0.0/0 or at minimum 192.168.102.0/24
```

### Step 3: Test Basic WireGuard Connectivity

**On Sub903 Router:**
```bash
# First, test connectivity to main router hub
/ping 10.144.144.1 interface=Sub903WireGuardInt count=5

# If that works, test PP1 router
/ping 10.144.144.2 interface=Sub903WireGuardInt count=5

# Check if we can reach PP1's local interface
/ping 10.144.144.2 src-address=10.144.144.3 count=5
```

### Step 4: Verify Routing Configuration

**On Sub903 Router:**
```bash
# Check if routes to 192.168.102.0/24 exist
/ip route print where dst-address="192.168.102.0/24"

# Check default route via WireGuard
/ip route print where gateway~"Sub903WireGuardInt"

# Look for any conflicting routes
/ip route print where dst-address~"192.168.102"
```

**On Main Router (NCU_ROUTER):**
```bash
# Verify inter-VPN routing rules exist
/ip route print where comment~"Sub903 SCADA to PP1"
/ip route print where comment~"PP1 Backend to Sub903"

# Check if routes are active (not just installed)
/ip route print active where dst-address="192.168.102.0/24"
/ip route print active where dst-address="192.168.101.0/24"
```

### Step 5: Check Firewall Rules

**On Sub903 Router:**
```bash
# Check if firewall is blocking outbound WireGuard traffic
/ip firewall filter print where chain=forward and (src-address~"192.168.101" or dst-address~"192.168.102")

# Check NAT rules aren't interfering
/ip firewall nat print where dst-address~"192.168.102"

# Look for any recent dropped packets
/ip firewall filter print stats where action=drop
```

**On Main Router (NCU_ROUTER):**
```bash
# Check forwarding rules between networks
/ip firewall filter print where chain=forward and (src-address~"192.168.101" or dst-address~"192.168.102")

# Look for dropped packets
/ip firewall filter print stats where action=drop and (src-address~"192.168.101" or dst-address~"192.168.102")
```

**On PP1 Router:**
```bash
# Check if inbound traffic from Sub903 is allowed
/ip firewall filter print where chain=input and src-address~"192.168.101"
/ip firewall filter print where chain=forward and src-address~"192.168.101"
```

## Common Issues and Solutions

### Issue 1: WireGuard Peer Allowed-Addresses Mismatch

**Symptoms:** Pings fail, no handshake activity

**Solution:**
```bash
# On Main Router - Update Sub903 peer
/interface wireguard peers set [find name="Sub903_EscadaPeer1"] \
    allowed-address=10.144.144.3/32,192.168.120.0/24,192.168.101.0/24,192.168.102.0/24

# On PP1 Router - Update main router peer  
/interface wireguard peers set [find name="NCU_Router"] \
    allowed-address=10.144.144.1/32,192.168.120.0/24,192.168.101.0/24,192.168.102.0/24

# On Sub903 Router - Verify peer allows all traffic
/interface wireguard peers set [find interface="Sub903WireGuardInt"] \
    allowed-address=0.0.0.0/0
```

### Issue 2: Missing Routes

**Symptoms:** WireGuard ping works, but specific network pings fail

**Solution:**
```bash
# On Sub903 - Add specific route to PP1 backend
/ip route add \
    dst-address=192.168.102.0/24 \
    gateway=Sub903WireGuardInt \
    scope=30 \
    comment="WireGuard: Route to PP1 Backend"

# On PP1 - Add return route to Sub903 networks
/ip route add \
    dst-address=192.168.101.0/24 \
    gateway=PP1WireGuardInt \
    scope=30 \
    comment="WireGuard: Route to Sub903 SCADA"
```

### Issue 3: Firewall Blocking Traffic

**Symptoms:** Inconsistent connectivity, some pings work

**Solution:**
```bash
# On Sub903 - Allow WireGuard forwarding
/ip firewall filter add \
    chain=forward \
    action=accept \
    out-interface=Sub903WireGuardInt \
    src-address=192.168.101.0/24 \
    comment="Allow Sub903 SCADA via WireGuard" \
    place-before=[find action=drop]

# On PP1 - Allow inbound from Sub903
/ip firewall filter add \
    chain=input \
    action=accept \
    in-interface=PP1WireGuardInt \
    src-address=192.168.101.0/24 \
    comment="Allow Sub903 SCADA access" \
    place-before=[find action=drop]
```

### Issue 4: NAT Interference

**Symptoms:** Outbound works, return traffic fails

**Solution:**
```bash
# On Sub903 - Ensure NAT doesn't touch WireGuard traffic
/ip firewall nat add \
    chain=srcnat \
    action=accept \
    out-interface=Sub903WireGuardInt \
    comment="NAT Bypass: WireGuard traffic" \
    place-before=[find action=masquerade]
```

## Diagnostic Commands for Current Status

Run these commands to gather diagnostic information:

**On Sub903 Router:**
```bash
# Complete WireGuard status
/interface wireguard monitor Sub903WireGuardInt once

# Routing table for target network
/ip route print detail where dst-address="192.168.102.0/24"

# Check for any active IPSec conflicts
/ip ipsec active-peers print
/ip ipsec policy print where !disabled

# Interface traffic counters
/interface monitor-traffic interface=Sub903WireGuardInt once
```

**On Main Router:**
```bash
# Check both peers status
/interface wireguard peers monitor [find name="Sub903_EscadaPeer1"] once
/interface wireguard peers monitor [find name="PP1_EscadaPeer"] once

# Verify routing between networks
/tool traceroute 192.168.102.1 src-address=192.168.101.82
```

## Step-by-Step Ping Test Protocol

1. **Test WireGuard Hub Connectivity:**
   ```bash
   /ping 10.144.144.1 interface=Sub903WireGuardInt count=3
   ```

2. **Test PP1 WireGuard IP:**
   ```bash
   /ping 10.144.144.2 interface=Sub903WireGuardInt count=3
   ```

3. **Test PP1 Backend Network:**
   ```bash
   /ping 192.168.102.1 interface=Sub903WireGuardInt count=3
   ```

4. **Test with Source Address:**
   ```bash
   /ping 192.168.102.1 src-address=192.168.101.82 count=3
   ```

5. **Monitor Traffic During Test:**
   ```bash
   # In another terminal session
   /interface monitor-traffic interface=Sub903WireGuardInt
   ```

## Next Steps

Once you run these diagnostics, share the output and I'll help you identify the specific issue. The most common problems are:

1. **Allowed-addresses mismatch** (80% of cases)
2. **Missing or incorrect routes** (15% of cases)  
3. **Firewall rules blocking traffic** (5% of cases)

Would you like me to walk through these diagnostics step by step with you? 