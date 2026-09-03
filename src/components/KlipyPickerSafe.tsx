import { useEffect, useMemo, useState } from "react";
import { Link2, Search, Send, X } from "lucide-react";
import { savedMedia, sendMedia, sendMediaLink, sendSavedMedia } from "../api";
import type { SavedMedia } from "../types";

type Kind = "GIF" | "STICKER";
type Tab = Kind | "LINKS";
type DirectKind = "AUTO" | "GIF" | "IMAGE" | "VIDEO";
type Item = { id:string; title?:string; media_formats?:Record<string,{url?:string;preview?:string;dims?:number[]}> };

const KEY=import.meta.env.VITE_KLIPY_API_KEY as string|undefined;
const BASE="https://api.klipy.com";
const STARTER_GIF="https://static.klipy.com/ii/d6b0ce929193df3c242ac34b5654d2ce/d8/71/iaYWp9nI.gif";

function pick(item:Item,kind:Kind){
 const f=item.media_formats||{}; const names=kind==="STICKER"?["webp","tinywebp","gif","tinygif"]:["gif","mediumgif","tinygif","webp"];
 for(const n of names) if(f[n]?.url) return {url:f[n]!.url!,preview:f[n]!.preview||f[n]!.url!,dims:f[n]!.dims||[]};
 return null;
}
function detect(url:string):DirectKind{
 const e=url.split("?")[0].split("#")[0].toLowerCase().split(".").pop()||"";
 if(e==="gif") return "GIF";
 if(["jpg","jpeg","png","webp","bmp","avif","svg"].includes(e)) return "IMAGE";
 if(["mp4","webm","mov","m4v","ogv"].includes(e)) return "VIDEO";
 return "AUTO";
}
function kindOf(item:SavedMedia):"GIF"|"IMAGE"|"VIDEO"{
 if(item.kind==="VIDEO"||item.mimeType?.startsWith("video/")) return "VIDEO";
 if(item.kind==="IMAGE"||item.mimeType?.startsWith("image/")) return "IMAGE";
 return "GIF";
}
function canLoad(url:string,type:"GIF"|"STICKER"|"IMAGE"|"VIDEO"):Promise<boolean>{
 return new Promise(resolve=>{
  let done=false; const timer=window.setTimeout(()=>finish(false),7000);
  function finish(ok:boolean){if(done)return;done=true;window.clearTimeout(timer);resolve(ok);}
  try{
   const u=new URL(url); if(!["http:","https:"].includes(u.protocol)) return finish(false);
   if(type==="VIDEO"){
    const v=document.createElement("video"); v.preload="metadata"; v.onloadedmetadata=()=>finish(true); v.onerror=()=>finish(false); v.src=u.href; v.load();
   }else{
    const img=new Image(); img.onload=()=>finish(true); img.onerror=()=>finish(false); img.src=u.href;
   }
  }catch{finish(false)}
 });
}

function Tile({item,onClick,disabled}:{item:SavedMedia;onClick:()=>void;disabled:boolean}){
 const video=kindOf(item)==="VIDEO";
 return <button type="button" disabled={disabled} onClick={onClick} title={`${item.title||"Shared media"} • ${item.sentCount}×`} className="relative overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800 hover:ring-2 hover:ring-indigo-400 transition disabled:opacity-60">
  {video?<video src={item.url} muted loop autoPlay playsInline preload="metadata" className="w-full h-28 object-cover"/>:<img src={item.url} alt={item.title||item.kind} loading="lazy" className="w-full h-28 object-contain"/>}
  <span className="absolute bottom-1 right-1 rounded-full bg-black/65 px-1.5 py-0.5 text-[10px] text-white">{item.sentCount}×</span>
 </button>;
}

export function KlipyPicker({onClose,replyToMessageId}:{onClose:()=>void;replyToMessageId?:string}){
 const [tab,setTab]=useState<Tab>("GIF"),[query,setQuery]=useState(""),[items,setItems]=useState<Item[]>([]),[saved,setSaved]=useState<SavedMedia[]>([]),[loading,setLoading]=useState(true),[savedLoading,setSavedLoading]=useState(true),[error,setError]=useState(""),[sending,setSending]=useState(false),[link,setLink]=useState(""),[directType,setDirectType]=useState<DirectKind>("AUTO");
 const kind:Kind=tab==="STICKER"?"STICKER":"GIF";
 const shared=useMemo(()=>saved.filter(x=>x.kind===kind),[saved,kind]),links=useMemo(()=>saved.filter(x=>x.provider==="LINK"),[saved]);
 useEffect(()=>{let c=false;(async()=>{setSavedLoading(true);try{const data=await savedMedia();const checked=await Promise.all((data||[]).map(async(x:SavedMedia)=>await canLoad(x.url,kindOf(x))?x:null));if(!c)setSaved(checked.filter(Boolean) as SavedMedia[])}catch(e:any){if(!c)setError(e.response?.data?.message||"Unable to load shared media.")}finally{if(!c)setSavedLoading(false)}})();return()=>{c=true}},[]);
 useEffect(()=>{if(tab==="LINKS")return;let c=false;(async()=>{if(!KEY){setError("KLIPY is not configured. Add VITE_KLIPY_API_KEY.");setLoading(false);return}setLoading(true);setError("");try{const p=new URLSearchParams({key:KEY,limit:"24",contentfilter:"high",media_filter:kind==="STICKER"?"webp,tinywebp,gif,tinygif":"gif,mediumgif,tinygif"});if(query.trim())p.set("q",query.trim());if(kind==="STICKER")p.set("searchfilter","sticker");const r=await fetch(`${BASE}${query.trim()?"/v2/search":"/v2/featured"}?${p}`);if(!r.ok)throw new Error(`KLIPY returned ${r.status}`);const d=await r.json();if(!c)setItems(d.results||[])}catch(e:any){if(!c)setError(e.message||"Unable to load GIFs.")}finally{if(!c)setLoading(false)}})();return()=>{c=true}},[kind,query,tab]);
 async function choose(item:Item){const m=pick(item,kind);if(!m||sending)return;try{setSending(true);setError("");if(!(await canLoad(m.url,kind)))throw new Error("This GIF is blocked or unavailable on this network, so it was not added.");await sendMedia({type:kind,provider:"KLIPY",providerId:item.id,title:item.title,url:m.url,previewUrl:m.preview,width:m.dims[0],height:m.dims[1]},replyToMessageId);onClose()}catch(e:any){setError(e.message||e.response?.data?.message||"Unable to send media.");setSending(false)}}
 async function chooseSaved(item:SavedMedia){if(sending)return;try{setSending(true);setError("");if(!(await canLoad(item.url,kindOf(item))))throw new Error("This media is blocked or unavailable on this network, so it was not sent.");await sendSavedMedia(item.id,replyToMessageId);onClose()}catch(e:any){setError(e.message||e.response?.data?.message||"Unable to send shared media.");setSending(false)}}
 async function submitLink(){const v=link.trim(),k=directType==="AUTO"?detect(v):directType;if(!v||sending)return;if(k==="AUTO"){setError("Use a direct GIF, image, or video URL with a supported extension.");return}try{setSending(true);setError("");new URL(v);if(!(await canLoad(v,k)))throw new Error("This media cannot be loaded on this network, so it was not added.");await sendMediaLink({url:v,type:k==="GIF"?"GIF":undefined,provider:"LINK"},replyToMessageId);setLink("");onClose()}catch(e:any){setError(e.message||e.response?.data?.message||"Unable to send that media link.");setSending(false)}}
 async function starter(){if(sending)return;try{setSending(true);setError("");if(!(await canLoad(STARTER_GIF,"GIF")))throw new Error("The starter GIF cannot be loaded on this network.");await sendMediaLink({url:STARTER_GIF,type:"GIF",provider:"LINK",title:"Starter GIF"},replyToMessageId);onClose()}catch(e:any){setError(e.message||e.response?.data?.message||"Unable to send starter GIF.");setSending(false)}}
 function sw(t:Tab){setTab(t);setQuery("");setError("")}
 return <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-3" onMouseDown={onClose}><section className="w-full max-w-2xl max-h-[80vh] overflow-hidden rounded-2xl bg-white dark:bg-slate-900 shadow-2xl" onMouseDown={e=>e.stopPropagation()}><header className="border-b border-slate-200 dark:border-slate-700 p-3 space-y-3"><div className="flex items-center gap-2"><div className="flex rounded-lg bg-slate-100 dark:bg-slate-800 p-1"><button type="button" className={`px-3 py-1.5 rounded-md text-sm ${tab==="GIF"?"bg-white dark:bg-slate-700 shadow":"muted"}`} onClick={()=>sw("GIF")}>GIFs</button><button type="button" className={`px-3 py-1.5 rounded-md text-sm ${tab==="STICKER"?"bg-white dark:bg-slate-700 shadow":"muted"}`} onClick={()=>sw("STICKER")}>Stickers</button><button type="button" className={`px-3 py-1.5 rounded-md text-sm ${tab==="LINKS"?"bg-white dark:bg-slate-700 shadow":"muted"}`} onClick={()=>sw("LINKS")}>Direct Links</button></div><button className="iconbtn ml-auto" onClick={onClose}><X size={20}/></button></div>{tab!=="LINKS"?<div className="relative"><Search className="absolute left-3 top-2.5 muted" size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={`Search ${kind.toLowerCase()}…`} className="w-full rounded-lg bg-slate-100 dark:bg-slate-800 py-2 pl-9 pr-3 outline-none" autoFocus/></div>:<><div className="flex gap-2"><div className="relative flex-1"><Link2 className="absolute left-3 top-2.5 muted" size={17}/><input value={link} onChange={e=>{setLink(e.target.value);setDirectType(detect(e.target.value))}} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();void submitLink()}}} placeholder="Paste a direct image, GIF, or video URL…" className="w-full rounded-lg bg-slate-100 dark:bg-slate-800 py-2 pl-9 pr-3 outline-none" autoFocus/></div><button type="button" className="btn-primary" disabled={!link.trim()||sending} onClick={()=>void submitLink()}><Send size={16}/> Send</button></div><div className="flex items-center gap-2 text-xs"><span className="muted">Type:</span>{(["AUTO","GIF","IMAGE","VIDEO"] as DirectKind[]).map(x=><button key={x} type="button" onClick={()=>setDirectType(x)} className={`rounded-full px-2.5 py-1 ${directType===x?"bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300":"bg-slate-100 dark:bg-slate-800 muted"}`}>{x==="AUTO"?"Auto":x}</button>)}</div></>}</header><div className="p-3 overflow-y-auto max-h-[65vh]">{error&&<div className="error mb-3">{error}</div>}{tab==="LINKS"?<><div className="mb-3"><div className="font-semibold text-sm">Shared direct links</div><div className="muted text-xs mt-0.5">Only media this network can load is shown.</div></div><button type="button" onClick={()=>void starter()} disabled={sending} className="mb-4 w-full rounded-lg border border-dashed border-slate-300 dark:border-slate-700 px-3 py-2 text-left"><div className="font-semibold text-sm">Use the starter GIF</div><div className="muted text-xs break-all">{STARTER_GIF}</div></button>{savedLoading?<div className="py-12 text-center muted">Checking shared media…</div>:links.length===0?<div className="py-12 text-center muted">No usable shared links.</div>:<div className="grid grid-cols-3 sm:grid-cols-4 gap-2">{links.map(x=><Tile key={x.id} item={x} disabled={sending} onClick={()=>void chooseSaved(x)}/>)}</div>}</>:<><div className="mb-2"><div className="font-semibold text-sm">Shared {kind===`GIF`?`GIFs`:`stickers`}</div><div className="muted text-xs">Available to everyone. Blocked media is hidden on this network.</div></div>{!savedLoading&&shared.length>0&&<div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-5">{shared.map(x=><Tile key={x.id} item={x} disabled={sending} onClick={()=>void chooseSaved(x)}/>)}</div>}<div className="font-semibold text-sm mb-2">{query.trim()?"Search results":"Discover"}</div>{loading?<div className="py-12 text-center muted">Loading…</div>:<div className="grid grid-cols-3 sm:grid-cols-4 gap-2">{items.map(x=>{const m=pick(x,kind);return m?<button key={x.id} type="button" disabled={sending} onClick={()=>void choose(x)} className="overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800 hover:ring-2 hover:ring-indigo-400 transition disabled:opacity-60"><img src={m.preview} alt={x.title||kind} loading="lazy" className="w-full h-28 object-contain"/></button>:null})}</div>}</>}</div></section></div>;
}
