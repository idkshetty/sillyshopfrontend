import {mountContentEditor} from '../frontend/content-editor.js';
import {DEFAULT_CONTENT} from '../frontend/store-content.js';
import {DEFAULT_SETTINGS} from '../frontend/store-settings.js';
import {logoutMarkup,mountLogout,animateLogout} from '../frontend/logout.js';
import {encodeImage} from '../frontend/image-data.js';
document.querySelector('#fixture-logout').innerHTML=logoutMarkup();mountLogout();
document.querySelector('.logoutButton').addEventListener('click',event=>animateLogout(event.currentTarget));
mountContentEditor(document.querySelector('#content-fixture'),DEFAULT_CONTENT,{
  settings:()=>DEFAULT_SETTINGS,header:()=>document.querySelector('header').outerHTML,
  onPublish:async()=>{if(document.querySelector('#fail-publish').checked)throw new Error('Simulated connection error. Your draft has been kept.');},
  onUpload:encodeImage
});
