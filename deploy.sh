#!/bin/bash

# Deployment script for Debian server
# Usage: ./deploy.sh

set -e

echo "🚀 Starting deployment of Innopolis Waste Map..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    print_error "Please run as root (use sudo)"
    exit 1
fi

print_status "Updating system packages..."
apt update && apt upgrade -y

print_status "Installing required packages..."
apt install -y \
    curl \
    wget \
    git \
    docker.io \
    docker-compose \
    nginx \
    certbot \
    python3-certbot-nginx \
    htop \
    ufw

print_status "Starting and enabling Docker..."
systemctl start docker
systemctl enable docker

print_status "Adding user to docker group..."
usermod -aG docker $USER
usermod -aG docker root

print_status "Configuring firewall..."
ufw allow ssh
ufw allow 80
ufw allow 443
ufw --force enable

print_status "Creating application directory..."
mkdir -p /opt/waste_map
cd /opt/waste_map

print_status "Cloning repository..."
git clone https://github.com/ANKomyagin/innopolise_waste_map.git .

print_status "Setting up environment variables..."
cat > .env << EOF
# Database configuration
DATABASE_URL=postgresql://waste_user:waste_password@postgres:5432/waste_db

# Telegram Bot Token (replace with your actual token)
BOT_TOKEN=your_telegram_bot_token_here

# VK Token (optional)
VK_TOKEN=your_vk_token_here

# Other environment variables
ENVIRONMENT=production
DEBUG=false
EOF

print_warning "Please edit .env file and set your actual BOT_TOKEN and VK_TOKEN"
print_warning "Press Enter to continue or Ctrl+C to exit..."
read

print_status "Building and starting containers..."
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d

print_status "Waiting for services to start..."
sleep 30

print_status "Checking service status..."
docker-compose -f docker-compose.prod.yml ps

print_status "Setting up SSL certificate with Let's Encrypt..."
# Uncomment and modify the next line when you have a domain name
# certbot --nginx -d your-domain.com

print_status "Setting up automatic renewal..."
echo "0 12 * * * /usr/bin/certbot renew --quiet" | crontab -

print_status "Setting up log rotation..."
cat > /etc/logrotate.d/waste_map << EOF
/opt/waste_map/logs/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 root root
}
EOF

print_status "Creating monitoring script..."
cat > /opt/waste_map/monitor.sh << 'EOF'
#!/bin/bash
# Simple monitoring script
cd /opt/waste_map

# Check if containers are running
if ! docker-compose -f docker-compose.prod.yml ps | grep -q "Up"; then
    echo "$(date): Some containers are down, restarting..." >> /var/log/waste_map.log
    docker-compose -f docker-compose.prod.yml restart
fi

# Check disk space
DISK_USAGE=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 80 ]; then
    echo "$(date): Disk usage is ${DISK_USAGE}%" >> /var/log/waste_map.log
fi

# Check memory usage
MEM_USAGE=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
if [ $MEM_USAGE -gt 80 ]; then
    echo "$(date): Memory usage is ${MEM_USAGE}%" >> /var/log/waste_map.log
fi
EOF

chmod +x /opt/waste_map/monitor.sh

print_status "Setting up cron job for monitoring..."
echo "*/5 * * * * /opt/waste_map/monitor.sh" | crontab -

print_status "Creating backup script..."
cat > /opt/waste_map/backup.sh << 'EOF'
#!/bin/bash
# Backup script
cd /opt/waste_map
DATE=$(date +%Y%m%d_%H%M%S)

# Backup database
docker-compose -f docker-compose.prod.yml exec -T postgres pg_dump -U waste_user waste_db > /opt/waste_map/backups/db_backup_$DATE.sql

# Backup application files
tar -czf /opt/waste_map/backups/app_backup_$DATE.tar.gz .

# Remove old backups (keep last 7 days)
find /opt/waste_map/backups -name "*.sql" -mtime +7 -delete
find /opt/waste_map/backups -name "*.tar.gz" -mtime +7 -delete
EOF

mkdir -p /opt/waste_map/backups
chmod +x /opt/waste_map/backup.sh

print_status "Setting up daily backup..."
echo "0 2 * * * /opt/waste_map/backup.sh" | crontab -

print_status "Deployment completed successfully!"
echo ""
echo "🌐 Your application should be available at: http://194.67.122.226"
echo "📚 API documentation: http://194.67.122.226/docs"
echo ""
echo "🔧 Useful commands:"
echo "  - Check logs: docker-compose -f docker-compose.prod.yml logs -f"
echo "  - Restart app: docker-compose -f docker-compose.prod.yml restart app"
echo "  - Check status: docker-compose -f docker-compose.prod.yml ps"
echo "  - View backups: ls -la /opt/waste_map/backups/"
echo ""
print_warning "Don't forget to:"
echo "  1. Edit .env file with your actual tokens"
echo "  2. Set up domain name and SSL certificate"
echo "  3. Configure firewall rules as needed"
echo "  4. Monitor logs regularly"
