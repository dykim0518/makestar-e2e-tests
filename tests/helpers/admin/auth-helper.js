/**
 * 관리자 테스트용 인증 헬퍼 (CommonJS)
 * 
 * auth.json 기반으로 인증을 관리합니다.
 */

const fs = require('fs');
const path = require('path');

// 상수 정의
const BASE_URL = 'https://stage-new-admin.makeuni2026.com';
const AUTH_DOMAIN = 'stage-auth.makeuni2026.com';
const ROOT_DOMAIN = '.makeuni2026.com';
const AUTH_FILE = path.join(__dirname, '..', '..', '..', 'auth.json');
const TOKEN_BUFFER_MS = 1 * 60 * 1000; // 1분

// 인증 설정 캐시
let authSetupCache = {
  setupComplete: false,
  lastSetup: 0
};

/**
 * 토큰 만료 여부 확인
 */
function isTokenExpired(bufferMs) {
  if (typeof bufferMs === 'undefined') bufferMs = TOKEN_BUFFER_MS;
  if (!fs.existsSync(AUTH_FILE)) return true;
  try {
    const auth = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf-8'));
    const cookies = auth.cookies || [];
    const rtCookie = cookies.find(function(c) { return c.name === 'refresh_token'; });
    if (!rtCookie || !rtCookie.value) return true;
    const payload = JSON.parse(Buffer.from(rtCookie.value.split('.')[1], 'base64').toString());
    const expiresAt = new Date(payload.exp * 1000).getTime();
    const now = Date.now();
    return expiresAt - bufferMs <= now;
  } catch (e) {
    return true;
  }
}

/**
 * 토큰 남은 시간 (분 단위)
 */
function getTokenRemainingMinutes() {
  if (!fs.existsSync(AUTH_FILE)) return 0;
  try {
    const auth = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf-8'));
    const cookies = auth.cookies || [];
    const rtCookie = cookies.find(function(c) { return c.name === 'refresh_token'; });
    if (!rtCookie || !rtCookie.value) return 0;
    const payload = JSON.parse(Buffer.from(rtCookie.value.split('.')[1], 'base64').toString());
    const expiresAt = new Date(payload.exp * 1000).getTime();
    const now = Date.now();
    const remaining = expiresAt - now;
    return Math.max(0, Math.floor(remaining / (1000 * 60)));
  } catch (e) {
    return 0;
  }
}

/**
 * 인증된 URL 생성
 */
function getAuthenticatedUrl(targetPath, includeToken) {
  if (typeof includeToken === 'undefined') includeToken = true;
  if (!includeToken) {
    return BASE_URL + targetPath;
  }
  try {
    if (fs.existsSync(AUTH_FILE)) {
      const authData = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf-8'));
      const cookies = authData.cookies || [];
      const rtCookie = cookies.find(function(c) { return c.name === 'refresh_token'; });
      if (rtCookie && rtCookie.value) {
        const separator = targetPath.indexOf('?') !== -1 ? '&' : '?';
        return BASE_URL + targetPath + separator + 'refresh_token=' + encodeURIComponent(rtCookie.value);
      }
    }
  } catch (e) {
    // ignore
  }
  return BASE_URL + targetPath;
}

/**
 * 토큰 유효성 확인
 */
async function ensureValidToken() {
  if (!fs.existsSync(AUTH_FILE)) {
    console.error('❌ auth.json이 없습니다.');
    console.log('   node token-manager.js --setup 명령으로 로그인하세요.');
    return false;
  }
  if (!isTokenExpired()) {
    const remainingMinutes = getTokenRemainingMinutes();
    console.log('✅ refresh_token 유효 (남은 시간: ' + Math.floor(remainingMinutes / 60) + '시간 ' + (remainingMinutes % 60) + '분)');
    return true;
  }
  console.warn('⚠️ refresh_token이 만료됨. node token-manager.js --setup 필요');
  return false;
}

/**
 * 세션 유효성 확인 (sessionid 쿠키 기반)
 */
function hasValidSession() {
  if (!fs.existsSync(AUTH_FILE)) return false;
  try {
    const auth = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf-8'));
    const cookies = auth.cookies || [];
    const sessionCookie = cookies.find(function(c) { return c.name === 'sessionid'; });
    if (sessionCookie && sessionCookie.value) {
      // sessionid 쿠키가 있고 만료되지 않았으면 유효
      if (typeof sessionCookie.expires === 'number') {
        return sessionCookie.expires * 1000 > Date.now();
      }
      return true; // expires가 없으면 세션 쿠키로 간주
    }
    return false;
  } catch (e) {
    return false;
  }
}

/**
 * 페이지 컨텍스트에 인증 쿠키 설정
 */
async function setupAuthCookies(page) {
  const context = page.context();
  const adminDomain = BASE_URL.replace(/^https?:\/\//, '').split('/')[0];
  
  // 캐시 확인 (5분 내 설정했으면 스킵)
  const now = Date.now();
  if (authSetupCache.setupComplete && (now - authSetupCache.lastSetup) < 5 * 60 * 1000) {
    return true;
  }
  
  if (!fs.existsSync(AUTH_FILE)) {
    console.warn('⚠️ auth.json이 없습니다.');
    return false;
  }
  
  try {
    const authData = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf-8'));
    
    if (authData.cookies && authData.cookies.length > 0) {
      const targetDomains = [adminDomain, AUTH_DOMAIN, ROOT_DOMAIN];
      const whitelist = ['csrftoken', 'sessionid', 'refresh_token', 'i18n_redirected'];
      const cookiesToSet = [];
      
      for (let i = 0; i < authData.cookies.length; i++) {
        const raw = authData.cookies[i];
        
        // 도메인 필터
        if (!raw.domain || String(raw.domain).indexOf('makeuni2026.com') === -1) continue;
        // 화이트리스트 필터
        if (whitelist.indexOf(raw.name) === -1) continue;
        
        const base = {
          name: String(raw.name),
          value: String(raw.value || ''),
          path: raw.path || '/',
          httpOnly: !!raw.httpOnly,
          secure: !!raw.secure,
          sameSite: (['Lax', 'None', 'Strict'].indexOf(raw.sameSite) !== -1 ? raw.sameSite : 'Lax')
        };
        
        if (typeof raw.expires === 'number') {
          base.expires = Math.floor(raw.expires);
        }
        
        for (let j = 0; j < targetDomains.length; j++) {
          cookiesToSet.push(Object.assign({}, base, { domain: targetDomains[j] }));
        }
      }
      
      if (cookiesToSet.length > 0) {
        await context.addCookies(cookiesToSet);
        console.log('✅ auth.json 쿠키 설정 완료 (' + cookiesToSet.length + '개)');
      }
    }
    
    // localStorage 토큰이 있으면 주입
    if (authData.localStorage) {
      const ls = authData.localStorage;
      const lsAccess = ls['access_token'];
      const lsRefresh = ls['refresh_token'];
      
      if (lsAccess && lsRefresh) {
        await page.addInitScript(function(tokens) {
          localStorage.setItem('access_token', tokens.accessToken);
          localStorage.setItem('refresh_token', tokens.refreshToken);
          if (tokens.userInfo) {
            localStorage.setItem('user_info', JSON.stringify(tokens.userInfo));
          }
          if (tokens.expiresAt) {
            localStorage.setItem('token_expires_at', tokens.expiresAt);
          }
        }, {
          accessToken: lsAccess,
          refreshToken: lsRefresh,
          userInfo: (function() {
            try { return JSON.parse(ls['user_info'] || 'null'); }
            catch (e) { return null; }
          })(),
          expiresAt: ls['token_expires_at'] || null
        });
        console.log('✅ auth.json 로컬스토리지 토큰 설정 완료');
      }
    }
    
    authSetupCache.setupComplete = true;
    authSetupCache.lastSetup = now;
    return true;
    
  } catch (e) {
    console.warn('⚠️ auth.json 파싱 실패:', e.message);
    return false;
  }
}

/**
 * 인증 캐시 초기화
 */
function resetAuthCache() {
  authSetupCache = {
    setupComplete: false,
    lastSetup: 0
  };
}

// CommonJS exports
module.exports = {
  BASE_URL: BASE_URL,
  AUTH_DOMAIN: AUTH_DOMAIN,
  ROOT_DOMAIN: ROOT_DOMAIN,
  isTokenExpired: isTokenExpired,
  getTokenRemainingMinutes: getTokenRemainingMinutes,
  getAuthenticatedUrl: getAuthenticatedUrl,
  ensureValidToken: ensureValidToken,
  hasValidSession: hasValidSession,
  setupAuthCookies: setupAuthCookies,
  resetAuthCache: resetAuthCache
};


