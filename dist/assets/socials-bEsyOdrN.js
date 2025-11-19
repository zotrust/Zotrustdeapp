import{y as L,F as O,X as P,O as u,R as w,n as T,G as c,j as b,ab as U,U as F,i as d,L as S,$ as D,E as p,a3 as W,S as C,ac as j,Y as I,a1 as $}from"./index-DgfMQxqM.js";import{n as N,r as l,c as _}from"./index-CXw-G0aR.js";import{o as x}from"./if-defined-jv-qDWGx.js";import{O as A}from"./index-egOH6OIM.js";import{e as M}from"./index-D-vGuimG.js";import"./index-Dns0QkU1.js";import"./index-DAf-DQ3p.js";import"./index-CAAlxwQK.js";import"./index-zX6rQTfs.js";import"./index-BiMfSpv3.js";import"./ref-C0hiwYgM.js";import"./index-DFUWkbcG.js";import"./index-D1z8ipgV.js";const z=L`
  :host {
    margin-top: ${({spacing:t})=>t[1]};
  }
  wui-separator {
    margin: ${({spacing:t})=>t[3]} calc(${({spacing:t})=>t[3]} * -1)
      ${({spacing:t})=>t[2]} calc(${({spacing:t})=>t[3]} * -1);
    width: calc(100% + ${({spacing:t})=>t[3]} * 2);
  }
`;var v=function(t,e,o,r){var n=arguments.length,i=n<3?e:r===null?r=Object.getOwnPropertyDescriptor(e,o):r,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")i=Reflect.decorate(t,e,o,r);else for(var a=t.length-1;a>=0;a--)(s=t[a])&&(i=(n<3?s(i):n>3?s(e,o,i):s(e,o))||i);return n>3&&i&&Object.defineProperty(e,o,i),i};let m=class extends O{constructor(){super(),this.unsubscribe=[],this.tabIdx=void 0,this.connectors=P.state.connectors,this.authConnector=this.connectors.find(e=>e.type==="AUTH"),this.remoteFeatures=u.state.remoteFeatures,this.isPwaLoading=!1,this.unsubscribe.push(P.subscribeKey("connectors",e=>{this.connectors=e,this.authConnector=this.connectors.find(o=>o.type==="AUTH")}),u.subscribeKey("remoteFeatures",e=>this.remoteFeatures=e))}connectedCallback(){super.connectedCallback(),this.handlePwaFrameLoad()}disconnectedCallback(){this.unsubscribe.forEach(e=>e())}render(){var i;let e=((i=this.remoteFeatures)==null?void 0:i.socials)||[];const o=!!this.authConnector,r=e==null?void 0:e.length,n=w.state.view==="ConnectSocials";return(!o||!r)&&!n?null:(n&&!r&&(e=T.DEFAULT_SOCIALS),c` <wui-flex flexDirection="column" gap="2">
      ${e.map(s=>c`<wui-list-social
            @click=${()=>{this.onSocialClick(s)}}
            data-testid=${`social-selector-${s}`}
            name=${s}
            logo=${s}
            ?disabled=${this.isPwaLoading}
          ></wui-list-social>`)}
    </wui-flex>`)}async onSocialClick(e){e&&await M(e)}async handlePwaFrameLoad(){var e;if(b.isPWA()){this.isPwaLoading=!0;try{((e=this.authConnector)==null?void 0:e.provider)instanceof U&&await this.authConnector.provider.init()}catch(o){F.open({displayMessage:"Error loading embedded wallet in PWA",debugMessage:o.message},"error")}finally{this.isPwaLoading=!1}}}};m.styles=z;v([N()],m.prototype,"tabIdx",void 0);v([l()],m.prototype,"connectors",void 0);v([l()],m.prototype,"authConnector",void 0);v([l()],m.prototype,"remoteFeatures",void 0);v([l()],m.prototype,"isPwaLoading",void 0);m=v([_("w3m-social-login-list")],m);const q=L`
  wui-flex {
    max-height: clamp(360px, 540px, 80vh);
    overflow: scroll;
    scrollbar-width: none;
    transition: opacity ${({durations:t})=>t.md}
      ${({easings:t})=>t["ease-out-power-1"]};
    will-change: opacity;
  }

  wui-flex::-webkit-scrollbar {
    display: none;
  }

  wui-flex.disabled {
    opacity: 0.3;
    pointer-events: none;
    user-select: none;
  }
`;var k=function(t,e,o,r){var n=arguments.length,i=n<3?e:r===null?r=Object.getOwnPropertyDescriptor(e,o):r,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")i=Reflect.decorate(t,e,o,r);else for(var a=t.length-1;a>=0;a--)(s=t[a])&&(i=(n<3?s(i):n>3?s(e,o,i):s(e,o))||i);return n>3&&i&&Object.defineProperty(e,o,i),i};let E=class extends O{constructor(){super(),this.unsubscribe=[],this.checked=A.state.isLegalCheckboxChecked,this.unsubscribe.push(A.subscribeKey("isLegalCheckboxChecked",e=>{this.checked=e}))}disconnectedCallback(){this.unsubscribe.forEach(e=>e())}render(){var R;const{termsConditionsUrl:e,privacyPolicyUrl:o}=u.state,r=(R=u.state.features)==null?void 0:R.legalCheckbox,s=!!(e||o)&&!!r&&!this.checked,a=s?-1:void 0;return c`
      <w3m-legal-checkbox></w3m-legal-checkbox>
      <wui-flex
        flexDirection="column"
        .padding=${["0","3","3","3"]}
        gap="01"
        class=${x(s?"disabled":void 0)}
      >
        <w3m-social-login-list tabIdx=${x(a)}></w3m-social-login-list>
      </wui-flex>
    `}};E.styles=q;k([l()],E.prototype,"checked",void 0);E=k([_("w3m-connect-socials-view")],E);const B=L`
  wui-logo {
    width: 80px;
    height: 80px;
    border-radius: ${({borderRadius:t})=>t[8]};
  }
  @keyframes shake {
    0% {
      transform: translateX(0);
    }
    25% {
      transform: translateX(3px);
    }
    50% {
      transform: translateX(-3px);
    }
    75% {
      transform: translateX(3px);
    }
    100% {
      transform: translateX(0);
    }
  }
  wui-flex:first-child:not(:only-child) {
    position: relative;
  }
  wui-loading-thumbnail {
    position: absolute;
  }
  wui-icon-box {
    position: absolute;
    right: calc(${({spacing:t})=>t[1]} * -1);
    bottom: calc(${({spacing:t})=>t[1]} * -1);
    opacity: 0;
    transform: scale(0.5);
    transition: all ${({easings:t})=>t["ease-out-power-2"]}
      ${({durations:t})=>t.lg};
  }
  wui-text[align='center'] {
    width: 100%;
    padding: 0px ${({spacing:t})=>t[4]};
  }
  [data-error='true'] wui-icon-box {
    opacity: 1;
    transform: scale(1);
  }
  [data-error='true'] > wui-flex:first-child {
    animation: shake 250ms ${({easings:t})=>t["ease-out-power-2"]} both;
  }
  .capitalize {
    text-transform: capitalize;
  }
`;var g=function(t,e,o,r){var n=arguments.length,i=n<3?e:r===null?r=Object.getOwnPropertyDescriptor(e,o):r,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")i=Reflect.decorate(t,e,o,r);else for(var a=t.length-1;a>=0;a--)(s=t[a])&&(i=(n<3?s(i):n>3?s(e,o,i):s(e,o))||i);return n>3&&i&&Object.defineProperty(e,o,i),i};let h=class extends O{constructor(){var o,r,n;super(),this.unsubscribe=[],this.socialProvider=(o=d.getAccountData())==null?void 0:o.socialProvider,this.socialWindow=(r=d.getAccountData())==null?void 0:r.socialWindow,this.error=!1,this.connecting=!1,this.message="Connect in the provider window",this.remoteFeatures=u.state.remoteFeatures,this.address=(n=d.getAccountData())==null?void 0:n.address,this.connectionsByNamespace=S.getConnections(d.state.activeChain),this.hasMultipleConnections=this.connectionsByNamespace.length>0,this.authConnector=P.getAuthConnector(),this.handleSocialConnection=async i=>{var s;if((s=i.data)!=null&&s.resultUri)if(i.origin===D.SECURE_SITE_ORIGIN){window.removeEventListener("message",this.handleSocialConnection,!1);try{if(this.authConnector&&!this.connecting){this.socialWindow&&(this.socialWindow.close(),d.setAccountProp("socialWindow",void 0,d.state.activeChain)),this.connecting=!0,this.updateMessage();const a=i.data.resultUri;this.socialProvider&&p.sendEvent({type:"track",event:"SOCIAL_LOGIN_REQUEST_USER_DATA",properties:{provider:this.socialProvider}}),await S.connectExternal({id:this.authConnector.id,type:this.authConnector.type,socialUri:a},this.authConnector.chain),this.socialProvider&&(W.setConnectedSocialProvider(this.socialProvider),p.sendEvent({type:"track",event:"SOCIAL_LOGIN_SUCCESS",properties:{provider:this.socialProvider}}))}}catch(a){this.error=!0,this.updateMessage(),this.socialProvider&&p.sendEvent({type:"track",event:"SOCIAL_LOGIN_ERROR",properties:{provider:this.socialProvider,message:b.parseError(a)}})}}else w.goBack(),C.showError("Untrusted Origin"),this.socialProvider&&p.sendEvent({type:"track",event:"SOCIAL_LOGIN_ERROR",properties:{provider:this.socialProvider,message:"Untrusted Origin"}})},j.EmbeddedWalletAbortController.signal.addEventListener("abort",()=>{this.socialWindow&&(this.socialWindow.close(),d.setAccountProp("socialWindow",void 0,d.state.activeChain))}),this.unsubscribe.push(d.subscribeChainProp("accountState",i=>{var s;if(i&&(this.socialProvider=i.socialProvider,i.socialWindow&&(this.socialWindow=i.socialWindow),i.address)){const a=(s=this.remoteFeatures)==null?void 0:s.multiWallet;i.address!==this.address&&(this.hasMultipleConnections&&a?(w.replace("ProfileWallets"),C.showSuccess("New Wallet Added"),this.address=i.address):(I.state.open||u.state.enableEmbedded)&&I.close())}}),u.subscribeKey("remoteFeatures",i=>{this.remoteFeatures=i})),this.authConnector&&this.connectSocial()}disconnectedCallback(){var e;this.unsubscribe.forEach(o=>o()),window.removeEventListener("message",this.handleSocialConnection,!1),(e=this.socialWindow)==null||e.close(),d.setAccountProp("socialWindow",void 0,d.state.activeChain)}render(){return c`
      <wui-flex
        data-error=${x(this.error)}
        flexDirection="column"
        alignItems="center"
        .padding=${["10","5","5","5"]}
        gap="6"
      >
        <wui-flex justifyContent="center" alignItems="center">
          <wui-logo logo=${x(this.socialProvider)}></wui-logo>
          ${this.error?null:this.loaderTemplate()}
          <wui-icon-box color="error" icon="close" size="sm"></wui-icon-box>
        </wui-flex>
        <wui-flex flexDirection="column" alignItems="center" gap="2">
          <wui-text align="center" variant="lg-medium" color="primary"
            >Log in with
            <span class="capitalize">${this.socialProvider??"Social"}</span></wui-text
          >
          <wui-text align="center" variant="lg-regular" color=${this.error?"error":"secondary"}
            >${this.message}</wui-text
          ></wui-flex
        >
      </wui-flex>
    `}loaderTemplate(){const e=$.state.themeVariables["--w3m-border-radius-master"],o=e?parseInt(e.replace("px",""),10):4;return c`<wui-loading-thumbnail radius=${o*9}></wui-loading-thumbnail>`}connectSocial(){const e=setInterval(()=>{var o;(o=this.socialWindow)!=null&&o.closed&&(!this.connecting&&w.state.view==="ConnectingSocial"&&(this.socialProvider&&p.sendEvent({type:"track",event:"SOCIAL_LOGIN_CANCELED",properties:{provider:this.socialProvider}}),w.goBack()),clearInterval(e))},1e3);window.addEventListener("message",this.handleSocialConnection,!1)}updateMessage(){this.error?this.message="Something went wrong":this.connecting?this.message="Retrieving user data":this.message="Connect in the provider window"}};h.styles=B;g([l()],h.prototype,"socialProvider",void 0);g([l()],h.prototype,"socialWindow",void 0);g([l()],h.prototype,"error",void 0);g([l()],h.prototype,"connecting",void 0);g([l()],h.prototype,"message",void 0);g([l()],h.prototype,"remoteFeatures",void 0);h=g([_("w3m-connecting-social-view")],h);const G=L`
  wui-shimmer {
    width: 100%;
    aspect-ratio: 1 / 1;
    border-radius: ${({borderRadius:t})=>t[4]};
  }

  wui-qr-code {
    opacity: 0;
    animation-duration: ${({durations:t})=>t.xl};
    animation-timing-function: ${({easings:t})=>t["ease-out-power-2"]};
    animation-name: fade-in;
    animation-fill-mode: forwards;
  }

  wui-logo {
    width: 80px;
    height: 80px;
    border-radius: ${({borderRadius:t})=>t[8]};
  }

  wui-flex:first-child:not(:only-child) {
    position: relative;
  }

  wui-loading-thumbnail {
    position: absolute;
  }

  wui-icon-box {
    position: absolute;
    right: calc(${({spacing:t})=>t[1]} * -1);
    bottom: calc(${({spacing:t})=>t[1]} * -1);
    opacity: 0;
    transform: scale(0.5);
    transition:
      opacity ${({durations:t})=>t.lg} ${({easings:t})=>t["ease-out-power-2"]},
      transform ${({durations:t})=>t.lg}
        ${({easings:t})=>t["ease-out-power-2"]};
    will-change: opacity, transform;
  }

  @keyframes fade-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
`;var y=function(t,e,o,r){var n=arguments.length,i=n<3?e:r===null?r=Object.getOwnPropertyDescriptor(e,o):r,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")i=Reflect.decorate(t,e,o,r);else for(var a=t.length-1;a>=0;a--)(s=t[a])&&(i=(n<3?s(i):n>3?s(e,o,i):s(e,o))||i);return n>3&&i&&Object.defineProperty(e,o,i),i};let f=class extends O{constructor(){var e,o;super(),this.unsubscribe=[],this.timeout=void 0,this.socialProvider=(e=d.getAccountData())==null?void 0:e.socialProvider,this.uri=(o=d.getAccountData())==null?void 0:o.farcasterUrl,this.ready=!1,this.loading=!1,this.remoteFeatures=u.state.remoteFeatures,this.authConnector=P.getAuthConnector(),this.forceUpdate=()=>{this.requestUpdate()},this.unsubscribe.push(d.subscribeChainProp("accountState",r=>{this.socialProvider=r==null?void 0:r.socialProvider,this.uri=r==null?void 0:r.farcasterUrl,this.connectFarcaster()}),u.subscribeKey("remoteFeatures",r=>{this.remoteFeatures=r})),window.addEventListener("resize",this.forceUpdate)}disconnectedCallback(){super.disconnectedCallback(),clearTimeout(this.timeout),window.removeEventListener("resize",this.forceUpdate)}render(){return this.onRenderProxy(),c`${this.platformTemplate()}`}platformTemplate(){return b.isMobile()?c`${this.mobileTemplate()}`:c`${this.desktopTemplate()}`}desktopTemplate(){return this.loading?c`${this.loadingTemplate()}`:c`${this.qrTemplate()}`}qrTemplate(){return c` <wui-flex
      flexDirection="column"
      alignItems="center"
      .padding=${["0","5","5","5"]}
      gap="5"
    >
      <wui-shimmer width="100%"> ${this.qrCodeTemplate()} </wui-shimmer>

      <wui-text variant="lg-medium" color="primary"> Scan this QR Code with your phone </wui-text>
      ${this.copyTemplate()}
    </wui-flex>`}loadingTemplate(){return c`
      <wui-flex
        flexDirection="column"
        alignItems="center"
        .padding=${["5","5","5","5"]}
        gap="5"
      >
        <wui-flex justifyContent="center" alignItems="center">
          <wui-logo logo="farcaster"></wui-logo>
          ${this.loaderTemplate()}
          <wui-icon-box color="error" icon="close" size="sm"></wui-icon-box>
        </wui-flex>
        <wui-flex flexDirection="column" alignItems="center" gap="2">
          <wui-text align="center" variant="md-medium" color="primary">
            Loading user data
          </wui-text>
          <wui-text align="center" variant="sm-regular" color="secondary">
            Please wait a moment while we load your data.
          </wui-text>
        </wui-flex>
      </wui-flex>
    `}mobileTemplate(){return c` <wui-flex
      flexDirection="column"
      alignItems="center"
      .padding=${["10","5","5","5"]}
      gap="5"
    >
      <wui-flex justifyContent="center" alignItems="center">
        <wui-logo logo="farcaster"></wui-logo>
        ${this.loaderTemplate()}
        <wui-icon-box
          color="error"
          icon="close"
          size="sm"
        ></wui-icon-box>
      </wui-flex>
      <wui-flex flexDirection="column" alignItems="center" gap="2">
        <wui-text align="center" variant="md-medium" color="primary"
          >Continue in Farcaster</span></wui-text
        >
        <wui-text align="center" variant="sm-regular" color="secondary"
          >Accept connection request in the app</wui-text
        ></wui-flex
      >
      ${this.mobileLinkTemplate()}
    </wui-flex>`}loaderTemplate(){const e=$.state.themeVariables["--w3m-border-radius-master"],o=e?parseInt(e.replace("px",""),10):4;return c`<wui-loading-thumbnail radius=${o*9}></wui-loading-thumbnail>`}async connectFarcaster(){var e,o;if(this.authConnector)try{await((e=this.authConnector)==null?void 0:e.provider.connectFarcaster()),this.socialProvider&&(W.setConnectedSocialProvider(this.socialProvider),p.sendEvent({type:"track",event:"SOCIAL_LOGIN_REQUEST_USER_DATA",properties:{provider:this.socialProvider}})),this.loading=!0;const n=S.getConnections(this.authConnector.chain).length>0;await S.connectExternal(this.authConnector,this.authConnector.chain);const i=(o=this.remoteFeatures)==null?void 0:o.multiWallet;this.socialProvider&&p.sendEvent({type:"track",event:"SOCIAL_LOGIN_SUCCESS",properties:{provider:this.socialProvider}}),this.loading=!1,n&&i?(w.replace("ProfileWallets"),C.showSuccess("New Wallet Added")):I.close()}catch(r){this.socialProvider&&p.sendEvent({type:"track",event:"SOCIAL_LOGIN_ERROR",properties:{provider:this.socialProvider,message:b.parseError(r)}}),w.goBack(),C.showError(r)}}mobileLinkTemplate(){return c`<wui-button
      size="md"
      ?loading=${this.loading}
      ?disabled=${!this.uri||this.loading}
      @click=${()=>{this.uri&&b.openHref(this.uri,"_blank")}}
    >
      Open farcaster</wui-button
    >`}onRenderProxy(){!this.ready&&this.uri&&(this.timeout=setTimeout(()=>{this.ready=!0},200))}qrCodeTemplate(){if(!this.uri||!this.ready)return null;const e=this.getBoundingClientRect().width-40;return c` <wui-qr-code
      size=${e}
      theme=${$.state.themeMode}
      uri=${this.uri}
      ?farcaster=${!0}
      data-testid="wui-qr-code"
      color=${x($.state.themeVariables["--w3m-qr-color"])}
    ></wui-qr-code>`}copyTemplate(){const e=!this.uri||!this.ready;return c`<wui-button
      .disabled=${e}
      @click=${this.onCopyUri}
      variant="neutral-secondary"
      size="sm"
      data-testid="copy-wc2-uri"
    >
      <wui-icon size="sm" color="default" slot="iconRight" name="copy"></wui-icon>
      Copy link
    </wui-button>`}onCopyUri(){try{this.uri&&(b.copyToClopboard(this.uri),C.showSuccess("Link copied"))}catch{C.showError("Failed to copy")}}};f.styles=G;y([l()],f.prototype,"socialProvider",void 0);y([l()],f.prototype,"uri",void 0);y([l()],f.prototype,"ready",void 0);y([l()],f.prototype,"loading",void 0);y([l()],f.prototype,"remoteFeatures",void 0);f=y([_("w3m-connecting-farcaster-view")],f);export{E as W3mConnectSocialsView,f as W3mConnectingFarcasterView,h as W3mConnectingSocialView};
