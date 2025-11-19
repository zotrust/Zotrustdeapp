import{i as c,E as S,R as p,X as g,S as m,j as u,a2 as _,a3 as E,M as R,y as w,A as y,F as b,G as v,D as $}from"./index-DgfMQxqM.js";import{n as d,c as C}from"./index-CXw-G0aR.js";import{o as O}from"./if-defined-jv-qDWGx.js";function T(){try{return u.returnOpenHref(`${R.SECURE_SITE_SDK_ORIGIN}/loading`,"popupWindow","width=600,height=800,scrollbars=yes")}catch{throw new Error("Could not open social popup")}}async function U(){p.push("ConnectingFarcaster");const e=g.getAuthConnector();if(e){const o=c.getAccountData();if(!(o!=null&&o.farcasterUrl))try{const{url:t}=await e.provider.getFarcasterUri();c.setAccountProp("farcasterUrl",t,c.state.activeChain)}catch(t){p.goBack(),m.showError(t)}}}async function j(e){p.push("ConnectingSocial");const o=g.getAuthConnector();let t=null;try{const n=setTimeout(()=>{throw new Error("Social login timed out. Please try again.")},45e3);if(o&&e){if(u.isTelegram()||(t=T()),t)c.setAccountProp("socialWindow",_(t),c.state.activeChain);else if(!u.isTelegram())throw new Error("Could not create social popup");const{uri:i}=await o.provider.getSocialRedirectUri({provider:e});if(!i)throw t==null||t.close(),new Error("Could not fetch the social redirect uri");if(t&&(t.location.href=i),u.isTelegram()){E.setTelegramSocialProvider(e);const r=u.formatTelegramSocialLoginUrl(i);u.openHref(r,"_top")}clearTimeout(n)}}catch(n){t==null||t.close(),m.showError(n==null?void 0:n.message)}}async function F(e){c.setAccountProp("socialProvider",e,c.state.activeChain),S.sendEvent({type:"track",event:"SOCIAL_LOGIN_STARTED",properties:{provider:e}}),e==="farcaster"?await U():await j(e)}const A=w`
  :host {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 40px;
    height: 40px;
    border-radius: ${({borderRadius:e})=>e[20]};
    overflow: hidden;
  }

  wui-icon {
    width: 100%;
    height: 100%;
  }
`;var x=function(e,o,t,n){var i=arguments.length,r=i<3?o:n===null?n=Object.getOwnPropertyDescriptor(o,t):n,a;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")r=Reflect.decorate(e,o,t,n);else for(var s=e.length-1;s>=0;s--)(a=e[s])&&(r=(i<3?a(r):i>3?a(o,t,r):a(o,t))||r);return i>3&&r&&Object.defineProperty(o,t,r),r};let h=class extends b{constructor(){super(...arguments),this.logo="google"}render(){return v`<wui-icon color="inherit" size="inherit" name=${this.logo}></wui-icon> `}};h.styles=[y,A];x([d()],h.prototype,"logo",void 0);h=x([C("wui-logo")],h);const I=w`
  :host {
    width: 100%;
  }

  button {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: ${({spacing:e})=>e[3]};
    width: 100%;
    background-color: transparent;
    border-radius: ${({borderRadius:e})=>e[4]};
  }

  wui-text {
    text-transform: capitalize;
  }

  @media (hover: hover) {
    button:hover:enabled {
      background-color: ${({tokens:e})=>e.theme.foregroundPrimary};
    }
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;var f=function(e,o,t,n){var i=arguments.length,r=i<3?o:n===null?n=Object.getOwnPropertyDescriptor(o,t):n,a;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")r=Reflect.decorate(e,o,t,n);else for(var s=e.length-1;s>=0;s--)(a=e[s])&&(r=(i<3?a(r):i>3?a(o,t,r):a(o,t))||r);return i>3&&r&&Object.defineProperty(o,t,r),r};let l=class extends b{constructor(){super(...arguments),this.logo="google",this.name="Continue with google",this.disabled=!1}render(){return v`
      <button ?disabled=${this.disabled} tabindex=${O(this.tabIdx)}>
        <wui-flex gap="2" alignItems="center">
          <wui-image ?boxed=${!0} logo=${this.logo}></wui-image>
          <wui-text variant="lg-regular" color="primary">${this.name}</wui-text>
        </wui-flex>
        <wui-icon name="chevronRight" size="lg" color="default"></wui-icon>
      </button>
    `}};l.styles=[y,$,I];f([d()],l.prototype,"logo",void 0);f([d()],l.prototype,"name",void 0);f([d()],l.prototype,"tabIdx",void 0);f([d({type:Boolean})],l.prototype,"disabled",void 0);l=f([C("wui-list-social")],l);export{F as e};
