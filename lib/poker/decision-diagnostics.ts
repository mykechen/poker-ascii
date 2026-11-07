import type {PublicSeat} from './view';
export type ObserverStatus = 'folded' | 'all-in' | 'funded';
/** Funded exposure permits another decision but does not guarantee one. */
export function observerStatus(seat: Pick<PublicSeat,'inHand'|'folded'|'allIn'|'stack'>): ObserverStatus {
 if(!seat.inHand)throw new Error('Observer is not participating in this hand.');
 if(seat.folded)return 'folded';
 if(seat.allIn||seat.stack===0)return 'all-in';
 return 'funded';
}
