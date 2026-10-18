const {app,BrowserWindow,WebContentsView,ipcMain}=require('electron');
const path=require('node:path');
app.setPath('userData',path.join(__dirname,'../.quanta/hermes-browser'));
const home=process.argv.includes('--qs')?'http://127.0.0.1:5173/?panel=hermes':'http://127.0.0.1:3000/#/hermes';
const providers={chatgpt:'https://chatgpt.com/',claude:'https://claude.ai/',gemini:'https://gemini.google.com/',grok:'https://grok.com/'};
let window;const views=new Map();let active;
function trusted(event){return event.sender===window.webContents&&new URL(event.senderFrame.url).origin===new URL(home).origin;}
function allowed(url){try{const parsed=new URL(url);return parsed.protocol==='https:'&&!['localhost','127.0.0.1','[::1]'].includes(parsed.hostname)&&!/^\d+\.\d+\.\d+\.\d+$/.test(parsed.hostname);}catch{return false;}}
function hide(){if(active){window.contentView.removeChildView(active);active=undefined;}}
app.whenReady().then(()=>{
 window=new BrowserWindow({width:1500,height:1000,title:'Gnoesis Hermes',webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
 window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 window.webContents.on('will-navigate',(event,url)=>{if(new URL(url).origin!==new URL(home).origin)event.preventDefault();});
 ipcMain.handle('hermes-browser',async(event,request)=>{
  if(!trusted(event))throw new Error('Local Hermes page required.');
  if(request.action==='hide'){hide();return;}
  if(!providers[request.provider]||!['work','personal','ideas'].includes(request.space))throw new Error('Unknown browser tab.');
  const key=request.space+':'+request.provider;
  if(request.action==='open'){
   hide();let view=views.get(key);
   if(!view){
    view=new WebContentsView({webPreferences:{partition:'persist:hermes-'+request.space+'-'+request.provider,contextIsolation:true,nodeIntegration:false,sandbox:true}});
    view.webContents.session.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
    view.webContents.session.on('will-download',event=>event.preventDefault());
    view.webContents.on('will-navigate',(event,url)=>{if(!allowed(url))event.preventDefault();});
    view.webContents.on('will-redirect',(event,url)=>{if(!allowed(url))event.preventDefault();});
    view.webContents.setWindowOpenHandler(({url})=>{
     if(!allowed(url))return {action:'deny'};
     return {action:'allow',overrideBrowserWindowOptions:{parent:window,width:650,height:800,webPreferences:{partition:'persist:hermes-'+request.space+'-'+request.provider,contextIsolation:true,nodeIntegration:false,sandbox:true}}};
    });
    views.set(key,view);void view.webContents.loadURL(providers[request.provider]).catch(()=>{});
   }
   active=view;window.contentView.addChildView(view);
  }
  const view=views.get(key);if(!view)return;
  if(request.action==='reload')view.webContents.reload();
  if(request.action==='back'&&view.webContents.navigationHistory.canGoBack())view.webContents.navigationHistory.goBack();
  if(request.action==='bounds'||request.action==='open'){
   const b=request.bounds;const [width,height]=window.getContentSize();
   if(b&&[b.x,b.y,b.width,b.height].every(Number.isFinite))view.setBounds({x:Math.max(0,Math.round(b.x)),y:Math.max(0,Math.round(b.y)),width:Math.max(1,Math.min(width,Math.round(b.width))),height:Math.max(1,Math.min(height,Math.round(b.height)))});
  }
 });
 window.on('closed',()=>{for(const view of views.values())view.webContents.close();views.clear();window=null;});
 void window.loadURL(home);
});
app.on('window-all-closed',()=>app.quit());
