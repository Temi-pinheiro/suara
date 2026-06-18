/* Suara — screen render functions. Each returns the inner HTML of a .screen.
   Shared by the interactive hero phone and the static gallery. */
(function () {
  const ICON = {
    spk: '<svg viewBox="0 0 24 24" fill="none"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    mic: '<svg viewBox="0 0 24 24" fill="none"><rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor"/><path d="M6 11a6 6 0 0 0 12 0M12 17v4M9 21h6" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>',
    stop: '<svg viewBox="0 0 24 24"><rect x="7" y="7" width="10" height="10" rx="2.5" fill="currentColor"/></svg>',
  };

  function statusbar() {
    return `<div class="statusbar"><span>9:41</span><span class="dots"><span class="pill-batt"></span></span></div>`;
  }
  function topbar(spend) {
    return `<div class="topbar"><div class="x">✕</div><div class="title">Mandarin</div><div class="spend">${spend || '$0.42'}</div></div>`;
  }
  function backbar(title) {
    return `<div class="topbar"><div class="x" style="font-size:24px">‹</div><div class="title">${title}</div><div style="width:40px"></div></div>`;
  }
  // wrap inner content as a full screen
  function screen(inner, { chrome = true, spend } = {}) {
    return `<div class="notch"></div>${statusbar()}${chrome ? topbar(spend) : ''}${inner}`;
  }

  const listenPill = (label = 'Listen') =>
    `<button class="listen"><span class="spk">${ICON.spk}</span>${label}</button>`;

  // pieces shelf — the honest progress signal
  function shelf(pieces, fresh) {
    const chips = pieces.map(p => {
      const isFresh = p === fresh;
      return `<span class="chip${isFresh ? ' fresh' : ''}">${p}</span>`;
    }).join('');
    return `<div class="shelf">
      <div class="label"><span class="caption">pieces you can now combine</span></div>
      <div class="chips">${chips}</div>
    </div>`;
  }

  const SCREENS = {
    // ---------- ENTRY / FIRST-RUN ----------
    entry: () => screen(`
      <div class="entry col">
        <div style="height:60px"></div>
        <div class="hero-mark">suara</div>
        <div style="height:18px"></div>
        <div class="sound-mark" aria-hidden="true">
          ${[26,44,62,38,54,30,48].map((h,i)=>`<i style="height:${h}px;opacity:${0.5+i*0.07}"></i>`).join('')}
        </div>
        <div style="flex:1"></div>
        <div class="lead">Let’s pick up where speaking comes from.</div>
        <div style="height:14px"></div>
        <div class="sub">A patient voice, one sentence at a time. You listen, you build, you say it. No tests, no clock.</div>
        <div style="flex:1"></div>
        <button class="btn primary">Begin</button>
        <div style="height:14px"></div>
        <div style="display:flex;justify-content:center">
          <span class="lang-pill">ZH&nbsp; Mandarin <span class="car">▾</span></span>
        </div>
        <div style="height:30px"></div>
      </div>`, { chrome: false }),

    // ---------- LANGUAGE PICKER ----------
    picker: () => screen(`
      <div class="entry col">
        <div style="height:60px"></div>
        <div class="hero-mark" style="opacity:.4">suara</div>
        <div style="flex:1"></div>
        <div class="caption" style="margin-bottom:10px">choose a language</div>
        <div class="picker" style="width:auto">
          ${langRow('ZH','Mandarin','Month 1 · Week 1', true)}
          ${langRow('JA','Japanese','resting')}
          ${langRow('KO','Korean','resting')}
          ${langRow('HI','Hindi','resting')}
          ${langRow('ID','Indonesian','resting')}
        </div>
        <div style="flex:1"></div>
        <div class="sub center" style="font-size:14px;color:var(--faint)">five languages, one teacher · nothing is locked</div>
        <div style="height:30px"></div>
      </div>`, { chrome: false }),

    // ---------- LOADING ----------
    loading: () => screen(`
      <div class="center-state">
        <div class="spinner"></div>
        <div class="msg">Setting up your lesson…</div>
      </div>`, { spend: '$0.42' }),

    // ---------- AWAITING · INTRODUCE ----------
    awaitingIntroduce: () => screen(`
      <div class="body gap20">
        <div style="height:6px"></div>
        <div class="narration">The first piece you’ll need is the word for <b style="color:var(--text);font-weight:600">“I”.</b> Listen, then say it back whenever you’re ready.</div>
        <div class="word-card">
          <div class="scriptline"><span class="word">我</span></div>
          <div class="roman">wǒ</div>
          <div class="gloss">I / me</div>
          ${listenPill('Listen')}
        </div>
        <div class="grow"></div>
      </div>
      ${footerMic('Tap to speak — there’s no rush')}`, { spend: '$0.42' }),

    // ---------- AWAITING · RECOMBINE ----------
    awaitingRecombine: () => screen(`
      <div class="body gap20">
        <div style="height:6px"></div>
        <div class="cue">Now put it together: <b>“I want tea.”</b></div>
        <div class="narration">You already own every piece of this. Build it out loud — the answer stays hidden until you’ve tried.</div>
        <div class="grow"></div>
        ${shelf(['我 wǒ','要 yào','茶 chá','不 bù'], '茶 chá')}
        <div style="height:8px"></div>
      </div>
      ${footerMic('Tap to speak when you’ve built it')}`, { spend: '$0.46' }),

    // ---------- RECORDING ----------
    recording: () => screen(`
      <div class="body gap20">
        <div style="height:6px"></div>
        <div class="cue">Now put it together: <b>“I want tea.”</b></div>
        <div class="grow"></div>
        <div class="echo"><span class="pending">listening…</span></div>
        <div style="height:6px"></div>
      </div>
      <div class="footer">
        <div class="helper" style="color:var(--live);font-weight:600">Live — say it your way, finish when you’re done</div>
        <div class="mic-row">
          <button class="mic live"><div class="bars"><i></i><i></i><i></i><i></i><i></i></div></button>
        </div>
      </div>`, { spend: '$0.46' }),

    // ---------- SCORING ----------
    scoring: () => screen(`
      <div class="center-state">
        <div class="think-orb"><div class="dots"><i></i><i></i><i></i></div></div>
        <div class="msg">Listening to what you said…</div>
      </div>`, { spend: '$0.46' }),

    // ---------- FEEDBACK · CORRECT ----------
    feedbackCorrect: () => screen(`
      <div class="body gap16">
        <div style="height:4px"></div>
        <div class="echo">我要茶</div>
        <div class="feedback-card correct">
          <div class="verdict correct">That’s it.</div>
          <div class="fb-note">Clean and natural. Notice you never had to rearrange a thing — Mandarin lets the pieces sit in the order you know.</div>
          <div class="fb-model">
            <div class="m-word"><span class="w">我要茶</span><span class="r">wǒ yào chá</span></div>
            ${listenPill('Hear it')}
          </div>
        </div>
        ${toneCue()}
        <div class="grow"></div>
      </div>
      <div class="footer">
        <div class="btn-row">
          <button class="btn ghost">Try once more</button>
          <button class="btn primary">Continue</button>
        </div>
      </div>`, { spend: '$0.49' }),

    // ---------- FEEDBACK · CLOSE ----------
    feedbackClose: () => screen(`
      <div class="body gap16">
        <div style="height:4px"></div>
        <div class="echo">我要茶</div>
        <div class="feedback-card close">
          <div class="verdict close">Almost — the tone on 茶 slipped a little.</div>
          <div class="fb-note">You said it flat; <b style="font-weight:700">chá</b> rises, like you’re gently asking “huh?”. Everything else landed.</div>
          <div class="fb-model">
            <div class="m-word"><span class="w">茶</span><span class="r">chá</span></div>
            ${listenPill('Hear it')}
          </div>
        </div>
        ${toneCue()}
        <div class="grow"></div>
      </div>
      <div class="footer">
        <div class="btn-row">
          <button class="btn ghost">Continue</button>
          <button class="btn primary">Try once more</button>
        </div>
      </div>`, { spend: '$0.49' }),

    // ---------- FEEDBACK · OFF ----------
    feedbackOff: () => screen(`
      <div class="body gap16">
        <div style="height:4px"></div>
        <div class="echo">我喝茶</div>
        <div class="feedback-card off">
          <div class="verdict off">Not quite — that was “I drink tea.” Let’s hear the one we’re after.</div>
          <div class="fb-note">Close cousin! You reached for <b style="font-weight:700">喝 hē</b> (drink). For “want” we use <b style="font-weight:700">要 yào</b>. Listen, then have another go.</div>
          <div class="fb-model">
            <div class="m-word"><span class="w">我要茶</span><span class="r">wǒ yào chá</span></div>
            ${listenPill('Hear it')}
          </div>
        </div>
        <div class="grow"></div>
      </div>
      <div class="footer">
        <button class="btn primary">Try once more</button>
      </div>`, { spend: '$0.49' }),

    // ---------- ERROR ----------
    error: () => screen(`
      <div class="center-state">
        <div class="think-orb" style="background:var(--cream)"><span style="font-size:34px">·  ·  ·</span></div>
        <div class="msg">Something hiccupped on our side — your place is saved.</div>
        <button class="btn primary" style="max-width:200px">Try again</button>
      </div>`, { spend: '$0.46' }),

    // ---------- PATH (module overview) ----------
    path: () => `<div class="notch"></div>${statusbar()}${backbar('Your path')}
      <div class="body gap16" style="overflow:hidden">
        <div style="height:2px"></div>
        <div class="caption">Mandarin · six little blocks</div>
        <div class="path-mirror">Everything here is yours to wander — start where you are, or wander back. Nothing is timed, nothing locks.</div>
        <div class="modules">
          ${moduleCard('done', 'Wanting &amp; having', '', [['我','wǒ','owned'],['要','yào','owned'],['有','yǒu','owned']], 'revisit')}
          ${moduleCard('done', 'Saying no', '', [['不','bù','owned'],['没','méi','owned']], 'revisit')}
          ${moduleCard('here', 'Tea, water, coffee', 'Three things to ask for — and the verb that gets them.', [['茶','chá','cur'],['水','shuǐ','ahead'],['咖啡','kāfēi','ahead']], "you're here")}
          ${moduleCard('ahead', 'Going places', '', [['去','qù','ahead'],['这里','zhèlǐ','ahead'],['哪里','nǎlǐ','ahead']], 'ahead')}
          ${moduleCard('ahead', 'When &amp; time', '', [['现在','xiànzài','ahead'],['今天','jīntiān','ahead']], 'ahead')}
        </div>
        <div style="height:6px"></div>
      </div>`,

    // ---------- MODULE INTRO (before a lesson) ----------
    moduleIntro: () => `<div class="notch"></div>${statusbar()}${backbar('Your path')}
      <div class="body gap16">
        <div style="height:4px"></div>
        <div class="caption" style="color:var(--primary)">Block 3 · you’re here</div>
        <div style="font-size:30px;font-weight:800;letter-spacing:-.4px">Tea, water, coffee</div>
        <div class="m-sub" style="font-size:16px">You already own <b style="color:var(--text);font-weight:700">我要</b> — “I want”. Now we add the things you’ll ask for.</div>
        <div class="intro-pieces">
          <span class="pchip owned">我要 <span class="pr">wǒ yào</span></span>
          <span class="pchip cur">茶 <span class="pr">chá</span></span>
          <span class="pchip ahead">水 <span class="pr">shuǐ</span></span>
          <span class="pchip ahead">咖啡 <span class="pr">kāfēi</span></span>
        </div>
        <div style="height:2px"></div>
        <div class="caption">what you’ll be able to say</div>
        <div class="say-list">
          <div class="say-row"><span class="zh">我要茶</span><span class="pr">wǒ yào chá</span><span class="en">I want tea</span></div>
          <div class="say-row locked"><span class="zh">我要水</span><span class="pr">wǒ yào shuǐ</span><span class="en">I want water</span></div>
          <div class="say-row locked"><span class="zh">我不要咖啡</span><span class="pr">…bù yào…</span><span class="en">I don’t want coffee</span></div>
        </div>
        <div class="grow"></div>
      </div>
      <div class="footer">
        <button class="btn primary">Pick up where you left off</button>
        <div class="helper">nothing is timed — close any time, you’ll land right back here</div>
      </div>`,
  };

  function pieceMini(p) {
    const [hz, rm, st] = p;
    return `<span class="pchip ${st}">${hz} <span class="pr">${rm}</span></span>`;
  }
  function moduleCard(state, title, sub, pieces, label) {
    const dot = state === 'done'
      ? `<div class="mdot done">✓</div>`
      : state === 'here' ? `<div class="mdot here"></div>` : `<div class="mdot ahead"></div>`;
    const lab = state === 'done'
      ? `<span class="mlabel done">↻ ${label}</span>`
      : `<span class="mlabel ${state}">${label}</span>`;
    return `<div class="module-card ${state}">
      ${dot}
      <div class="m-main">
        <div class="m-top"><div class="module-title">${title}</div>${lab}</div>
        ${sub ? `<div class="m-sub">${sub}</div>` : ''}
        <div class="mini-chips">${pieces.map(pieceMini).join('')}</div>
      </div>
    </div>`;
  }

  function langRow(code, name, pos, active) {    const cls = active ? 'active' : (pos === 'resting' ? 'resting' : '');
    return `<div class="lang-row ${cls}">
      <div class="code">${code}</div>
      <div class="col"><div class="lname">${name}</div><div class="lpos">${pos}</div></div>
    </div>`;
  }

  function footerMic(helper) {
    return `<div class="footer">
      <div class="mic-row"><button class="mic"><span class="micglyph">${ICON.mic}</span></button></div>
      <div class="helper">${helper}</div>
    </div>`;
  }

  function toneCue() {
    return `<div class="tone-cue">
      <svg class="contour" viewBox="0 0 52 36"><path d="M6 30 L46 6"/></svg>
      <div class="col">
        <div class="t-name">Tone 2 · rising</div>
        <div class="t-desc">Voice lifts from low to high — like asking “huh?” &nbsp;茶 = chá</div>
      </div>
    </div>`;
  }

  // metadata for the gallery (order + section + label + caption)
  const GALLERY = [
    { key:'entry',            section:'Entry',      label:'First-run',                 note:'Tiny, warm, no goal-setting. Wordmark + a sound-mark, one intent line, Begin, language pill.' },
    { key:'picker',           section:'Entry',      label:'Language picker',           note:'Five languages, Mandarin launching; others “resting”. Nothing locked — never a gate.' },
    { key:'path',             section:'Path · progress at a glance', label:'the path (module map)', note:'Six small blocks. Done / here / ahead — a mirror, not a leaderboard. The pieces you own (filled teal) are the honest progress signal; no %, no streaks, nothing locks.' },
    { key:'moduleIntro',      section:'Path · progress at a glance', label:'module intro (before a lesson)', note:'Tap the current block to see what it teaches, what you already own, and what you’ll be able to say — then begin. This is the “glance before you start”.' },
    { key:'loading',          section:'Lesson states', label:'loading',                note:'Quiet spinner + one honest line.' },
    { key:'awaitingIntroduce',section:'Lesson states', label:'awaiting · introduce',   note:'A new piece is taught. Word card holds the script + romanization + gloss; Listen pill; mic waits.' },
    { key:'awaitingRecombine',section:'Lesson states', label:'awaiting · recombine',   note:'Build from owned pieces. Target hidden. The shelf shows what you can now combine — honest progress.' },
    { key:'recording',        section:'Lesson states', label:'recording (live)',       note:'Mic turns teal, level bars move with real input. “Live” is visibly true — never speak into a void.' },
    { key:'scoring',          section:'Lesson states', label:'scoring',                note:'Thinking orb + dots, brief. The only motion on a still screen.' },
    { key:'error',            section:'Lesson states', label:'error',                  note:'Warm, never alarming. Place is saved; one Try again.' },
    { key:'feedbackCorrect',  section:'Feedback',   label:'feedback · correct',        note:'Green verdict, worded. Model revealed only now. Tone cue (Mandarin). Continue is primary.' },
    { key:'feedbackClose',    section:'Feedback',   label:'feedback · close',          note:'Amber verdict — one warm sentence, never a score. Try once more is primary.' },
    { key:'feedbackOff',      section:'Feedback',   label:'feedback · off',            note:'Slate verdict = information, not failure. Names the swap, hears the model, tries again.' },
  ];

  window.SuaraScreens = { SCREENS, GALLERY, ICON };
})();
