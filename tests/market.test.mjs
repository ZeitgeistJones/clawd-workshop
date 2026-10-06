import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import { TOPICS, tokenAmount, selectPair, swapSpec, decodeBuy, decodeBurn, MarketClient } from '../src/market.js';
const config={...CONFIG.market};
const word=n=>(n<0n?(1n<<256n)+n:n).toString(16).padStart(64,'0');
const addr=a=>'0x'+a.slice(2).padStart(64,'0');
const hash='0x'+'a'.repeat(64), quote='0x4200000000000000000000000000000000000006';
const pair={chainId:'base',dexId:'uniswap',pairAddress:'0x'+'b'.repeat(64),baseToken:{address:config.token},quoteToken:{address:quote},priceUsd:'0.0001',liquidity:{usd:1000}};
const swap=(version='v4', amount=20000000n*10n**18n)=>({address:version==='v4'?config.v4Manager:'0x'+'c'.repeat(40),topics:[TOPICS[version],pair.pairAddress,addr(quote)],data:'0x'+[version==='v4'?-1n:1n,version==='v4'?amount:-amount,0n,0n,0n,0n].map(word).join(''),transactionHash:hash,logIndex:'0x1',blockNumber:'0x64'});
const burn=(to=config.burnAddresses[0],amount=2000000n*10n**18n)=>({address:config.token,topics:[TOPICS.transfer,addr(quote),addr(to)],data:'0x'+word(amount),transactionHash:hash,logIndex:'0x2',blockNumber:'0x64'});
test('quote selection rejects same-symbol impostors, wrong chains, missing prices, and honors a pinned pair',()=>{
 const selected=selectPair([{...pair,chainId:'ethereum',liquidity:{usd:1000000}},{...pair,baseToken:{address:quote},liquidity:{usd:1000000}},pair],config,1000);
 assert.equal(selected.pairAddress,pair.pairAddress);assert.equal(selected.at,1000);
 assert.throws(()=>selectPair([{...pair,priceUsd:null}],config));
 assert.throws(()=>selectPair([pair],{...config,pairAddress:'0x'+'d'.repeat(64)}));
 assert.ok(Math.abs(tokenAmount(1234567890000000000n)-1.23456789)<1e-12);
});
test('V3 and V4 swaps use opposite sign conventions and never infer buys from ordinary transfers',()=>{
 const price={price:.0001,at:1000};
 const v4=swapSpec(pair,config);assert.equal(v4.tokenIndex,1);
 assert.equal(decodeBuy(swap(),v4,config,price,1000).usd,2000);
 assert.equal(decodeBuy(swap('v4',-20000000n*10n**18n),v4,config,price,1000),null);
 const v3={version:'v3',address:'0x'+'c'.repeat(40),tokenIndex:1};
 assert.equal(decodeBuy(swap('v3'),v3,config,price,1000).kind,'buy');
 assert.equal(decodeBuy(burn(),v4,config,price,1000),null);
 assert.equal(decodeBuy({...swap(),removed:true},v4,config,price,1000),null);
 assert.equal(decodeBuy({...swap(),topics:[TOPICS.v4,'0x'+'d'.repeat(64)]},v4,config,price,1000),null);
 assert.equal(decodeBuy(swap(),v4,config,price,100000),null);
 assert.equal(decodeBuy(swap(),v4,config,{price:NaN,at:1000},1000),null);
 assert.equal(decodeBuy(swap('v4',1n),v4,config,price,1000),null);
});
test('burns and dead-address transfers stay distinct, reject mints and unrelated transfers',()=>{
 assert.equal(decodeBurn(burn(),config).label,'Token burn');
 assert.equal(decodeBurn(burn(config.burnAddresses[1]),config).label,'Burn-address transfer');
 assert.equal(decodeBurn(burn(quote),config),null);
 assert.equal(decodeBurn(burn(config.burnAddresses[0],1n),config),null);
 assert.equal(decodeBurn({...burn(),topics:[TOPICS.transfer,addr(config.burnAddresses[0]),addr(config.burnAddresses[1])]},config),null);
 assert.equal(decodeBurn({...burn(),removed:true},config),null);
 assert.equal(decodeBurn({...burn(),data:'not hex'},config),null);
 assert.equal(decodeBurn({...burn(),address:quote},config),null);
});
test('watcher establishes a baseline, retries without moving its cursor, and deduplicates logs',async()=>{
 const client=new MarketClient(config);client.price={...pair,price:.0001,at:Date.now()};
 let head=100n,fail=false,queries=[];
 client.rpc=async(method,params)=>{
  if(method==='eth_chainId')return config.chainHex;
  if(method==='eth_call')return '0x12';
  if(method==='eth_blockNumber')return '0x'+head.toString(16);
  if(method==='eth_getLogs'){queries.push(params[0]);if(fail)throw new Error('Offline');return [{...burn(),blockNumber:'0x5a'},{...burn(),blockNumber:'0x5a'}];}
 };
 assert.equal((await client.watch()).events.length,0);assert.equal(queries.length,0);assert.equal(client.cursor,88n);
 head=110n;fail=true;await assert.rejects(client.watch());assert.equal(client.cursor,88n);
 fail=false;assert.equal((await client.watch()).events.length,1);assert.equal(client.cursor,98n);
 head=120n;assert.equal((await client.watch()).events.length,0);
 assert.ok(queries.every(q=>BigInt(q.toBlock)-BigInt(q.fromBlock)<10n));
});
test('wrong RPC chains and token decimals stop the watcher',async()=>{
 const client=new MarketClient(config);client.rpc=async()=> '0x1';
 await assert.rejects(client.watch(),/chain does not match/);
 client.rpc=async m=>m==='eth_chainId'?config.chainHex:'0x6';
 await assert.rejects(client.watch(),/decimals/);
});
