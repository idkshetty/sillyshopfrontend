// Isolated UI checks. This file never imports the Firebase adapter.
import {mountLabelTemplate} from '../frontend/labels.js';
import {mountContentEditor} from '../frontend/content-editor.js';
import {DEFAULT_CONTENT} from '../frontend/store-content.js';
import {DEFAULT_SETTINGS} from '../frontend/store-settings.js';
import {reviewCards,mountReviewEditor,collectReviews} from '../frontend/review-editor.js';
import {mountSalesDashboard} from '../frontend/sales-dashboard.js';
import {logoutMarkup,mountLogout,animateLogout} from '../frontend/logout.js';
document.querySelector('#fixture-logout').innerHTML=logoutMarkup();
mountLogout();document.querySelector('.logoutButton').onclick=event=>animateLogout(event.currentTarget);
let labels={};
document.addEventListener('click',event=>{const link=event.target.closest('a');if(link?.getAttribute('href')?.startsWith('#')){event.preventDefault();location.hash=link.getAttribute('href');}});
async function render(){
  const root=document.querySelector('#studio-fixture'),page=location.hash.slice(1)||'labels';
  if(page==='privacy')mountContentEditor(root,DEFAULT_CONTENT,{pageOnly:'privacy',settings:()=>DEFAULT_SETTINGS,header:()=>'',onPublish:async()=>{}});
  else if(page==='reviews'){
    root.innerHTML=`<h1>Customer reviews</h1><form id="banner-form">${reviewCards()}<button type="submit" class="button">Save reviews</button><p id="fixture-status" role="status"></p></form>`;
    mountReviewEditor(root);
    root.querySelector('form').onsubmit=event=>{event.preventDefault();try{document.querySelector('#fixture-status').textContent=`${collectReviews(event.target).length} image(s) ready. Nothing was published.`;}catch(error){document.querySelector('#fixture-status').textContent=error.message;}};
  }else if(page==='sales')await mountSalesDashboard(root,{load:async()=>[
    {verified:true,mode:'test',currency:'INR',amount:240000,refundedAmount:0,paidAt:Date.now(),items:[{productId:'sample',title:'Sample painting',quantity:1}]},
    {verified:true,mode:'test',currency:'INR',amount:120000,refundedAmount:20000,paidAt:Date.now()-86400000,items:[{productId:'sample-rock',title:'Sample painted rock',quantity:2}]}
  ]});
  else await mountLabelTemplate(root,{load:async()=>labels,save:async value=>{labels=value;}});
}
window.addEventListener('hashchange',render);render();
