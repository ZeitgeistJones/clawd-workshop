import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {CONFIG} from '../src/config.js';
import {buildBrief} from '../src/builds.js';
import {safeGithubUrl,timeAgo} from '../src/activity.js';
import {STATIONS} from '../src/music.js';
class Element{
 constructor(){this.textContent='';this.children=[];this.dataset={};this.attributes={};this.handlers={};this.classes=new Set();this.classList={contains:k=>this.classes.has(k),toggle:(k,v)=>{const enabled=v??!this.classes.has(k);enabled?this.classes.add(k):this.classes.delete(k);return enabled;}};}
 setAttribute(k,v){this.attributes[k]=v}append(...n){this.children.push(...n)}replaceChildren(...n){this.children=n}addEventListener(k,v){this.handlers[k]=v}
}
async function harness(){
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 const source=(await readFile(new URL('../src/lounge.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'');
 const elements=Object.fromEntries([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],new Element()]));
 elements['radio-station'].value='0';elements['radio-volume'].value='35';
 const windowHandlers={},docHandlers={};const document={hidden:false,getElementById:id=>{assert.ok(elements[id],id);return elements[id]},querySelector:()=>elements['radio-title'],createElement:()=>new Element(),addEventListener:(k,v)=>docHandlers[k]=v};
 let marketCalls=0,audioStarts=0,quotes=[];
 class Client{
  constructor(){this.price=null}dispose(){}quote(){marketCalls++;return new Promise(resolve=>quotes.push(q=>{this.price=q;resolve(q)}))}async watch(){marketCalls++;return{events:[],note:'Watching'}}
 }
 class Radio{constructor(){this.station=0;this.playing=false}async play(station=this.station){audioStarts++;this.station=station;this.playing=true}async stop(){this.playing=false}setVolume(v){this.volume=v}}
 vm.runInNewContext(source,{CONFIG,buildBrief,safeGithubUrl,timeAgo,STATIONS,MarketClient:Client,LofiRadio:Radio,document,window:{addEventListener:(k,v)=>windowHandlers[k]=v},Date,Intl,Number,Map,Set,encodeURIComponent,setTimeout:()=>1,clearTimeout:()=>{},console});
 const fixture={demo:true,mode:'current',status:{repo:'clawdbotatg/test-wallet'},metadata:{description:'A small wallet.',language:'JavaScript'},events:[],allEvents:[],repos:[],data:{},client:{details:async()=>({metadata:{description:'A fetched wallet.'},commits:[]})}};
 const emit=async(detail={})=>{windowHandlers['workshop:render']({detail:{...fixture,...detail}});await new Promise(setImmediate)};
 return{elements,document,docHandlers,emit,marketCalls:()=>marketCalls,audioStarts:()=>audioStarts,quotes};
}
test('lounge demo makes no market requests, music is opt-in, and buy/burn previews react independently',async()=>{
 const h=await harness(),e=h.elements;await h.emit();
 assert.equal(h.marketCalls(),0);assert.equal(h.audioStarts(),0);assert.match(e['market-status'].textContent,/DEMO/);assert.equal(e['brief-description'].textContent,'A small wallet.');
 e['demo-buy'].handlers.click();assert.equal(e.scene.dataset.marketEffect,'buy');assert.match(e['scene-event-title'].textContent,/DEMO/);
 e['demo-burn'].handlers.click();assert.equal(e.scene.dataset.marketEffect,'burn');
 await e['radio-play'].handlers.click();assert.equal(h.audioStarts(),1);assert.equal(e['radio-play'].attributes['aria-pressed'],'true');
 await e['radio-play'].handlers.click();assert.equal(e['radio-play'].attributes['aria-pressed'],'false');
});
test('historical replay and paused animations suppress current market effects',async()=>{
 const h=await harness(),e=h.elements;await h.emit({mode:'replay'});
 e['demo-buy'].handlers.click();assert.equal(e['market-events'].children.length,1);assert.equal(e.scene.dataset.marketEffect,undefined);
 await h.emit();e.scene.classes.add('paused');e['demo-burn'].handlers.click();assert.equal(e.scene.dataset.marketEffect,undefined);
 e.scene.classes.delete('paused');e['market-effects'].handlers.change({target:{checked:false}});e['demo-buy'].handlers.click();assert.equal(e.scene.dataset.marketEffect,undefined);
});
test('late real quotes cannot overwrite the demo after a mode switch',async()=>{
 const h=await harness();await h.emit({demo:false});assert.equal(h.marketCalls(),1);
 await h.emit({demo:true});h.quotes[0]({price:1,at:Date.now(),pairAddress:'0x123',priceChange:{h24:99}});await new Promise(setImmediate);
 assert.match(h.elements['market-status'].textContent,/DEMO/);assert.equal(h.elements['market-price'].textContent,'$0.000042');
});
