# TURN Server Setup with Coturn

## Installation on Ubuntu 20.04

### 1. Install Coturn
```bash
# Update package list
sudo apt update

# Install coturn
sudo apt install coturn

# Enable coturn service
sudo systemctl enable coturn
```

### 2. Configure Coturn

Create the main configuration file:
```bash
sudo nano /etc/turnserver.conf
```

Add the following configuration:
```conf
# TURN server configuration
# Listening ports
listening-port=3478
tls-listening-port=5349

# External IP address (replace with your server's public IP)
external-ip=YOUR_SERVER_PUBLIC_IP

# Realm for authentication
realm=yourdomain.com

# User database (we'll use static users for simplicity)
user=webrtc:password123
user=user:password

# Enable long-term credentials mechanism
use-auth-secret
static-auth-secret=your-secret-key-here

# Enable REST API for dynamic user management
rest-api-secret=your-rest-secret

# Logging
log-file=/var/log/turnserver.log
verbose

# Security settings
no-multicast-peers
no-cli
no-tlsv1
no-tlsv1_1
no-sslv2
no-sslv3

# Network settings
no-tcp-relay
no-udp-relay
no-tls-relay

# Allow all IPs (for development - restrict in production)
allowed-peer-ip=0.0.0.0-255.255.255.255
denied-peer-ip=0.0.0.0-0.255.255.255
denied-peer-ip=10.0.0.0-10.255.255.255
denied-peer-ip=172.16.0.0-172.31.255.255
denied-peer-ip=192.168.0.0-192.168.255.255

# Performance settings
total-quota=100
bps-capacity=0
stale-nonce=600

# Database (optional - for user management)
# userdb=/etc/turnuserdb.conf
```

### 3. Create User Database (Optional)
```bash
sudo nano /etc/turnuserdb.conf
```

Add users in the format:
```
username:password
webrtc:password123
user:password
```

### 4. Configure Firewall
```bash
# Allow TURN server ports
sudo ufw allow 3478
sudo ufw allow 5349
sudo ufw allow 49152:65535/udp
```

### 5. Start and Enable Service
```bash
# Start coturn service
sudo systemctl start coturn

# Check status
sudo systemctl status coturn

# Enable auto-start on boot
sudo systemctl enable coturn
```

### 6. Test TURN Server
```bash
# Test with turnutils_stunclient
turnutils_stunclient YOUR_SERVER_IP

# Test with turnutils_uclient
turnutils_uclient -u webrtc -w password123 YOUR_SERVER_IP
```

## Alternative: Docker Setup

If you prefer Docker:

```bash
# Create docker-compose.yml
cat > docker-compose.yml << EOF
version: '3.8'
services:
  coturn:
    image: coturn/coturn:latest
    container_name: coturn
    ports:
      - "3478:3478"
      - "3478:3478/udp"
      - "5349:5349"
      - "49152-65535:49152-65535/udp"
    environment:
      - TURN_USERNAME=webrtc
      - TURN_PASSWORD=password123
      - TURN_REALM=yourdomain.com
      - TURN_EXTERNAL_IP=YOUR_SERVER_PUBLIC_IP
    command: >
      -n
      --log-file=stdout
      --external-ip=YOUR_SERVER_PUBLIC_IP
      --listening-port=3478
      --tls-listening-port=5349
      --realm=yourdomain.com
      --user=webrtc:password123
      --user=user:password
      --no-tlsv1
      --no-tlsv1_1
      --no-sslv2
      --no-sslv3
      --no-multicast-peers
      --no-cli
      --no-tcp-relay
      --no-udp-relay
      --no-tls-relay
      --allowed-peer-ip=0.0.0.0-255.255.255.255
      --denied-peer-ip=0.0.0.0-0.255.255.255
      --denied-peer-ip=10.0.0.0-10.255.255.255
      --denied-peer-ip=172.16.0.0-172.31.255.255
      --denied-peer-ip=192.168.0.0-192.168.255.255
      --total-quota=100
      --bps-capacity=0
      --stale-nonce=600
    restart: unless-stopped
EOF

# Run with Docker Compose
docker-compose up -d
```

## Production Considerations

### 1. Security Hardening
```conf
# Restrict access to specific IPs
allowed-peer-ip=192.168.1.0/24
allowed-peer-ip=10.0.0.0/8

# Use strong authentication
use-auth-secret
static-auth-secret=your-very-strong-secret-key

# Enable TLS
cert=/path/to/cert.pem
pkey=/path/to/private.key
```

### 2. Monitoring
```bash
# Check logs
sudo tail -f /var/log/turnserver.log

# Monitor connections
sudo netstat -tulpn | grep 3478
```

### 3. Load Balancing
For high-traffic applications, consider:
- Multiple TURN servers behind a load balancer
- Redis for session management
- Database for user authentication

## Troubleshooting

### Common Issues:
1. **Port not accessible**: Check firewall rules
2. **Authentication failed**: Verify username/password
3. **No relay candidates**: Check external-ip configuration
4. **High CPU usage**: Adjust bps-capacity and total-quota

### Debug Commands:
```bash
# Check if service is running
sudo systemctl status coturn

# Check listening ports
sudo netstat -tulpn | grep turn

# Test connectivity
telnet YOUR_SERVER_IP 3478

# Check logs
sudo journalctl -u coturn -f
```
