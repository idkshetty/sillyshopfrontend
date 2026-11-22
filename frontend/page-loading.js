import {pageSkeleton} from './skeletons.js';

// Render immediately when data is ready instead of holding on a skeleton.
export const MIN_PAGE_LOADING_MS=0;
const main=document.getElementById('main');
let activeRoute='',readyAt=0,renderTimer;
function beginPageLoading(){
  if(location.hash==='#main')return;
  const nextRoute=location.hash.slice(1)||'home';
  if(nextRoute===activeRoute)return;
  const prevSection=activeRoute.split('/')[0];
  const nextSection=nextRoute.split('/')[0];
  activeRoute=nextRoute;
  if(prevSection==='admin'&&nextSection==='admin'&&main.querySelector('.admin-layout')){
    clearTimeout(renderTimer);
    readyAt=0;
    main.removeAttribute('aria-busy');
    return;
  }
  if(main.dataset.smoothNav===nextSection){
    clearTimeout(renderTimer);
    readyAt=0;
    main.removeAttribute('aria-busy');
    return;
  }
  readyAt=performance.now()+MIN_PAGE_LOADING_MS;
  clearTimeout(renderTimer);
  main.setAttribute('aria-busy','true');
  main.innerHTML=pageSkeleton(nextSection);
}

// Repeated data callbacks share the same deadline instead of extending it.
export function deferPageRender(render){
  beginPageLoading();
  const remaining=readyAt-performance.now();
  clearTimeout(renderTimer);
  if(remaining<=0){main.removeAttribute('aria-busy');return false;}
  renderTimer=setTimeout(render,remaining);
  return true;
}

beginPageLoading();
window.addEventListener('hashchange',beginPageLoading);
document.getElementById('shop-app').addEventListener('error',()=>{
  if(!main.hasAttribute('data-loading'))return;
  clearTimeout(renderTimer);
  main.removeAttribute('data-loading');
  main.removeAttribute('aria-busy');
  main.innerHTML='<div class="container empty-state" role="alert"><h1>The page could not load</h1><p>Check your connection and reload to try again.</p><a class="button" href="">Reload page</a></div>';
});
