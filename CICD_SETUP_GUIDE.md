# 🚀 CI/CD Pipeline Setup Guide

## 📋 Overview

Automated CI/CD pipeline using GitHub Actions for:
- ✅ Automatic testing on pull requests
- ✅ Automatic deployment to VPS on push to main/master
- ✅ Build verification
- ✅ Security scanning
- ✅ Health checks

---

## 🔧 Setup Instructions

### Step 1: Configure GitHub Secrets

Go to your GitHub repository → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

Add these 3 secrets:

#### 1. **VPS_HOST**
```
Value: 185.112.144.66
```
Your VPS IP address.

#### 2. **VPS_USER**
```
Value: root
```
(Or your VPS username, e.g., `ubuntu`, `admin`, etc.)

#### 3. **VPS_SSH_KEY**
```
Value: <Your Private SSH Key>
```

**How to get SSH key:**

```bash
# On your local machine, generate SSH key pair (if not exists)
ssh-keygen -t rsa -b 4096 -C "github-actions" -f ~/.ssh/github_actions_key

# Display the PRIVATE key (copy this to GitHub Secret)
cat ~/.ssh/github_actions_key

# Display the PUBLIC key (add this to VPS)
cat ~/.ssh/github_actions_key.pub
```

**Add public key to VPS:**

```bash
# SSH into your VPS
ssh user@185.112.144.66

# Add the public key to authorized_keys
nano ~/.ssh/authorized_keys
# Paste the public key content and save

# Set correct permissions
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys
```

---

### Step 2: Verify VPS Setup

Make sure these are installed on VPS:

```bash
# Node.js
node --version  # Should be 18+

# PM2
pm2 --version

# Nginx
nginx -v

# Git (optional)
git --version
```

If not installed, run:

```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2
sudo npm install -g pm2

# Install Nginx
sudo apt install nginx -y
```

---

### Step 3: Create App Directory on VPS

```bash
# SSH into VPS
ssh user@185.112.144.66

# Create app directory
sudo mkdir -p /var/www/Zotrustdeapp
sudo chown -R $USER:$USER /var/www/Zotrustdeapp

# Create backups directory
mkdir -p /var/www/backups

# Verify
ls -la /var/www/
```

---

### Step 4: Test SSH Connection

Test if GitHub Actions can connect to VPS:

```bash
# From your local machine
ssh -i ~/.ssh/github_actions_key user@185.112.144.66 "echo 'Connection successful!'"
```

If you see "Connection successful!", you're good to go!

---

## 🎯 Workflows

### 1. **Deploy Workflow** (`.github/workflows/deploy.yml`)

**Triggers:**
- Push to `main` or `master` branch
- Manual trigger from GitHub Actions tab

**Steps:**
1. ✅ Checkout code
2. ✅ Install dependencies (frontend + backend)
3. ✅ Build frontend (`npm run build`)
4. ✅ Build backend (`cd backend && npm run build`)
5. ✅ Create deployment package
6. ✅ Upload to VPS via SCP
7. ✅ Extract and install on VPS
8. ✅ Restart PM2 service
9. ✅ Reload Nginx
10. ✅ Health check
11. ✅ Deployment summary

**Automatic Backups:**
- Creates backup before each deployment
- Keeps last 5 backups
- Stored in `/var/www/backups/`

---

### 2. **Test Workflow** (`.github/workflows/test.yml`)

**Triggers:**
- Push to `develop` or `feature/*` branches
- Pull requests to `main`, `master`, or `develop`

**Steps:**
1. ✅ Test frontend build
2. ✅ Test backend build
3. ✅ Run TypeScript checks
4. ✅ Security vulnerability scan
5. ✅ Build size analysis
6. ✅ Summary report

---

## 📁 Deployment Structure on VPS

```
/var/www/Zotrustdeapp/
├── dist/              # Frontend build files
│   ├── index.html
│   ├── assets/
│   └── ...
├── backend/
│   ├── dist/          # Backend compiled code
│   │   └── index.js
│   ├── package.json
│   └── node_modules/
└── ...

/var/www/backups/
├── backup_20251117_200000.tar.gz
├── backup_20251117_210000.tar.gz
└── ...
```

---

## 🔄 How to Use

### Automatic Deployment

Just push to main branch:

```bash
git add .
git commit -m "Deploy new features"
git push origin main
```

GitHub Actions will automatically:
1. Build your code
2. Deploy to VPS
3. Restart services
4. Run health check

### Manual Deployment

1. Go to GitHub → **Actions** tab
2. Select **Deploy to VPS** workflow
3. Click **Run workflow**
4. Select branch
5. Click **Run workflow** button

### Monitor Deployment

1. Go to GitHub → **Actions** tab
2. Click on the running workflow
3. Watch real-time logs

---

## 🔍 Troubleshooting

### Deployment Failed?

**Check logs:**
```bash
# SSH into VPS
ssh user@185.112.144.66

# Check PM2 logs
pm2 logs zotrust-backend

# Check PM2 status
pm2 status

# Check Nginx
sudo systemctl status nginx
sudo nginx -t
```

**Rollback to previous version:**
```bash
# SSH into VPS
cd /var/www/backups

# List backups
ls -lh

# Extract previous backup
tar -xzf backup_TIMESTAMP.tar.gz -C /var/www/Zotrustdeapp

# Restart services
pm2 restart zotrust-backend
```

### SSH Connection Failed?

**Check SSH key:**
```bash
# Verify key is added to VPS
ssh user@185.112.144.66
cat ~/.ssh/authorized_keys
```

**Check GitHub Secret:**
- Make sure `VPS_SSH_KEY` contains the PRIVATE key (not public)
- Make sure there are no extra spaces or newlines

### Build Failed?

**Check Node version:**
```bash
node --version  # Should be 18+
```

**Clear cache and rebuild:**
```bash
rm -rf node_modules package-lock.json
npm install
npm run build
```

---

## 📊 Monitoring

### Check Deployment Status

```bash
# PM2 status
pm2 status

# PM2 logs (real-time)
pm2 logs zotrust-backend --lines 50

# Nginx access logs
sudo tail -f /var/log/nginx/access.log

# Nginx error logs
sudo tail -f /var/log/nginx/error.log
```

### Health Check Endpoints

```bash
# API health check
curl https://zotrust.net/api/health

# Frontend
curl https://zotrust.net/

# Check response time
curl -w "@-" -o /dev/null -s https://zotrust.net/api/health <<'EOF'
    time_namelookup:  %{time_namelookup}\n
       time_connect:  %{time_connect}\n
    time_appconnect:  %{time_appconnect}\n
      time_redirect:  %{time_redirect}\n
   time_starttransfer:  %{time_starttransfer}\n
                     ----------\n
         time_total:  %{time_total}\n
EOF
```

---

## 🔒 Security Best Practices

1. **SSH Key:**
   - ✅ Use separate SSH key for CI/CD
   - ✅ Never commit private keys to repository
   - ✅ Rotate keys periodically

2. **Secrets:**
   - ✅ Store all sensitive data in GitHub Secrets
   - ✅ Never hardcode credentials in code
   - ✅ Use environment variables

3. **VPS:**
   - ✅ Use firewall (UFW)
   - ✅ Keep system updated
   - ✅ Use non-root user when possible
   - ✅ Enable fail2ban for SSH

4. **Backups:**
   - ✅ Automatic backups before deployment
   - ✅ Regular database backups
   - ✅ Test restore process

---

## 🎨 Workflow Badges

Add these to your README.md:

```markdown
![Deploy](https://github.com/YOUR_USERNAME/YOUR_REPO/actions/workflows/deploy.yml/badge.svg)
![Tests](https://github.com/YOUR_USERNAME/YOUR_REPO/actions/workflows/test.yml/badge.svg)
```

Replace `YOUR_USERNAME` and `YOUR_REPO` with your actual GitHub username and repository name.

---

## 📝 Workflow Customization

### Change Deployment Branch

Edit `.github/workflows/deploy.yml`:

```yaml
on:
  push:
    branches:
      - production  # Change this
```

### Add Environment Variables

Edit `.github/workflows/deploy.yml`:

```yaml
- name: 🏗️ Build Frontend
  run: npm run build
  env:
    NODE_ENV: production
    VITE_API_URL: https://api.zotrust.net  # Add custom vars
```

### Add Notifications

Add Slack/Discord/Telegram notifications:

```yaml
- name: 📢 Notify Deployment
  if: always()
  run: |
    curl -X POST ${{ secrets.SLACK_WEBHOOK }} \
      -H 'Content-Type: application/json' \
      -d '{"text":"Deployment ${{ job.status }}"}'
```

---

## ✅ Verification Checklist

After setup:

- [ ] GitHub Secrets configured (VPS_HOST, VPS_USER, VPS_SSH_KEY)
- [ ] SSH connection working
- [ ] VPS has Node.js, PM2, Nginx installed
- [ ] App directory created on VPS (`/var/www/Zotrustdeapp`)
- [ ] PM2 process name is `zotrust-backend`
- [ ] Nginx configured correctly
- [ ] First manual deployment successful
- [ ] Automatic deployment working
- [ ] Health check passing
- [ ] Backups being created

---

## 🆘 Support

If you encounter issues:

1. **Check GitHub Actions logs** (detailed error messages)
2. **Check VPS logs** (`pm2 logs`, nginx logs)
3. **Verify SSH connection** manually
4. **Test builds locally** before pushing
5. **Check file permissions** on VPS

---

## 📚 Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [PM2 Documentation](https://pm2.keymetrics.io/docs/)
- [Nginx Documentation](https://nginx.org/en/docs/)
- [SSH Key Setup](https://docs.github.com/en/authentication/connecting-to-github-with-ssh)

---

**✅ Your CI/CD pipeline is ready!**

Now every push to main will automatically deploy your application to production! 🚀

