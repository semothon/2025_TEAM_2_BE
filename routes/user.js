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

//회원 정보 조회 API
router.get('/profile', async (req, res) => {

  const token = req.headers['authorization'];

  if (!token) {
    return res.status(401).json({ message: '인증 토큰이 없습니다.' });
  }

  try {
    
    const decoded = jwt.verify(token.split(' ')[1], process.env.JWT_SECRET);
    const userId = decoded.userId; 

    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
  
    if (!user) {
      return res.status(404).json({ message: '존재하지 않는 회원입니다.' });
    }

    return res.status(200).json({
      message: '사용자 정보 조회 성공',
      user: {
        icon: user.icon,
        nickname: user.nickname,
        username: user.username,
        school: user.school,
        nickname: user.nickname,
        gender : user.gender,
        likeCount: user.likedBy_list ? user.likedBy_list.length : 0
      },
    });
  } catch (error) {
    console.error('사용자 조회 오류:', error);
    res.status(500).json({ message: '서버 오류 발생' });
  }
});

//query 로 profile 정보를 받아올 유저 id 전달
router.get('/profile/detail', async (req, res) => {

  const { userId } = req.query; 

  if (!userId) {
    return res.status(400).json({ message: '그룹 ID가 제공되지 않았습니다.' });
}

  try {

    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
  
    if (!user) {
      return res.status(404).json({ message: '존재하지 않는 회원입니다.' });
    }

    return res.status(200).json({
      message: '사용자 정보 조회 성공',
      user: {
        userId: user._id,
        icon: user.icon,
        nickname: user.nickname,
        username: user.username,
        school: user.school,
        nickname: user.nickname,
        gender : user.gender,
        likeCount: user.likedBy_list ? user.likedBy_list.length : 0
        
      },
    });
  } catch (error) {
    console.error('사용자 조회 오류:', error);
    res.status(500).json({ message: '서버 오류 발생' });
  }
});

//회원 탈퇴 API
router.delete('/delete', async (req, res) => {
    
    const token = req.headers['authorization'];
  
    if (!token) {
      return res.status(401).json({ message: '인증 토큰이 없습니다.' });
    }
  
    try {
      
      const decoded = jwt.verify(token.split(' ')[1], process.env.JWT_SECRET);
      const userId = decoded.userId; 
  
      const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
      
      if (!user) {
        return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
      }
  
      const email = user.email;
  
      
      const response = await axios.post('https://univcert.com/api/v1/clear', {
        key: process.env.UNIAPI_KEY, 
        email: email,
      });
  
      if (!response.data.success) {
        return res.status(400).json({ message: '외부 인증 API에서 이메일 삭제 실패' });
      }
  
      
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
  
//회원 정보 업데이트 API
router.patch('/update', async (req, res) => {
  const token = req.headers['authorization'];

  if (!token) {
    return res.status(401).json({ message: '인증 토큰이 제공되지 않았습니다.' });
  }

  try {
    
    const decoded = jwt.verify(token.split(' ')[1], process.env.JWT_SECRET);
    const userId = decoded.userId; 

    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });

    if (!user) {
      return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
    }

    
    const { nickname, username, icon, major, studentId } = req.body;

    const updateFields = {};

    
    if (nickname) updateFields.nickname = nickname;
    if (username) updateFields.username = username;
    if (icon !== undefined) updateFields.icon = icon;
    if (studentId) updateFields["school.1"] = studentId; 
    if (major) updateFields["school.2"] = major;

    
    await db.collection('users').updateOne(
      { _id: new ObjectId(userId) },
      { $set: updateFields }
    );

    return res.status(200).json({
      message: '사용자 정보가 성공적으로 업데이트되었습니다.',
    });
  } catch (error) {
    console.error('정보 수정 오류:', error);
    res.status(500).json({ message: '서버 오류 발생' });
  }
});

//좋아요 api
router.post('/like', async (req, res) => {
  const token = req.headers['authorization'];
  if (!token) {
    return res.status(401).json({ message: '인증 토큰이 없습니다.' });
  }

  try {
    const decoded = jwt.verify(token.split(' ')[1], process.env.JWT_SECRET);
    const userId = decoded.userId.toString();
    const { targetUserId } = req.body; // 요청 body에서 문자열로 받음

    if (!targetUserId) {
      return res.status(400).json({ message: '대상 사용자 ID가 없습니다.' });
    }

    if (userId === targetUserId) {
      return res.status(400).json({ message: '자기 자신을 좋아요할 수 없습니다.' });
    }

    if (!ObjectId.isValid(targetUserId)) {
      return res.status(400).json({ message: '올바르지 않은 사용자 ID입니다.' });
    }

    const targetUser = await db.collection('users').findOne({ _id: new ObjectId(targetUserId) });
    if (!targetUser) {
      return res.status(404).json({ message: '대상 사용자를 찾을 수 없습니다.' });
    }

    const alreadyLiked = (targetUser.likedBy_list || []).includes(userId);

   if (alreadyLiked) {
      // 좋아요 취소
      await db.collection('users').updateOne(
        { _id: new ObjectId(targetUserId) },
        {
          $pull: { likedBy_list: userId },
        }
      );

      // mylike_list에서 targetUserId를 제거
      await db.collection('users').updateOne(
        { _id: new ObjectId(userId) },
        {
          $pull: { mylike_list: targetUserId },
        }
      );

      return res.status(200).json({ message: '좋아요를 취소했습니다.' });
    } else {
      // 좋아요 추가
      await db.collection('users').updateOne(
        { _id: new ObjectId(targetUserId) },
        {
          $addToSet: { likedBy_list: userId },
        }
      );

      // mylike_list에 targetUserId 추가
      await db.collection('users').updateOne(
        { _id: new ObjectId(userId) },
        {
          $addToSet: { mylike_list: targetUserId },
        }
      );

      return res.status(200).json({ message: '좋아요를 추가했습니다.' });
    }
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: '토큰이 만료되었습니다. 다시 로그인 해주세요.' });
    }
    console.error('좋아요 처리 오류:', error);
    res.status(500).json({ message: '서버 오류 발생' });
  }
});

// 사용자 차단 / 차단 해제 API
router.post('/block', async (req, res) => {
  const token = req.headers['authorization'];
  if (!token) {
    return res.status(401).json({ message: '인증 토큰이 없습니다.' });
  }

  try {
    const decoded = jwt.verify(token.split(' ')[1], process.env.JWT_SECRET);
    const userId = decoded.userId;

    const { targetUserId } = req.body; // 요청 body에서 받도록 변경

    if (!targetUserId) {
      return res.status(400).json({ message: '대상 사용자 ID가 없습니다.' });
    }

    if (userId === targetUserId) {
      return res.status(400).json({ message: '자기 자신은 차단할 수 없습니다.' });
    }

    if (!ObjectId.isValid(targetUserId)) {
      return res.status(400).json({ message: '올바르지 않은 사용자 ID입니다.' });
    }

    const me = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    if (!me) {
      return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
    }

    const alreadyBlocked = me.block_list?.includes(targetUserId);

    if (alreadyBlocked) {
      // 차단 해제
      await db.collection('users').updateOne(
        { _id: new ObjectId(userId) },
        { $pull: { block_list: targetUserId } }
      );
      return res.status(200).json({ message: '차단을 해제했습니다.' });
    } else {
      // 차단 추가
      await db.collection('users').updateOne(
        { _id: new ObjectId(userId) },
        { $addToSet: { block_list: targetUserId } }
      );
      return res.status(200).json({ message: '사용자를 차단했습니다.' });
    }
  } catch (error) {
    console.error('차단 처리 오류:', error);
    res.status(500).json({ message: '서버 오류 발생' });
  }
});

module.exports = router
