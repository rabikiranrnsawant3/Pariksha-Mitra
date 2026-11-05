// PareekshaSetu authentication backend starter
// Node.js + Express + SQLite + bcrypt + JWT httpOnly cookie.
// For real SMS OTP, configure Twilio Verify credentials in .env.
// Never deploy with DEMO_OTP=true or a weak JWT_SECRET.
require('dotenv').config();
const express = require('express');
const path = require('path');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const twilio = require('twilio');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const IS_PROD = process.env.NODE_ENV === 'production';
const DEMO_OTP = process.env.DEMO_OTP === 'true';
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be set in .env and contain at least 32 characters.');
}
if (IS_PROD && DEMO_OTP) throw new Error('DEMO_OTP must be false in production.');

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({limit:'20kb'}));
app.use(cookieParser());
app.use('/api/auth', rateLimit({windowMs:15*60*1000, max:30, standardHeaders:true, legacyHeaders:false}));
app.use(express.static(path.join(__dirname, 'public')));

const db = new Database(process.env.DB_FILE || path.join(__dirname,'pareekshasetu.sqlite'));
db.pragma('journal_mode = WAL');
db.exec(`
CREATE TABLE IF NOT EXISTS candidates (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 candidate_id TEXT UNIQUE NOT NULL,
 name TEXT NOT NULL,
 mobile TEXT UNIQUE NOT NULL,
 dob TEXT NOT NULL,
 password_hash TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`);

const twilioConfigured = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_VERIFY_SERVICE_SID;
const twilioClient = twilioConfigured ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN) : null;
const otpMemory = new Map(); // Development-only OTP storage. Use Twilio Verify in production.

function validMobile(m){ return /^[6-9]\d{9}$/.test(String(m||'')); }
function issueToken(user,res){
 const token=jwt.sign({sub:user.id,candidateId:user.candidate_id},JWT_SECRET,{expiresIn:'8h'});
 res.cookie('ps_session',token,{httpOnly:true,secure:IS_PROD,sameSite:'strict',maxAge:8*60*60*1000,path:'/'});
}
function publicUser(row){return {candidateId:row.candidate_id,name:row.name,mobile:row.mobile,dob:row.dob};}
function requireAuth(req,res,next){
 try{
  const token=req.cookies.ps_session;
  if(!token) return res.status(401).json({message:'कृपया आधी Login करा.'});
  req.auth=jwt.verify(token,JWT_SECRET); next();
 }catch(_){return res.status(401).json({message:'Session संपले आहे. पुन्हा Login करा.'});}
}

app.post('/api/auth/register', async (req,res)=>{
 try{
  const {name,mobile,dob,password}=req.body||{};
  if(!name || String(name).trim().length<2 || String(name).length>100) return res.status(400).json({message:'कृपया योग्य पूर्ण नाव भरा.'});
  if(!validMobile(mobile)) return res.status(400).json({message:'10 अंकी वैध भारतीय मोबाइल नंबर भरा.'});
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(dob||'')) || new Date(dob)>=new Date()) return res.status(400).json({message:'योग्य जन्मतारीख निवडा.'});
  if(typeof password!=='string' || password.length<8 || password.length>72) return res.status(400).json({message:'Password किमान 8 आणि कमाल 72 अक्षरांचा असावा.'});
  const passwordHash=await bcrypt.hash(password,12);
  const candidateId='PS'+new Date().getFullYear()+String(Date.now()).slice(-6);
  const info=db.prepare('INSERT INTO candidates(candidate_id,name,mobile,dob,password_hash) VALUES(?,?,?,?,?)')
    .run(candidateId,String(name).trim(),String(mobile),String(dob),passwordHash);
  const row=db.prepare('SELECT * FROM candidates WHERE id=?').get(info.lastInsertRowid);
  issueToken(row,res); return res.status(201).json({message:'नोंदणी यशस्वी.',user:publicUser(row)});
 }catch(err){
  if(String(err.code)==='SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({message:'हा मोबाइल नंबर आधीच नोंदणीकृत आहे.'});
  console.error(err); return res.status(500).json({message:'नोंदणी करताना सर्व्हर त्रुटी आली.'});
 }
});

app.post('/api/auth/login', async (req,res)=>{
 const {mobile,password}=req.body||{};
 if(!validMobile(mobile) || typeof password!=='string') return res.status(400).json({message:'मोबाइल नंबर आणि Password तपासा.'});
 const row=db.prepare('SELECT * FROM candidates WHERE mobile=?').get(String(mobile));
 if(!row || !(await bcrypt.compare(password,row.password_hash))) return res.status(401).json({message:'मोबाइल नंबर किंवा Password चुकीचा आहे.'});
 issueToken(row,res); return res.json({message:'Login यशस्वी.',user:publicUser(row)});
});

app.post('/api/auth/otp/request', async (req,res)=>{
 const {mobile}=req.body||{};
 if(!validMobile(mobile)) return res.status(400).json({message:'वैध 10 अंकी मोबाइल नंबर भरा.'});
 const row=db.prepare('SELECT id FROM candidates WHERE mobile=?').get(String(mobile));
 if(!row) return res.status(404).json({message:'हा मोबाइल नंबर नोंदणीकृत नाही.'});
 try{
  if(twilioClient){
   await twilioClient.verify.v2.services(process.env.TWILIO_VERIFY_SERVICE_SID).verifications.create({to:'+91'+mobile,channel:'sms'});
   return res.json({message:'OTP SMS द्वारे पाठवला आहे. तो 5 मिनिटांत वापरा.'});
  }
  if(!DEMO_OTP) return res.status(503).json({message:'SMS OTP सेवा configure केलेली नाही. कृपया Password Login वापरा.'});
  const code=String(Math.floor(100000+Math.random()*900000));
  otpMemory.set(String(mobile),{code,expires:Date.now()+5*60*1000,attempts:0});
  console.log(`[DEVELOPMENT ONLY] OTP for ${mobile}: ${code}`);
  return res.json({message:'Development mode: OTP server terminal/console मध्ये छापला आहे. हा खरा SMS नाही.'});
 }catch(err){console.error(err);return res.status(502).json({message:'OTP पाठवता आला नाही. पुन्हा प्रयत्न करा.'});}
});

app.post('/api/auth/otp/verify', async (req,res)=>{
 const {mobile,otp}=req.body||{};
 if(!validMobile(mobile) || !/^\d{6}$/.test(String(otp||''))) return res.status(400).json({message:'मोबाइल नंबर किंवा 6 अंकी OTP तपासा.'});
 try{
  let approved=false;
  if(twilioClient){
   const check=await twilioClient.verify.v2.services(process.env.TWILIO_VERIFY_SERVICE_SID).verificationChecks.create({to:'+91'+mobile,code:String(otp)});
   approved=check.status==='approved';
  }else if(DEMO_OTP){
   const saved=otpMemory.get(String(mobile));
   if(saved && Date.now()<saved.expires && saved.attempts<5 && saved.code===String(otp)){approved=true;otpMemory.delete(String(mobile));}
   else if(saved){saved.attempts++; if(saved.attempts>=5 || Date.now()>=saved.expires)otpMemory.delete(String(mobile));}
  }
  if(!approved) return res.status(401).json({message:'OTP चुकीचा किंवा कालबाह्य झाला आहे.'});
  const row=db.prepare('SELECT * FROM candidates WHERE mobile=?').get(String(mobile));
  if(!row) return res.status(404).json({message:'उमेदवार खाते सापडले नाही.'});
  issueToken(row,res); return res.json({message:'OTP पडताळणी यशस्वी.',user:publicUser(row)});
 }catch(err){console.error(err);return res.status(502).json({message:'OTP पडताळणी सेवा उपलब्ध नाही.'});}
});

app.get('/api/auth/me',requireAuth,(req,res)=>{
 const row=db.prepare('SELECT * FROM candidates WHERE id=?').get(req.auth.sub);
 if(!row) return res.status(401).json({message:'खाते सापडले नाही.'});
 res.json({user:publicUser(row)});
});
app.post('/api/auth/logout',(req,res)=>{res.clearCookie('ps_session',{httpOnly:true,secure:IS_PROD,sameSite:'strict',path:'/'});res.json({message:'Logout झाले.'});});

app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));
app.listen(PORT,()=>console.log(`PareekshaSetu server running at http://localhost:${PORT}`));
