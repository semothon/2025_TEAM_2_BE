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
  console.log('group DB연결성공')
}).catch((err)=>{
  console.log(err)
}) 

// DB에 존재하는 그룹 목록 GET
router.get('/get', async (req, res) => {
    try {
      const groups = await db.collection('groups').find({ }).toArray();
      return res.status(200).json({
        message: '그룹 목록을 성공적으로 가져왔습니다.',
        groups: groups.map(group => ({
          groupId: group._id,
          title: group.title,
          note: group.note,
          foodCategory: group.foodCategory,
          maxPeople: group.maxPeople,
          together: group.together,
          sameGender: group.sameGender,
          hashtags: group.hashtags,
          location: group.location,
          members: group.members,
          status: group.status,
          creator: group.creator
          
    
        })),
      });
    } catch (error) {
      console.error('그룹 목록 조회 오류:', error);
      res.status(500).json({ message: '서버 오류 발생' });
    }
  });
// 그룹 개설 API
router.post('/create', async (req, res) => {
    const token = req.headers['authorization'];

    if (!token) {
        return res.status(401).json({ message: '인증 토큰이 제공되지 않았습니다.' });
    }

    try {
        
        const decoded = jwt.verify(token.split(' ')[1], process.env.JWT_SECRET);
        const userId = decoded.userId; 
  
        
        const { title, note, foodCategory, maxPeople, together, sameGender, hashtags, location } = req.body;
  
        
        if (!title || !foodCategory || !maxPeople || together === undefined || sameGender === undefined || !location) {
            return res.status(400).json({ message: '모든 필드를 입력해 주세요.' });
        }

        const finalNote = note || "상세 설명이 존재하지 않습니다";
        const finalHashtags = hashtags || [];

        // 첫 번째 멤버는 방 생성자
        const members = [userId]; 
        // 방 상태는 초기에 개설자 한명뿐이니까 true로 둠
        const status = true;
        
        
        const newGroup = {
            title,
            note: finalNote,  
            foodCategory,
            maxPeople,
            together,
            sameGender,
            hashtags: finalHashtags,  
            members,  
            location,
            status, // 방 현재 상태 => maxPeople 수가 되면 false로 변경해서 더이상 못들어오게함
            creator: new ObjectId(userId), // 그룹 생성자의 userId 저장
            createdAt: new Date(),
        };

        
        const result = await db.collection('groups').insertOne(newGroup);

        
        return res.status(201).json({
            message: '그룹이 성공적으로 생성되었습니다.',
            groupId: result.insertedId,
        });
    } catch (error) {
        console.error('그룹 개설 오류:', error);
        res.status(500).json({ message: '서버 오류 발생' });
    }
});

// 그룹 업데이트 API
// hashtags 관련해서 토의해보고 수정하자 
// 예시) hashtags = [ { "한식" : true}, { "일식" : false}, {"따로먹을래요" : true} ] 같은 형식으로 하는게 나을지 ,, 
router.patch('/update', async (req, res) => {
    const token = req.headers['authorization'];
  
    if (!token) {
      return res.status(401).json({ message: '인증 토큰이 제공되지 않았습니다.' });
    }
  
    const { groupId, title, note, foodCategory, maxPeople, sameGender, location, hashtags, together } = req.body;
  
    if (!groupId) {
      return res.status(400).json({ message: '그룹 ID가 제공되지 않았습니다.' });
    }
  
    // 최소 하나의 수정 필드가 있어야 함
    if (!title && !note && !foodCategory && !maxPeople && sameGender === undefined && !location && !hashtags && together === undefined) {
      return res.status(400).json({ message: '수정할 필드를 최소 하나는 입력해주세요.' });
    }
  
    try {
      
      const group = await db.collection('groups').findOne({ _id: new ObjectId(groupId) });
  
      if (!group) {
        return res.status(404).json({ message: '그룹을 찾을 수 없습니다.' });
      }
  
      
      const decoded = jwt.verify(token.split(' ')[1], process.env.JWT_SECRET);
      const userId = decoded.userId;
  
      if (group.creator.toString() !== userId) {
        return res.status(403).json({ message: '수정 권한이 없습니다.' });
      }
  
      
      const updateFields = {};
  
      if (title) updateFields.title = title;
      if (note) updateFields.note = note;
      if (foodCategory) updateFields.foodCategory = foodCategory;
      if (maxPeople) updateFields.maxPeople = maxPeople;
      if (location) updateFields.location = location;
      if (together !== undefined) updateFields.together = together;
      if (sameGender !== undefined) updateFields.sameGender = sameGender;
      //   if (hashtags) updateFields.hashtags = hashtags; 
  
      // 그룹 정보 업데이트
      await db.collection('groups').updateOne(
        { _id: new ObjectId(groupId) },
        { $set: updateFields }
      );
  
      return res.status(200).json({ message: '그룹 정보가 성공적으로 업데이트되었습니다.' });
    } catch (error) {
      console.error('그룹 정보 수정 오류:', error);
      res.status(500).json({ message: '서버 오류 발생' });
    }
  });


// 그룹 삭제 API
router.delete('/delete', async (req, res) => {
    const token = req.headers['authorization'];
  
    if (!token) {
      return res.status(401).json({ message: '인증 토큰이 제공되지 않았습니다.' });
    }
  
    const { groupId } = req.body; 
  
    if (!groupId) {
      return res.status(400).json({ message: '그룹 ID가 제공되지 않았습니다.' });
    }
  
    try {
      
      const decoded = jwt.verify(token.split(' ')[1], process.env.JWT_SECRET);
      const userId = decoded.userId; 
  
   
      const group = await db.collection('groups').findOne({ _id: new ObjectId(groupId) });
  
      if (!group) {
        return res.status(404).json({ message: '그룹을 찾을 수 없습니다.' });
      }
  
    
      if (group.creator.toString() !== userId) {
        return res.status(403).json({ message: '삭제 권한이 없습니다.' });
      }
  
     
      const result = await db.collection('groups').deleteOne({ _id: new ObjectId(groupId) });
  
      if (result.deletedCount === 1) {
        return res.status(200).json({ message: '그룹이 성공적으로 삭제되었습니다.' });
      } else {
        return res.status(400).json({ message: '그룹 삭제 중 오류가 발생했습니다.' });
      }
  
    } catch (error) {
      console.error('그룹 삭제 오류:', error);
      res.status(500).json({ message: '서버 오류 발생' });
    }
  });
module.exports = router 