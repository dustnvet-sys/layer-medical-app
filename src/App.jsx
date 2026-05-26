import { useState, useEffect, useRef } from "react";

const SUPABASE_URL = "https://lfxiptbxgmwnohfcobpf.supabase.co";
const SUPABASE_KEY = "sb_publishable_dLpzKQSvKQnRI-q16h3y7g_UUUQMiLd";
const H = { "Content-Type": "application/json", "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` };

const ROLES = { owner:"원장", manager:"팀장", staff:"직원" };
const ROLE_COLORS = { owner:"#C9A84C", manager:"#9B7EC2", staff:"#5BA4CF" };
const ROLE_PERMS = {
  owner:   { canCreate:true, canEdit:true, canDelete:true, canManageUsers:true  },
  manager: { canCreate:true, canEdit:true, canDelete:false, canManageUsers:false },
  staff:   { canCreate:false, canEdit:false, canDelete:false, canManageUsers:false },
};
const CATEGORIES = ["경영전략","인사/채용","마케팅","시설관리","의료장비","고객서비스","재무/회계","기타"];
const PRIORITIES = { high:"높음", mid:"보통", low:"낮음" };
const PRIORITY_COLORS = { high:"#FF6B6B", mid:"#FFD93D", low:"#6BCB77" };
const STATUSES = { todo:"예정", doing:"진행중", review:"검토중", done:"완료" };
const STATUS_COLORS = { todo:"#5BA4CF", doing:"#FFD93D", review:"#C77DFF", done:"#6BCB77" };
const G = "#C9A84C";

const FILE_ICONS = { pdf:"📄",doc:"📝",docx:"📝",xls:"📊",xlsx:"📊",ppt:"📑",pptx:"📑",jpg:"🖼",jpeg:"🖼",png:"🖼",gif:"🖼",mp4:"🎬",mov:"🎬",zip:"🗜",hwp:"📋",default:"📎" };
const getFileIcon = (name="") => FILE_ICONS[name.split(".").pop().toLowerCase()] || FILE_ICONS.default;
const fmtSize = (b) => b<1024?b+"B":b<1024*1024?(b/1024).toFixed(1)+"KB":(b/(1024*1024)).toFixed(1)+"MB";
const fmtDate = (iso) => { if(!iso) return "-"; const d=new Date(iso); return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,"0")}.${String(d.getDate()).padStart(2,"0")}`; };
const isOverdue = (d,s) => d&&s!=="done"&&new Date(d)<new Date();

export default function App() {
  const [currentUserId, setCurrentUserId] = useState("u1");
  const [users, setUsers]   = useState([]);
  const [tasks, setTasks]   = useState([]);
  const [comments, setComments] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage]     = useState("tasks");
  const [taskModal, setTaskModal] = useState(null);
  const [userModal, setUserModal] = useState(null);
  const [filterStatus, setFilterStatus]     = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [searchQ, setSearchQ] = useState("");
  const [newComment, setNewComment] = useState("");
  const [toast, setToast] = useState(null);

  const currentUser = users.find(u=>u.id===currentUserId) || users[0] || {};
  const perms = ROLE_PERMS[currentUser?.role] || ROLE_PERMS.staff;

  const showToast = (msg, type="ok") => { setToast({msg,type}); setTimeout(()=>setToast(null),2800); };

  const loadAll = async () => {
    setLoading(true);
    try {
      const [u,t,c,a] = await Promise.all([
        fetch(`${SUPABASE_URL}/rest/v1/layer_users?select=*&order=created_at`, {headers:H}).then(r=>r.json()),
        fetch(`${SUPABASE_URL}/rest/v1/layer_tasks?select=*&order=created_at.desc`, {headers:H}).then(r=>r.json()),
        fetch(`${SUPABASE_URL}/rest/v1/layer_comments?select=*&order=created_at`, {headers:H}).then(r=>r.json()),
        fetch(`${SUPABASE_URL}/rest/v1/layer_attachments?select=*&order=uploaded_at`, {headers:H}).then(r=>r.json()),
      ]);
      if (Array.isArray(u)) setUsers(u);
      if (Array.isArray(t)) setTasks(t);
      if (Array.isArray(c)) setComments(c);
      if (Array.isArray(a)) setAttachments(a);
    } catch(e) { showToast("데이터 불러오기 실패", "warn"); }
    setLoading(false);
  };

  useEffect(()=>{ loadAll(); }, []);
  useEffect(()=>{ const t=setInterval(loadAll,30000); return ()=>clearInterval(t); }, []);

  const filteredTasks = tasks.filter(t => {
    if (filterStatus!=="all"&&t.status!==filterStatus) return false;
    if (filterPriority!=="all"&&t.priority!==filterPriority) return false;
    if (filterCategory!=="all"&&t.category!==filterCategory) return false;
    if (searchQ&&!t.title.includes(searchQ)) return false;
    return true;
  });

  const createTask = async (form) => {
    const id = `t${Date.now()}`;
    await fetch(`${SUPABASE_URL}/rest/v1/layer_tasks`, { method:"POST", headers:{...H,"Prefer":"return=minimal"}, body:JSON.stringify({id,...form,created_by:currentUserId,created_at:new Date().toISOString()}) });
    await loadAll(); setTaskModal(null); showToast("할 일이 추가됐어요!");
  };
  const updateTask = async (id, patch) => {
    const {comments:_c,attachments:_a,...data} = patch;
    await fetch(`${SUPABASE_URL}/rest/v1/layer_tasks?id=eq.${id}`, { method:"PATCH", headers:{...H,"Prefer":"return=minimal"}, body:JSON.stringify(data) });
    await loadAll();
    setTaskModal(prev => prev?.task ? {...prev, task:{...prev.task,...patch,id}} : prev);
  };
  const deleteTask = async (id) => {
    await fetch(`${SUPABASE_URL}/rest/v1/layer_tasks?id=eq.${id}`, { method:"DELETE", headers:H });
    await loadAll(); setTaskModal(null); showToast("삭제됐어요.", "warn");
  };
  const addComment = async (taskId) => {
    if (!newComment.trim()) return;
    const id = `c${Date.now()}`;
    await fetch(`${SUPABASE_URL}/rest/v1/layer_comments`, { method:"POST", headers:{...H,"Prefer":"return=minimal"}, body:JSON.stringify({id,task_id:taskId,author_id:currentUserId,text:newComment,created_at:new Date().toISOString()}) });
    setNewComment(""); await loadAll();
  };
  const addAttachment = (taskId, file) => {
    if (file.size>3*1024*1024) { showToast("3MB 이하만 가능합니다.","warn"); return; }
    const reader = new FileReader();
    reader.onload = async (e) => {
      const id = `a${Date.now()}`;
      await fetch(`${SUPABASE_URL}/rest/v1/layer_attachments`, { method:"POST", headers:{...H,"Prefer":"return=minimal"}, body:JSON.stringify({id,task_id:taskId,name:file.name,size:file.size,type:file.type,data:e.target.result,uploaded_by:currentUserId,uploaded_at:new Date().toISOString()}) });
      await loadAll(); showToast(`"${file.name}" 업로드 완료!`);
    };
    reader.readAsDataURL(file);
  };
  const removeAttachment = async (attId) => {
    await fetch(`${SUPABASE_URL}/rest/v1/layer_attachments?id=eq.${attId}`, { method:"DELETE", headers:H });
    await loadAll(); showToast("삭제됨","warn");
  };
  const addUser = async (form) => {
    const id=`u${Date.now()}`;
    await fetch(`${SUPABASE_URL}/rest/v1/layer_users`, { method:"POST", headers:{...H,"Prefer":"return=minimal"}, body:JSON.stringify({id,...form,created_at:new Date().toISOString()}) });
    await loadAll(); setUserModal(null); showToast("팀원이 추가됐어요!");
  };
  const updateUser = async (id, form) => {
    await fetch(`${SUPABASE_URL}/rest/v1/layer_users?id=eq.${id}`, { method:"PATCH", headers:{...H,"Prefer":"return=minimal"}, body:JSON.stringify(form) });
    await loadAll(); setUserModal(null); showToast("저장됐어요!");
  };
  const removeUser = async (id) => {
    if (id===currentUserId) return showToast("자신은 삭제할 수 없어요.","warn");
    await fetch(`${SUPABASE_URL}/rest/v1/layer_users?id=eq.${id}`, { method:"DELETE", headers:H });
    await loadAll(); showToast("삭제됐어요.","warn");
  };

  const enrichTask = (t) => ({...t, comments:comments.filter(c=>c.task_id===t.id), attachments:attachments.filter(a=>a.task_id===t.id)});

  if (loading) return (
    <div style={S.screen}>
      <div style={{color:G,fontSize:22,fontFamily:"serif",letterSpacing:4}}>LAYER</div>
      <div style={{color:"rgba(255,255,255,.4)",marginTop:14,fontSize:13}}>데이터 불러오는 중...</div>
    </div>
  );

  return (
    <div style={S.root}>
      <style>{CSS}</style>
      {toast && <div style={{...S.toast,background:toast.type==="warn"?"rgba(255,107,107,.95)":"rgba(107,203,119,.95)"}}>{toast.type==="warn"?"⚠ ":"✓ "}{toast.msg}</div>}
      <aside style={S.sidebar}>
        <div style={S.logoBox}>
          <div style={S.logoMark}><span style={{color:G,fontSize:18,fontWeight:900,fontFamily:"serif",letterSpacing:2}}>L</span></div>
          <div>
            <div style={{color:G,fontSize:16,fontWeight:900,letterSpacing:3,fontFamily:"serif"}}>LAYER</div>
            <div style={{color:"rgba(201,168,76,.5)",fontSize:9,letterSpacing:1.5}}>동물메디컬센터</div>
          </div>
        </div>
        <div style={S.meCard}>
          <div style={{...S.rolePill,background:(ROLE_COLORS[currentUser.role]||G)+"22",color:ROLE_COLORS[currentUser.role]||G,borderColor:(ROLE_COLORS[currentUser.role]||G)+"44"}}>{ROLES[currentUser.role]||"—"}</div>
          <div style={{color:"#fff",fontWeight:700,fontSize:15,marginTop:6}}>{currentUser.name||"로딩중"}</div>
          <div style={{color:"rgba(255,255,255,.35)",fontSize:11,marginTop:2}}>{currentUser.email||""}</div>
        </div>
        <div style={{padding:"0 14px"}}>
          <div style={S.sideLabel}>계정 전환</div>
          {users.map(u=>(
            <button key={u.id} onClick={()=>setCurrentUserId(u.id)} style={{...S.swBtn,...(u.id===currentUserId?S.swBtnOn:{})}}>
              <span style={{color:ROLE_COLORS[u.role],fontSize:10,fontWeight:800}}>{ROLES[u.role]}</span>
              <span style={{color:u.id===currentUserId?"#fff":"rgba(255,255,255,.55)",fontSize:13}}>{u.name}</span>
            </button>
          ))}
        </div>
        <nav style={{padding:"20px 14px 0"}}>
          {[{id:"tasks",icon:"📋",label:"할 일 관리"},{id:"users",icon:"👥",label:"팀원 관리"}].map(n=>(
            <button key={n.id} onClick={()=>setPage(n.id)} style={{...S.navBtn,...(page===n.id?S.navOn:{})}}>
              <span>{n.icon}</span><span>{n.label}</span>
            </button>
          ))}
        </nav>
        <div style={{padding:"8px 18px"}}>
          <button onClick={loadAll} style={{width:"100%",padding:"7px",background:"rgba(201,168,76,.1)",border:"1px solid rgba(201,168,76,.25)",borderRadius:8,color:G,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>🔄 새로고침</button>
        </div>
        <div style={S.statBox}>
          {Object.entries(STATUSES).map(([k,v])=>(
            <div key={k} style={S.statRow}>
              <span style={{...S.statDot,background:STATUS_COLORS[k]}}/><span style={S.statLbl}>{v}</span>
              <span style={S.statNum}>{tasks.filter(t=>t.status===k).length}</span>
            </div>
          ))}
          <div style={{borderTop:"1px solid rgba(255,255,255,.07)",marginTop:8,paddingTop:8}}>
            <div style={S.statRow}>
              <span style={{...S.statDot,background:"rgba(255,255,255,.3)"}}/><span style={S.statLbl}>총 파일</span>
              <span style={S.statNum}>{attachments.length}</span>
            </div>
          </div>
        </div>
      </aside>
      <main style={S.main}>
        {page==="tasks" && <TasksPage tasks={filteredTasks.map(enrichTask)} allTasks={tasks} users={users} perms={perms} filterStatus={filterStatus} setFilterStatus={setFilterStatus} filterPriority={filterPriority} setFilterPriority={setFilterPriority} filterCategory={filterCategory} setFilterCategory={setFilterCategory} searchQ={searchQ} setSearchQ={setSearchQ} onOpen={t=>setTaskModal({mode:"view",task:enrichTask(t)})} onCreate={()=>setTaskModal({mode:"create"})} />}
        {page==="users" && <UsersPage users={users} perms={perms} currentUser={currentUser} tasks={tasks} attachments={attachments} onAdd={()=>setUserModal({mode:"add"})} onEdit={u=>setUserModal({mode:"edit",user:u})} onRemove={removeUser} />}
      </main>
      {taskModal && <TaskModal mode={taskModal.mode} task={taskModal.task} users={users} currentUser={currentUser} perms={perms} newComment={newComment} setNewComment={setNewComment} onClose={()=>{setTaskModal(null);setNewComment("");}} onCreate={createTask} onUpdate={updateTask} onDelete={deleteTask} onAddComment={addComment} onAddAttachment={addAttachment} onRemoveAttachment={removeAttachment} onSwitchMode={m=>setTaskModal(p=>({...p,mode:m}))} />}
      {userModal && <UserModal mode={userModal.mode} user={userModal.user} onClose={()=>setUserModal(null)} onAdd={addUser} onUpdate={updateUser} />}
    </div>
  );
}

function TasksPage({ tasks, allTasks, users, perms, filterStatus, setFilterStatus, filterPriority, setFilterPriority, filterCategory, setFilterCategory, searchQ, setSearchQ, onOpen, onCreate }) {
  const done = allTasks.filter(t=>t.status==="done").length;
  const pct  = allTasks.length?Math.round(done/allTasks.length*100):0;
  return (
    <div style={S.page}>
      <div style={S.pageHdr}>
        <div>
          <h1 style={S.pageTitle}>할 일 관리</h1>
          <p style={S.pageSub}>전체 {allTasks.length}건 · 완료 {done}건 ({pct}%)</p>
          <div style={S.progBar}><div style={{...S.progFill,width:`${pct}%`}}/></div>
        </div>
        {perms.canCreate && <button style={S.goldBtn} onClick={onCreate}>+ 새 할 일</button>}
      </div>
      <div style={S.filterRow}>
        <input style={S.searchBox} placeholder="🔍  제목 검색..." value={searchQ} onChange={e=>setSearchQ(e.target.value)} />
        <Sel value={filterStatus}   onChange={setFilterStatus}   opts={[["all","전체 상태"],...Object.entries(STATUSES)]} />
        <Sel value={filterPriority} onChange={setFilterPriority} opts={[["all","우선순위"],...Object.entries(PRIORITIES)]} />
        <Sel value={filterCategory} onChange={setFilterCategory} opts={[["all","카테고리"],...CATEGORIES.map(c=>[c,c])]} />
      </div>
      {tasks.length===0?<div style={S.empty}>해당 조건의 할 일이 없습니다</div>
        :<div style={S.taskList}>{tasks.map(t=><TaskCard key={t.id} task={t} users={users} onClick={()=>onOpen(t)}/>)}</div>}
    </div>
  );
}

function TaskCard({ task, users, onClick }) {
  const assignee = users.find(u=>u.id===task.assignee_id);
  const over = isOverdue(task.due_date,task.status);
  const files = (task.attachments||[]).length;
  return (
    <div className="tcard" onClick={onClick} style={S.tCard}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          <Chip color={STATUS_COLORS[task.status]}>{STATUSES[task.status]}</Chip>
          <Chip color={PRIORITY_COLORS[task.priority]}>{PRIORITIES[task.priority]}</Chip>
          <Chip color="rgba(255,255,255,.3)">{task.category}</Chip>
        </div>
        <span style={{color:over?"#FF6B6B":"rgba(255,255,255,.35)",fontSize:11,flexShrink:0,marginLeft:8}}>{over&&"⚠ "}{fmtDate(task.due_date)}</span>
      </div>
      <div style={{color:"#fff",fontSize:15,fontWeight:600,marginBottom:10,lineHeight:1.4}}>{task.title}</div>
      <div style={{display:"flex",gap:14,color:"rgba(255,255,255,.35)",fontSize:12}}>
        <span>👤 {assignee?.name||"미배정"}</span>
        <span>💬 {(task.comments||[]).length}</span>
        {files>0&&<span style={{color:G}}>📎 {files}</span>}
      </div>
    </div>
  );
}

function TaskModal({ mode, task, users, currentUser, perms, newComment, setNewComment, onClose, onCreate, onUpdate, onDelete, onAddComment, onAddAttachment, onRemoveAttachment, onSwitchMode }) {
  const fileRef = useRef();
  const [form, setForm] = useState({title:task?.title||"",category:task?.category||CATEGORIES[0],priority:task?.priority||"mid",status:task?.status||"todo",assignee_id:task?.assignee_id||"",due_date:task?.due_date||""});
  const [dragging, setDragging] = useState(false);
  const setF=(k,v)=>setForm(p=>({...p,[k]:v}));
  const isEdit=mode==="edit"||mode==="create";
  const assignee=users.find(u=>u.id===task?.assignee_id);
  const taskComments=task?.comments||[];
  const taskAttachments=task?.attachments||[];
  const handleSave=()=>{if(!form.title.trim())return alert("제목을 입력해주세요.");mode==="create"?onCreate(form):(onUpdate(task.id,form),onSwitchMode("view"));};
  const handleFiles=(files)=>{if(!task)return;Array.from(files).forEach(f=>onAddAttachment(task.id,f));};
  const handleDrop=(e)=>{e.preventDefault();setDragging(false);handleFiles(e.dataTransfer.files);};
  const downloadFile=(att)=>{const a=document.createElement("a");a.href=att.data;a.download=att.name;a.click();};
  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e=>e.stopPropagation()}>
        <div style={S.mHdr}>
          <h2 style={S.mTitle}>{mode==="create"?"새 할 일 추가":mode==="edit"?"할 일 수정":"할 일 상세"}</h2>
          <button style={S.xBtn} onClick={onClose}>✕</button>
        </div>
        <div style={S.mBody}>
          {isEdit?(
            <div style={{display:"flex",flexDirection:"column",gap:16}}>
              <FRow label="제목 *"><input style={S.inp} value={form.title} onChange={e=>setF("title",e.target.value)} placeholder="할 일 제목을 입력하세요" /></FRow>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <FRow label="카테고리"><Sel2 value={form.category} onChange={v=>setF("category",v)} opts={CATEGORIES.map(c=>[c,c])} /></FRow>
                <FRow label="우선순위"><Sel2 value={form.priority} onChange={v=>setF("priority",v)} opts={Object.entries(PRIORITIES)} /></FRow>
                <FRow label="상태"><Sel2 value={form.status} onChange={v=>setF("status",v)} opts={Object.entries(STATUSES)} /></FRow>
                <FRow label="담당자"><Sel2 value={form.assignee_id} onChange={v=>setF("assignee_id",v)} opts={[["","미배정"],...users.map(u=>[u.id,u.name])]} /></FRow>
              </div>
              <FRow label="마감일"><input type="date" style={S.inp} value={form.due_date} onChange={e=>setF("due_date",e.target.value)} /></FRow>
              <div style={{display:"flex",gap:10,marginTop:4}}>
                <button style={S.grayBtn} onClick={()=>mode==="create"?onClose():onSwitchMode("view")}>취소</button>
                <button style={{...S.goldBtn,flex:1}} onClick={handleSave}>{mode==="create"?"추가하기":"저장하기"}</button>
              </div>
            </div>
          ):(
            <div>
              <div style={{display:"flex",gap:7,flexWrap:"wrap",marginBottom:14}}>
                <Chip color={STATUS_COLORS[task.status]} lg>{STATUSES[task.status]}</Chip>
                <Chip color={PRIORITY_COLORS[task.priority]} lg>{PRIORITIES[task.priority]} 우선순위</Chip>
                <Chip color="rgba(255,255,255,.3)" lg>{task.category}</Chip>
              </div>
              <h3 style={{color:"#fff",fontSize:19,fontWeight:700,marginBottom:16,lineHeight:1.4}}>{task.title}</h3>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:20}}>
                {[["담당자",assignee?.name||"미배정"],["마감일",fmtDate(task.due_date)+(isOverdue(task.due_date,task.status)?" ⚠":"")],["등록자",users.find(u=>u.id===task.created_by)?.name||"-"],["등록일",fmtDate(task.created_at)]].map(([k,v])=>(
                  <div key={k} style={S.dItem}><span style={S.dKey}>{k}</span><span style={{color:v.includes("⚠")?"#FF6B6B":"#fff",fontSize:14,fontWeight:600}}>{v}</span></div>
                ))}
              </div>
              {perms.canEdit&&(
                <div style={{marginBottom:20}}>
                  <div style={S.secLabel}>상태 변경</div>
                  <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
                    {Object.entries(STATUSES).map(([k,v])=>(
                      <button key={k} onClick={()=>onUpdate(task.id,{status:k})} style={{...S.stBtn,...(task.status===k?{background:STATUS_COLORS[k]+"30",borderColor:STATUS_COLORS[k],color:STATUS_COLORS[k]}:{})}}>{v}</button>
                    ))}
                  </div>
                </div>
              )}
              <div style={{marginBottom:20}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                  <div style={S.secLabel}>첨부파일 {taskAttachments.length}개</div>
                  <button style={S.uploadBtn} onClick={()=>fileRef.current?.click()}>+ 파일 추가</button>
                  <input ref={fileRef} type="file" multiple style={{display:"none"}} onChange={e=>handleFiles(e.target.files)} />
                </div>
                <div onDragOver={e=>{e.preventDefault();setDragging(true)}} onDragLeave={()=>setDragging(false)} onDrop={handleDrop} onClick={()=>fileRef.current?.click()} style={{...S.dropZone,...(dragging?S.dropZoneActive:{})}}>
                  <span style={{fontSize:22}}>📎</span>
                  <span style={{color:"rgba(255,255,255,.4)",fontSize:12,marginTop:4}}>클릭하거나 파일을 여기로 드래그 (최대 3MB)</span>
                </div>
                {taskAttachments.length>0&&(
                  <div style={{display:"flex",flexDirection:"column",gap:8,marginTop:10}}>
                    {taskAttachments.map(att=>{const up=users.find(u=>u.id===att.uploaded_by);return(
                      <div key={att.id} style={S.attItem}>
                        {att.type?.startsWith("image/")&&<img src={att.data} alt={att.name} style={{width:"100%",borderRadius:8,marginBottom:8,maxHeight:180,objectFit:"cover"}} />}
                        <div style={{display:"flex",alignItems:"center",gap:10}}>
                          <span style={{fontSize:22,flexShrink:0}}>{getFileIcon(att.name)}</span>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{color:"#fff",fontSize:13,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{att.name}</div>
                            <div style={{color:"rgba(255,255,255,.35)",fontSize:11,marginTop:2}}>{fmtSize(att.size)} · {up?.name||"알수없음"} · {new Date(att.uploaded_at).toLocaleDateString("ko-KR")}</div>
                          </div>
                          <div style={{display:"flex",gap:6,flexShrink:0}}>
                            <button style={S.attBtn} onClick={()=>downloadFile(att)}>⬇</button>
                            {perms.canEdit&&<button style={{...S.attBtn,color:"#FF6B6B"}} onClick={()=>onRemoveAttachment(att.id)}>✕</button>}
                          </div>
                        </div>
                      </div>
                    );})}
                  </div>
                )}
              </div>
              <div style={S.secLabel}>댓글 {taskComments.length}개</div>
              <div style={S.cmtList}>
                {taskComments.length===0?<div style={{color:"rgba(255,255,255,.3)",fontSize:13,padding:"10px 0"}}>댓글이 없습니다</div>
                  :taskComments.map(c=>{const au=users.find(u=>u.id===c.author_id);return(
                    <div key={c.id} style={S.cmtItem}>
                      <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:5}}>
                        <span style={{color:ROLE_COLORS[au?.role||"staff"],fontWeight:700,fontSize:13}}>{au?.name||"?"}</span>
                        <span style={{color:"rgba(255,255,255,.3)",fontSize:11}}>{new Date(c.created_at).toLocaleString("ko-KR",{month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"})}</span>
                      </div>
                      <div style={{color:"rgba(255,255,255,.75)",fontSize:13,lineHeight:1.55}}>{c.text}</div>
                    </div>
                  );})}
              </div>
              <div style={{display:"flex",gap:8,marginTop:10}}>
                <input style={{...S.inp,flex:1}} placeholder="댓글을 입력하세요..." value={newComment} onChange={e=>setNewComment(e.target.value)} onKeyDown={e=>e.key==="Enter"&&onAddComment(task.id)} />
                <button style={S.goldBtn} onClick={()=>onAddComment(task.id)}>등록</button>
              </div>
              <div style={{display:"flex",gap:9,marginTop:20}}>
                {perms.canEdit&&<button style={{...S.grayBtn,flex:1}} onClick={()=>onSwitchMode("edit")}>✏ 수정</button>}
                {perms.canDelete&&<button style={S.redBtn} onClick={()=>{if(window.confirm("삭제할까요?"))onDelete(task.id);}}>🗑 삭제</button>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function UsersPage({ users, perms, currentUser, tasks, attachments, onAdd, onEdit, onRemove }) {
  return (
    <div style={S.page}>
      <div style={S.pageHdr}>
        <div><h1 style={S.pageTitle}>팀원 관리</h1><p style={S.pageSub}>총 {users.length}명</p></div>
        {perms.canManageUsers&&<button style={S.goldBtn} onClick={onAdd}>+ 팀원 추가</button>}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(270px,1fr))",gap:14}}>
        {users.map(u=>{const mine=tasks.filter(t=>t.assignee_id===u.id);const doneN=mine.filter(t=>t.status==="done").length;const files=attachments.filter(a=>mine.some(t=>t.id===a.task_id)).length;return(
          <div key={u.id} style={S.uCard}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}>
              <div style={{...S.rolePill,background:ROLE_COLORS[u.role]+"22",color:ROLE_COLORS[u.role],borderColor:ROLE_COLORS[u.role]+"44"}}>{ROLES[u.role]}</div>
              {perms.canManageUsers&&<div style={{display:"flex",gap:6}}>
                <button style={S.iBtn} onClick={()=>onEdit(u)}>✏</button>
                {u.id!==currentUser.id&&<button style={{...S.iBtn,color:"#FF6B6B"}} onClick={()=>{if(window.confirm(`${u.name}님을 삭제할까요?`))onRemove(u.id);}}>🗑</button>}
              </div>}
            </div>
            <div style={{color:"#fff",fontSize:17,fontWeight:700,marginBottom:3}}>{u.name}</div>
            <div style={{color:"rgba(255,255,255,.4)",fontSize:12,marginBottom:14}}>{u.email}</div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              <div style={S.sPill}>담당 {mine.length}건</div>
              <div style={{...S.sPill,background:"rgba(107,203,119,.12)",color:"#6BCB77"}}>완료 {doneN}건</div>
              {files>0&&<div style={{...S.sPill,background:"rgba(201,168,76,.12)",color:G}}>파일 {files}개</div>}
            </div>
          </div>
        );})}
      </div>
    </div>
  );
}

function UserModal({ mode, user, onClose, onAdd, onUpdate }) {
  const [form, setForm] = useState({name:user?.name||"",email:user?.email||"",role:user?.role||"staff"});
  const setF=(k,v)=>setForm(p=>({...p,[k]:v}));
  const save=()=>{if(!form.name.trim())return alert("이름을 입력해주세요.");mode==="add"?onAdd(form):onUpdate(user.id,form);};
  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={{...S.modal,maxWidth:400}} onClick={e=>e.stopPropagation()}>
        <div style={S.mHdr}><h2 style={S.mTitle}>{mode==="add"?"팀원 추가":"팀원 정보 수정"}</h2><button style={S.xBtn} onClick={onClose}>✕</button></div>
        <div style={S.mBody}>
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <FRow label="이름 *"><input style={S.inp} value={form.name} onChange={e=>setF("name",e.target.value)} placeholder="홍길동" /></FRow>
            <FRow label="이메일"><input style={S.inp} value={form.email} onChange={e=>setF("email",e.target.value)} placeholder="example@layer.vet" /></FRow>
            <FRow label="권한"><Sel2 value={form.role} onChange={v=>setF("role",v)} opts={Object.entries(ROLES)} /></FRow>
            <div style={S.infoBox}><b>권한 안내</b><br/>원장: 모든 기능 + 팀원 관리<br/>팀장: 할 일 생성·수정·파일 첨부<br/>직원: 댓글·파일 다운로드만 가능</div>
            <div style={{display:"flex",gap:10}}>
              <button style={S.grayBtn} onClick={onClose}>취소</button>
              <button style={{...S.goldBtn,flex:1}} onClick={save}>{mode==="add"?"추가하기":"저장하기"}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const Chip=({color,children,lg})=>(<span style={{background:color+"22",color,border:`1px solid ${color}44`,borderRadius:20,padding:lg?"3px 10px":"2px 8px",fontSize:lg?12:11,fontWeight:700}}>{children}</span>);
const FRow=({label,children})=>(<div><div style={{color:"rgba(201,168,76,.75)",fontSize:11,fontWeight:700,marginBottom:6,textTransform:"uppercase",letterSpacing:"0.5px"}}>{label}</div>{children}</div>);
const Sel=({value,onChange,opts})=>(<select style={S.filterSel} value={value} onChange={e=>onChange(e.target.value)}>{opts.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>);
const Sel2=({value,onChange,opts})=>(<select style={S.inp} value={value} onChange={e=>onChange(e.target.value)}>{opts.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>);

const S={
  screen:{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"#0A0A0F",fontFamily:"'Noto Sans KR',sans-serif"},
  toast:{position:"fixed",top:20,right:20,zIndex:999,padding:"12px 20px",borderRadius:12,color:"#fff",fontWeight:700,fontSize:13,boxShadow:"0 4px 20px rgba(0,0,0,.4)",fontFamily:"'Noto Sans KR',sans-serif"},
  root:{display:"flex",minHeight:"100vh",background:"#0A0A0F",fontFamily:"'Noto Sans KR','Apple SD Gothic Neo',sans-serif",color:"#fff"},
  sidebar:{width:234,minWidth:234,background:"#0D0D14",borderRight:"1px solid rgba(201,168,76,.13)",display:"flex",flexDirection:"column",padding:"22px 0 16px"},
  logoBox:{display:"flex",alignItems:"center",gap:11,padding:"0 18px 22px",borderBottom:"1px solid rgba(201,168,76,.1)"},
  logoMark:{width:40,height:40,borderRadius:10,background:"rgba(201,168,76,.1)",border:"1px solid rgba(201,168,76,.3)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0},
  meCard:{margin:"18px 14px 0",background:"rgba(201,168,76,.06)",border:"1px solid rgba(201,168,76,.14)",borderRadius:12,padding:"14px"},
  rolePill:{display:"inline-block",borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:700,border:"1px solid"},
  sideLabel:{color:"rgba(255,255,255,.22)",fontSize:10,textTransform:"uppercase",letterSpacing:1.2,marginBottom:8,marginTop:18},
  swBtn:{display:"flex",alignItems:"center",gap:8,width:"100%",padding:"8px 10px",background:"transparent",border:"1px solid rgba(255,255,255,.06)",borderRadius:8,cursor:"pointer",marginBottom:4,textAlign:"left",transition:"all .15s",fontFamily:"inherit"},
  swBtnOn:{background:"rgba(201,168,76,.1)",borderColor:"rgba(201,168,76,.3)"},
  navBtn:{display:"flex",alignItems:"center",gap:8,width:"100%",padding:"10px 12px",borderRadius:10,border:"none",background:"transparent",color:"rgba(255,255,255,.45)",fontSize:13,cursor:"pointer",marginBottom:4,transition:"all .15s",fontFamily:"inherit"},
  navOn:{background:"rgba(201,168,76,.1)",color:G,fontWeight:700},
  statBox:{marginTop:"auto",padding:"14px 14px 0",borderTop:"1px solid rgba(255,255,255,.07)"},
  statRow:{display:"flex",alignItems:"center",gap:8,marginBottom:8},
  statDot:{width:7,height:7,borderRadius:"50%",flexShrink:0},
  statLbl:{flex:1,color:"rgba(255,255,255,.38)",fontSize:12},
  statNum:{color:G,fontWeight:700,fontSize:13},
  main:{flex:1,overflowY:"auto"},
  page:{padding:26,maxWidth:880},
  pageHdr:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:22},
  pageTitle:{color:"#fff",fontSize:22,fontWeight:800,margin:0,marginBottom:4},
  pageSub:{color:"rgba(255,255,255,.38)",fontSize:12},
  progBar:{marginTop:8,height:4,background:"rgba(255,255,255,.08)",borderRadius:99,width:240},
  progFill:{height:"100%",background:`linear-gradient(90deg,${G},#E8C56A)`,borderRadius:99,transition:"width .4s"},
  goldBtn:{padding:"10px 18px",background:`linear-gradient(135deg,${G},#E8C56A)`,border:"none",borderRadius:10,color:"#0A0A0F",fontWeight:800,fontSize:13,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"},
  grayBtn:{padding:"10px 18px",background:"rgba(255,255,255,.07)",border:"1px solid rgba(255,255,255,.13)",borderRadius:10,color:"rgba(255,255,255,.7)",fontSize:13,cursor:"pointer",fontFamily:"inherit"},
  redBtn:{padding:"10px 16px",background:"rgba(255,107,107,.1)",border:"1px solid rgba(255,107,107,.28)",borderRadius:10,color:"#FF6B6B",fontSize:13,cursor:"pointer",fontFamily:"inherit"},
  uploadBtn:{padding:"5px 12px",background:"rgba(201,168,76,.12)",border:"1px solid rgba(201,168,76,.3)",borderRadius:8,color:G,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"},
  filterRow:{display:"flex",gap:9,flexWrap:"wrap",marginBottom:18},
  searchBox:{flex:1,minWidth:150,padding:"9px 13px",background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.1)",borderRadius:10,color:"#fff",fontSize:13,fontFamily:"inherit",outline:"none"},
  filterSel:{padding:"9px 11px",background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.1)",borderRadius:10,color:"rgba(255,255,255,.7)",fontSize:13,fontFamily:"inherit",cursor:"pointer",outline:"none"},
  taskList:{display:"flex",flexDirection:"column",gap:9},
  tCard:{background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",borderRadius:14,padding:"15px 17px",cursor:"pointer",transition:"all .15s"},
  empty:{textAlign:"center",padding:"60px 0",color:"rgba(255,255,255,.3)",fontSize:14},
  overlay:{position:"fixed",inset:0,background:"rgba(0,0,0,.72)",display:"flex",alignItems:"center",justifyContent:"center",padding:16,zIndex:100,backdropFilter:"blur(4px)"},
  modal:{background:"#13131F",border:"1px solid rgba(201,168,76,.18)",borderRadius:20,width:"100%",maxWidth:560,maxHeight:"92vh",display:"flex",flexDirection:"column",overflow:"hidden"},
  mHdr:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"18px 22px 14px",borderBottom:"1px solid rgba(255,255,255,.07)"},
  mTitle:{color:"#fff",fontSize:16,fontWeight:800,margin:0},
  xBtn:{background:"none",border:"none",color:"rgba(255,255,255,.35)",fontSize:18,cursor:"pointer",padding:4},
  mBody:{padding:"18px 22px 22px",overflowY:"auto"},
  inp:{width:"100%",padding:"10px 12px",background:"rgba(255,255,255,.07)",border:"1px solid rgba(255,255,255,.12)",borderRadius:10,color:"#fff",fontSize:13,fontFamily:"inherit",outline:"none",boxSizing:"border-box"},
  secLabel:{color:"rgba(201,168,76,.7)",fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:9},
  dItem:{background:"rgba(255,255,255,.04)",borderRadius:10,padding:"9px 11px"},
  dKey:{display:"block",color:"rgba(255,255,255,.33)",fontSize:11,marginBottom:3},
  stBtn:{padding:"6px 12px",background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.1)",borderRadius:8,color:"rgba(255,255,255,.45)",fontSize:12,cursor:"pointer",fontFamily:"inherit",transition:"all .15s"},
  dropZone:{border:"1.5px dashed rgba(255,255,255,.15)",borderRadius:12,padding:"18px",display:"flex",flexDirection:"column",alignItems:"center",gap:4,cursor:"pointer",transition:"all .2s"},
  dropZoneActive:{border:"1.5px dashed rgba(201,168,76,.6)",background:"rgba(201,168,76,.06)"},
  attItem:{background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",borderRadius:12,padding:"12px"},
  attBtn:{background:"rgba(255,255,255,.07)",border:"1px solid rgba(255,255,255,.1)",borderRadius:7,color:"rgba(255,255,255,.6)",width:28,height:28,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12},
  cmtList:{maxHeight:180,overflowY:"auto",display:"flex",flexDirection:"column",gap:9,marginBottom:4},
  cmtItem:{background:"rgba(255,255,255,.04)",borderRadius:10,padding:"10px 12px"},
  uCard:{background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",borderRadius:14,padding:"18px"},
  sPill:{background:"rgba(201,168,76,.1)",color:G,borderRadius:20,padding:"3px 11px",fontSize:12,fontWeight:700},
  iBtn:{background:"rgba(255,255,255,.07)",border:"1px solid rgba(255,255,255,.1)",borderRadius:7,color:"rgba(255,255,255,.55)",width:28,height:28,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12},
  infoBox:{background:"rgba(201,168,76,.06)",border:"1px solid rgba(201,168,76,.18)",borderRadius:10,padding:"12px 14px",color:"rgba(255,255,255,.5)",fontSize:12,lineHeight:1.75},
};
const CSS=`
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;600;700;800&display=swap');
  *{box-sizing:border-box;margin:0;padding:0;}body{background:#0A0A0F;}
  ::-webkit-scrollbar{width:4px;}::-webkit-scrollbar-track{background:transparent;}::-webkit-scrollbar-thumb{background:rgba(201,168,76,.22);border-radius:99px;}
  .tcard:hover{background:rgba(255,255,255,.07)!important;border-color:rgba(201,168,76,.22)!important;transform:translateY(-1px);}
  input[type="date"]::-webkit-calendar-picker-indicator{filter:invert(.6);}select option{background:#1a1a2e;color:#fff;}
`;
