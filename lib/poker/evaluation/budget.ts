/** Charge whichever clock advanced farther; suspension or a wall-clock step cannot extend the work budget. */
export function budgetState(wallStart:number,monoStart:number,wallNow:number,monoNow:number,limitMs:number){
 const wall=wallNow-wallStart,mono=monoNow-monoStart,elapsedMs=Math.max(0,wall,mono);
 return {elapsedMs,exceeded:elapsedMs>=limitMs,clockGapMs:Math.abs(wall-mono)};
}
