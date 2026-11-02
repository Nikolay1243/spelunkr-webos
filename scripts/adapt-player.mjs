// Checked adaptations of the pinned upstream client. Fail loudly on drift.
//
// Everything here works against minified identifiers, so anchors are patterns
// (not one exact string) wherever the shape is stable, and each adaptation
// asserts what it needs before touching the source. A miss aborts the build:
// shipping a half-patched player is worse than not building.
const DRIFT = 'Original player changed: review the webOS player adapter before building';

const countOf = (source, pattern) => (pattern instanceof RegExp
  ? (source.match(pattern.global ? pattern : new RegExp(pattern.source, pattern.flags + 'g')) || []).length
  : source.split(pattern).length - 1);

function expect(source, pattern, count = 1, what = '') {
  const found = countOf(source, pattern);
  if (found !== count) {
    throw new Error(`${DRIFT} — ${what || String(pattern)}: expected ${count} match(es), found ${found}`);
  }
}
function swap(source, pattern, replacement, what = '') {
  expect(source, pattern, 1, what);
  if (typeof replacement === 'function') return source.replace(pattern, replacement);
  return pattern instanceof RegExp ? source.replace(pattern, replacement) : source.split(pattern).join(replacement);
}
function swapAll(source, pattern, replacement, count, what = '') {
  expect(source, pattern, count, what);
  if (typeof replacement === 'function') throw new Error('swapAll takes a string replacement');
  return pattern instanceof RegExp
    ? source.replace(new RegExp(pattern.source, 'g'), replacement)
    : source.split(pattern).join(replacement);
}

export function adaptPlayer(source) {
  // 1. Expose the player's own menu, spelunk and guide actions to the webOS
  //    remote layer. `hr`/`ai` are the open state and setter of the on-screen
  //    key menu, `f` is onSpelunk and `y` is onGuide.
  expect(source, 'const[hr,ai]=M(!1)', 1, 'player key-menu state');
  expect(source, 'onSpelunk:f', 1, 'onSpelunk prop');
  expect(source, 'onGuide:y', 2, 'onGuide prop');
  // The volume state is local to the player, so the wheel needs the setter the
  // player already uses for its own ArrowUp/ArrowDown handling.
  const volumeSetter = source.match(/([A-Za-z_$][\w$]*)\(([A-Za-z_$][\w$]*)=>Math\.min\(\2\+\.05,1\)\)/);
  if (!volumeSetter) throw new Error(`${DRIFT} — volume setter`);
  const setVolume = volumeSetter[1];
  expect(source, `${setVolume}(${volumeSetter[2]}=>Math.min(${volumeSetter[2]}+.05,1))`, 1, 'volume setter call site');
  const refHook = /([A-Za-z_$][\w$]*)\.current=([A-Za-z_$][\w$]*),([A-Za-z_$][\w$]*)\(\(\)=>\{const ([A-Za-z_$][\w$]*)=([A-Za-z_$][\w$]*)=>\1\.current\(\5\)/;
  source = swap(source, refHook, (match) =>
    'window.SpelunkrWebOS.player={isMenuVisible:()=>hr,showMenu:()=>ai(!0),' +
    `hideMenu:()=>ai(!1),spelunk:()=>f&&f(),guide:()=>y&&y(),` +
    `changeVolume:d=>${setVolume}(v=>Math.max(0,Math.min(1,v+d)))},${match}`, 'player API hook');
  expect(source, 'window.SpelunkrWebOS.player=', 1, 'player API injected');

  // 2. The preview must be able to show the channel that is actually playing,
  //    not the one the guide happens to highlight.
  const preview = /function ([A-Za-z_$][\w$]*)\(\{channel:e,channelNumber:t,tuneAtOnce:n=null,/;
  const previewMatch = source.match(preview);
  if (!previewMatch) throw new Error(`${DRIFT} — preview component signature`);
  const previewName = previewMatch[1];
  source = swap(source, preview,
    `function ${previewName}({channel:e,channelNumber:t,webosPlayingChannel=null,tuneAtOnce:n=null,`,
    'preview component signature');
  source = swap(source, /const ([A-Za-z_$][\w$]*)=z\.current,([A-Za-z_$][\w$]*)=O&&!r&&/,
    'const $1=(!r&&webosPlayingChannel)||z.current,$2=O&&!r&&', 'preview channel choice');
  source = swap(source, /a\((\w+),\{channel:(\w+),channelNumber:(\w+),tuneAtOnce:/,
    (match, tag, channel, number) => {
      if (tag !== previewName) throw new Error(`${DRIFT} — preview element uses ${tag}, expected ${previewName}`);
      return `a(${tag},{channel:${channel},channelNumber:${number},webosPlayingChannel:Kr(I),tuneAtOnce:`;
    }, 'preview element');

  // 3. Expose the guide's active/selected ids and its tune action, and mark the
  //    playing channel as active so the guide agrees with what is on screen.
  source = swap(source, /const (\w+)=Kr\(U\),(\w+)=aR\(\),/,
    'const $1=Kr(U),webosGuide=(window.SpelunkrWebOS.guide={activeChannel:I,' +
    'selectedChannel:U,tuneSelected:()=>Y(U)}),$2=aR(),', 'guide API hook');
  source = swap(source, 'activeId:$?U:null,highlightedId:U,', 'activeId:I,highlightedId:U,',
    'guide active row');

  // 4. Hand the supabase client and the sign-in call to the webOS layer: the TV
  //    finishes the Discord flow in its own service instead of a web redirect.
  source = swap(source, /const (\w+)=pw\(\),(\w+)=cn&&Kt\?cw\(cn,Kt\):null;/,
    'const $1=pw(),$2=cn&&Kt?cw(cn,Kt):null;window.SpelunkrWebOS.auth=$2;', 'supabase client');
  source = swap(source,
    /async function (\w+)\(\)\{if\(!\w+\)return\{error:\{message:"Supabase not configured"\}\};const\{data:e,error:t\}=await (\w+)\.auth\.signInWithOAuth\(\{provider:"discord",options:\{redirectTo:window\.location\.origin,scopes:"identify guilds\.join"\}\}\);return\{data:e,error:t\}\}/,
    'async function $1(){return window.SpelunkrWebOS.signIn($2)}', 'sign-in function');

  // 5. This app always uses the normal flat-TV layout. Do not let persisted CRT
  //    modes or query links re-enable a differently scaled 640x480 interface.
  source = swap(source, /function (\w+)\(e,t\)\{const n=String\(e\|\|""\);/,
    'function $1(e,t){return null;const n=String(e||"");', 'CRT query adapter');
  source = swap(source, /function (\w+)\(\{mode:e=null,channel:t=null,watching:n=!1\}\)\{/,
    'function $1({mode:e=null,channel:t=null,watching:n=!1}){return null;', 'CRT layout adapter');

  // 6. The site's pull animation measures and animates layout on every frame.
  //    Snap the TV video plane to its final size instead of resizing it.
  source = swap(source, /(\w+)\((\w+),r,!O\);/, '$1($2,r,!1);', 'pull animation');

  // 7. Say what the comment key does instead of the site's terse HIDE key.
  source = swapAll(source, '...Tc(!en,Cr.titleOn,Cr.titleOff),children:Cr.key',
    '...Tc(!en,Cr.titleOn,Cr.titleOff),children:!en?"Comments & reactions: On":"Comments & reactions: Off"',
    2, 'comment toggle label');

  // 8. No analytics from the living room: the injector returns before it can add
  //    the script tag, which lets the bundler drop the whole block. If upstream
  //    ever drops analytics itself, that is fine too — just say so.
  const injector = /if\(!(\w+)\(\)\)return;const\{beforeSend:(\w+),src:(\w+),dataset:(\w+)\}=(\w+)\(e,t\);/;
  const injectorHits = countOf(source, injector);
  if (injectorHits === 1) {
    source = source.replace(injector, (match, isBrowser) =>
      `if(!${isBrowser}())return;return;${match.slice(`if(!${isBrowser}())return;`.length)}`);
  } else if (injectorHits > 1) {
    throw new Error(`${DRIFT} — analytics injector: expected at most 1 match, found ${injectorHits}`);
  } else {
    console.warn('adapt-player: no analytics injector found, nothing to disable');
  }

  return source;
}
