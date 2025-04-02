const router = require('express').Router();
const { ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
let connectDB = require('./../database.js');
require('dotenv').config();

let db;
connectDB.then((client) => {
  db = client.db('triangle');
  console.log('chat DB연결성공');
}).catch((err) => {
  console.log(err);
});

// 특정 그룹의 채팅 내역 조회
router.get('/history/:groupId', async (req, res) => {
    const { groupId } = req.params;
  
    try {
      // groupId로 해당 그룹의 채팅 내역 조회
      const chats = await db.collection('chats').find({ groupId: new ObjectId(groupId) }).toArray();
  
      if (!chats) {
        return res.status(404).json({ message: '채팅 내역이 없습니다.' });
      }
  
      return res.status(200).json({
        message: '채팅 내역을 성공적으로 가져왔습니다.',
        chats: chats.map((chat) => ({
          messageId: chat._id,
          senderId: chat.senderId,
          message: chat.message,
          timestamp: chat.timestamp,
        })),
      });
    } catch (error) {
      console.error('채팅 내역 조회 오류:', error);
      res.status(500).json({ message: '서버 오류 발생' });
    }
  });
  
  // 채팅 메시지 보내기
  router.post('/send', async (req, res) => {
    const token = req.headers['authorization'];
    const { groupId, message } = req.body;
  
    if (!token) {
        return res.status(400).json({ message: '인증 토큰이 제공되지 않았습니다.' });
      }
    
    if (!groupId) {
    return res.status(400).json({ message: '그룹 ID가 제공되지 않았습니다.' });
    }

    if (!message) {
    return res.status(400).json({ message: '메시지가 제공되지 않았습니다.' });
    }

    try {
      const decoded = jwt.verify(token.split(' ')[1], process.env.JWT_SECRET);
      const senderId = decoded.userId;

      const group = await db.collection('groups').findOne({ _id: new ObjectId(groupId) });
        if (!group) {
            return res.status(404).json({ message: '그룹을 찾을 수 없습니다.' });
        }
        // 그룹 상태가 2일 경우 자동으로 "거래 완료" 메시지를 보내고 더 이상 메시지를 받지 않도록 설정
        if (group.status === 2) {
            return res.status(400).json({ message: '거래가 완료되었습니다. 더 이상 메시지를 보낼 수 없습니다.' });
        }


    // 그룹의 멤버 확인
        if (!group.members.includes(senderId)) {
            return res.status(403).json({ message: '그룹의 멤버가 아니어서 메시지를 보낼 수 없습니다.' });
        }
  
      // 메시지 저장
      const newChat = {
        groupId: new ObjectId(groupId),
        senderId: new ObjectId(senderId),
        message,
        timestamp: new Date(),
      };
  
      const result = await db.collection('chats').insertOne(newChat);
  
      // 채팅방에 메시지 전달
      io.to(groupId).emit('receiveMessage', newChat);
  
      return res.status(200).json({
        message: '메시지가 성공적으로 전송되었습니다.',
        chatId: result.insertedId,
      });
    } catch (error) {
      console.error('메시지 전송 오류:', error);
      res.status(500).json({ message: '서버 오류 발생' });
    }
  });
  
  module.exports = router;