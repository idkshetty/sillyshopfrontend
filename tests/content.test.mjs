import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_CONTENT,normalizeContent,validateContent,safeContentLink,contentCategories,footerMarkup,applyStoreContent,CONTENT_SCHEMA} from '../frontend/store-content.js';
import {parseHTML} from 'linkedom';
 test('content schema accepts full defaults and rejects unsafe or oversized drafts',()=>{
  assert.equal(validateContent(DEFAULT_CONTENT),'');
  for(const value of ['javascript:alert(1)','data:text/html,test','//example.com'])assert.equal(safeContentLink(value),false);
  assert.equal(safeContentLink('#artists'),true);
  assert.equal(safeContentLink('#artist/suprita-chatterjee'),true);
 const c=structuredClone(DEFAULT_CONTENT);c.footer.link1Url='javascript:alert(1)';assert.match(validateContent(c),/destination/);
 c.footer.link1Url='#shop';c.home.heading='a'.repeat(121);assert.match(validateContent(c),/heading/);
});
test('normalization fills partial documents, limits schema and escapes markup',()=>{
 const c=normalizeContent({brand:{name:'<script>alert(1)</script>',logo:'javascript:alert(1)'},home:{heading:'New studio'},sections:{footer:false},unknown:{admin:true}});
 assert.equal(c.brand.logo,DEFAULT_CONTENT.brand.logo);assert.equal(c.home.heading,'New studio');assert.equal(c.sections.footer,false);assert.equal(c.unknown,undefined);
 assert(!footerMarkup(c).includes('<script>'));assert(footerMarkup(c).includes('&lt;script&gt;'));
 assert.equal(contentCategories(c)[1].id,'clay-models');assert.equal(contentCategories(c).length,4);
});
test('unused dropdown label removed and story button label preserves arrow',()=>{
 assert.equal(CONTENT_SCHEMA.navigation.fields.collections,undefined);
 assert.equal(CONTENT_SCHEMA.collections.fields.paintingsName,undefined);
 const dom=parseHTML('<html><body><div class="story-copy"><a href="#shop"><span class="story-cta-label">Explore all artworks</span> <span>→</span></a></div></body></html>');
 const c=normalizeContent({...DEFAULT_CONTENT,story:{button:'Browse clay art'}});
 applyStoreContent(c,'home',dom.document);
 assert.equal(dom.document.querySelector('.story-cta-label').textContent,'Browse clay art');
 assert.match(dom.document.querySelector('.story-copy>a').textContent,/Browse clay art →/);
});
