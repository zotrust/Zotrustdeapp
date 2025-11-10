# Backend से Frontend Serve करने के लिए Guide

## ✅ सही तरीका (Correct Way)

### Step 1: Frontend Build करें
```bash
npm run build
```
यह `dist/` folder में production build create करेगा।

### Step 2: Backend Start करें
```bash
cd backend
npm start
```

या root से:
```bash
npm run serve
```

## ⚠️ Potential Issues और Solutions

### 1. **WebSocket URL Detection**
**Issue:** Frontend `window.location` से WebSocket URL detect करता है।
**Solution:** ✅ यह automatically काम करता है क्योंकि:
- `env.ts` में dynamic detection है
- ngrok domains के लिए automatically `wss://` use होता है
- Local IPs के लिए correct protocol detect होता है

**Test करें:**
- Local: `http://localhost:5000` → WebSocket: `ws://localhost:5000`
- ngrok: `https://xyz.ngrok.io` → WebSocket: `wss://xyz.ngrok.io`

### 2. **API Routes**
**Issue:** API calls `/api` से होते हैं।
**Solution:** ✅ Backend में `/api` routes properly configured हैं:
- `app.use('/api/auth', authRoutes)`
- `app.use('/api/calls', callsRoutes)`
- आदि...

**Check:** सभी API calls relative path use करते हैं (`/api/...`), तो यह automatically same origin पर work करेगा।

### 3. **Static Assets Path**
**Issue:** CSS, JS, images load नहीं हो रहे।
**Solution:** ✅ Backend में static files serve करने के लिए:
```typescript
express.static(path.join(__dirname, '../../dist'))
```

**Verify:** 
- `dist/assets/` folder में files होनी चाहिए
- Browser console में 404 errors check करें

### 4. **Frontend Build Missing**
**Issue:** Error: "Frontend build not found"
**Solution:** 
```bash
# Root directory से
npm run build

# Verify dist folder exists
ls dist/
```

### 5. **React Router Routes**
**Issue:** Direct URL access पर 404 error
**Solution:** ✅ Backend में catch-all handler है:
```typescript
app.get('*', (req, res) => {
  // API routes को skip करता है
  if (req.path.startsWith('/api/')) return next();
  // बाकी सभी routes के लिए index.html serve करता है
  res.sendFile(indexPath);
});
```

### 6. **Environment Variables**
**Issue:** Frontend में env variables नहीं मिल रहे
**Solution:** 
- Vite `VITE_` prefix use करता है
- Build time पर inject होते हैं
- Runtime पर `import.meta.env` से access होते हैं

**Note:** Backend से serve करते समय, env variables build time पर set होने चाहिए।

### 7. **WebSocket Connection**
**Issue:** WebSocket connect नहीं हो रहा
**Solution:** Check करें:
1. Backend Socket.IO server running है
2. Frontend में `WS_URL` correctly set है
3. ngrok use कर रहे हैं तो `wss://` protocol check करें

**Debug:**
```javascript
console.log('WebSocket URL:', WS_URL);
```

### 8. **CORS Issues**
**Issue:** CORS errors
**Solution:** ✅ Backend में CORS enabled है:
```typescript
app.use(cors({
  origin: true, // सभी origins allow करता है
  credentials: true
}));
```

## 📋 Testing Checklist

### Pre-deployment:
- [ ] Frontend build successful (`npm run build`)
- [ ] `dist/` folder exists और files present हैं
- [ ] Backend routes properly configured
- [ ] Socket.IO server running
- [ ] Database connected

### During testing:
- [ ] Homepage load हो रहा है
- [ ] API calls working (`/api/auth/login`, etc.)
- [ ] WebSocket connection establish हो रहा है
- [ ] Static assets (CSS, JS, images) load हो रहे हैं
- [ ] React Router routes working (`/admin`, `/support-call`, etc.)
- [ ] Voice calls working (WebRTC)

### Common Errors और Fixes:

#### Error: "Frontend build not found"
```bash
npm run build
```

#### Error: "Cannot GET /some-route"
✅ Normal है - React Router client-side routing use करता है।
Backend catch-all handler automatically handle करता है।

#### Error: "WebSocket connection failed"
- Check backend server running
- Check `WS_URL` in frontend
- Check firewall/network settings
- ngrok use कर रहे हैं तो tunnel active होना चाहिए

#### Error: "API endpoint not found"
- Verify route registered in `backend/src/index.ts`
- Check route path matches exactly
- Verify HTTP method (GET, POST, etc.)

## 🚀 Production Deployment

### Recommended Setup:
1. Build frontend: `npm run build`
2. Start backend: `cd backend && npm start`
3. Backend automatically serve करेगा `dist/` folder से

### ngrok के साथ:
1. ngrok tunnel setup (backend में automatically)
2. Public URL get करें
3. Frontend automatically same origin पर WebSocket connect करेगा

### Environment Variables:
Frontend build से पहले set करें:
```bash
VITE_API_BASE_URL=/api
VITE_WS_URL=  # Empty = auto-detect
```

## ✅ Summary

**Good News:** Code already configured है backend से frontend serve करने के लिए!

**Main Requirements:**
1. ✅ Build frontend first (`npm run build`)
2. ✅ Backend serve करता है `dist/` folder
3. ✅ API routes properly configured
4. ✅ WebSocket detection automatic
5. ✅ Static assets serving configured

**No Issues Expected** अगर:
- Frontend properly build हो गया है
- Backend server running है
- Database connected है
- Port 5000 available है

