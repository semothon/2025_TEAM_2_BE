const router = require('express').Router()
const bcrypt = require('bcrypt');
const { ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken'); 
const axios = require('axios'); 
let connectDB = require('./../database.js')
require('dotenv').config();

let db
connectDB.then((client)=>{
  db = client.db('triangle')
  console.log('user DB연결성공')
}).catch((err)=>{
  console.log(err)
}) 


router.get('/',(req,res)=>{
   res.send("흠 user 라우트 문제 ㄴㄴ")
})
router.post('/',(req,res)=>{
   
   console.log('흠 user 라우트 문제 ㄴㄴ')
})



//계정 삭제 API (JWT ver)
router.delete('/delete', async (req, res) => {
    // Authorization 헤더에서 JWT 토큰을 가져오기
    const token = req.headers['authorization'];
  
    if (!token) {
      return res.status(401).json({ message: '인증 토큰이 없습니다.' });
    }
  
    try {
      // JWT 토큰에서 사용자 정보 추출
      const decoded = jwt.verify(token.split(' ')[1], process.env.JWT_SECRET);
      const userId = decoded.userId; // JWT에서 userId 추출
  
      const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
      
      if (!user) {
        return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
      }
  
      const email = user.email;
  
      // 외부 인증 API에 이메일 삭제 요청
      const response = await axios.post('https://univcert.com/api/v1/clear', {
        key: process.env.UNIAPI_KEY, 
        email: email,
      });
  
      if (!response.data.success) {
        return res.status(400).json({ message: '외부 인증 API에서 이메일 삭제 실패' });
      }
  
      // 해당 사용자 삭제 (DB)
      const result = await db.collection('users').deleteOne({ _id: new ObjectId(userId) });
  
      // 삭제 여부 확인
      if (result.deletedCount === 1) {
        return res.status(200).json({ message: '사용자가 성공적으로 삭제되었습니다.' });
      } else {
        return res.status(400).json({ message: '사용자 삭제 중 오류가 발생했습니다.' });
      }
    } catch (error) {
      console.error('계정 삭제 오류:', error);
      res.status(500).json({ message: '서버 오류 발생' });
    }
  });
  


module.exports = router 