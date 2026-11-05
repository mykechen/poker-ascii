export type CpuProfile={startTime:number;endTime:number;nodes:{id:number;callFrame:{functionName:string;url:string;lineNumber:number};children?:number[]}[];samples:number[];timeDeltas:number[]};
export function summarizeCpuProfile(profile:CpuProfile,window:{start:number;end:number}) {
  if(profile.samples.length!==profile.timeDeltas.length || !Number.isFinite(window.start) || !Number.isFinite(window.end) || window.end<=window.start || window.start<profile.startTime || window.end>profile.endTime)throw new Error("Invalid profile samples or measurement window.");
  const nodes=new Map(profile.nodes.map(n=>[n.id,n]));
  const parent=new Map<number,number>();
  for(const node of profile.nodes)for(const child of node.children??[])parent.set(child,node.id);
  const frames=new Map(profile.nodes.map(n=>[n.id,{id:n.id,functionName:n.callFrame.functionName,source:n.callFrame.url,line:n.callFrame.lineNumber+1,selfMicros:0,inclusiveMicros:0}]));
  let time=profile.startTime,sampledMicros=0;
  for(let i=0;i<profile.samples.length;i++){
    const delta=profile.timeDeltas[i]!;
    if(!Number.isFinite(delta)||delta<0)throw new Error("Invalid profile sample duration.");
    const end=time+delta;
    const duration=Math.max(0,Math.min(end,window.end)-Math.max(time,window.start));
    time=end;
    if(!duration)continue;
    const id=profile.samples[i]!;
    const frame=frames.get(id);
    if(!frame)throw new Error("Missing CPU sample frame.");
    frame.selfMicros+=duration;sampledMicros+=duration;
    const seen=new Set<number>();
    let current:number|undefined=id;
    while(current!==undefined){
      if(seen.has(current)||!nodes.has(current))throw new Error("Invalid CPU profile call tree.");
      seen.add(current);frames.get(current)!.inclusiveMicros+=duration;current=parent.get(current);
    }
  }
  const sources=new Map<string,number>();
  for(const frame of frames.values())sources.set(frame.source,(sources.get(frame.source)??0)+frame.selfMicros);
  return {windowMicros:window.end-window.start,sampledMicros,frames:[...frames.values()].sort((a,b)=>b.selfMicros-a.selfMicros),sourceSelf:[...sources].map(([source,selfMicros])=>({source,selfMicros})).sort((a,b)=>b.selfMicros-a.selfMicros)};
}

/** Use the marker to bound one synchronous workload, retaining intervening GC samples. */
export function findCpuMarkerWindow(profile:CpuProfile,marker:string):{start:number;end:number} {
  if(profile.samples.length!==profile.timeDeltas.length)throw new Error("Invalid profile samples.");
  const nodes=new Map(profile.nodes.map(n=>[n.id,n]));
  const parents=new Map<number,number>();
  for(const node of profile.nodes)for(const child of node.children??[])parents.set(child,node.id);
  const marked=new Set<number>();
  for(const node of profile.nodes){
    let id:number|undefined=node.id;const seen=new Set<number>();
    while(id!==undefined){
      if(seen.has(id)||!nodes.has(id))throw new Error("Invalid CPU profile call tree.");
      seen.add(id);if(nodes.get(id)!.callFrame.functionName===marker){marked.add(node.id);break;}id=parents.get(id);
    }
  }
  let time=profile.startTime,start=Infinity,end=-Infinity;
  profile.samples.forEach((id,i)=>{
    const delta=profile.timeDeltas[i]!;if(!Number.isFinite(delta)||delta<0)throw new Error("Invalid profile sample duration.");
    if(marked.has(id)){start=Math.min(start,time);end=time+delta;}time+=delta;
  });
  if(!Number.isFinite(start)||end<=start)throw new Error("No measured workload marker in CPU samples.");
  return {start,end};
}
