#!/bin/bash

# =============================================
# CI/CD Setup Script for Zotrust P2P Platform
# =============================================

set -e

echo "🚀 Setting up CI/CD Pipeline for Zotrust..."
echo "=============================================="

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Step 1: Check if GitHub Actions workflows exist
if [ -f ".github/workflows/deploy.yml" ] && [ -f ".github/workflows/test.yml" ]; then
    print_success "GitHub Actions workflows found"
else
    print_error "GitHub Actions workflows not found"
    exit 1
fi

# Step 2: Generate SSH key for CI/CD
print_info "Step 1: Generate SSH Key for CI/CD"
echo ""

SSH_KEY_PATH="$HOME/.ssh/github_actions_zotrust"

if [ -f "$SSH_KEY_PATH" ]; then
    print_info "SSH key already exists at $SSH_KEY_PATH"
    read -p "Do you want to generate a new key? (y/N): " generate_new
    if [[ $generate_new =~ ^[Yy]$ ]]; then
        rm -f "$SSH_KEY_PATH" "$SSH_KEY_PATH.pub"
        ssh-keygen -t rsa -b 4096 -C "github-actions-zotrust" -f "$SSH_KEY_PATH" -N ""
        print_success "New SSH key generated"
    fi
else
    ssh-keygen -t rsa -b 4096 -C "github-actions-zotrust" -f "$SSH_KEY_PATH" -N ""
    print_success "SSH key generated at $SSH_KEY_PATH"
fi

# Step 3: Display keys
echo ""
print_info "Step 2: Configure GitHub Secrets"
echo ""
echo "Go to: GitHub Repository → Settings → Secrets and variables → Actions"
echo ""
echo "Add these 3 secrets:"
echo ""

echo "════════════════════════════════════════════"
echo "1. VPS_HOST"
echo "════════════════════════════════════════════"
read -p "Enter your VPS IP address (e.g., 185.112.144.66): " vps_host
echo "Value to add: $vps_host"
echo ""

echo "════════════════════════════════════════════"
echo "2. VPS_USER"
echo "════════════════════════════════════════════"
read -p "Enter your VPS username (e.g., root, ubuntu): " vps_user
echo "Value to add: $vps_user"
echo ""

echo "════════════════════════════════════════════"
echo "3. VPS_SSH_KEY"
echo "════════════════════════════════════════════"
echo "Copy the PRIVATE key below and add it to GitHub Secrets:"
echo ""
echo "--- BEGIN PRIVATE KEY ---"
cat "$SSH_KEY_PATH"
echo "--- END PRIVATE KEY ---"
echo ""

# Step 4: Display public key for VPS
echo "════════════════════════════════════════════"
print_info "Step 3: Add Public Key to VPS"
echo "════════════════════════════════════════════"
echo ""
echo "SSH into your VPS and run:"
echo ""
echo "  ssh $vps_user@$vps_host"
echo ""
echo "Then add this PUBLIC key to ~/.ssh/authorized_keys:"
echo ""
echo "--- BEGIN PUBLIC KEY ---"
cat "$SSH_KEY_PATH.pub"
echo "--- END PUBLIC KEY ---"
echo ""
echo "Commands to run on VPS:"
echo ""
echo "  mkdir -p ~/.ssh"
echo "  echo '$(cat "$SSH_KEY_PATH.pub")' >> ~/.ssh/authorized_keys"
echo "  chmod 700 ~/.ssh"
echo "  chmod 600 ~/.ssh/authorized_keys"
echo ""

# Step 5: Test SSH connection
echo "════════════════════════════════════════════"
print_info "Step 4: Test SSH Connection"
echo "════════════════════════════════════════════"
echo ""
read -p "Have you added the public key to VPS? (y/N): " key_added

if [[ $key_added =~ ^[Yy]$ ]]; then
    print_info "Testing SSH connection..."
    if ssh -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no "$vps_user@$vps_host" "echo 'Connection successful!'" 2>/dev/null; then
        print_success "SSH connection successful!"
    else
        print_error "SSH connection failed. Please check:"
        echo "  1. Public key is added to VPS ~/.ssh/authorized_keys"
        echo "  2. VPS SSH service is running"
        echo "  3. Firewall allows SSH (port 22)"
    fi
else
    print_info "Skipping SSH test. Please test manually later."
fi

# Step 6: Summary
echo ""
echo "════════════════════════════════════════════"
print_success "CI/CD Setup Instructions"
echo "════════════════════════════════════════════"
echo ""
echo "📋 Next Steps:"
echo ""
echo "1. ✅ Add GitHub Secrets:"
echo "   - VPS_HOST: $vps_host"
echo "   - VPS_USER: $vps_user"
echo "   - VPS_SSH_KEY: (private key shown above)"
echo ""
echo "2. ✅ Verify VPS Setup:"
echo "   ssh $vps_user@$vps_host"
echo "   # Check Node.js: node --version"
echo "   # Check PM2: pm2 --version"
echo "   # Check Nginx: nginx -v"
echo ""
echo "3. ✅ Create App Directory:"
echo "   sudo mkdir -p /var/www/Zotrustdeapp"
echo "   sudo chown -R \$USER:\$USER /var/www/Zotrustdeapp"
echo "   mkdir -p /var/www/backups"
echo ""
echo "4. ✅ Push to GitHub:"
echo "   git add ."
echo "   git commit -m 'Setup CI/CD pipeline'"
echo "   git push origin main"
echo ""
echo "5. ✅ Monitor Deployment:"
echo "   Go to GitHub → Actions tab"
echo "   Watch the deployment progress"
echo ""
echo "════════════════════════════════════════════"
echo "📚 Documentation: CICD_SETUP_GUIDE.md"
echo "════════════════════════════════════════════"
echo ""
print_success "Setup script completed!"
echo ""

