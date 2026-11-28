export const FESTIVAL_CSS = `
#g3festival[hidden]{display:none}
#g3festival{position:fixed;inset:0;z-index:10;display:grid;align-items:end;justify-items:center;background:#05070e8f;color:#f4f0e8;font:500 14px/1.42 Inter,system-ui,sans-serif}
#g3festival .festival-inner{width:min(530px,100%);max-height:85dvh;overflow:auto;touch-action:pan-y;box-sizing:border-box;padding:14px 16px calc(14px + env(safe-area-inset-bottom));border-radius:20px 20px 0 0;background:#171920;box-shadow:0 16px 50px #08090abf}
#g3festival header{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}
#g3festival h2,#g3festival h3,#g3festival p{margin:6px 0}
#g3festival h2{font-size:21px;font-weight:850;line-height:1.16}
#g3festival h3{font-size:17px;font-weight:850;line-height:1.23}
#g3festival button,#g3festival select{font:700 14px/1.22 Inter,system-ui,sans-serif;color:#17121c;background:#ffc679;border:1px solid #ffc679;border-radius:10px;min-height:44px;padding:7px 11px;cursor:pointer}
#g3festival .festival-secondary,#g3festival select{background:#272c37;color:#f4f0e8;border-color:#5a5659}
#g3festival button:focus-visible,#g3festival select:focus-visible{outline:2px solid #fff;outline-offset:2px}
#g3festival #fClose{min-width:44px}
#g3festival label{display:block;margin:8px 0}
#g3festival select{max-width:100%}
#g3festival fieldset{border:1px solid #75684f;border-radius:9px;padding:8px;margin:8px 0}
#g3festival fieldset button{width:100%;margin:3px 0}
.festival-lead,.festival-counter,.festival-landmark{color:#ffd998;font-weight:750}
.festival-act,.festival-poster{background:#20222b;border:1px solid #51433b;border-inline-start:3px solid var(--act,#ffc679);border-radius:11px;padding:11px;margin:8px 0}
.festival-quick{background:#213739;border:1px solid #69988e;border-radius:9px;padding:6px 9px;margin:8px 0;color:#ddf6ef}
.festival-quick summary{cursor:pointer;font-weight:800;padding:4px 0;color:#b8efdd}
.festival-payoff{border-inline-start:2px solid #a6dbb1;padding:4px 8px;color:#d2f3cf}
.festival-dialogue{display:grid;grid-template-columns:minmax(0,auto) minmax(0,1fr);align-items:start;gap:12px;
 background:linear-gradient(134deg,#2e2b38,#23232b 72%);border:1px solid #5a4b50;border-radius:14px;padding:10px;margin:10px 0}
.festival-dialogue .story-portrait{--portrait-size:clamp(80px,24vw,108px)}
.festival-dialogue-copy{align-self:center;min-width:0;overflow-wrap:anywhere}
.festival-dialogue-copy p:first-child{margin-top:0}
.festival-dialogue-copy p:last-child{margin-bottom:0}
.festival-slot{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;padding:8px 9px 10px;min-inline-size:0}
.festival-slot legend{padding:0 5px;color:#ffe0a8;font-size:15px;font-weight:750}
#g3festival .festival-slot button{display:grid;align-content:start;justify-items:center;gap:8px;margin:0;padding:8px 6px 9px;
 background:#312b37;border-color:#a6805e;color:#ffe6bf;overflow-wrap:anywhere}
.festival-slot .story-portrait{--portrait-size:clamp(82px,26vw,122px)}
.festival-lineup{display:flex;align-items:center;gap:10px;--portrait-size:74px;margin:10px 0;color:#ffd998;font-weight:750}
.festival-tip{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(145px,100%),1fr));align-items:stretch;gap:6px;margin:10px 0;overflow:hidden;border-radius:9px}
.festival-tip img,.festival-tip canvas,.festival-poster img{display:block;width:100%;height:auto;min-height:65px;object-fit:cover;border-radius:7px}
.festival-tip figcaption{grid-column:1/-1;color:#d0c9bd;font-size:12px}
.festival-practice{margin:10px 0;color:#ece5db}
.festival-practice summary{cursor:pointer;padding:6px 0;font-weight:700}
.festival-plate,.festival-prizes img{display:block;width:100%;border-radius:8px;aspect-ratio:1.92;object-fit:cover}
#g3festival button:disabled{opacity:.46;cursor:default}
#g3festival.playing{background:linear-gradient(transparent 22%,#08091130 60%,#05070f75)}
#g3festival.playing .festival-inner{background:#171920f5;max-height:58dvh;padding-top:8px}
#g3festival.playing header small{display:block;color:#ffd998}
#fCues,#fPads{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin:6px 0}
#fCues{grid-template-columns:repeat(5,minmax(0,1fr));font:800 15px Inter,sans-serif}
#fCues .festival-cue{position:relative;padding:8px 2px;background:#262b34;border:1px solid #514e58;border-radius:6px;text-align:center;min-width:0}
#fCues .festival-cue>span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#fCues :is(.hold,.release,.hand){font-size:11px}
#fCues .hold,#fPads button.holding{border-color:#9adbbb;color:#d6ffe9}
#fCues .release{border-color:#c9bbfb;color:#eee7ff}
#fCues .hand{border-color:#82c7f3;color:#d9f1ff}
#fPads button.not-in-score{opacity:.38}
.festival-study{padding:8px;border:1px solid #5a5360;border-radius:9px;background:#23252e;margin:8px 0}
.festival-study>div{display:flex;align-items:center;flex-wrap:wrap;gap:4px;margin:4px 0}
.festival-study span{min-width:min(50%,160px);font-size:12px;color:#e6d1aa}
#g3festival .festival-study img{width:100%;border-radius:8px;display:block;margin-top:5px}
.festival-study small{font-size:10px;border:1px solid #575360;border-radius:5px;padding:2px 4px;color:#d9def0}
#fCues .past{opacity:.58}
#fCues .now{background:#3e3132;color:#ffe5ab;border:2px solid #ffc679;padding:7px 1px}
#fCues .now::after{content:"";position:absolute;inset:-1px;border-radius:inherit;box-shadow:0 0 13px #ffc679b0;opacity:var(--beat-glow,.6);will-change:opacity;pointer-events:none}
#fPads button{padding:5px 1px;overflow-wrap:anywhere;color:#fff0ce;border-color:#896e55;background:#342c36;touch-action:none;min-height:49px}
#fPads button:active{background:#ffcf8f;color:#1b151b}
#fPrompt,#fResponse,#fPreview{min-height:21px;color:#ffda98;margin:3px 0;font-weight:700}
#fPreview{color:#c2d9ee;font-size:12px}
.festival-decks{display:flex;gap:20px;justify-content:center}
.festival-decks[hidden]{display:none!important}
.festival-decks>div{width:55px;height:55px;border-radius:50%;border:2px solid #624d46;background:repeating-radial-gradient(circle,#2e3037 0px 3px,#1a1d25 4px 6px);touch-action:none}
.festival-decks>div.active{border-color:#ffc679;box-shadow:0 0 8px #ffc67965}
@media (min-width:600px) and (max-height:470px) and (orientation:landscape){
 #g3festival .festival-inner:has(>.festival-slot){display:grid;width:min(720px,100%);grid-template-columns:1.15fr 1fr;gap:0 12px}
 #g3festival .festival-inner:has(>.festival-slot)>:not(.festival-dialogue,.festival-slot){grid-column:1/-1}
 #g3festival .festival-inner:has(>.festival-slot)>.festival-dialogue{grid-area:2/1;margin-top:0}
 #g3festival .festival-inner:has(>.festival-slot)>.festival-slot{grid-area:2/2;margin-top:0}
}
@media (max-height:470px) and (orientation:landscape){
 #g3festival.playing .festival-inner{max-height:68dvh;display:grid;column-gap:12px;
  grid-template-columns:minmax(0,1.25fr) minmax(176px,1fr);
  grid-template-areas:"header header" "cues pads" "prompt decks" "preview decks" "response response"}
 #g3festival.playing header{grid-area:header}
 #fCues{grid-area:cues;align-self:start}
 #fPads{grid-area:pads;align-self:start}
 #fPrompt{grid-area:prompt}
 #fPreview{grid-area:preview}
 #fResponse{grid-area:response}
 #g3festival.playing .festival-decks{grid-area:decks;align-self:start;gap:10px}
 .festival-decks>div{width:38px;height:38px}
}
#g3hud2 #g3festivalOpen{min-height:37px;color:#ffce95;border-color:#b18056;font:inherit;white-space:nowrap}
#g3hud2 #g3festivalOpen[hidden]{display:none}
body.g3fight #g3festivalOpen{visibility:hidden}
body.festival-playing :is(#g3hud,#g3hud2,#g3act,#g3storyNear,#hint,#ztip,.hud){visibility:hidden;pointer-events:none}
`;
