if(!self.define){let e,a={};const s=(s,i)=>(s=new URL(s+".js",i).href,a[s]||new Promise((a=>{if("document"in self){const e=document.createElement("script");e.src=s,e.onload=a,document.head.appendChild(e)}else e=s,importScripts(s),a()})).then((()=>{let e=a[s];if(!e)throw new Error(`Module ${s} didn’t register its module`);return e})));self.define=(i,c)=>{const n=e||("document"in self?document.currentScript.src:"")||location.href;if(a[n])return;let t={};const f=e=>s(e,n),d={module:{uri:n},exports:t,require:f};a[n]=Promise.all(i.map((e=>d[e]||f(e)))).then((e=>(c(...e),t)))}}define(["./workbox-4754cb34"],(function(e){"use strict";importScripts(),self.skipWaiting(),e.clientsClaim(),e.precacheAndRoute([{url:"/FMP_LaranjaGradient.svg",revision:"e917f2db0e11ad07378465b981197c4d"},{url:"/FMP_Laranja_Centered.svg",revision:"7b713906aa674b663bb9d1a8f84e0d3d"},{url:"/FMP_Roxo.svg",revision:"e4391d859827ebedddfa85a8a6f59ded"},{url:"/_next/app-build-manifest.json",revision:"d8c044a9ce96216cc6fa5803f50d3509"},{url:"/_next/dynamic-css-manifest.json",revision:"d751713988987e9331980363e24189ce"},{url:"/_next/static/aaWfgEBPIpEJusc-vMJWs/_buildManifest.js",revision:"3fb3ddd90e82e47aad5fdb3075f7d4e4"},{url:"/_next/static/aaWfgEBPIpEJusc-vMJWs/_ssgManifest.js",revision:"b6652df95db52feb4daf4eca35380933"},{url:"/_next/static/chunks/205-5e77b66147949689.js",revision:"aaWfgEBPIpEJusc-vMJWs"},{url:"/_next/static/chunks/265-205f5d5cfb0756a0.js",revision:"aaWfgEBPIpEJusc-vMJWs"},{url:"/_next/static/chunks/277-0e2bea38edafe8ba.js",revision:"aaWfgEBPIpEJusc-vMJWs"},{url:"/_next/static/chunks/294.e72d2554be082393.js",revision:"e72d2554be082393"},{url:"/_next/static/chunks/341.52842df298060f33.js",revision:"52842df298060f33"},{url:"/_next/static/chunks/408-1c171a69fc1f9a28.js",revision:"aaWfgEBPIpEJusc-vMJWs"},{url:"/_next/static/chunks/472.975541ad4a1dbcd8.js",revision:"975541ad4a1dbcd8"},{url:"/_next/static/chunks/4bd1b696-68bad4e53fe858be.js",revision:"aaWfgEBPIpEJusc-vMJWs"},{url:"/_next/static/chunks/50-f9bf339011c23f0b.js",revision:"aaWfgEBPIpEJusc-vMJWs"},{url:"/_next/static/chunks/518.38a28cf942889d64.js",revision:"38a28cf942889d64"},{url:"/_next/static/chunks/566-6e157d0ffa2e7b4e.js",revision:"aaWfgEBPIpEJusc-vMJWs"},{url:"/_next/static/chunks/662-80b4d426cd2997cf.js",revision:"aaWfgEBPIpEJusc-vMJWs"},{url:"/_next/static/chunks/684-245d0fc511126ed7.js",revision:"aaWfgEBPIpEJusc-vMJWs"},{url:"/_next/static/chunks/719-c1e77be8bb1c4ae9.js",revision:"aaWfgEBPIpEJusc-vMJWs"},{url:"/_next/static/chunks/851-c6952f3282869f27.js",revision:"aaWfgEBPIpEJusc-vMJWs"},{url:"/_next/static/chunks/874-36bc4822e446d5d1.js",revision:"aaWfgEBPIpEJusc-vMJWs"},{url:"/_next/static/chunks/app/_not-found/page-01678cc41cffc895.js",revision:"aaWfgEBPIpEJusc-vMJWs"},{url:"/_next/static/chunks/app/admin/groups/page-46aa167c1ca60127.js",revision:"aaWfgEBPIpEJusc-vMJWs"},{url:"/_next/static/chunks/app/admin/layout-07526571ab6532fc.js",revision:"aaWfgEBPIpEJusc-vMJWs"},{url:"/_next/static/chunks/app/admin/leaders/page-ac1c9f8556aee326.js",revision:"aaWfgEBPIpEJusc-vMJWs"},{url:"/_next/static/chunks/app/admin/loading-65732032e3c9ea5a.js",revision:"aaWfgEBPIpEJusc-vMJWs"},{url:"/_next/static/chunks/app/admin/page-edef8a3a1476e33d.js",revision:"aaWfgEBPIpEJusc-vMJWs"},{url:"/_next/static/chunks/app/api/auth/set-admin/route-3db8cc3cff29eb43.js",revision:"aaWfgEBPIpEJusc-vMJWs"},{url:"/_next/static/chunks/app/api/auth/verify-admin/route-45502109de1a9b13.js",revision:"aaWfgEBPIpEJusc-vMJWs"},{url:"/_next/static/chunks/app/auth/callback/route-15f31160763b975e.js",revision:"aaWfgEBPIpEJusc-vMJWs"},{url:"/_next/static/chunks/app/dashboard/layout-f329058dd5b52ef0.js",revision:"aaWfgEBPIpEJusc-vMJWs"},{url:"/_next/static/chunks/app/dashboard/page-a8848795572bc718.js",revision:"aaWfgEBPIpEJusc-vMJWs"},{url:"/_next/static/chunks/app/layout-d25bea2e2692740b.js",revision:"aaWfgEBPIpEJusc-vMJWs"},{url:"/_next/static/chunks/app/login/page-e7ce5e576c052291.js",revision:"aaWfgEBPIpEJusc-vMJWs"},{url:"/_next/static/chunks/app/page-dd2c2d53def8942d.js",revision:"aaWfgEBPIpEJusc-vMJWs"},{url:"/_next/static/chunks/app/public/page-5ea3bd4ea020a81a.js",revision:"aaWfgEBPIpEJusc-vMJWs"},{url:"/_next/static/chunks/framework-f91ac3e95d37cfad.js",revision:"aaWfgEBPIpEJusc-vMJWs"},{url:"/_next/static/chunks/main-58981de53a4250c1.js",revision:"aaWfgEBPIpEJusc-vMJWs"},{url:"/_next/static/chunks/main-app-ca5ac3cd5c0e1e68.js",revision:"aaWfgEBPIpEJusc-vMJWs"},{url:"/_next/static/chunks/pages/_app-4216d016d6fb093a.js",revision:"aaWfgEBPIpEJusc-vMJWs"},{url:"/_next/static/chunks/pages/_error-1c5192a1d9d043eb.js",revision:"aaWfgEBPIpEJusc-vMJWs"},{url:"/_next/static/chunks/polyfills-42372ed130431b0a.js",revision:"846118c33b2c0e922d7b3a7676f81f6f"},{url:"/_next/static/chunks/webpack-5d827a9596dfc712.js",revision:"aaWfgEBPIpEJusc-vMJWs"},{url:"/_next/static/css/1ac4531111069e25.css",revision:"1ac4531111069e25"},{url:"/_next/static/css/26606639122d1a0a.css",revision:"26606639122d1a0a"},{url:"/_next/static/css/b735c720a7ac0a96.css",revision:"b735c720a7ac0a96"},{url:"/_next/static/media/034043092db1e233-s.woff2",revision:"985e9b4713be3b0c3210a2f4a316492d"},{url:"/_next/static/media/0484562807a97172-s.p.woff2",revision:"b550bca8934bd86812d1f5e28c9cc1de"},{url:"/_next/static/media/26a46d62cd723877-s.woff2",revision:"befd9c0fdfa3d8a645d5f95717ed6420"},{url:"/_next/static/media/2b3f1035ed87a788-s.p.woff2",revision:"03e877e75c5a1213e13a56b59471c946"},{url:"/_next/static/media/4c285fdca692ea22-s.p.woff2",revision:"42d3308e3aca8742731f63154187bdd7"},{url:"/_next/static/media/55c55f0601d81cf3-s.woff2",revision:"43828e14271c77b87e3ed582dbff9f74"},{url:"/_next/static/media/569ce4b8f30dc480-s.p.woff2",revision:"ef6cefb32024deac234e82f932a95cbd"},{url:"/_next/static/media/581909926a08bbc8-s.woff2",revision:"f0b86e7c24f455280b8df606b89af891"},{url:"/_next/static/media/65053818c3abcf97-s.woff2",revision:"9b02c436a26a8afe2e94314fdaa6d6bd"},{url:"/_next/static/media/6c9a125e97d835e1-s.woff2",revision:"889718d692d5bfc6019cbdfcb5cc106f"},{url:"/_next/static/media/6d93bde91c0c2823-s.woff2",revision:"621a07228c8ccbfd647918f1021b4868"},{url:"/_next/static/media/747892c23ea88013-s.woff2",revision:"a0761690ccf4441ace5cec893b82d4ab"},{url:"/_next/static/media/7cba1811e3c25a15-s.p.woff2",revision:"294acfe5ae5fedf82364d309dd284fc4"},{url:"/_next/static/media/8888a3826f4a3af4-s.p.woff2",revision:"792477d09826b11d1e5a611162c9797a"},{url:"/_next/static/media/93f479601ee12b01-s.p.woff2",revision:"da83d5f06d825c5ae65b7cca706cb312"},{url:"/_next/static/media/97e0cb1ae144a2a9-s.woff2",revision:"e360c61c5bd8d90639fd4503c829c2dc"},{url:"/_next/static/media/a1386beebedccca4-s.woff2",revision:"d3aa06d13d3cf9c0558927051f3cb948"},{url:"/_next/static/media/a34f9d1faa5f3315-s.p.woff2",revision:"d4fe31e6a2aebc06b8d6e558c9141119"},{url:"/_next/static/media/b7387a63dd068245-s.woff2",revision:"dea099b7d5a5ea45bd4367f8aeff62ab"},{url:"/_next/static/media/b957ea75a84b6ea7-s.p.woff2",revision:"0bd523f6049956faaf43c254a719d06a"},{url:"/_next/static/media/ba015fad6dcf6784-s.woff2",revision:"8ea4f719af3312a055caf09f34c89a77"},{url:"/_next/static/media/c3bc380753a8436c-s.woff2",revision:"5a1b7c983a9dc0a87a2ff138e07ae822"},{url:"/_next/static/media/df0a9ae256c0569c-s.woff2",revision:"d54db44de5ccb18886ece2fda72bdfe0"},{url:"/_next/static/media/e1aab0933260df4d-s.woff2",revision:"207f8e9f3761dbd724063a177d906a99"},{url:"/_next/static/media/eafabf029ad39a43-s.p.woff2",revision:"43751174b6b810eb169101a20d8c26f8"},{url:"/_next/static/media/eed6db14ac3b93a0-s.woff2",revision:"bf5e9d3da99a28e7391571987186e6ea"},{url:"/_next/static/media/f10b8e9d91f3edcb-s.woff2",revision:"63af7d5e18e585fad8d0220e5d551da1"},{url:"/_next/static/media/fe0777f1195381cb-s.woff2",revision:"f2a04185547c36abfa589651236a9849"},{url:"/file.svg",revision:"d09f95206c3fa0bb9bd9fefabfd0ea71"},{url:"/globe.svg",revision:"2aaafa6a49b6563925fe440891e32717"},{url:"/icon-generation-instructions.txt",revision:"0af5ddf91200d85eb8608642e6aa8252"},{url:"/icons/icon-128x128.png",revision:"c9db576b2e82ece9151bc9736e283cdc"},{url:"/icons/icon-144x144.png",revision:"34dbb71a8cdaadca14ba3dbcfc2cadd9"},{url:"/icons/icon-152x152.png",revision:"481ebb10cb3b77f038d105db8db9bc9c"},{url:"/icons/icon-192x192.png",revision:"fd74f62dcfeed313ad25ca4ff1551d94"},{url:"/icons/icon-512x512.png",revision:"224d958ea654e872e5358c676c9f8b74"},{url:"/icons/icon-72x72.png",revision:"50f99277dd0fa17d125f867977e27a42"},{url:"/icons/icon-96x96.png",revision:"189db0f849ee1efc80f0f2166a298792"},{url:"/images/dunamis-name.png",revision:"f017538081345e7bbbe69f254f307dff"},{url:"/images/ios-install/add-button.svg",revision:"9a682a5a6e4a5fc2442f132ccdd31680"},{url:"/images/ios-install/add-homescreen.svg",revision:"2e8dcb8ca66ef3efc15aedc74c408ca9"},{url:"/images/ios-install/share-icon.svg",revision:"71da024878ba2662933c85e7d1d61059"},{url:"/ios-install-guide.css",revision:"4835ba91ec7b058dd4b3879e46487665"},{url:"/manifest.json",revision:"e798f5ff9ec645195f348e5a746a24b9"},{url:"/next.svg",revision:"8e061864f388b47f33a1c3780831193e"},{url:"/pockets-logo-style.css",revision:"c4b9c50ea9ea0a7302bee4c9158aef22"},{url:"/pockets-logo.svg",revision:"377573eb32eb696ee9e5fcf7ec9a0fa5"},{url:"/pwa-icon-instructions.md",revision:"a3a2e98103f11836de82c1c221a970ab"},{url:"/vercel.svg",revision:"c0af2f507b369b085b35ef4bbe3bcf1e"},{url:"/window.svg",revision:"a2760511c65806022ad20adf74370ff3"}],{ignoreURLParametersMatching:[]}),e.cleanupOutdatedCaches(),e.registerRoute("/",new e.NetworkFirst({cacheName:"start-url",plugins:[{cacheWillUpdate:async({request:e,response:a,event:s,state:i})=>a&&"opaqueredirect"===a.type?new Response(a.body,{status:200,statusText:"OK",headers:a.headers}):a}]}),"GET"),e.registerRoute(/^https:\/\/fonts\.(?:gstatic)\.com\/.*/i,new e.CacheFirst({cacheName:"google-fonts-webfonts",plugins:[new e.ExpirationPlugin({maxEntries:4,maxAgeSeconds:31536e3})]}),"GET"),e.registerRoute(/^https:\/\/fonts\.(?:googleapis)\.com\/.*/i,new e.StaleWhileRevalidate({cacheName:"google-fonts-stylesheets",plugins:[new e.ExpirationPlugin({maxEntries:4,maxAgeSeconds:604800})]}),"GET"),e.registerRoute(/\.(?:eot|otf|ttc|ttf|woff|woff2|font.css)$/i,new e.StaleWhileRevalidate({cacheName:"static-font-assets",plugins:[new e.ExpirationPlugin({maxEntries:4,maxAgeSeconds:604800})]}),"GET"),e.registerRoute(/\.(?:jpg|jpeg|gif|png|svg|ico|webp)$/i,new e.StaleWhileRevalidate({cacheName:"static-image-assets",plugins:[new e.ExpirationPlugin({maxEntries:64,maxAgeSeconds:86400})]}),"GET"),e.registerRoute(/\/_next\/image\?url=.+$/i,new e.StaleWhileRevalidate({cacheName:"next-image",plugins:[new e.ExpirationPlugin({maxEntries:64,maxAgeSeconds:86400})]}),"GET"),e.registerRoute(/\.(?:mp3|wav|ogg)$/i,new e.CacheFirst({cacheName:"static-audio-assets",plugins:[new e.RangeRequestsPlugin,new e.ExpirationPlugin({maxEntries:32,maxAgeSeconds:86400})]}),"GET"),e.registerRoute(/\.(?:mp4)$/i,new e.CacheFirst({cacheName:"static-video-assets",plugins:[new e.RangeRequestsPlugin,new e.ExpirationPlugin({maxEntries:32,maxAgeSeconds:86400})]}),"GET"),e.registerRoute(/\.(?:js)$/i,new e.StaleWhileRevalidate({cacheName:"static-js-assets",plugins:[new e.ExpirationPlugin({maxEntries:32,maxAgeSeconds:86400})]}),"GET"),e.registerRoute(/\.(?:css|less)$/i,new e.StaleWhileRevalidate({cacheName:"static-style-assets",plugins:[new e.ExpirationPlugin({maxEntries:32,maxAgeSeconds:86400})]}),"GET"),e.registerRoute(/\/_next\/data\/.+\/.+\.json$/i,new e.StaleWhileRevalidate({cacheName:"next-data",plugins:[new e.ExpirationPlugin({maxEntries:32,maxAgeSeconds:86400})]}),"GET"),e.registerRoute(/\.(?:json|xml|csv)$/i,new e.NetworkFirst({cacheName:"static-data-assets",plugins:[new e.ExpirationPlugin({maxEntries:32,maxAgeSeconds:86400})]}),"GET"),e.registerRoute((({url:e})=>{if(!(self.origin===e.origin))return!1;const a=e.pathname;return!a.startsWith("/api/auth/")&&!!a.startsWith("/api/")}),new e.NetworkFirst({cacheName:"apis",networkTimeoutSeconds:10,plugins:[new e.ExpirationPlugin({maxEntries:16,maxAgeSeconds:86400})]}),"GET"),e.registerRoute((({url:e})=>{if(!(self.origin===e.origin))return!1;return!e.pathname.startsWith("/api/")}),new e.NetworkFirst({cacheName:"others",networkTimeoutSeconds:10,plugins:[new e.ExpirationPlugin({maxEntries:32,maxAgeSeconds:86400})]}),"GET"),e.registerRoute((({url:e})=>!(self.origin===e.origin)),new e.NetworkFirst({cacheName:"cross-origin",networkTimeoutSeconds:10,plugins:[new e.ExpirationPlugin({maxEntries:32,maxAgeSeconds:3600})]}),"GET")}));
