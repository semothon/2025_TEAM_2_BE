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


// 채팅 내역 조회
router.get('/history', async (req, res) => {
    const { groupId } = req.query;
  
    try {
        
        if (!ObjectId.isValid(groupId)) {
            return res.status(400).json({ message: '잘못된 그룹 ID입니다. query' });
        }

        
        const chats = await db.collection('chats').find({ groupId: new ObjectId(groupId) }).toArray();
  
        if (!chats || chats.length === 0) {
            return res.status(404).json({ message: '채팅 내역이 없습니다.' });
        }

        
        const chatsWithSenderInfo = await Promise.all(chats.map(async (chat) => {
            
            if (!ObjectId.isValid(chat.senderId)) {
                return {
                    messageId: chat._id,
                    senderInfo: null, 
                    message: chat.message,
                    timestamp: chat.timestamp,
                };
            }

            
            const sender = await db.collection('users').findOne({ _id: new ObjectId(chat.senderId) });

            if (!sender) {
                return {
                    messageId: chat._id,
                    senderInfo: null,  
                    message: chat.message,
                    timestamp: chat.timestamp,
                };
            }

            
            const senderInfo = {
                userId: sender._id,
                nickname: sender.nickname,
                icon: sender.icon,
            };

            return {
                messageId: chat._id,
                senderInfo: senderInfo,
                message: chat.message,
                timestamp: chat.timestamp,
            };
        }));

        return res.status(200).json({
            message: '채팅 내역을 성공적으로 가져왔습니다.',
            chats: chatsWithSenderInfo,
        });
    } catch (error) {
        console.error('채팅 내역 조회 오류:', error);
        res.status(500).json({ message: '서버 오류 발생' });
    }
});

// 채팅방 생성
router.post('/create', async (req, res) => {
  const token = req.headers['authorization'];
  const { targetUserId } = req.body;

  if (!token) {
    return res.status(401).json({ message: '인증 토큰이 없습니다.' });
  }

  if (!targetUserId) {
    return res.status(400).json({ message: '대상 사용자 ID가 없습니다.' });
  }

  try {
      const decoded = jwt.verify(token.split(' ')[1], process.env.JWT_SECRET);
      const userId = decoded.userId.toString();

      if (userId === targetUserId) {
          return res.status(400).json({ message: '자기 자신과 채팅할 수 없습니다.' });
      }

      
      const targetUser = await db.collection('users').findOne({ _id: new ObjectId(targetUserId) });
      if (!targetUser) {
          return res.status(404).json({ message: '대상 사용자를 찾을 수 없습니다.' });
      }

      
      const existingRoom = await db.collection('chattingRoom').findOne({
          $or: [
              { $and: [{ userId }, { targetUserId }] },
              { $and: [{ userId: targetUserId }, { targetUserId: userId }] },
          ],
      });

      if (existingRoom) {
          return res.status(200).json({ message: '이미 존재하는 채팅방입니다.', roomId: existingRoom._id });
      }

      
      const newRoom = {
          userId,
          targetUserId,
          createdAt: new Date(),
      };

      const result = await db.collection('chattingRoom').insertOne(newRoom);

      
      io.to(result.insertedId.toString()).emit('newChatRoom', { roomId: result.insertedId });

      return res.status(201).json({ message: '새로운 채팅방이 생성되었습니다.', roomId: result.insertedId });
  } catch (error) {
      console.error('채팅방 생성 오류:', error);
      res.status(500).json({ message: '서버 오류 발생' });
  }
});

  
// 그룹 채팅 send
router.post('/send/groupRoom', async (req, res) => {
  console.log("요청은옴")
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


  
      if (!group.members.includes(senderId)) {
          return res.status(403).json({ message: '그룹의 멤버가 아니어서 메시지를 보낼 수 없습니다.' });
      }

    
    const newChat = {
      groupId: new ObjectId(groupId),
      senderId: new ObjectId(senderId),
      message,
      timestamp: new Date(),
    };

    const result = await db.collection('chats').insertOne(newChat);

    
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
// 개인 채팅 send
router.post('/send/userRoom', async (req, res) => {
  const token = req.headers['authorization'];
  const { roomId, message } = req.body;

  if (!token) {
    return res.status(400).json({ message: '인증 토큰이 제공되지 않았습니다.' });
  }

  if (!roomId || !message) {
    return res.status(400).json({ message: '채팅방 ID와 메시지가 제공되지 않았습니다.' });
  }

  try {
    const decoded = jwt.verify(token.split(' ')[1], process.env.JWT_SECRET);
    const senderId = decoded.userId;

    // 채팅방이 존재하는지 확인
    const room = await db.collection('chattingRoom').findOne({ _id: new ObjectId(roomId) });
    if (!room) {
      return res.status(404).json({ message: '존재하지 않는 채팅방입니다.' });
    }

    // 유저가 해당 채팅방에 참여하는지 확인
    if (![room.userId, room.targetUserId].includes(senderId)) {
      return res.status(403).json({ message: '이 채팅방에 참여할 수 없는 사용자입니다.' });
    }

    // 메시지 저장
    const newChat = {
      roomId: new ObjectId(roomId),
      senderId: new ObjectId(senderId),
      message,
      timestamp: new Date(),
    };

    const result = await db.collection('chats').insertOne(newChat);

    // 해당 방에 메시지 전송
    io.to(roomId).emit('receiveMessage', newChat);

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