const PROD_BACKEND_URL='https://sillyshopbackend.idkshetty26.workers.dev';

function resolveBackendBase(){
  const override=window?.__HEHE_BACKEND_URL__;
  if(override)return String(override).replace(/\/+$/,'');
  const host=String(location.hostname||'').toLowerCase();
  if(host==='localhost'||host==='127.0.0.1'||host==='[::1]'||host==='::1'){
    return '';
  }
  return PROD_BACKEND_URL;
}

function escapeHtml(value){
  return String(value??'').replace(/[&<>"']/g,ch=>({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    '"':'&quot;',
    "'":'&#39;'
  }[ch]));
}

function formatTime(iso){
  if(!iso)return '—';
  const d=new Date(iso);
  if(Number.isNaN(d.getTime()))return String(iso);
  return d.toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'medium'});
}

function labelForStatus(status){
  if(status==='operational')return 'All Systems Operational';
  if(status==='degraded')return 'Partial Degraded Performance';
  return 'Service Disruption Detected';
}

function heroClassForStatus(status){
  if(status==='operational')return 'is-operational';
  if(status==='degraded')return 'is-degraded';
  return 'is-down';
}

function serviceBadgeLabel(status){
  if(status==='operational')return 'Operational';
  if(status==='degraded')return 'Degraded';
  return 'Down';
}

function renderPayload(payload){
  const hero=document.getElementById('status-hero');
  const headline=document.getElementById('status-headline');
  const subline=document.getElementById('status-subline');
  const pill90=document.getElementById('status-90d');
  const checkedEl=document.getElementById('status-checked-at');
  const barsEl=document.getElementById('uptime-bars');
  const summaryEl=document.getElementById('services-summary');
  const servicesEl=document.getElementById('services-list');
  const incidentsEl=document.getElementById('incidents-list');

  const status=payload?.status||'major_outage';
  hero.className=`hero-card ${heroClassForStatus(status)}`;
  headline.textContent=labelForStatus(status);
  const s=payload?.summary||{};
  subline.textContent=`${s.operationalCount||0} of ${s.totalServices||0} critical subsystems healthy · Runtime: ${payload?.runtime||'API'}`;
  pill90.textContent=`90d uptime: ${Number(payload?.overall90dUptime??100).toFixed(2)}%`;
  checkedEl.textContent=`Last checked: ${formatTime(payload?.checkedAt)}`;
  summaryEl.textContent=`${s.operationalCount||0} operational · ${s.degradedCount||0} degraded · ${s.downCount||0} down`;

  const days=Array.isArray(payload?.uptimeDays)?payload.uptimeDays:[];
  barsEl.innerHTML=days.map(day=>{
    const tip=day.uptimePct===null
      ?`${day.date}: No samples recorded`
      :`${day.date}: ${day.uptimePct}% uptime (${day.checks} checks)`;
    return `<div class="history-bar is-${escapeHtml(day.status||'no_data')}" role="listitem" title="${escapeHtml(tip)}" aria-label="${escapeHtml(tip)}"></div>`;
  }).join('');

  const services=Array.isArray(payload?.services)?payload.services:[];
  servicesEl.innerHTML=services.map(svc=>`
    <article class="service-row">
      <div>
        <div class="service-name">${escapeHtml(svc.name)}</div>
        <div class="service-desc">${escapeHtml(svc.description||'')}</div>
        <div class="service-detail">${escapeHtml(svc.detail||'Healthy')}</div>
      </div>
      <div class="service-meta">
        <span class="latency-tag">${Number(svc.latencyMs||0)} ms</span>
        <span class="state-badge is-${escapeHtml(svc.status||'down')}">${escapeHtml(serviceBadgeLabel(svc.status))}</span>
      </div>
    </article>
  `).join('');

  const incidents=Array.isArray(payload?.incidents)?payload.incidents:[];
  if(!incidents.length){
    incidentsEl.innerHTML='<p class="empty-msg">No incidents recorded in the last 90 days.</p>';
  }else{
    incidentsEl.innerHTML=incidents.map(inc=>{
      const resolvedText=inc.resolvedAt?`Resolved ${formatTime(inc.resolvedAt)}`:'Ongoing investigation';
      const badgeClass=inc.resolvedAt?'is-operational':(inc.status==='major_outage'?'is-down':'is-degraded');
      return `
        <article class="incident-item">
          <div class="incident-top">
            <span class="incident-title">${escapeHtml(inc.title||'Service event')}</span>
            <span class="state-badge ${badgeClass}">${escapeHtml(resolvedText)}</span>
          </div>
          <p class="incident-detail">${escapeHtml(inc.detail||'')}</p>
          <div class="incident-time">Started: ${escapeHtml(formatTime(inc.startedAt))}</div>
        </article>
      `;
    }).join('');
  }
}

function renderReachabilityFailure(message){
  const hero=document.getElementById('status-hero');
  const headline=document.getElementById('status-headline');
  const subline=document.getElementById('status-subline');
  const servicesEl=document.getElementById('services-list');
  const incidentsEl=document.getElementById('incidents-list');
  hero.className='hero-card is-down';
  headline.textContent='API Gateway Unreachable';
  subline.textContent=`Live health probe could not reach the backend API (${message}).`;
  servicesEl.innerHTML=`
    <article class="service-row">
      <div>
        <div class="service-name">Core API Gateway</div>
        <div class="service-desc">Direct probe from browser to /health/deep</div>
        <div class="service-detail">${escapeHtml(message)}</div>
      </div>
      <div class="service-meta">
        <span class="state-badge is-down">Down</span>
      </div>
    </article>
  `;
  incidentsEl.innerHTML='<p class="empty-msg">Live status endpoint is currently unreachable.</p>';
}

async function fetchStatus({forceFresh=false}={}){
  const btn=document.getElementById('status-refresh');
  const note=document.getElementById('status-endpoint-note');
  const base=resolveBackendBase();
  const endpoint=`${base}/health/deep${forceFresh?'?refresh=1':''}`;
  if(note)note.textContent=`Endpoint: ${endpoint}`;
  if(btn)btn.disabled=true;
  try{
    const controller=typeof AbortController==='function'?new AbortController():null;
    const timer=controller?setTimeout(()=>controller.abort(),9000):null;
    const res=await fetch(endpoint,{
      cache:'no-store',
      signal:controller?controller.signal:undefined
    });
    if(timer)clearTimeout(timer);
    if(!res.ok)throw new Error(`HTTP ${res.status}`);
    const payload=await res.json();
    renderPayload(payload);
  }catch(err){
    renderReachabilityFailure(err?.message||'Connection failed');
  }finally{
    if(btn)btn.disabled=false;
  }
}

document.getElementById('status-refresh')?.addEventListener('click',()=>{
  fetchStatus({forceFresh:true});
});

fetchStatus();
setInterval(()=>fetchStatus(),60_000);
