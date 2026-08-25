from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


root = Path("public/captains-log-dashboard")
phase1_path = root / "dashboard-signal-map-phase1.js"
phase1 = phase1_path.read_text(encoding="utf-8")

phase1 = replace_once(
    phase1,
    "  const flowTrack=document.querySelector('.map-flow-track');\n",
    """  const flowTrack=document.querySelector('.map-flow-track');
  const qualifiedStage=stages.find(stage=>stage.dataset.stageIndex==='2')||null;
  const replyLaneSourceIds=new Set(['facebook_groups','reddit_groups','linkedin_groups']);
  const laneFormatter=new Intl.NumberFormat(undefined,{notation:'compact',maximumFractionDigits:1});
  let latestMap=null;

  function numeric(value){
    const count=Number(value);
    return value!==null&&value!==undefined&&Number.isFinite(count)&&count>=0?count:null;
  }

  function formatLaneCount(value){
    const count=numeric(value);
    return count===null?'—':laneFormatter.format(count);
  }

  function ensureQualifiedSplit(){
    if(!qualifiedStage)return null;
    let split=qualifiedStage.querySelector('.map-qualified-split');
    if(split)return split;
    split=document.createElement('div');
    split.className='map-qualified-split';
    split.setAttribute('aria-label','Qualified outcome lanes');
    split.innerHTML='<span class="buyer"><small>BUYER</small><b data-qualified-buyer>—</b></span><span class="reply"><small>REPLY</small><b data-qualified-reply>—</b></span>';
    const caption=qualifiedStage.querySelector('.map-stage-caption');
    qualifiedStage.insertBefore(split,caption||null);
    return split;
  }
""",
    "phase1 lane helpers",
)

phase1 = replace_once(
    phase1,
    """    const producing=document.createElement('span');
    producing.innerHTML='<b data-phase1-producing-sources>—</b><span>producing sources</span>';
    outcomeFacts.append(active,producing);
""",
    """    const producing=document.createElement('span');
    producing.innerHTML='<b data-phase1-producing-sources>—</b><span>producing sources</span>';
    const buyer=document.createElement('span');
    buyer.className='network-lane-fact buyer';
    buyer.innerHTML='<span>BUYER</span><b data-phase1-buyer-opportunities>—</b>';
    const reply=document.createElement('span');
    reply.className='network-lane-fact reply';
    reply.innerHTML='<span>REPLY</span><b data-phase1-reply-opportunities>—</b>';
    outcomeFacts.append(active,producing,buyer,reply);
""",
    "network lane facts",
)

phase1 = replace_once(
    phase1,
    "  if(flowTrack)flowTrack.setAttribute('aria-label','Scanned, cleared, qualified, and working now');",
    "  if(flowTrack)flowTrack.setAttribute('aria-label','Scanned, cleared, qualified into Buyer and Reply lanes, and working now');",
    "route aria label",
)

selected_source = """  function selectedSourceId(){
    return window.SignalMapView?.getState?.().selectedSourceId || document.querySelector('[data-source-id][aria-pressed=\"true\"]')?.dataset.sourceId || null;
  }
"""
selected_source_plus = selected_source + """
  function selectedSource(map=latestMap){
    const id=selectedSourceId();
    return map?.sources?.find(source=>source?.id===id)||null;
  }

  function laneCounts(map=latestMap){
    const source=selectedSource(map);
    if(!source){
      return {
        buyer:numeric(map?.opportunities?.total),
        reply:numeric(map?.reply_opportunities?.total)
      };
    }
    if(source.id==='company_page_engagement'){
      return {buyer:0,reply:numeric(source.surfaced??source.buyer_opportunities)};
    }
    if(replyLaneSourceIds.has(source.id)){
      return {
        buyer:numeric(source.buyer_opportunities),
        reply:numeric(source.reply_opportunities)
      };
    }
    return {buyer:numeric(source.buyer_opportunities??source.surfaced),reply:0};
  }

  function renderQualifiedLanes(){
    const split=ensureQualifiedSplit();
    if(!split)return;
    const lanes=laneCounts();
    const buyerNode=split.querySelector('[data-qualified-buyer]');
    const replyNode=split.querySelector('[data-qualified-reply]');
    if(buyerNode)buyerNode.textContent=formatLaneCount(lanes.buyer);
    if(replyNode)replyNode.textContent=formatLaneCount(lanes.reply);
    const qualifiedValue=qualifiedStage?.querySelector('[data-stage-value]');
    if(qualifiedValue&&lanes.buyer!==null&&lanes.reply!==null){
      qualifiedValue.textContent=formatLaneCount(lanes.buyer+lanes.reply);
    }
    const buyerText=lanes.buyer===null?'unknown':formatLaneCount(lanes.buyer);
    const replyText=lanes.reply===null?'unknown':formatLaneCount(lanes.reply);
    split.setAttribute('aria-label',`Qualified outcomes: ${buyerText} Buyer, ${replyText} Reply`);
  }
"""
phase1 = replace_once(phase1, selected_source, selected_source_plus, "selected source lane functions")

phase1 = replace_once(
    phase1,
    """      caption.textContent=captions[index]||presentation.caption;
    });
  }
""",
    """      caption.textContent=captions[index]||presentation.caption;
    });
    renderQualifiedLanes();
  }
""",
    "route presentation lane render",
)

phase1 = replace_once(
    phase1,
    """  function renderNetworkOverview(map){
    if(!map||!Array.isArray(map.sources))return;
    const available=map.sources.filter(source=>source?.availability==='available').length;
    const producing=Number(map?.outcomes?.producing_sources ?? map?.opportunities?.producing_sources);
    const activeNode=document.querySelector('[data-phase1-active-sources]');
    const countNode=document.querySelector('[data-phase1-source-count]');
    const producingNode=document.querySelector('[data-phase1-producing-sources]');
    if(activeNode)activeNode.textContent=String(available);
    if(countNode)countNode.textContent=String(map.sources.length);
    if(producingNode)producingNode.textContent=Number.isFinite(producing)?String(producing):'—';
  }
""",
    """  function renderNetworkOverview(map){
    if(!map||!Array.isArray(map.sources))return;
    latestMap=map;
    const available=map.sources.filter(source=>source?.availability==='available').length;
    const producing=Number(map?.outcomes?.producing_sources ?? map?.opportunities?.producing_sources);
    const activeNode=document.querySelector('[data-phase1-active-sources]');
    const countNode=document.querySelector('[data-phase1-source-count]');
    const producingNode=document.querySelector('[data-phase1-producing-sources]');
    const buyerNode=document.querySelector('[data-phase1-buyer-opportunities]');
    const replyNode=document.querySelector('[data-phase1-reply-opportunities]');
    if(activeNode)activeNode.textContent=String(available);
    if(countNode)countNode.textContent=String(map.sources.length);
    if(producingNode)producingNode.textContent=Number.isFinite(producing)?String(producing):'—';
    if(buyerNode)buyerNode.textContent=formatLaneCount(map?.opportunities?.total);
    if(replyNode)replyNode.textContent=formatLaneCount(map?.reply_opportunities?.total);
  }
""",
    "network lane count render",
)

phase1_path.write_text(phase1, encoding="utf-8")

lanes_css = """/* Signal Intelligence Map — compact Buyer / Reply lane split */
.map-qualified-split {
  display: flex;
  gap: 4px;
  justify-content: center;
  min-height: 18px;
  margin-top: 6px;
  white-space: nowrap;
}

.map-qualified-split > span {
  display: inline-flex;
  gap: 3px;
  align-items: baseline;
  padding: 2px 5px;
  border: 1px solid rgba(116, 161, 196, .32);
  border-radius: 999px;
  background: rgba(8, 27, 39, .86);
  box-shadow: inset 0 0 10px rgba(111, 176, 218, .035);
}

.map-qualified-split small {
  color: #88aabc;
  font-size: 6px;
  font-weight: 900;
  letter-spacing: .10em;
  line-height: 1;
}

.map-qualified-split b {
  margin: 0;
  color: #dff8ff;
  font-size: 8px;
  font-weight: 900;
  letter-spacing: 0;
  line-height: 1;
}

.map-qualified-split .buyer {
  border-color: rgba(91, 218, 194, .38);
}
.map-qualified-split .buyer small,
.map-qualified-split .buyer b { color: #72dfca; }

.map-qualified-split .reply {
  border-color: rgba(177, 145, 243, .40);
}
.map-qualified-split .reply small,
.map-qualified-split .reply b { color: #c4a9fb; }

.map-outcome-facts .network-lane-fact {
  gap: 5px;
  padding: 2px 6px;
  border: 1px solid rgba(97, 146, 175, .24);
  border-radius: 999px;
  background: rgba(8, 28, 39, .55);
  font-weight: 850;
  letter-spacing: .08em;
}

.map-outcome-facts .network-lane-fact.buyer b { color: #72dfca; }
.map-outcome-facts .network-lane-fact.reply b { color: #c4a9fb; }

@media (max-width: 900px) {
  .map-outcome-facts {
    grid-template-columns: repeat(2, max-content);
    justify-content: start;
    justify-items: start;
  }
}

@media (max-width: 620px) {
  .map-qualified-split {
    gap: 3px;
    margin-top: 5px;
  }
  .map-qualified-split > span { gap: 2px; padding: 2px 4px; }
  .map-qualified-split small { font-size: 5.5px; letter-spacing: .07em; }
  .map-qualified-split b { font-size: 7px; }
  .map-outcome-facts .network-lane-fact { padding: 2px 5px; }
}
"""
(root / "dashboard-signal-lanes.css").write_text(lanes_css, encoding="utf-8")

index_path = root / "index.html"
index = index_path.read_text(encoding="utf-8")
if "dashboard-signal-lanes.css" not in index:
    index = replace_once(
        index,
        '<link href="./dashboard-signal-map-phase2.css?v=1.2.80" rel="stylesheet"/>',
        '<link href="./dashboard-signal-map-phase2.css?v=1.2.86" rel="stylesheet"/>\n<link href="./dashboard-signal-lanes.css?v=1.2.86" rel="stylesheet"/>',
        "lane css include",
    )
index = index.replace("v=1.2.80", "v=1.2.86")
index = index.replace('data-dashboard-version="1.2.80"', 'data-dashboard-version="1.2.86"')
index = index.replace('SIGNAL INTELLIGENCE <b>v1.2.80</b> · 2026-08-23', 'SIGNAL INTELLIGENCE <b>v1.2.86</b> · 2026-08-25')
index_path.write_text(index, encoding="utf-8")

phase2_path = root / "dashboard-signal-map-phase2.js"
phase2 = phase2_path.read_text(encoding="utf-8")
phase2 = phase2.replace("1.2.85", "1.2.86")
phase2_path.write_text(phase2, encoding="utf-8")

version_path = root / "version.json"
version_path.write_text("""{
  \"name\": \"Signal Intelligence Dashboard\",
  \"version\": \"1.2.86\",
  \"released_at\": \"2026-08-25T07:26:00-05:00\",
  \"release\": \"buyer-reply-route-split\"
}
""", encoding="utf-8")

route_test = Path("tests/signal-route-dynamic-spine.test.mjs")
route_text = route_test.read_text(encoding="utf-8")
route_text = replace_once(route_text, "assert.equal(version.version, '1.2.85');", "assert.equal(version.version, '1.2.86');", "route version assertion")
route_text = replace_once(route_text, "assert.equal(version.release, 'signal-route-dynamic-spine');", "assert.equal(version.release, 'buyer-reply-route-split');", "route release assertion")
route_test.write_text(route_text, encoding="utf-8")

lane_test = Path("tests/signal-map-buyer-reply-lanes.test.mjs")
lane_test.write_text("""import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const js = fs.readFileSync('public/captains-log-dashboard/dashboard-signal-map-phase1.js', 'utf8');
const css = fs.readFileSync('public/captains-log-dashboard/dashboard-signal-lanes.css', 'utf8');
const html = fs.readFileSync('public/captains-log-dashboard/index.html', 'utf8');
const version = JSON.parse(fs.readFileSync('public/captains-log-dashboard/version.json', 'utf8'));

test('Qualified waypoint splits compactly into Buyer and Reply lanes', () => {
  assert.match(js, /data-qualified-buyer/);
  assert.match(js, /data-qualified-reply/);
  assert.match(js, /source\.buyer_opportunities/);
  assert.match(js, /source\.reply_opportunities/);
  assert.match(js, /qualifiedValue\.textContent=formatLaneCount\(lanes\.buyer\+lanes\.reply\)/);
  assert.match(js, /Qualified outcomes:/);
});

test('All Sources keeps Buyer and Reply totals separate', () => {
  assert.match(js, /map\?\.opportunities\?\.total/);
  assert.match(js, /map\?\.reply_opportunities\?\.total/);
  assert.match(js, /data-phase1-buyer-opportunities/);
  assert.match(js, /data-phase1-reply-opportunities/);
});

test('compact lane UI is mobile-safe and cache-busted', () => {
  assert.match(css, /\.map-qualified-split/);
  assert.match(css, /@media \(max-width: 620px\)/);
  assert.match(html, /dashboard-signal-lanes\.css\?v=1\.2\.86/);
  assert.match(html, /dashboard-signal-map-phase1\.js\?v=1\.2\.86/);
  assert.match(html, /dashboard-signal-map-phase2\.js\?v=1\.2\.86/);
  assert.equal(version.version, '1.2.86');
  assert.equal(version.release, 'buyer-reply-route-split');
});
""", encoding="utf-8")
