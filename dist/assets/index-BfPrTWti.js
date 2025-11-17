import{I as p,F as u,R as f,Y as g,G as d}from"./index-Bxd8aEoY.js";import{n as b,r as m,c as w}from"./index-inSMu1qg.js";import{T as l}from"./index-BAABYv_m.js";const C={interpolate(r,e,t){if(r.length!==2||e.length!==2)throw new Error("inputRange and outputRange must be an array of length 2");const n=r[0]||0,i=r[1]||0,o=e[0]||0,s=e[1]||0;return t<n?o:t>i?s:(s-o)/(i-n)*(t-n)+o}},v=p`
  :host {
    width: 100%;
    display: block;
  }
`;var a=function(r,e,t,n){var i=arguments.length,o=i<3?e:n===null?n=Object.getOwnPropertyDescriptor(e,t):n,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")o=Reflect.decorate(r,e,t,n);else for(var c=r.length-1;c>=0;c--)(s=r[c])&&(o=(i<3?s(o):i>3?s(e,t,o):s(e,t))||o);return i>3&&o&&Object.defineProperty(e,t,o),o};let h=class extends u{constructor(){super(),this.unsubscribe=[],this.text="",this.open=l.state.open,this.unsubscribe.push(f.subscribeKey("view",()=>{l.hide()}),g.subscribeKey("open",e=>{e||l.hide()}),l.subscribeKey("open",e=>{this.open=e}))}disconnectedCallback(){this.unsubscribe.forEach(e=>e()),l.hide()}render(){return d`
      <div
        @pointermove=${this.onMouseEnter.bind(this)}
        @pointerleave=${this.onMouseLeave.bind(this)}
      >
        ${this.renderChildren()}
      </div>
    `}renderChildren(){return d`<slot></slot> `}onMouseEnter(){const e=this.getBoundingClientRect();if(!this.open){const t=document.querySelector("w3m-modal"),n={width:e.width,height:e.height,left:e.left,top:e.top};if(t){const i=t.getBoundingClientRect();n.left=e.left-(window.innerWidth-i.width)/2,n.top=e.top-(window.innerHeight-i.height)/2}l.showTooltip({message:this.text,triggerRect:n,variant:"shade"})}}onMouseLeave(e){this.contains(e.relatedTarget)||l.hide()}};h.styles=[v];a([b()],h.prototype,"text",void 0);a([m()],h.prototype,"open",void 0);h=a([w("w3m-tooltip-trigger")],h);export{C as M};
