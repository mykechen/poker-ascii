"""Standard-library evaluation analysis. TS owns all simulation and payouts."""
import math
import statistics as st
from statistics import NormalDist
from collections import defaultdict

def required_units(variance, effect_bb100, comparisons=3, power=.8, null_bb100=0):
    margin=(effect_bb100-null_bb100)/100
    if not math.isfinite(variance) or variance<=0 or margin<=0 or comparisons<1:
        raise ValueError('Positive finite variance, effect margin and comparison count required')
    z=NormalDist().inv_cdf(1-.05/(2*comparisons))+NormalDist().inv_cdf(power)
    return math.ceil(z*z*variance/margin**2)

def correlation(x,y):
    if st.variance(x)==0 or st.variance(y)==0:return None
    return st.covariance(x,y)/(st.stdev(x)*st.stdev(y))

def design_rotation(seed_index,cell,players):
    import hashlib
    offset=int(hashlib.sha256(f'{cell}:{players}'.encode()).hexdigest()[:8],16)%players
    return (seed_index+offset)%players

def design_rows(rows,metric):
    """Cluster-safe designs: preassigned balanced rotation vs every rotation, equal pool/table weights."""
    seed_indexes={seed:i for i,seed in enumerate(sorted({r['seed'] for r in rows}))}
    def selected(r):return r['rotation']==design_rotation(seed_indexes[r['seed']],r['cell'],r['players'])
    def summarize(rotated):
        cells=defaultdict(list)
        for r in rows:
            if rotated or selected(r):
                cells[r['seed'],r['arm'],r['cell'],r['players']].append(r[metric])
        grouped=defaultdict(list)
        for (seed,arm,cell,players),values in cells.items():grouped[seed,arm].append(st.mean(values))
        return {k:st.mean(v) for k,v in grouped.items()}
    seeds=sorted({r['seed'] for r in rows});arms=sorted({r['arm'] for r in rows})
    if len(arms)!=2 or len(seeds)<3:raise ValueError('Two arms, at least three seed clusters required')
    out={}
    for rotated in [False,True]:
        g=summarize(rotated);x=[g[s,arms[0]] for s in seeds];y=[g[s,arms[1]] for s in seeds]
        physical=sum(1 for r in rows if (rotated or selected(r)))/len(seeds)
        if not rotated:out['unpaired']={'variance':st.variance(x)+st.variance(y),'physicalHandsPerUnit':physical,'independentUnit':'one independent seed per arm; one preassigned balanced rotation per cell','correlation':None}
        out['rotated' if rotated else 'paired']={'variance':st.variance([b-a for a,b in zip(x,y)]),'physicalHandsPerUnit':physical,'independentUnit':'paired seed cluster; all rotations' if rotated else 'paired seed cluster; one preassigned balanced rotation per cell','correlation':correlation(x,y)}
    return out

# Student-t CDF via regularized incomplete beta (continued fraction, Numerical Recipes).
def _betacf(a,b,x):
    c=1.;d=1-(a+b)*x/(a+1);d=1/max(abs(d),1e-300)*(1 if d>=0 else -1);h=d
    for m in range(1,301):
        for aa in [m*(b-m)*x/((a+2*m-1)*(a+2*m)), -(a+m)*(a+b+m)*x/((a+2*m)*(a+2*m+1))]:
            d=1+aa*d;c=1+aa/c
            if abs(d)<1e-300:d=1e-300
            if abs(c)<1e-300:c=1e-300
            d=1/d;delta=d*c;h*=delta
        if abs(delta-1)<3e-14:return h
    raise ArithmeticError('beta fraction did not converge')
def _ibeta(a,b,x):
    if x<=0:return 0.
    if x>=1:return 1.
    bt=math.exp(math.lgamma(a+b)-math.lgamma(a)-math.lgamma(b)+a*math.log(x)+b*math.log1p(-x))
    if x<(a+1)/(a+b+2):return bt*_betacf(a,b,x)/a
    return 1-bt*_betacf(b,a,1-x)/b
def t_quantile(p,df):
    if not .5<p<1 or df<1:raise ValueError('upper t quantile required')
    lo,hi=0.,1.
    def cdf(t):return 1-.5*_ibeta(df/2,.5,df/(df+t*t))
    while cdf(hi)<p:hi*=2
    for _ in range(100):
        mid=(lo+hi)/2
        if cdf(mid)<p:lo=mid
        else:hi=mid
    return (lo+hi)/2

def paired_ci(values,comparisons=1):
    n=len(values);mean=st.mean(values);se=st.stdev(values)/math.sqrt(n);q=t_quantile(1-.05/(2*comparisons),n-1)
    return {'mean':mean,'ci95' if comparisons==1 else 'correctedCI':[mean-q*se,mean+q*se],'nSeedClusters':n,'se':se}

def chi_square_quantile(p,df):
    if not 0<p<1 or df<1:raise ValueError('Invalid chi-square quantile')
    a=df/2
    def cdf(x):
        x=x/2
        if x==0:return 0.
        if x<a+1:
            term=1/a;total=term
            for n in range(1,10000):
                term*=x/(a+n);total+=term
                if abs(term)<abs(total)*1e-14:return total*math.exp(-x+a*math.log(x)-math.lgamma(a))
        else:
            b=x+1-a;c=1e300;d=1/b;h=d
            for i in range(1,10000):
                an=-i*(i-a);b+=2;d=an*d+b;c=b+an/c
                if abs(d)<1e-300:d=1e-300
                if abs(c)<1e-300:c=1e-300
                d=1/d;delta=d*c;h*=delta
                if abs(delta-1)<1e-14:return 1-math.exp(-x+a*math.log(x)-math.lgamma(a))*h
        raise ArithmeticError('gamma did not converge')
    lo,hi=0.,max(1.,float(df))
    while cdf(hi)<p:hi*=2
    for _ in range(100):
        mid=(lo+hi)/2
        if cdf(mid)<p:lo=mid
        else:hi=mid
    return (lo+hi)/2
