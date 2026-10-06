const incoming=[40,45,50,60,65,55,45], closed=[35,40,42,45,50,48,50];
const channels=['email','Чат','Телефон'], late=[30,18,6];
let q=20;const queue=incoming.map((n,i)=>(q+=n-closed[i]));
const total=incoming.reduce((a,b)=>a+b,0),done=closed.reduce((a,b)=>a+b,0),overdue=late.reduce((a,b)=>a+b,0),share=overdue/total*100;
function txt(id,value){document.getElementById(id).textContent=value;}
txt('queueEnd',dkFmt.num(q));txt('queueDelta',dkFmt.delta(q-20)+' заявок');txt('queueNote','Начало: '+dkFmt.num(20)+' заявок → конец: '+dkFmt.num(q));txt('lateShare',dkFmt.pct(share));txt('slaNote',dkFmt.num(overdue)+' из '+dkFmt.num(total)+' · порог '+dkFmt.pct(10)+' · превышение '+dkFmt.pp(share-10));txt('flowNote','Входящие: '+dkFmt.num(total)+' · закрытые: '+dkFmt.num(done)+' · прирост очереди: '+dkFmt.delta(total-done));
const days=incoming.map((_,i)=>'День '+dkFmt.num(i+1));
dkChart(document.getElementById('queueChart'),{type:'line',label:'Очередь на конец каждого дня, заявок',unit:'заявок',categories:days,series:[{name:'Очередь',data:queue}]});
dkChart(document.getElementById('channelChart'),{type:'bar-h',label:'Просроченные входящие по каналам, заявок',categories:channels,series:[{name:'Просрочено',data:late}]});
const body=document.getElementById('daily');incoming.forEach((n,i)=>{const tr=document.createElement('tr');[days[i],dkFmt.num(n),dkFmt.num(closed[i]),dkFmt.num(queue[i])].forEach((v,j)=>{const td=document.createElement(j?'td':'th');if(j)td.className='dk-td-num';else td.scope='row';td.textContent=v;tr.append(td);});body.append(tr);});
txt('channelsText','Просрочки: '+channels.map((c,i)=>c+' — '+dkFmt.num(late[i])).join('; ')+'. Всего — '+dkFmt.num(overdue)+'.');
