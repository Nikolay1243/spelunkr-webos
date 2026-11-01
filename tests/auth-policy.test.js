import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {validAuthorize,isPackagedApp,callbackURL}=require('../service/auth-policy.cjs');
const app='file:///media/developer/apps/usr/palm/applications/tv.spelunkr.webos/index.html?tv=1#route=%2F';
test('OAuth helper accepts only the existing Discord provider and exact app target',()=>{
 const u=new URL('https://jbuopkuluyfjwgsrigry.supabase.co/auth/v1/authorize');u.search=new URLSearchParams({provider:'discord',redirect_to:'https://spelunkr.tv/'}).toString();
 assert.ok(validAuthorize(u.href));assert.equal(validAuthorize(u.href.replace('provider=discord','provider=google')),false);assert.equal(validAuthorize('https://example.org/authorize'),false);
 assert.ok(isPackagedApp(app));assert.equal(isPackagedApp(app.replace('tv.spelunkr.webos','another.app')),false);
});
test('OAuth return accepts the exact callback origin and rejects other origins and paths',()=>{
 const callback=callbackURL('https://spelunkr.tv/#access_token=TEST_ACCESS&refresh_token=TEST_REFRESH&provider_token=TEST_PROVIDER');assert.ok(callback);
 assert.equal(callbackURL('https://evil.example/#access_token=TEST&refresh_token=TEST'),null);
 assert.equal(callbackURL('https://spelunkr.tv/about#access_token=TEST&refresh_token=TEST'),null);
 assert.equal(callbackURL('https://spelunkr.tv/'),null);
});
test('PKCE query callbacks and denied consent can return to the app',()=>{
 const callback=callbackURL('https://spelunkr.tv/?code=TEST_CODE');assert.equal(callback.searchParams.get('code'),'TEST_CODE');
 assert.ok(callbackURL('https://spelunkr.tv/#error=access_denied&error_description=Denied'));
});
