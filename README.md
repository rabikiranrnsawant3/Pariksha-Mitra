# PareekshaSetu — Backend Authentication Starter

या प्रोजेक्टमध्ये तुमची मूळ PareekshaSetu वेबसाइट ठेवून Candidate Portal साठी backend authentication जोडले आहे.

## समाविष्ट सुविधा
- नवीन उमेदवार नोंदणी: नाव, मोबाइल नंबर, जन्मतारीख, Password
- मोबाइल नंबर + Password Login
- मोबाइल नंबर + OTP Login
- httpOnly session cookie आणि logout
- SQLite database; Password plain text मध्ये न ठेवता bcrypt hash
- OTP/API routes वर rate limit
- Development OTP mode आणि Twilio Verify द्वारे खरा SMS OTP जोडण्याची तयारी

## Windows वर चालवण्याची पद्धत
1. Node.js 20 किंवा नवीन आवृत्ती install करा.
2. हा ZIP extract करा.
3. त्या folder मध्ये Command Prompt उघडा.
4. `npm install` चालवा.
5. `.env.example` ची copy करून `.env` नाव द्या.
6. `.env` मधील `JWT_SECRET` ला किमान 32 अक्षरांचा random secret द्या.
7. सुरुवातीच्या चाचणीसाठी `DEMO_OTP=true` ठेवा.
8. `npm start` चालवा.
9. Browser मध्ये `http://localhost:3000` उघडा.

## Development OTP
`DEMO_OTP=true` असताना OTP SMS होत नाही. OTP server terminal/console मध्ये दिसेल. हा फक्त local testing साठी आहे. Production मध्ये `DEMO_OTP=false` करा आणि Twilio Verify चे credentials `.env` मध्ये भरा.

## GitHub Pages बद्दल महत्त्वाचे
फक्त GitHub Pages वर HTML चालते; हा Node.js backend तिथे चालत नाही. त्यामुळे ही पूर्ण आवृत्ती GitHub Pages वर deploy करून Login चालणार नाही. Backend चालवण्यासाठी Node.js hosting आवश्यक आहे (उदा. Render/Railway/Fly.io किंवा स्वतःचा server) आणि SQLite ऐवजी production database/backup strategy वापरणे योग्य राहील. Frontend आणि backend एकाच origin वर host करा किंवा CORS + cookie configuration नीट सेट करा.

## Production पूर्वी आवश्यक
- HTTPS अनिवार्य
- `DEMO_OTP=false`
- Twilio Verify किंवा अधिकृत SMS OTP सेवा configure करणे
- मजबूत JWT_SECRET; `.env` GitHub वर कधीही upload करू नका
- Database backup, monitoring, audit logs, account recovery आणि security testing
- Aadhaar नंबर या demo authentication मध्ये घेतलेला नाही. Aadhaar verification साठी स्वतंत्र अधिकृत आणि कायदेशीर compliant integration आवश्यक आहे.

ही starter implementation आहे; प्रत्यक्ष सरकारी/मोठ्या परीक्षांसाठी security audit आणि deployment review आवश्यक आहे.
